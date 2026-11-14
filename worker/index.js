/**
 * Dungeons and Tasks — servidor na Cloudflare.
 *
 * O site (public/index.html) é servido como arquivo estático. Os pedidos para /api/<função>
 * chegam aqui. Cada sala da guilda vive num Durable Object próprio (um "quartinho" com banco
 * SQLite só dela), endereçado pelo código de 6 letras. Como cada quartinho atende um pedido por
 * vez, gravações simultâneas de aparelhos diferentes nunca se atropelam.
 *
 * As funções e respostas são as mesmas do servidor antigo no Google Apps Script (gas/Code.gs),
 * então o aplicativo usa o mesmo código para os dois.
 */
import { DurableObject } from 'cloudflare:workers';

const MAX_DOC = 60000;          // limite de segurança por documento (caracteres de JSON)
const MAX_BODY = 250000;        // limite do corpo de cada pedido
const CODE_RE = /^[A-Z0-9]{6}$/;
const PATH_RE = /^rooms\/([A-Z0-9]{6})\/((heroes|board|rewards|chores|inbox|activity|requests)\/[A-Za-z0-9_-]{1,40}|party\/main)$/;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const code = (c) => { const s = String(c || '').toUpperCase(); if (!CODE_RE.test(s)) throw new Error('código de sala inválido'); return s; };
const split = (path) => { const m = PATH_RE.exec(String(path)); if (!m) throw new Error('caminho inválido'); return [m[1], m[2]]; };
const MAX_SLOTS = 6, MIN_SLOTS = 1;
const slotsOf = (v) => Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, Math.round(Number(v) || 5)));
// campos de configuração da sala que só o organizador (criador ou co-criador) pode mudar
const CFG_FIELDS = ['creatorId', 'coCreators', 'pin', 'xpCap', 'mvpGold', 'allowImport', 'approval', 'diffMul', 'slots', 'name', 'perms'];
// quem pode criar missões do quadro e recompensas (o padrão repete o que o app faz sem configuração)
const PERM_DEF = { tasks: 'all', rewards: 'org' };
const sized = (data) => { if (JSON.stringify(data ?? null).length > MAX_DOC) throw new Error('documento grande demais (too_large)'); return data; };

/** Uma sala da guilda: guarda meta, revisão e os documentos (heroes/…, party/main, board/…). */
export class Room extends DurableObject {
  async rev() { return (await this.ctx.storage.get('rev')) || 0; }
  async bump() { const r = (await this.rev()) + 1; await this.ctx.storage.put('rev', r); return r; }
  async docs() {
    const out = {};
    for (const [k, v] of await this.ctx.storage.list({ prefix: 'd:' })) out[k.slice(2)] = v;
    return out;
  }
  async out(room, extra) { return Object.assign({ room, rev: await this.rev(), meta: await this.meta(), docs: await this.docs() }, extra || {}); }

