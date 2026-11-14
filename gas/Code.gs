/**
 * Guilda da Família — servidor no Google Apps Script.
 * Os dados ficam nas Propriedades do Script deste projeto (nada no seu Drive).
 * Cada sala tem um código de 6 letras; seus documentos ficam em "d:rooms/<CÓDIGO>/...".
 */
var CHUNK = 8000;      // o PropertiesService guarda até ~9 KB por valor; documentos maiores são divididos em partes
var MAX_DOC = 60000;   // limite de segurança por documento

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Guilda da Família')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function props_() { return PropertiesService.getScriptProperties(); }
var ROOM_RE = /^rooms\/([A-Z0-9]{6})(\/(heroes|board|rewards|chores|inbox|activity|requests)\/[A-Za-z0-9_-]{1,40}|\/party\/main)?$/;
function roomOf_(path) {
  var m = ROOM_RE.exec(String(path));
  if (!m) throw new Error('caminho inválido');
  return m[1];
}
function rev_(room) { return Number(props_().getProperty('rev:' + room) || 0); }
function bump_(room) { var r = rev_(room) + 1; props_().setProperty('rev:' + room, String(r)); return r; }
function readJson_(all, path) {
  var v = all['d:' + path];
  if (v == null) return null;
  if (v.indexOf('#chunks:') === 0) { var n = Number(v.slice(8)), s = ''; for (var i = 0; i < n; i++) s += all['c:' + path + '#' + i] || ''; v = s; }
  try { return JSON.parse(v); } catch (e) { return null; }
}
function roomDocs_(room) {
  var all = props_().getProperties(), docs = {}, pre = 'd:rooms/' + room + '/';
  for (var k in all) if (k.indexOf(pre) === 0) { var path = k.slice(2), d = readJson_(all, path); if (d) docs[k.slice(pre.length)] = d; }
  return docs;
}
function dropChunks_(path) {
  var pr = props_(), old = pr.getProperty('d:' + path);
  if (old && old.indexOf('#chunks:') === 0) { var n = Number(old.slice(8)); for (var i = 0; i < n; i++) pr.deleteProperty('c:' + path + '#' + i); }
}
function putDoc_(path, json) {
  dropChunks_(path);
  if (json.length <= CHUNK) { props_().setProperty('d:' + path, json); return; }
  var parts = Math.ceil(json.length / CHUNK), obj = {};
  for (var i = 0; i < parts; i++) obj['c:' + path + '#' + i] = json.slice(i * CHUNK, (i + 1) * CHUNK);
  obj['d:' + path] = '#chunks:' + parts;
  props_().setProperties(obj);
}
function delDoc_(path) { dropChunks_(path); props_().deleteProperty('d:' + path); }
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function out_(room, extra) {
  var o = { room: room, rev: rev_(room), docs: roomDocs_(room) };
  for (var k in (extra || {})) o[k] = extra[k];
  return o;
}

/** Dados da sala (ou null se não existe). */
function api_room(code) {
  var raw = props_().getProperty('d:rooms/' + String(code).toUpperCase());
  return { meta: raw ? JSON.parse(raw) : null };
}

/** Cria a sala se o código estiver livre. */
function api_create_room(code, meta, party) {
  code = String(code).toUpperCase();
  roomOf_('rooms/' + code);
  return withLock_(function () {
    if (props_().getProperty('d:rooms/' + code)) return { ok: false };
    props_().setProperty('d:rooms/' + code, JSON.stringify(meta));
    putDoc_('rooms/' + code + '/party/main', JSON.stringify(party));
    bump_(code);
    return { ok: true };
  });
}

/** Estado da sala, ou só a revisão se nada mudou desde clientRev. */
function api_get(clientRev, room) {
  room = String(room).toUpperCase(); roomOf_('rooms/' + room);
  var r = rev_(room);
  if (clientRev === r && r > 0) return { room: room, rev: r };
  return { room: room, rev: r, docs: roomDocs_(room) };
}

function api_set(path, data) {
  var room = roomOf_(path);
  var json = JSON.stringify(data);
  if (json.length > MAX_DOC) throw new Error('documento grande demais (too_large)');
  return withLock_(function () {
    if (!props_().getProperty('d:rooms/' + room)) throw new Error('sala não existe');
    putDoc_(path, json);
    bump_(room);
    return out_(room);
  });
}

function api_delete(path) {
  var room = roomOf_(path);
  return withLock_(function () {
    delDoc_(path);
    bump_(room);
    return out_(room);
  });
}

/** Marca uma missão como cumprida apenas se ninguém a cumpriu antes. */
function api_claim(path, patch) {
  var room = roomOf_(path);
  return withLock_(function () {
    var doc = readJson_(props_().getProperties(), path);
    if (!doc) return out_(room, { ok: false });
    if (doc.done) return out_(room, { ok: false });
    for (var k in patch) doc[k] = patch[k];
    putDoc_(path, JSON.stringify(doc));
    bump_(room);
    return out_(room, { ok: true });
  });
}

/** Trava curta para que só um aparelho resolva a batalha da noite de cada sala. */
function api_lock(room, holder, ttlSec) {
  return withLock_(function () {
    var cache = CacheService.getScriptCache(), key = 'battle-lock:' + room;
    var cur = cache.get(key);
    if (cur && cur !== holder) return false;
    cache.put(key, String(holder), Math.max(5, Math.min(60, ttlSec || 20)));
    return true;
  });
}

/** Opcional: rode no editor para apagar TODAS as salas e recomeçar do zero. */
function apagarTudo() {
  withLock_(function () { props_().deleteAllProperties(); });
}
