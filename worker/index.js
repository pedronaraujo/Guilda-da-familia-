/**
 * Guilda da Família — servidor na Cloudflare.
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
  async out(room, extra) { return Object.assign({ room, rev: await this.rev(), docs: await this.docs() }, extra || {}); }

  async meta() { return (await this.ctx.storage.get('meta')) || null; }
  async create(room, meta, party) {
    if (await this.ctx.storage.get('meta')) return { ok: false };
    await this.ctx.storage.put({ meta, 'd:party/main': party });
    await this.bump();
    return { ok: true };
  }
  async get(room, clientRev) {
    const r = await this.rev();
    if (clientRev === r && r > 0) return { room, rev: r };
    return { room, rev: r, docs: await this.docs() };
  }
  async set(room, rel, data) {
    if (!(await this.ctx.storage.get('meta'))) throw new Error('sala não existe');
    await this.ctx.storage.put('d:' + rel, data);
    await this.bump();
    return this.out(room);
  }
  async del(room, rel) {
    await this.ctx.storage.delete('d:' + rel);
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
  view(a) { return { email: a.email, rooms: a.rooms || [] }; }
  async newSession(a) {
    const rnd = randHex(24); a.sessions = (a.sessions || []).concat({ h: await sha(rnd), at: Date.now() }).slice(-10);
    await this.ctx.storage.put('acct', a);
    return { token: b64u(a.email) + '.' + rnd, ...this.view(a) };
  }
  async register(email, pass) {
    if (await this.data()) throw new Error('Já existe uma conta com esse e-mail. Use Entrar.');
    const salt = randHex(16);
    const a = { email, salt, hash: await pbkdf2(pass, salt), rooms: [], sessions: [], createdAt: Date.now() };
    return this.newSession(a);
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
const acctOf = (env, email) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('acct:' + email));
function splitToken(t) {
  const [e, rnd] = String(t || '').split('.');
  let email; try { email = normEmail(unb64u(e)); } catch (err) { throw new Error('sessão expirada'); }
  if (!/^[0-9a-f]{48}$/.test(rnd || '')) throw new Error('sessão expirada');
  return [email, rnd];
}

const roomOf = (env, c) => env.ROOMS.get(env.ROOMS.idFromName(c));

async function call(env, fn, a) {
  switch (fn) {
    case 'api_room': { const c = code(a[0]); return { meta: await roomOf(env, c).meta() }; }
    case 'api_create_room': { const c = code(a[0]); return roomOf(env, c).create(c, sized(a[1]), sized(a[2])); }
    case 'api_get': { const c = code(a[1]); return roomOf(env, c).get(c, a[0]); }
    case 'api_set': { const [c, rel] = split(a[0]); return roomOf(env, c).set(c, rel, sized(a[1])); }
    case 'api_delete': { const [c, rel] = split(a[0]); return roomOf(env, c).del(c, rel); }
    case 'api_claim': { const [c, rel] = split(a[0]); return roomOf(env, c).claim(c, rel, sized(a[1])); }
    case 'api_lock': { const c = code(a[0]); return roomOf(env, c).lock(a[1], a[2]); }
    case 'auth_register': { const e = normEmail(a[0]); return acctOf(env, e).register(e, checkPass(a[1])); }
    case 'auth_login': { const e = normEmail(a[0]); return acctOf(env, e).login(e, String(a[1] || '')); }
    case 'auth_me': { const [e, r] = splitToken(a[0]); return acctOf(env, e).me(r); }
    case 'auth_logout': { const [e, r] = splitToken(a[0]); return acctOf(env, e).logout(r); }
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
    if (fn === 'ping') return json({ guilda: true, v: 1 });
    if (request.method !== 'POST') return json({ error: 'use POST' }, 405);
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json({ error: 'pedido grande demais (too_large)' }, 413);
    let args;
    try { args = await request.json(); } catch (e) { return json({ error: 'pedido inválido' }, 400); }
    if (!Array.isArray(args)) return json({ error: 'pedido inválido' }, 400);
    try { return json(await call(env, fn, args)); }
    catch (e) { return json({ error: String((e && e.message) || e) }, 400); }
  },
};