  async meta() { return (await this.ctx.storage.get('meta')) || null; }
  async create(room, meta, party, acct) {
    if (await this.ctx.storage.get('meta')) return { ok: false };
    meta = Object.assign({}, meta, { slots: slotsOf(meta && meta.slots), name: String((meta && meta.name) || 'Minha guilda').slice(0, 40), owner: acct || null });
    await this.ctx.storage.put({ meta, 'd:party/main': party });
    await this.bump();
    return { ok: true };
  }
  async get(room, clientRev) {
    const r = await this.rev();
    if (clientRev === r && r > 0) return { room, rev: r };
    return { room, rev: r, meta: await this.meta(), docs: await this.docs() };
  }
  /** Um único herói (para importar para outra sala). */
  async hero(id) { return (await this.ctx.storage.get('d:heroes/' + id)) || null; }
  /** O organizador é quem joga com o criador da sala ou com um co-criador (ou quem criou a sala, antes do 1º herói). */
  async isOrg(acct) {
    if (!acct) return false;
    const party = (await this.ctx.storage.get('d:party/main')) || {};
    const ids = [party.creatorId].concat(party.coCreators || []).filter(Boolean);
    if (!ids.length) { const m = await this.meta(); return !m || !m.owner || m.owner === acct; }
    for (const id of ids) { const h = await this.ctx.storage.get('d:heroes/' + id); if (h && h.owner === acct) return true; }
    return false;
  }
  async set(room, rel, data, acct) {
    const meta = await this.meta(); if (!meta) throw new Error('sala não existe');
    const prev = await this.ctx.storage.get('d:' + rel);
    if (rel.startsWith('heroes/')) {
      if (prev && prev.owner && prev.owner !== acct && !(await this.isOrg(acct))) throw new Error('Esse personagem é de outra pessoa.');
      if (!prev) {
        const n = [...(await this.ctx.storage.list({ prefix: 'd:heroes/' })).keys()].length;
        if (n >= slotsOf(meta.slots)) throw new Error('A sala está cheia.');
      }
      // o dono nunca muda por escrita de outra pessoa; um herói sem dono só passa a ter dono quando o próprio jogador o assume
      data.owner = prev ? (prev.owner || (data.owner === acct ? acct : null)) : acct;
    } else if (!prev && (rel.startsWith('board/') || rel.startsWith('rewards/'))) {
      const k = rel.startsWith('board/') ? 'tasks' : 'rewards';
      const party = (await this.ctx.storage.get('d:party/main')) || {};
      const c = Object.assign({ mode: PERM_DEF[k], heroes: [] }, (party.perms || {})[k] || {});
      if (c.mode !== 'all' && !(await this.isOrg(acct))) {
        let ok = false;
        if (c.mode === 'some') for (const id of c.heroes || []) { const h = await this.ctx.storage.get('d:heroes/' + id); if (h && h.owner === acct) ok = true; }
        if (!ok) throw new Error(k === 'tasks' ? 'O organizador não liberou criar tarefas para você.' : 'O organizador não liberou criar recompensas para você.');
      }
    } else if (rel === 'party/main' && prev && prev.creatorId && !(await this.isOrg(acct))) {
      for (const k of CFG_FIELDS) { if (k in prev) data[k] = prev[k]; else delete data[k]; }
    }
    await this.ctx.storage.put('d:' + rel, data);
    await this.bump();
    return this.out(room);
  }
  async del(room, rel, acct) {
    if (rel.startsWith('heroes/')) {
      const prev = await this.ctx.storage.get('d:' + rel);
      if (prev && prev.owner && prev.owner !== acct && !(await this.isOrg(acct))) throw new Error('Só o organizador pode tirar o personagem de outra pessoa.');
    }
    await this.ctx.storage.delete('d:' + rel);
    await this.bump();
    return this.out(room);
  }
  /** Muda o nome ou as vagas da sala (só o organizador). */
  async setMeta(room, patch, acct) {
    const meta = await this.meta(); if (!meta) throw new Error('sala não existe');
    if (!(await this.isOrg(acct))) throw new Error('Só o organizador muda a sala.');
    if (patch.name != null) { const n = String(patch.name).trim().slice(0, 40); if (!n) throw new Error('Dê um nome para a sala.'); meta.name = n; }
    if (patch.slots != null) {
      const n = [...(await this.ctx.storage.list({ prefix: 'd:heroes/' })).keys()].length; const v = slotsOf(patch.slots);
      if (v < n) throw new Error(`A sala já tem ${n} heróis. Para diminuir as vagas, expulse alguém antes.`);
      meta.slots = v;
    }
    await this.ctx.storage.put('meta', meta); await this.bump();
    return this.out(room);
  }
  /* ----- Cópias de segurança dos dados da sala -----
     Feitas sozinhas: antes da primeira gravação de cada versão nova do app (ou seja, com os dados
     como a versão anterior deixou) e uma vez por dia. Ficam as 14 mais recentes. */
  async autoSnap(ver) {
    if (!(await this.meta())) return;
    const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const st = (await this.ctx.storage.get('snapState')) || {};
    let label = null;
    if (ver && st.ver && st.ver !== ver) label = 'Antes da atualização do app';
    else if (st.day !== day) label = st.day ? 'Cópia diária' : 'Primeira cópia';
    if (label) await this.snapshot(label);
    if (label || (ver && st.ver !== ver)) await this.ctx.storage.put('snapState', { ver: ver || st.ver || null, day });
  }
  async snapshot(label) {
    const docs = await this.docs(); const meta = await this.meta();
    const data = JSON.stringify({ meta, docs, at: Date.now() });
    if (data.length > 1800000) return null;
    const id = 's' + Date.now().toString(36);
    const heroes = Object.keys(docs).filter((k) => k.startsWith('heroes/')).length;
    const idx = (await this.ctx.storage.get('snapIdx')) || [];
    idx.unshift({ id, at: Date.now(), label: String(label).slice(0, 60), size: data.length, heroes, stage: (docs['party/main'] || {}).stage || 1 });
    const drop = idx.splice(14);
    await this.ctx.storage.put('snap:' + id, data);
    await this.ctx.storage.put('snapIdx', idx);
    for (const d of drop) await this.ctx.storage.delete('snap:' + d.id);
    return idx[0];
  }
  async snaps(acct) { if (!(await this.isOrg(acct))) throw new Error('Só o organizador vê as cópias de segurança.'); return { snaps: (await this.ctx.storage.get('snapIdx')) || [] }; }
  async snapNow(acct) { if (!(await this.isOrg(acct))) throw new Error('Só o organizador faz cópias de segurança.'); await this.snapshot('Cópia feita pelo organizador'); return this.snaps(acct); }
  async snapGet(id, acct) {
    if (!(await this.isOrg(acct))) throw new Error('Só o organizador baixa as cópias de segurança.');
    const raw = await this.ctx.storage.get('snap:' + String(id)); if (!raw) throw new Error('Cópia não encontrada.');
    return { data: raw };
  }
  /** Volta a sala para uma cópia (antes, guarda o estado atual como outra cópia, para dar para desfazer). */
  async restore(room, id, acct) {
    if (!(await this.isOrg(acct))) throw new Error('Só o organizador restaura cópias de segurança.');
    const raw = await this.ctx.storage.get('snap:' + String(id)); if (!raw) throw new Error('Cópia não encontrada.');
    const snap = JSON.parse(raw);
    await this.snapshot('Antes de restaurar uma cópia');
    const cur = await this.ctx.storage.list({ prefix: 'd:' });
    const old = [...cur.keys()]; for (let i = 0; i < old.length; i += 100) await this.ctx.storage.delete(old.slice(i, i + 100));
    const put = {}; for (const [rel, doc] of Object.entries(snap.docs || {})) put['d:' + rel] = doc;
    const keys = Object.keys(put); for (let i = 0; i < keys.length; i += 100) { const chunk = {}; keys.slice(i, i + 100).forEach((k) => { chunk[k] = put[k]; }); await this.ctx.storage.put(chunk); }
    if (snap.meta) await this.ctx.storage.put('meta', Object.assign({}, await this.meta(), { name: snap.meta.name, slots: snap.meta.slots }));
    await this.bump();
    return this.out(room);
  }
  /** Marca uma missão como cumprida apenas se ninguém a cumpriu antes. */
  async claim(room, rel, patch) {
    const doc = await this.ctx.storage.get('d:' + rel);
    if (!doc || doc.done) return this.out(room, { ok: false });
    Object.assign(doc, patch || {});
    await this.ctx.storage.put('d:' + rel, doc);
    await this.bump();
    return this.out(room, { ok: true });
  }
  /** Trava curta para que só um aparelho resolva a batalha da noite. */
  lock(holder, ttlSec) {
    const now = Date.now();
    if (this.lk && this.lk.until > now && this.lk.holder !== holder) return false;
    this.lk = { holder: String(holder), until: now + Math.max(5, Math.min(60, Number(ttlSec) || 20)) * 1000 };
    return true;
  }
}

