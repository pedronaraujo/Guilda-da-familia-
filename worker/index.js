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