/* ---------------- Contas (login com e-mail e senha) ----------------
   Cada conta vive num Durable Object próprio, endereçado pelo e-mail. A senha nunca é guardada:
   só um "hash" PBKDF2 com sal aleatório. A sessão é um token "<e-mail em base64>.<aleatório>",
   e a conta guarda só o SHA-256 da parte aleatória. */
const ITER = 60000;
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (str) => hex(await crypto.subtle.digest('SHA-256', enc.encode(str)));
async function pbkdf2(pass, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITER }, key, 256));
}
const sameStr = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))));
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const normEmail = (e) => { const s = String(e || '').trim().toLowerCase(); if (!EMAIL_RE.test(s)) throw new Error('E-mail inválido.'); return s; };
const checkPass = (p) => { p = String(p || ''); if (p.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.'); if (p.length > 200) throw new Error('Senha longa demais.'); return p; };

export class Account extends DurableObject {
  async data() { return (await this.ctx.storage.get('acct')) || null; }
  view(a) { return { email: a.email, id: a.id, rooms: a.rooms || [], hasRecovery: !!a.rch }; }
  async newSession(a) {
    const rnd = randHex(24); a.sessions = (a.sessions || []).concat({ h: await sha(rnd), at: Date.now() }).slice(-10);
    await this.ctx.storage.put('acct', a);
    return { token: b64u(a.email) + '.' + rnd, ...this.view(a) };
  }
  async register(email, pass) {
    if (await this.data()) throw new Error('Já existe uma conta com esse e-mail. Use Entrar.');
    const salt = randHex(16);
    const rc = newRecovery();
    const a = { email, id: await acctId(email), salt, hash: await pbkdf2(pass, salt), rch: await sha(normRec(rc)), rooms: [], sessions: [], createdAt: Date.now() };
    return Object.assign(await this.newSession(a), { recovery: rc });
  }
  /** Gera um código de recuperação novo (o antigo deixa de valer). */
  async newRecovery(rnd) {
    const a = await this.auth(rnd); if (!a) throw new Error('sessão expirada');
    const rc = newRecovery(); a.rch = await sha(normRec(rc)); await this.ctx.storage.put('acct', a);
    return Object.assign(this.view(a), { recovery: rc });
  }
  /** Esqueci a senha: com o código de recuperação, cria uma senha nova. O código é trocado por outro. */
  async reset(rc, newPass) {
    const a = await this.data(); const now = Date.now();
    if (!a || !a.rch) throw new Error('E-mail ou código de recuperação incorretos.');
    if (a.lockUntil && a.lockUntil > now) throw new Error('Muitas tentativas. Espere um minuto e tente de novo.');
    if (!sameStr(await sha(normRec(rc)), a.rch)) {
      a.fails = (a.fails || 0) + 1; if (a.fails >= 5) { a.fails = 0; a.lockUntil = now + 60000; }
      await this.ctx.storage.put('acct', a); throw new Error('E-mail ou código de recuperação incorretos.');
    }
    const next = newRecovery();
    a.fails = 0; a.lockUntil = 0; a.salt = randHex(16); a.hash = await pbkdf2(newPass, a.salt); a.sessions = []; a.rch = await sha(normRec(next));
    return Object.assign(await this.newSession(a), { recovery: next });
  }
  async login(email, pass) {
    const a = await this.data(); if (!a) throw new Error('E-mail ou senha incorretos.');
    const now = Date.now();
    if (a.lockUntil && a.lockUntil > now) throw new Error('Muitas tentativas. Espere um minuto e tente de novo.');
    if (!sameStr(await pbkdf2(pass, a.salt), a.hash)) {
      a.fails = (a.fails || 0) + 1; if (a.fails >= 5) { a.fails = 0; a.lockUntil = now + 60000; }
      await this.ctx.storage.put('acct', a); throw new Error('E-mail ou senha incorretos.');
    }
    a.fails = 0; a.lockUntil = 0;
    return this.newSession(a);
  }
  async auth(rnd) {
    const a = await this.data(); if (!a) return null;
    if (!a.id) { a.id = await acctId(a.email); await this.ctx.storage.put('acct', a); }
    const h = await sha(String(rnd || '')); return (a.sessions || []).some((x) => x.h === h) ? a : null;
  }
  async me(rnd) { const a = await this.auth(rnd); if (!a) throw new Error('sessão expirada'); return this.view(a); }
  async logout(rnd) {
    const a = await this.auth(rnd); if (!a) return { ok: true };
    const h = await sha(String(rnd)); a.sessions = a.sessions.filter((x) => x.h !== h); await this.ctx.storage.put('acct', a); return { ok: true };
  }
  async changePass(rnd, oldPass, newPass) {
    const a = await this.auth(rnd); if (!a) throw new Error('sessão expirada');
    if (!sameStr(await pbkdf2(oldPass, a.salt), a.hash)) throw new Error('A senha atual não confere.');
    a.salt = randHex(16); a.hash = await pbkdf2(newPass, a.salt); a.sessions = [];
    return this.newSession(a);
  }
  async roomSet(rnd, room) {
    const a = await this.auth(rnd); if (!a) throw new Error('sessão expirada');
    const list = (a.rooms || []).filter((r) => r.code !== room.code);
    const prev = (a.rooms || []).find((r) => r.code === room.code) || {};
    const hero = room.hero === undefined ? prev.hero || null : room.hero;
    const heroName = room.hero === undefined ? prev.heroName || null : (room.heroName ? String(room.heroName).slice(0, 30) : null);
    list.unshift({ code: room.code, name: String(room.name || prev.name || room.code).slice(0, 40), hero, heroName, at: Date.now() });
    a.rooms = list.slice(0, 30); await this.ctx.storage.put('acct', a); return this.view(a);
  }
  async roomDel(rnd, code) {
    const a = await this.auth(rnd); if (!a) throw new Error('sessão expirada');
    a.rooms = (a.rooms || []).filter((r) => r.code !== code); await this.ctx.storage.put('acct', a); return this.view(a);
  }
}
// código de recuperação: 16 letras/números em 4 blocos, sem letras que se confundem
const REC_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRecovery = () => { const b = crypto.getRandomValues(new Uint8Array(16)); let s = ''; for (let i = 0; i < 16; i++) { s += REC_CHARS[b[i] % REC_CHARS.length]; if (i % 4 === 3 && i < 15) s += '-'; } return s; };
const normRec = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1');
// identificador público da conta (vai nos heróis): não revela o e-mail
const acctId = async (email) => (await sha('guilda-acct:' + email)).slice(0, 24);
const acctOf = (env, email) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('acct:' + email));
function splitToken(t) {
  const [e, rnd] = String(t || '').split('.');
  let email; try { email = normEmail(unb64u(e)); } catch (err) { throw new Error('sessão expirada'); }
  if (!/^[0-9a-f]{48}$/.test(rnd || '')) throw new Error('sessão expirada');
  return [email, rnd];
}

const roomOf = (env, c) => env.ROOMS.get(env.ROOMS.idFromName(c));

// quem está escrevendo: a sessão vai no cabeçalho x-guilda-token (guardada em memória por 2 minutos)
const authCache = new Map();
async function whoIs(env, token) {
  if (!token) throw new Error('Entre com a sua conta para continuar. (login)');
  const hit = authCache.get(token); if (hit && hit.exp > Date.now()) return hit.id;
  const [e, r] = splitToken(token);
  let v; try { v = await acctOf(env, e).me(r); } catch (err) { throw new Error('Sua sessão expirou. Entre de novo. (login)'); }
  if (authCache.size > 500) authCache.clear();
  authCache.set(token, { id: v.id, exp: Date.now() + 120000 }); return v.id;
}

async function call(env, fn, a, token) {
  const ver = (env.CF_VERSION_METADATA && env.CF_VERSION_METADATA.id) || null;
  // antes de qualquer gravação numa sala: cópia automática se a versão do app mudou ou se é o 1º acesso do dia
  if (['api_set', 'api_delete', 'api_claim', 'api_meta'].includes(fn)) {
    try { const c = fn === 'api_meta' ? code(a[0]) : split(a[0])[0]; await roomOf(env, c).autoSnap(ver); } catch (e) { /* a cópia nunca impede a gravação */ }
  }
  switch (fn) {
    case 'api_snaps': { const c = code(a[0]); return roomOf(env, c).snaps(await whoIs(env, token)); }
    case 'api_snap_now': { const c = code(a[0]); return roomOf(env, c).snapNow(await whoIs(env, token)); }
    case 'api_snap_get': { const c = code(a[0]); return roomOf(env, c).snapGet(a[1], await whoIs(env, token)); }
    case 'api_restore': { const c = code(a[0]); return roomOf(env, c).restore(c, a[1], await whoIs(env, token)); }
    case 'api_room': { const c = code(a[0]); return { meta: await roomOf(env, c).meta() }; }
    case 'api_create_room': { const c = code(a[0]); const who = await whoIs(env, token); return roomOf(env, c).create(c, sized(a[1]), sized(a[2]), who); }
    case 'api_get': { const c = code(a[1]); return roomOf(env, c).get(c, a[0]); }
    case 'api_hero': { const c = code(a[0]); return { hero: await roomOf(env, c).hero(String(a[1] || '').slice(0, 40)) }; }
    case 'api_set': { const [c, rel] = split(a[0]); const who = await whoIs(env, token); return roomOf(env, c).set(c, rel, sized(a[1]), who); }
    case 'api_delete': { const [c, rel] = split(a[0]); const who = await whoIs(env, token); return roomOf(env, c).del(c, rel, who); }
    case 'api_claim': { const [c, rel] = split(a[0]); await whoIs(env, token); return roomOf(env, c).claim(c, rel, sized(a[1])); }
    case 'api_meta': { const c = code(a[0]); const who = await whoIs(env, token); return roomOf(env, c).setMeta(c, a[1] || {}, who); }
    case 'api_lock': { const c = code(a[0]); return roomOf(env, c).lock(a[1], a[2]); }
    case 'auth_register': { const e = normEmail(a[0]); return acctOf(env, e).register(e, checkPass(a[1])); }
    case 'auth_login': { const e = normEmail(a[0]); return acctOf(env, e).login(e, String(a[1] || '')); }
    case 'auth_me': { const [e, r] = splitToken(a[0]); return acctOf(env, e).me(r); }
    case 'auth_logout': { authCache.delete(String(a[0] || '')); const [e, r] = splitToken(a[0]); return acctOf(env, e).logout(r); }
    case 'auth_recovery': { const [e, r] = splitToken(a[0]); return acctOf(env, e).newRecovery(r); }
    case 'auth_reset': { const e = normEmail(a[0]); return acctOf(env, e).reset(String(a[1] || ''), checkPass(a[2])); }
    case 'auth_pass': { const [e, r] = splitToken(a[0]); return acctOf(env, e).changePass(r, String(a[1] || ''), checkPass(a[2])); }
    case 'auth_room': { const [e, r] = splitToken(a[0]); const room = a[1] || {}; return acctOf(env, e).roomSet(r, { code: code(room.code), name: room.name, hero: room.hero === undefined ? undefined : (room.hero ? String(room.hero).slice(0, 40) : null), heroName: room.heroName }); }
    case 'auth_room_del': { const [e, r] = splitToken(a[0]); return acctOf(env, e).roomDel(r, code(a[1])); }
    default: throw new Error('função desconhecida');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const fn = url.pathname.slice(5);
    if (fn === 'ping') return json({ guilda: true, v: 2 });
    if (request.method !== 'POST') return json({ error: 'use POST' }, 405);
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json({ error: 'pedido grande demais (too_large)' }, 413);
    let args;
    try { args = await request.json(); } catch (e) { return json({ error: 'pedido inválido' }, 400); }
    if (!Array.isArray(args)) return json({ error: 'pedido inválido' }, 400);
    try { return json(await call(env, fn, args, request.headers.get('x-guilda-token') || '')); }
    catch (e) { return json({ error: String((e && e.message) || e) }, 400); }
  },
};
