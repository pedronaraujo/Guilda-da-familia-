/* ===== Aplicativo: Guilda da Família ===== */
(function () {
  const D = window.DATA, E = window.ENGINE, A = window.ART;
  const $app = document.getElementById('app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uidGen = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtDay = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}`; };
  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
  const deviceId = lsGet('guilda-device', null) || (() => { const id = 'dev-' + uidGen(); lsSet('guilda-device', id); return id; })();

  /* ---------------- Estado ---------------- */
  const S = {
    ready: false, mode: 'loading', readOnly: false, isOwner: false,
    heroes: {}, party: null, board: {}, rewards: {}, chores: {}, inbox: {}, activity: {}, requests: {}, newDays: [], newDue: '', newDuo: false, newTarget: 'me', masterOk: false,
    room: null, roomMeta: null, me: null, roomErr: '', choreAssign: 'all', diffPreview: null,
    view: 'rooms', heroId: null, tab: 'tarefas', selSkill: null,
    draft: null, newDiff: 'm', newFreq: 'once', newEvery: 7, newDom: null, modal: null, toast: null,
    chance: null, chanceKey: '',
  };

  /* ---------------- Armazenamento ----------------
     Cada sala guarda seus documentos em rooms/<CÓDIGO>/...: heroes/<id>, party/main, board/<id>, rewards/<id>, chores/<id>.
     Quatro modos: Google Apps Script (google.script.run), banco do Claude (claude.use("db")),
     servidor próprio na Cloudflare (/api/..., mesmas funções do Apps Script) ou só este aparelho. */
  function applyDocs(docs) {
    const heroes = {}, board = {}, rewards = {}, chores = {}, inbox = {}, activity = {}, requests = {}; let party = null;
    for (const [path, data] of Object.entries(docs || {})) {
      if (!data) continue;
      const [col, id] = path.split('/');
      if (col === 'heroes') heroes[id] = clone(data);
      else if (col === 'board') board[id] = clone(data);
      else if (col === 'rewards') rewards[id] = clone(data);
      else if (col === 'chores') chores[id] = clone(data);
      else if (col === 'inbox') inbox[id] = clone(data);
      else if (col === 'activity') activity[id] = clone(data);
      else if (col === 'requests') requests[id] = clone(data);
      else if (path === 'party/main') party = clone(data);
    }
    S.heroes = heroes; S.board = board; S.rewards = rewards; S.chores = chores; S.inbox = inbox; S.activity = activity; S.requests = requests; S.party = party;
  }
  let gas = (fn, ...args) => new Promise((res, rej) => window.google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...args));
  // Servidor próprio (Cloudflare): POST /api/<função> com os argumentos em JSON
  const serverCall = async (fn, ...args) => {
    const r = await fetch('/api/' + fn, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), cache: 'no-store' });
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok || (j && typeof j === 'object' && j.error)) throw new Error((j && j.error) || 'HTTP ' + r.status);
    return j;
  };
  async function hasServer() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('/api/ping', { cache: 'no-store', signal: ctl.signal }); clearTimeout(t);
      const j = r.ok ? await r.json() : null; return !!(j && j.guilda);
    } catch (e) { return false; }
  }
  const COLS = ['heroes', 'board', 'rewards', 'chores', 'inbox', 'activity', 'requests'];
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const Store = {
    db: null, queues: {}, rev: -1, pending: 0, docs: {}, unsubs: [], pollTimer: null,
    full(path) { return 'rooms/' + S.room + '/' + path; },
    async init() {
      if (window.google && window.google.script && window.google.script.run) { S.mode = 'gas'; return; }
      let db = null;
      try { if (window.claude && typeof window.claude.use === 'function') db = await window.claude.use('db'); } catch (e) { db = null; }
      if (db) {
        this.db = db; S.mode = 'shared';
        try { const user = await window.claude.use('user'); if (user) { const can = await user.can('data.write'); if (can === false) S.readOnly = true; } } catch (e) { /* ok */ }
        return;
      }
      if (await hasServer()) {
        gas = serverCall; S.mode = 'gas'; this.server = true;
        document.addEventListener('visibilitychange', () => { if (!document.hidden && S.room) this.poll(); });
        return;
      }
      S.mode = 'local';
    },
    localAll() { return lsGet('guilda-local-v3', {}); },
    localSave(all) { lsSet('guilda-local-v3', all); },
    async roomMeta(code) {
      if (S.mode === 'local') return this.localAll()['rooms/' + code] || null;
      if (S.mode === 'gas') { const r = await gas('api_room', code); return r && r.meta ? r.meta : null; }
      const d = await this.db.doc('rooms/' + code).get(); return d.exists ? d.data() : null;
    },
    async createRoom(code, meta, party) {
      if (S.mode === 'local') { const all = this.localAll(); if (all['rooms/' + code]) return false; all['rooms/' + code] = meta; all['rooms/' + code + '/party/main'] = party; this.localSave(all); return true; }
      if (S.mode === 'gas') { const r = await gas('api_create_room', code, meta, party); return !!(r && r.ok); }
      const ref = this.db.doc('rooms/' + code);
      const lease = await ref.acquire({ holder: deviceId, ttlMs: 5000 }); if (!lease.acquired) return false;
      const cur = await ref.get(); if (cur.exists) return false;
      await ref.set(meta); await this.db.doc('rooms/' + code + '/party/main').set(party); return true;
    },
    // abre a sala: começa a receber os documentos dela
    async open(code) {
      this.close(); S.room = code; this.docs = {}; this.rev = -1; applyDocs({});
      if (S.mode === 'local') {
        const all = this.localAll(), pre = 'rooms/' + code + '/';
        for (const [k, v] of Object.entries(all)) if (k.startsWith(pre)) this.docs[k.slice(pre.length)] = v;
        applyDocs(this.docs); return;
      }
      if (S.mode === 'gas') {
        await this.poll();
        this.pollTimer = setInterval(() => { if (!document.hidden) this.poll(); }, this.server ? 5000 : 20000);
        return;
      }
      await new Promise((resolve) => {
        const need = new Set(COLS.concat(['party']));
        const timer = setTimeout(() => { S.stale = true; resolve(); }, 10000);
        const got = (k, cache) => { if (!cache) need.delete(k); if (!need.size) { clearTimeout(timer); S.stale = false; resolve(); } };
        for (const name of COLS) {
          this.unsubs.push(this.db.collection(this.full(name)).onSnapshot((snap) => {
            for (const k of Object.keys(this.docs)) if (k.startsWith(name + '/')) delete this.docs[k];
            snap.docs.forEach((d) => { if (d.exists) this.docs[name + '/' + d.id] = d.data(); });
            applyDocs(this.docs); got(name, snap.metadata.fromCache); afterRemote();
          }, (err) => { console.warn(name, err); got(name, false); }));
        }
        this.unsubs.push(this.db.doc(this.full('party/main')).onSnapshot((d) => {
          if (d.exists) this.docs['party/main'] = d.data(); else delete this.docs['party/main'];
          applyDocs(this.docs); got('party', d.metadata.fromCache); afterRemote();
        }, (err) => { console.warn('party', err); got('party', false); }));
      });
    },
    close() { this.unsubs.forEach((u) => { try { u(); } catch (e) { /* ok */ } }); this.unsubs = []; clearInterval(this.pollTimer); this.pollTimer = null; S.room = null; },
    /* --- Google Apps Script --- */
    takeGas(res) {
      if (!res || res.rev == null || res.room !== S.room) return;
      if (res.docs && this.pending === 0 && res.rev >= this.rev) { this.rev = res.rev; this.docs = res.docs; applyDocs(res.docs); afterRemote(); }
      else if (!res.docs && res.rev > this.rev) this.poll();
    },
    async poll() {
      if (!S.room) return;
      try { const res = await gas('api_get', this.rev, S.room); S.stale = false; this.takeGas(res); }
      catch (e) { console.warn('poll', e); S.stale = true; if (S.ready) render(); }
    },
    fail(e) {
      console.warn('write', e);
      const code = e && e.code, msg = String((e && e.message) || e || '');
      if (code === 'invalid_argument') { S.readOnly = true; render(); }
      else if (code === 'quota_exceeded' || /too_large|grande|quota|storage/i.test(msg)) showToast('Não coube no armazenamento. Apague algumas tarefas antigas.');
      else showToast('Não deu para salvar agora. Tente de novo em instantes.');
    },
    write(key, fn) {
      this.pending++;
      const q = this.queues[key] || Promise.resolve();
      const run = () => fn().catch((e) => {
        if (e && e.code === 'unavailable') return new Promise((r) => setTimeout(r, 400 + Math.random() * 600)).then(fn);
        throw e;
      });
      const p = q.then(run).then((res) => { this.pending--; if (S.mode === 'gas') this.takeGas(res); return res; }, (e) => { this.pending--; this.fail(e); return null; });
      this.queues[key] = p; return p;
    },
    setDoc(path, data) {
      this.docs[path] = clone(data); applyDocs(this.docs);
      const full = this.full(path), body = clone(data);
      if (S.mode === 'local') { const all = this.localAll(); all[full] = body; this.localSave(all); return Promise.resolve(true); }
      if (S.mode === 'gas') return this.write(full, () => gas('api_set', full, body));
      return this.write(full, () => this.db.doc(full).set(body));
    },
    delDoc(path) {
      delete this.docs[path]; applyDocs(this.docs);
      const full = this.full(path);
      if (S.mode === 'local') { const all = this.localAll(); delete all[full]; this.localSave(all); return Promise.resolve(true); }
      if (S.mode === 'gas') return this.write(full, () => gas('api_delete', full));
      return this.write(full, () => this.db.doc(full).delete());
    },
    // Marca uma missão como cumprida só se ninguém cumpriu antes
    async claim(path, patch) {
      const full = this.full(path);
      if (S.mode === 'local') { const all = this.localAll(); const d = all[full]; if (!d || d.done) return false; Object.assign(d, patch); this.localSave(all); this.docs[path] = clone(d); applyDocs(this.docs); return true; }
      if (S.mode === 'gas') {
        this.pending++;
        try { const res = await gas('api_claim', full, patch); this.pending--; this.takeGas(res); return !!(res && res.ok); }
        catch (e) { this.pending--; this.fail(e); return false; }
      }
      try {
        const ref = this.db.doc(full);
        const lease = await ref.acquire({ holder: deviceId, ttlMs: 5000 });
        if (!lease.acquired) return false;
        const cur = await ref.get(); if (!cur.exists || cur.data().done) return false;
        const next = Object.assign(clone(cur.data()), patch);
        await ref.set(next); this.docs[path] = next; applyDocs(this.docs); return true;
      } catch (e) { this.fail(e); return false; }
    },
    async lock() {
      if (S.mode === 'local') return true;
      if (S.mode === 'gas') { try { return await gas('api_lock', S.room, deviceId, 20); } catch (e) { return false; } }
      try { const r = await this.db.doc(this.full('party/lock')).acquire({ holder: deviceId, ttlMs: 15000 }); return r.acquired; } catch (e) { return false; }
    },
    // Lê o estado mais recente direto da fonte (antes de resolver a batalha)
    async fresh() {
      if (S.mode === 'local') return clone(this.docs);
      if (S.mode === 'gas') { try { const res = await gas('api_get', -1, S.room); this.takeGas(res); return clone(res.docs || this.docs); } catch (e) { return clone(this.docs); } }
      try {
        const out = {};
        const [hs, pm] = await Promise.all([this.db.collection(this.full('heroes')).get(), this.db.doc(this.full('party/main')).get()]);
        hs.docs.forEach((d) => { if (d.exists) out['heroes/' + d.id] = d.data(); });
        if (pm.exists) out['party/main'] = pm.data();
        return clone(out);
      } catch (e) { return clone(this.docs); }
    },
    saveHero(h) { return this.setDoc('heroes/' + h.id, h); },
    deleteHero(id) { return this.delDoc('heroes/' + id); },
    saveParty(p) { return this.setDoc('party/main', p); },
  };
  /* ---------------- Conta (login com e-mail e senha, só no servidor próprio) ----------------
     A conta lembra as salas de que a pessoa participa e qual herói ela usa em cada uma. */
  const Acct = {
    saved() { return lsGet('guilda-auth', null); },
    on() { return !!(Store.server && S.acct); },
    async call(fn, ...args) { return serverCall('auth_' + fn, ...args); },
    async load() {
      const sv = this.saved(); if (!Store.server || !sv || !sv.token) return;
      try { const r = await this.call('me', sv.token); S.acct = { email: r.email, rooms: r.rooms || [], token: sv.token }; }
      catch (e) { if (/sess/.test(String(e.message))) lsSet('guilda-auth', null); S.acct = null; }
    },
    keep(r) { S.acct = { email: r.email, rooms: r.rooms || [], token: r.token || (S.acct && S.acct.token) }; lsSet('guilda-auth', { token: S.acct.token, email: S.acct.email }); },
    async enter(kind, email, pass) {
      S.authErr = ''; S.authBusy = true; render();
      try { this.keep(await this.call(kind, email, pass)); S.authBusy = false; if (S.room) this.room(); render(); showToast(kind === 'register' ? 'Conta criada. Suas salas ficam salvas nela.' : `Olá! Conectado como <b>${esc(S.acct.email)}</b>.`); }
      catch (e) { S.authBusy = false; S.authErr = String(e.message || e); render(); }
    },
    async logout() { const t = S.acct && S.acct.token; S.acct = null; lsSet('guilda-auth', null); render(); if (t) { try { await this.call('logout', t); } catch (e) { /* ok */ } } },
    // guarda (ou atualiza) a sala atual na conta, com o herói escolhido nela
    room(heroId) {
      if (!this.on() || !S.room) return;
      const h = heroId === undefined ? (S.me && S.heroes[S.me]) : heroId ? S.heroes[heroId] : null;
      const info = { code: S.room, name: (S.roomMeta && S.roomMeta.name) || S.room };
      if (heroId !== undefined || h) { info.hero = h ? h.id : null; info.heroName = h ? h.name : null; }
      this.call('room', S.acct.token, info).then((r) => { if (S.acct) { S.acct.rooms = r.rooms || []; render(); } }).catch((e) => console.warn('conta', e));
    },
    async forget(code) { if (!this.on()) return; try { const r = await this.call('room_del', S.acct.token, code); S.acct.rooms = r.rooms || []; render(); } catch (e) { showToast('Não deu para remover agora.'); } },
    heroIn(code) { const r = this.on() && S.acct.rooms.find((x) => x.code === code); return r ? r.hero : null; },
  };
  function afterRemote() { if (!S.ready || !S.room) return; if (S.me && !S.heroes[S.me] && Object.keys(S.heroes).length) { S.me = null; if (['home', 'hero', 'settings'].includes(S.view)) S.view = 'select'; } tidyAll(); maybeShowReport(); render(); processInbox(); }

  /* ---------------- Regras ---------------- */
  const heroList = () => Object.values(S.heroes).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const boardList = () => Object.values(S.board || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const stage = () => (S.party && S.party.stage) || 1;
  const mulOf = (p) => (p && typeof p.diffMul === 'number' ? p.diffMul : ((D.LEVELS[(p && p.difficulty) || 'normal'] || D.LEVELS.normal).mul));
  function levelFor(mul) {
    const n = mul < 0.8 ? ['Tranquila', 'Vitórias frequentes. Bom para começar.'] : mul < 1.08 ? ['Normal', 'Uma família ativa vence a maioria, mas não todas.'] : mul < 1.25 ? ['Desafiadora', 'Derrotas são comuns. Cada tarefa pesa.'] : mul < 1.45 ? ['Épica', 'Só um grupo muito dedicado avança rápido.'] : ['Lendária', 'Para quem quer suar a cada vitória.'];
    return { mul, name: n[0], blurb: n[1] };
  }
  const level = () => { const l = levelFor(mulOf(S.party)); const e = eventOn() && eventOn().fx && eventOn().fx.enemy; return e ? Object.assign({}, l, { mul: l.mul * (1 + e) }) : l; };
  // criador principal + co-criadores: todos abrem as configurações; só o principal escolhe co-criadores e o PIN
  const isMainCreator = (id) => !!((id || S.me) && S.party && S.party.creatorId === (id || S.me));
  const isCoCreator = (id) => !!((id || S.me) && S.party && (S.party.coCreators || []).includes(id || S.me));
  const isCreator = (id) => isMainCreator(id) || isCoCreator(id);
  const roleTag = (h) => { if (!h) return ''; const f = h.look && h.look.gender === 'f'; return isMainCreator(h.id) ? `<span class="tag crown">${f ? 'Criadora' : 'Criador'} da sala</span>` : isCoCreator(h.id) ? `<span class="tag crown co">${f ? 'Co-criadora' : 'Co-criador'}</span>` : ''; };
  const choreList = () => Object.values(S.chores || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const goldOf = (h) => Math.max(0, ((S.party && S.party.earned && S.party.earned[h.id]) || 0) + (h.bonusGold || 0) - (h.spent || 0));
  const xpFor = (t, h) => xpCalc(t, h || (S.me && S.heroes[S.me]));
  const MAX_TASKS = 40;
  const ancOf = (h) => D.ANCESTRIES[(h.look && h.look.anc) || 'humano'] || D.ANCESTRIES.humano;
  const rewardList = () => Object.values(S.rewards || {}).sort((a, b) => a.cost - b.cost || (a.createdAt || 0) - (b.createdAt || 0));
  // saldo para recompensas: todo XP já ganho menos o que foi resgatado (não mexe no nível)
  const redeemBal = (h) => Math.max(0, ((h.stats && h.stats.xp) || 0) - (h.redeemed || 0));
  /* aniversário */
  const isLeapY = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  function isBday(h, day) {
    const b = h && h.birth; if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return false; day = day || today();
    const md = b.slice(5), dm = day.slice(5);
    return md === dm || (md === '02-29' && dm === '02-28' && !isLeapY(Number(day.slice(0, 4))));
  }
  const bdayGiftReady = (h) => isBday(h) && h.bdayGift !== today().slice(0, 4);
  const bdayBuffOn = (h, day) => !!h && h.bdayBuff === (day || today());
  const festaOf = (h) => Math.max(0, (h && h.festa) || 0);
  function ageOn(h, day) { const y = Number(((h && h.birth) || '').slice(0, 4)); if (!y || y < 1900) return null; const a = Number((day || today()).slice(0, 4)) - y; return a > 0 && a < 130 ? a : null; }
  const fmtBirth = (b) => { if (!b) return ''; const [y, m, d] = b.split('-'); return `${d}/${m}/${y}`; };
  const masterLocked = () => !isCreator() || !!(S.party && S.party.pin && !S.masterOk);

  function newHero(draft) {
    return {
      id: 'h' + uidGen(), name: draft.name.trim(), cls: draft.cls, look: clone(draft.look),
      level: 1, xp: 0, points: 1, mastery: 0, skills: {}, gear: {}, cosmetics: { owned: [], hat: null, cape: null, aura: null, pet: null },
      spent: 0, tasks: [], stats: { done: 0, xp: 0 }, createdAt: Date.now(), createdDay: today(), birth: draft.birth || null, treeV: 2,
    };
  }
  // Ajustes diários: tarefas repetidas voltam, tarefas antigas concluídas são removidas
  function tidyTask(task, t) {
    if (task.repeat && task.done && task.done < t && !task.pending && scheduledOn(task, t)) { Object.assign(task, { done: null, doneBy: null, doneByName: null, created: t, gain: 0, parts: [], partNames: [], partGains: [], pending: null, approved: null, punct: null }); return 'reset'; }
    if (!task.repeat && task.done && task.done < t && !task.pending) return 'drop';
    return null;
  }
  const choreFor = (c, h) => c.assign === 'all' || (Array.isArray(c.assign) && c.assign.includes(h.id));
  function dailyTidy(h) {
    const t = today(); let changed = false; const keep = [];
    // árvores ampliadas: pontos gastos em treino voltam uma única vez para serem usados nas habilidades novas
    if ((h.treeV || 1) < 2) {
      if (h.mastery) { const n = h.mastery; h.points = (h.points || 0) + n; h.mastery = 0; setTimeout(() => showToast(`<span>Árvore de habilidades ampliada! <b>${n}</b> ponto${n > 1 ? 's' : ''} de treino voltaram para você usar.</span>`), 800); }
      h.treeV = 2; changed = true;
    }
    for (const task of h.tasks || []) {
      if (task.chore) { const c = S.chores[task.chore]; if ((!c || !choreFor(c, h)) && !task.done) { changed = true; continue; } if (c && !task.done && ['title', 'diff', 'days', 'every', 'start', 'dom', 'due'].some((k) => String(task[k] || null) !== String(c[k] || null))) { Object.assign(task, { title: c.title, diff: c.diff, days: c.days || null, every: c.every || null, start: c.start || null, dom: c.dom || null, due: c.due || null }); changed = true; } }
      const r = tidyTask(task, t); if (r) changed = true; if (r !== 'drop') keep.push(task);
    }
    // tarefas obrigatórias definidas pelo criador da sala
    for (const c of choreList()) {
      if (!choreFor(c, h) || keep.some((x) => x.chore === c.id) || !scheduledOn(c, t) || (c.from && t < c.from)) continue;
      keep.push({ id: 'c' + c.id, chore: c.id, title: c.title, diff: c.diff, repeat: true, days: c.days || null, every: c.every || null, start: c.start || null, dom: c.dom || null, due: c.due || null, created: t, done: null, gain: 0 }); changed = true;
    }
    if (changed) h.tasks = keep;
    return changed;
  }
  function tidyAll() {
    if (S.readOnly) return;
    const t = today();
    const h = S.me && S.heroes[S.me];
    if (h && dailyTidy(h)) Store.saveHero(h);
    for (const b of boardList()) {
      const r = tidyTask(b, t);
      if (r === 'drop') Store.delDoc('board/' + b.id); else if (r === 'reset') Store.setDoc('board/' + b.id, b);
    }
  }
  function addXp(h, amount) {
    // XP devolvido por uma tarefa desfeita (quando o herói já tinha gasto esse XP num nível) é descontado primeiro
    if (h.xpDebt && amount > 0) { const pay = Math.min(h.xpDebt, amount); h.xpDebt -= pay; amount -= pay; }
    h.xp += amount; h.stats.xp = (h.stats.xp || 0) + amount; let ups = 0;
    while (h.xp >= D.xpToNext(h.level)) { h.xp -= D.xpToNext(h.level); h.level++; h.points = (h.points || 0) + 1; ups++; }
    return ups;
  }
  /* ---------------- Rotina e motivação ---------------- */
  const dowOf = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).getDay(); };
  const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(y, m - 1, dd + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const weekStart = (d) => addDays(d, -((dowOf(d) + 6) % 7));
  const nowHM = () => { const n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()); };
  /* frequência: uma vez, todo dia, dias da semana (days), a cada N dias (every + start) ou todo mês (dom) */
  function scheduledOn(task, d) {
    if (task.dom) { const [y, m, dd] = d.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return dd === Math.min(task.dom, last); }
    if (task.every) { const diff = daysBetween(task.start || task.created || d, d); return diff >= 0 && diff % task.every === 0; }
    return !task.days || !task.days.length || task.days.includes(dowOf(d));
  }
  const hasSchedule = (t) => !!(t.dom || t.every || (t.days && t.days.length));
  // primeiro dia em que a tarefa vale (para tarefas que só aparecem em certos dias)
  function dueDay(task) { if (!hasSchedule(task)) return task.created; let d = task.created; for (let i = 0; i < 62; i++) { if (scheduledOn(task, d)) return d; d = addDays(d, 1); } return task.created; }
  function nextOn(task, from) { let d = from; for (let i = 0; i < 62; i++) { if (scheduledOn(task, d)) return d; d = addDays(d, 1); } return null; }
  const WD_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function freqOf(t) { if (t.dom) return 'monthly'; if (t.every) return 'interval'; if (t.days && t.days.length && t.days.length < 7) return 'weekly'; return t.repeat || t.chore ? 'daily' : 'once'; }
  function freqTxt(t) {
    const f = freqOf(t);
    if (f === 'monthly') return `Todo dia ${t.dom} do mês`;
    if (f === 'interval') return t.every === 7 ? 'Toda semana' : t.every === 14 ? 'A cada 2 semanas' : `A cada ${t.every} dias`;
    if (f === 'weekly') { const ds = t.days.slice().sort(); return ds.length === 1 ? `${ds[0] === 0 || ds[0] === 6 ? 'Todo' : 'Toda'} ${WD_FULL[ds[0]]}` : ds.map((d) => D.WEEKDAYS[d]).join(', '); }
    if (f === 'daily') return 'Todo dia';
    return '';
  }
  // transforma a escolha do formulário nos campos da tarefa
  // "from": dia em que a tarefa começa a valer (para "uma vez", o dia agendado). Só guardado se for no futuro.
  const fromOf = (st) => (st.from && /^\d{4}-\d{2}-\d{2}$/.test(st.from) && st.from > today() ? st.from : null);
  function freqFields(st) {
    const f = st.freq; const days = (st.days || []).slice().sort(); const from = fromOf(st);
    if (f === 'weekly' && days.length && days.length < 7) return { repeat: true, days, every: null, start: null, dom: null, from };
    if (f === 'interval') return { repeat: true, days: null, every: Math.max(2, Math.min(90, Math.round(Number(st.every) || 7))), start: from || st.start || today(), dom: null, from };
    if (f === 'monthly') return { repeat: true, days: null, every: null, start: null, dom: Math.max(1, Math.min(31, Math.round(Number(st.dom) || Number(today().slice(8))))), from };
    if (f === 'daily' || f === 'weekly') return { repeat: true, days: null, every: null, start: null, dom: null, from };
    return { repeat: false, days: null, every: null, start: null, dom: null, from };
  }
  function freqControls(st, pre, noOnce) {
    const opts = [['once', 'Uma vez'], ['daily', 'Todo dia'], ['weekly', 'Dias da semana'], ['interval', 'A cada N dias'], ['monthly', 'Todo mês']].filter(([k]) => !(noOnce && k === 'once'));
    const act = pre === 'ed' ? 'edFreq' : 'freq';
    let sub = '';
    if (st.freq === 'weekly') sub = `${dayChips(st.days, pre === 'ed' ? 'edDay' : 'day')}<span class="small muted">${st.days.length ? freqTxt({ repeat: true, days: st.days }) : 'Marque os dias'}</span>`;
    if (st.freq === 'interval') sub = `<label class="check" for="${pre}-every">A cada <input type="number" id="${pre}-every" class="time-in num-in" min="2" max="90" value="${esc(st.every || 7)}"> dias</label><span class="small muted">7 = toda semana · 14 = a cada 2 semanas</span>`;
    if (st.freq === 'monthly') sub = `<label class="check" for="${pre}-dom">Todo dia <input type="number" id="${pre}-dom" class="time-in num-in" min="1" max="31" value="${esc(st.dom || Number(today().slice(8)))}"> do mês</label>`;
    const fv = st.from && st.from > today() ? st.from : today();
    const when = `<label class="check when" for="${pre}-from">${st.freq === 'once' ? 'Para quando?' : 'Começa em'} <input type="date" id="${pre}-from" class="time-in date-in" min="${today()}" value="${fv}"></label>${fv > today() ? `<span class="small muted">${st.freq === 'once' ? 'Aparece' : 'Começa'} ${D.WEEKDAYS[dowOf(fv)].toLowerCase()}, ${fmtDay(fv)}</span>` : ''}`;
    return `<div class="field" style="margin:0"><span class="lbl">Frequência</span><div class="seg wrap" role="group" aria-label="Frequência">${opts.map(([k, n]) => `<button type="button" data-act="${act}" data-v="${k}" aria-pressed="${st.freq === k}">${n}</button>`).join('')}</div>${sub ? `<div class="row" style="margin-top:8px">${sub}</div>` : ''}<div class="row" style="margin-top:8px">${when}</div></div>`;
  }
  const newFreqState = () => ({ freq: S.newFreq, days: S.newDays, every: S.newEvery, dom: S.newDom, from: S.newFrom });
  const visibleToday = (task) => task.done === today() || !!task.pending || (!task.done && dueDay(task) <= today());
  function streakNow(h) { const st = h && h.streak; if (!st || !st.last) return 0; const t = today(); if (st.last === t) return st.n; if (st.last === addDays(t, -1)) return st.n; return 0; }
  function streakBonusNext(h) { const st = h && h.streak; if (!st || !st.last) return 0; const t = today(); const n = st.last === t ? st.n : st.last === addDays(t, -1) ? st.n + 1 : 1; return Math.min(D.STREAK_MAX, D.STREAK_STEP * (n - 1)); }
  function xpCalc(t, h) {
    const base = D.DIFF[t.diff].xp; const tt = today();
    const carried = !t.done && dueDay(t) < tt;
    const punctual = !carried && !!t.due && (t.done ? !!t.wasPunctual : nowHM() <= t.due);
    const late = !carried && !!t.due && !t.done && nowHM() > t.due;
    const streak = h ? streakBonusNext(h) : 0;
    const ev = typeof eventMul === 'function' ? eventMul('xp', t) : 0;
    const pb = punctual ? D.PUNCTUAL_BONUS + (typeof eventMul === 'function' ? eventMul('punctual') : 0) : 0;
    const bday = h && bdayBuffOn(h) ? D.BDAY.xpPct : 0;
    const mult = 1 + (carried ? D.CARRY_BONUS : 0) + pb + streak + ev + bday;
    return { base, carried, punctual, late, streak, ev, bday, total: Math.round(base * mult) };
  }
  function ensureHero(h) { h.stats = h.stats || {}; h.stats.byDiff = h.stats.byDiff || {}; h.log = h.log || {}; h.ach = h.ach || {}; h.streak = h.streak || { n: 0, last: null, best: 0 }; return h; }
  function logDay(h, k, n) {
    ensureHero(h); const t = today(); h.log[t] = h.log[t] || { t: 0, x: 0 }; h.log[t][k] = (h.log[t][k] || 0) + n;
    const keys = Object.keys(h.log).sort(); while (keys.length > 40) delete h.log[keys.shift()];
  }
  // marca o dia como ativo (sequência) quando o herói cumpre algo
  function markDay(h) {
    ensureHero(h); const t = today(); const st = h.streak;
    if (st.last !== t) { h.streakPrev = { day: t, n: st.n || 0, last: st.last || null, best: st.best || 0 }; st.n = st.last === addDays(t, -1) ? st.n + 1 : 1; st.last = t; st.best = Math.max(st.best || 0, st.n); }
    if (dowOf(t) === 0 && h.log[addDays(t, -1)] && h.log[addDays(t, -1)].t) h.stats.weekend = true;
  }
  function grantXp(h, amount) { ensureHero(h); const ups = addXp(h, amount); logDay(h, 'x', amount); return ups; }
  /* ----- Desfazer uma tarefa concluída hoje ----- */
  // tira o XP sem nunca tirar um nível já conquistado: o que faltar vira "dívida" paga pelas próximas tarefas
  function removeXp(h, amount) {
    ensureHero(h); amount = Math.max(0, Math.round(amount || 0)); if (!amount) return;
    h.stats.xp = Math.max(0, (h.stats.xp || 0) - amount);
    const take = Math.min(h.xp || 0, amount); h.xp -= take; if (amount > take) h.xpDebt = (h.xpDebt || 0) + (amount - take);
    logDay(h, 'x', -amount);
  }
  // desfaz a contagem do dia; se era a única tarefa de hoje, a sequência volta a ser como antes
  function unmarkDay(h, diff) {
    ensureHero(h); const t = today();
    h.stats.done = Math.max(0, (h.stats.done || 0) - 1);
    if (diff && h.stats.byDiff && h.stats.byDiff[diff]) h.stats.byDiff[diff] = Math.max(0, h.stats.byDiff[diff] - 1);
    logDay(h, 't', -1);
    const lg = h.log[t]; if (lg && lg.t < 0) lg.t = 0;
    if ((!lg || !lg.t) && h.streak.last === t && h.streakPrev && h.streakPrev.day === t) { h.streak.n = h.streakPrev.n; h.streak.last = h.streakPrev.last; h.streak.best = h.streakPrev.best; }
  }
  function checkAch(h) {
    ensureHero(h); const got = [];
    for (const a of D.ACH) if (!h.ach[a.id] && a.test(h, { party: S.party })) { h.ach[a.id] = today(); h.bonusGold = (h.bonusGold || 0) + a.gold; got.push(a); }
    got.forEach((a, i) => setTimeout(() => { showToast(`<span>Conquista: <b>${esc(a.name)}</b> · +${a.gold} <span class="coin"></span></span>`); post('ach', `${h.name} conquistou a medalha "${a.name}"`); }, 1800 + i * 2200));
    return got;
  }
  const weekXp = (h) => { const ws = weekStart(today()); return Object.entries(h.log || {}).filter(([d]) => d >= ws).reduce((s2, [, v]) => s2 + (v.x || 0), 0); };
  const weekTasks = (h) => { const ws = weekStart(today()); return Object.entries(h.log || {}).filter(([d]) => d >= ws).reduce((s2, [, v]) => s2 + (v.t || 0), 0); };
  /* histórico de atividades da sala */
  const activityList = () => Object.values(S.activity || {}).sort((a, b) => b.at - a.at);
  function post(kind, text) {
    if (!S.room || S.readOnly) return;
    const id = 'a' + uidGen(); Store.setDoc('activity/' + id, { id, at: Date.now(), day: today(), who: S.me || null, kind, text: String(text).slice(0, 140) });
    const all = activityList(); if (all.length > 120) all.slice(120).forEach((x) => Store.delDoc('activity/' + x.id));
  }
  /* aprovação de tarefas */
  const approvalCfg = () => (S.party && S.party.approval) || { mode: 'off', heroes: [] };
  const needsApproval = (h) => { const c = approvalCfg(); return !isCreator(h.id) && (c.mode === 'all' || (c.mode === 'some' && (c.heroes || []).includes(h.id))); };
  function pendingItems() {
    const out = []; const inboxRefs = new Set(Object.values(S.inbox || {}).map((x) => x.ref && x.ref.id).filter(Boolean));
    for (const h of heroList()) for (const t of h.tasks || []) if (t.pending && !inboxRefs.has(t.id)) out.push({ kind: 'task', hero: h, task: t, xp: t.pendXp || 0 });
    for (const b of boardList()) if (b.pending && !inboxRefs.has(b.id)) out.push({ kind: 'board', hero: S.heroes[b.doneBy], task: b, xp: b.gain || 0 });
    return out.filter((x) => x.hero);
  }
  function sendInbox(to, kind, extra) { const id = 'i' + uidGen(); return Store.setDoc('inbox/' + id, Object.assign({ id, to, kind, at: Date.now(), from: S.me, fromName: S.me && S.heroes[S.me] ? S.heroes[S.me].name : '' }, extra || {})); }
  // a caixa de entrada é lida só pelo dono do herói: assim ninguém sobrescreve o herói de outra pessoa
  let inboxBusy = false;
  async function processInbox() {
    if (inboxBusy || !S.me || S.readOnly) return;
    const mine = Object.values(S.inbox || {}).filter((x) => x.to === S.me && !x.done); if (!mine.length) return;
    inboxBusy = true;
    try {
      // 1) reivindica cada item (só um aparelho aplica cada um)  2) aplica tudo de uma vez no herói  3) salva e apaga
      const claimed = [];
      for (const it of mine) if (await Store.claim('inbox/' + it.id, { done: today() })) claimed.push(it);
      if (!claimed.length) return;
      const h = ensureHero(S.heroes[S.me]); if (!h) return;
      const notes = []; let ups = 0;
      for (const it of claimed) {
        if (it.kind === 'approve') {
          if (it.ref && it.ref.type === 'task') { const t = h.tasks.find((x) => x.id === it.ref.id); if (t) { t.done = today(); t.gain = it.xp; t.pending = null; if (t.wasPunctual) h.stats.punctual = (h.stats.punctual || 0) + 1; } }
          if (it.ref && it.ref.type === 'board') h.stats.board = (h.stats.board || 0) + 1;
          ups += grantXp(h, it.xp || 0); notes.push(`Aprovada: <b>${esc(it.title || 'tarefa')}</b> +${it.xp} XP`);
        } else if (it.kind === 'reject') {
          if (it.ref && it.ref.type === 'task') { const t = h.tasks.find((x) => x.id === it.ref.id); if (t) { t.pending = null; t.pendXp = 0; } }
          h.stats.done = Math.max(0, (h.stats.done || 0) - 1); notes.push(`Não aprovada: <b>${esc(it.title || 'tarefa')}</b>`);
        } else if (it.kind === 'kudos') {
          ups += grantXp(h, it.xp || D.KUDOS_XP); h.stats.kudosGot = (h.stats.kudosGot || 0) + 1; notes.push(`${it.emo ? esc(it.emo) + ' ' : ''}<b>${esc(it.fromName)}</b> elogiou você: "${esc(it.msg || '')}" +${it.xp || D.KUDOS_XP} XP`);
        } else { const r = inboxExtra(h, it); if (r) { ups += r.ups || 0; if (r.note) notes.push(r.note); } }
      }
      checkAch(h); await Store.saveHero(h);
      claimed.forEach((it) => Store.delDoc('inbox/' + it.id));
      notes.forEach((n, i) => setTimeout(() => showToast(`<span>${n}</span>`), i * 2600));
      if (ups && !S.modal) S.modal = { type: 'levelup', heroId: h.id, level: h.level, ups };
      render();
    } finally { inboxBusy = false; }
  }
  function inboxExtra(h, it) { return typeof inboxMore === 'function' ? inboxMore(h, it) : null; }
  /* baú diário */
  function chestState(h) {
    const t = today(); const list = (h.tasks || []).filter(visibleToday);
    const done = list.filter((x) => x.done === t && !x.pending).length;
    return { total: list.length, done, ready: list.length >= 2 && done === list.length && (!h.chest || h.chest.last !== t), opened: !!(h.chest && h.chest.last === t) };
  }

  /* ---------------- Eventos de fim de semana ---------------- */
  const satOf = (d) => { const w = dowOf(d); return w === 6 ? d : w === 0 ? addDays(d, -1) : addDays(d, 6 - w); };
  function eventFor(sat) {
    const [y, m, d] = sat.split('-').map(Number); const n = Math.floor(Date.UTC(y, m - 1, d) / (7 * 864e5));
    const cycle = Math.floor(n / D.EVENTS.length); const r = E.rng(E.hashStr((S.room || 'guilda') + ':' + cycle));
    const perm = D.EVENTS.map((_, i) => i); for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    return Object.assign({ key: sat }, D.EVENTS[perm[n % D.EVENTS.length]]);
  }
  function eventOn(day) { day = day || today(); const w = dowOf(day); return w === 6 || w === 0 ? eventFor(satOf(day)) : null; }
  function eventMul(kind, task, day) {
    const ev = eventOn(day); if (!ev || !ev.fx) return 0;
    if (kind === 'xp') return (ev.fx.xp || 0) + (task && task.diff === 'd' ? ev.fx.xpHard || 0 : 0);
    return ev.fx[kind] || 0;
  }
  const weekendDays = (ev) => [ev.key, addDays(ev.key, 1)];
  function goalProgress(ev) { const [a, b] = weekendDays(ev); return heroList().reduce((s2, h) => s2 + ((h.log && h.log[a] && h.log[a].t) || 0) + ((h.log && h.log[b] && h.log[b].t) || 0), 0); }
  function merchantStock(ev) { const r = E.rng(E.hashStr(S.room + ':merc:' + ev.key)); const lvl = Math.max(1, ...heroList().map((h) => h.level), 1); return [0, 1, 2].map((i) => { const rl = rollRelic(lvl, null, r, ['epica', 'epica', 'lendaria'][i]); rl.id = 'm' + ev.key.replace(/-/g, '') + i; return { relic: rl, price: [160, 320, 600][i] + lvl * 10 }; }); }
  const priceOf = (base, kind) => Math.round(base * (1 - (eventMul(kind) || 0)));
  function eventCard() {
    const ev = eventOn(); const me = S.me && S.heroes[S.me];
    if (!ev) {
      const nxt = eventFor(satOf(today())); const days = daysBetween(today(), nxt.key);
      return `<section class="card evcard soon"><div class="ev-ic">${eventIcon(nxt)}</div><div><div class="eyebrow">Próximo evento · ${days === 1 ? 'amanhã' : `em ${days} dias`}</div><h3>${esc(nxt.name)}</h3><p class="small muted" style="margin:4px 0 0">${esc(nxt.place)} · ${esc(nxt.blurb)}</p></div></section>`;
    }
    let extra = '';
    if (ev.goal) { const pr = goalProgress(ev); const done = pr >= ev.goal.tasks; const claimed = me && me.evClaims && me.evClaims[ev.key];
      extra += `<div class="ev-goal"><div class="row"><b>Meta da guilda:</b> <span class="num">${Math.min(pr, ev.goal.tasks)} / ${ev.goal.tasks}</span> tarefas no fim de semana<span class="spacer"></span>${done ? (claimed ? '<span class="tag win">Prêmio coletado</span>' : `<button class="btn sm primary" data-act="claimGoal">Coletar <span class="coin"></span> ${ev.goal.gold} e ${ev.goal.xp} XP</button>`) : `<span class="small muted">Prêmio: <span class="coin"></span> ${ev.goal.gold} e ${ev.goal.xp} XP para cada herói</span>`}</div><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, Math.round((pr / ev.goal.tasks) * 100))}%"></i></div></div>`; }
    if (ev.merchant && me) { const bought = (me.evBought && me.evBought[ev.key]) || [];
      extra += `<div class="shop" style="margin-top:12px">${merchantStock(ev).map((it, i) => { const R = D.RARITY[it.relic.rarity]; const has = bought.includes(i); return `<div class="item relic" style="--rc:${R.color}"><div class="rar" style="color:${R.color}">${R.name}</div><div class="nm">${esc(it.relic.name)}</div><div class="small muted">${relicTxt(it.relic)}</div>${has ? '<span class="tag win">Comprado</span>' : `<button class="btn sm ${goldOf(me) >= it.price ? 'primary' : ''}" data-act="buyMerchant" data-i="${i}" ${goldOf(me) >= it.price && !S.readOnly ? '' : 'disabled'}><span class="coin"></span> ${it.price}</button>`}</div>`; }).join('')}</div>`; }
    if (ev.extra) { const eb = S.party && S.party.eventBattle && S.party.eventBattle.key === ev.key ? S.party.eventBattle : null;
      const ch = heroList().length ? Math.round(E.winChance(heroList(), stage(), 30, level().mul, ev.extra) * 100) : 0;
      extra += `<div class="ev-goal"><div class="row"><b>${esc(ev.extra.title)}</b><span class="small muted">· batalha extra na noite de domingo · chance hoje ${ch}%</span><span class="spacer"></span>${eb ? `<button class="btn sm" data-act="replayEvent">Rever</button>` : ''}</div><div class="small muted">Vitória: ouro ${ev.extra.gold}x e relíquia ${D.RARITY[ev.extra.relic].name.toLowerCase()} para cada herói. Derrota não muda nada.</div></div>`; }
    if (ev.respec && me) extra += `<div class="ev-goal"><div class="row"><b>Refazer habilidades de graça</b><span class="spacer"></span><button class="btn sm" data-act="respec">Redistribuir meus pontos</button></div></div>`;
    const fxTxt = ev.fx ? Object.entries(ev.fx).map(([k, v]) => ({ xp: `+${Math.round(v * 100)}% de XP`, xpHard: `tarefas difíceis +${Math.round(v * 100)}%`, board: `quadro +${Math.round(v * 100)}%`, chest: `baú +${Math.round(v * 100)}%`, kudos: `elogios ${v + 1}x`, gold: `ouro das vitórias +${Math.round(v * 100)}%`, loot: `saque +${Math.round(v * 100)}%`, punctual: `pontualidade +${Math.round(v * 100)}%`, enemy: `inimigos +${Math.round(v * 100)}%`, gear: `equipamentos −${Math.round(v * 100)}%`, cos: `estilo −${Math.round(v * 100)}%` }[k])).filter(Boolean) : [];
    return `<section class="card evcard on"><div class="ev-ic">${eventIcon(ev)}</div><div style="min-width:0"><div class="eyebrow">Evento de fim de semana · ${esc(ev.place)}</div><h3>${esc(ev.name)}</h3><p class="small" style="margin:4px 0 6px">${esc(ev.blurb)}</p>
      ${fxTxt.length ? `<div class="chips">${fxTxt.map((t) => `<span class="tag evt">${t}</span>`).join('')}</div>` : ''}${extra}</div></section>`;
  }
  function eventIcon(ev) {
    const c = ev.extra ? '#e0665f' : ev.merchant ? '#eab54c' : ev.goal ? '#63c784' : ev.fx && ev.fx.enemy ? '#c8413f' : '#b997f2';
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 40 L24 6 L40 40Z" fill="${c}" opacity=".25"/><path d="M14 40 v-14 l10 -8 10 8 v14Z" fill="${c}"/><path d="M24 4 v10" stroke="${c}" stroke-width="2"/><path d="M24 4 l8 3 -8 3Z" fill="#f4c84a"/><rect x="21" y="30" width="6" height="10" fill="#1a1410"/></svg>`;
  }

  /* ---------------- Relíquias ---------------- */
  function rollRelic(level, sid, r, forceRk) {
    r = r || Math.random;
    const sp = (sid && (D.SPECIES_MAP[sid] || D.BOSSES[sid])) || D.SPECIES[Math.floor(r() * D.SPECIES.length)];
    const roll = r(); const rk = forceRk || (roll < 0.06 + level * 0.004 ? 'lendaria' : roll < 0.3 + level * 0.006 ? 'epica' : 'rara');
    const R = D.RARITY[rk]; const pool = D.RELIC_MODS.slice(); const mod = {};
    for (let i = 0; i < R.mods; i++) { const m = pool.splice(Math.floor(r() * pool.length), 1)[0]; let v = (m.lo + r() * (m.hi - m.lo)) * R.mul; v = m.int ? Math.max(1, Math.round(v)) : Math.round(v * 1000) / 1000; mod[m.k] = v; }
    return { id: 'r' + uidGen(), name: `${D.RELIC_PART[sp.shape] || 'Troféu'} de ${sp.name}`, rarity: rk, sid: sp.id, mod };
  }
  const relicTxt = (rl) => Object.entries(rl.mod || {}).map(([k, v]) => (D.RELIC_MODS.find((m) => m.k === k) || { txt: () => k }).txt(v)).join(', ');
  function addRelic(h, rl) {
    h.relics = h.relics || []; if (h.relics.length >= D.MAX_RELICS) { h.bonusGold = (h.bonusGold || 0) + D.RARITY[rl.rarity].sell; return false; }
    h.relics.push(rl); h.stats.relics = (h.stats.relics || 0) + 1; return true;
  }
  /* ---------------- Pedidos de recompensa ---------------- */
  const requestList = () => Object.values(S.requests || {}).sort((a, b) => b.at - a.at);
  function openRequests() { return requestList().filter((r) => r.status === 'pending' || r.status === 'approved'); }
  function rewardUsage(rw, heroId) { const ws = weekStart(today()); return requestList().filter((q) => q.rewardId === rw.id && q.heroId === heroId && q.status !== 'refused' && q.day >= ws).length; }
  function rewardBlock(rw, h) {
    if (rw.stock != null && rw.stock <= 0) return 'Esgotada';
    if (rw.perWeek && rewardUsage(rw, h.id) >= rw.perWeek) return `Limite da semana (${rw.perWeek})`;
    return '';
  }
  // itens da caixa de entrada que chegam pelas batalhas, eventos e pedidos
  function inboxMore(h, it) {
    if (it.kind === 'loot' && it.relic) { const ok = addRelic(h, it.relic); return { note: ok ? `Saque da batalha: <b style="color:${D.RARITY[it.relic.rarity].color}">${esc(it.relic.name)}</b>` : `Mochila cheia: <b>${esc(it.relic.name)}</b> virou ouro` }; }
    if (it.kind === 'refund') { h.redeemed = Math.max(0, (h.redeemed || 0) - (it.cost || 0)); return { note: `Pedido recusado: <b>${esc(it.title)}</b>. ${it.cost} XP de resgate devolvidos.` }; }
    if (it.kind === 'reqok') return { note: `Pedido aprovado: <b>${esc(it.title)}</b>` };
    if (it.kind === 'delivered') return { note: `Recompensa entregue: <b>${esc(it.title)}</b>. Aproveite!` };
    if (it.kind === 'gold') { h.bonusGold = (h.bonusGold || 0) + (it.gold || 0); const ups = it.xp ? grantXp(h, it.xp) : 0; return { ups, note: `${esc(it.title || 'Prêmio')}: <span class="coin"></span> ${it.gold || 0}${it.xp ? ` e ${it.xp} XP` : ''}` }; }
    return null;
  }
  /* ---------------- Sons (sintetizados, sem arquivos) ---------------- */
  const Sound = {
    ctx: null, on: lsGet('guilda-sound', true), musicTimer: null, last: 0,
    unlocked: false,
    ensure() { if (!this.unlocked) return null; if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; },
    tone(f, dur, type, vol, at, slideTo) {
      const c = this.ctx; if (!c) return; const t0 = c.currentTime + (at || 0);
      const o = c.createOscillator(), g = c.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t0); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol || 0.05, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    noise(dur, vol, at) {
      const c = this.ctx; if (!c) return; const t0 = c.currentTime + (at || 0); const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      src.buffer = buf; g.gain.value = vol || 0.08; src.connect(f).connect(g).connect(c.destination); src.start(t0);
    },
    play(k) {
      if (!this.on || !this.ensure()) return;
      const now = performance.now(); if (['hit', 'crit', 'magic', 'twinkle'].includes(k) && now - this.last < 70) return; this.last = now;
      const T = (f, d, ty, v, a, sl) => this.tone(f, d, ty, v, a, sl);
      switch (k) {
        case 'task': T(523, 0.08, 'square', 0.04); T(659, 0.08, 'square', 0.04, 0.07); T(784, 0.14, 'square', 0.04, 0.14); break;
        case 'level': [523, 659, 784, 1047].forEach((f, i) => T(f, 0.16, 'square', 0.05, i * 0.1)); T(1319, 0.4, 'triangle', 0.05, 0.42); break;
        case 'chest': [880, 1175, 1568, 2093].forEach((f, i) => T(f, 0.12, 'triangle', 0.045, i * 0.06)); break;
        case 'hit': this.noise(0.08, 0.07); T(140, 0.08, 'square', 0.035, 0, 70); break;
        case 'crit': this.noise(0.14, 0.11); T(220, 0.16, 'sawtooth', 0.05, 0, 60); break;
        case 'magic': T(660, 0.18, 'triangle', 0.035, 0, 1320); break;
        case 'twinkle': [1319, 1568, 1976, 2637].forEach((f, i) => T(f, 0.09, 'sine', 0.03, i * 0.045)); T(3136, 0.25, 'triangle', 0.015, 0.18); break;
        case 'heal': T(523, 0.12, 'sine', 0.05, 0, 784); T(784, 0.16, 'sine', 0.04, 0.08, 1047); break;
        case 'ko': T(330, 0.3, 'square', 0.04, 0, 82); break;
        case 'win': [392, 523, 659, 784].forEach((f, i) => T(f, 0.14, 'square', 0.05, i * 0.12)); T(1047, 0.6, 'square', 0.05, 0.5); T(523, 0.6, 'triangle', 0.05, 0.5); break;
        case 'loss': [392, 349, 311, 262].forEach((f, i) => T(f, 0.24, 'triangle', 0.05, i * 0.22)); break;
      }
    },
    // trilha de batalha em loop (8 compassos simples)
    music(start) {
      clearInterval(this.musicTimer); this.musicTimer = null;
      if (!start || !this.on || !this.ensure()) return;
      const bass = [110, 110, 131, 98, 110, 110, 147, 131], mel = [440, 523, 494, 440, 392, 440, 523, 587, 659, 587, 523, 494, 440, 392, 349, 392];
      let step = 0;
      const tick = () => { if (!this.on) return; const b = bass[Math.floor(step / 2) % bass.length]; if (step % 2 === 0) this.tone(b, 0.22, 'triangle', 0.05); if (step % 4 !== 3) this.tone(mel[step % mel.length], 0.11, 'square', 0.018); step++; };
      tick(); this.musicTimer = setInterval(tick, 230);
    },
    toggle() { this.on = !this.on; lsSet('guilda-sound', this.on); if (!this.on) this.music(false); else { this.ensure(); this.play('task'); if (S.modal && S.modal.type === 'replay' && !S.modal.finished) this.music(true); } },
  };
  document.addEventListener('pointerdown', () => { Sound.unlocked = true; if (Sound.on) Sound.ensure(); }, { once: true, capture: true });

  // retrato compacto do herói para refazer a batalha no replay
  const snapshotHero = (h, day) => ({ bday: !!day && bdayBuffOn(h, day), id: h.id, name: h.name, cls: h.cls, look: Object.assign({ anc: 'humano' }, h.look || {}), potion: !!day && h.potion && h.potion.day === day ? h.potion.id : null, cosmetics: Object.fromEntries(Object.keys(D.COSMETIC_SLOTS).map((k) => [k, (h.cosmetics && h.cosmetics[k]) || null])), relics: (h.relics || []).filter((x) => (h.relicOn || []).includes(x.id)), relicOn: (h.relicOn || []).slice(), level: h.level, skills: clone(h.skills || {}), gear: clone(h.gear || {}), mastery: h.mastery || 0, createdAt: h.createdAt || 0 });
  function battleOf(last) {
    if (last.log) return last; // formato antigo
    const res = E.simulate(last.roster, last.stage, last.seed, true, last.mul, last.special || null);
    return Object.assign({}, last, { log: res.log, units: res.units, rounds: res.rounds });
  }

  /* ---------------- Batalha diária ---------------- */
  let resolving = false;
  async function resolveDay(force) {
    if (resolving || S.readOnly || !S.room) return;
    const t = today();
    if (!force && S.party && S.party.lastBattleDay >= t) return;
    resolving = true;
    try {
      if (!(await Store.lock())) return;
      const docs = await Store.fresh();
      let p = docs['party/main'] ? clone(docs['party/main']) : null;
      if (!p) p = newParty();
      if (!force && p.lastBattleDay >= t) return;
      const hs = Object.entries(docs).filter(([k]) => k.startsWith('heroes/')).map(([, v]) => v).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      if (!p.lastBattleDay || !hs.length) { p.lastBattleDay = t; await Store.saveParty(p); return; }
      const battleDay = force ? t : prevDay(t);
      const st = p.stage || 1;
      const evB = eventOn(battleDay); const mul = mulOf(p) * (1 + ((evB && evB.fx && evB.fx.enemy) || 0));
      const roster = hs.map((h) => snapshotHero(h, battleDay));
      const seed = E.hashStr(battleDay + ':' + st + ':' + hs.length + (force ? ':' + Date.now() : ''));
      const res = E.simulate(roster, st, seed, false, mul);
      const gm = typeof eventMul === 'function' ? eventMul('gold', null, battleDay) : 0;
      const gold = res.win ? Math.round(E.goldReward(st) * (1 + gm)) : 0;
      p.earned = p.earned || {};
      if (res.win) { for (const h of hs) p.earned[h.id] = (p.earned[h.id] || 0) + gold; p.stage = st + 1; }
      // bestiário e saque
      const foes = E.buildEnemies(st, hs.length, mul); p.bestiary = p.bestiary || {};
      for (const f of foes) { const b = p.bestiary[f.sid] || { s: 0, k: 0, t: 0 }; b.s++; if (res.win) b.k += f.count || 1; b.t = Math.max(b.t, f.tier || 0); p.bestiary[f.sid] = b; }
      if (res.win && foes.some((f) => f.boss)) p.bossWins = (p.bossWins || 0) + 1;
      if (res.win) {
        const lr = E.rng(seed ^ 0x5bd1e995); const lm = 1 + (typeof eventMul === 'function' ? eventMul('loot', null, battleDay) : 0);
        const boss = foes.some((f) => f.boss);
        for (const h of hs) if (lr() < (boss ? 1 : 0.3) * lm) { const f = foes[Math.floor(lr() * foes.length)]; sendInbox(h.id, 'loot', { relic: rollRelic(h.level, f.sid, lr) }); }
      }
      post('battle', `${res.win ? 'Vitória' : 'Derrota'} no estágio ${st} (${E.regionOf(st).name})${res.win ? `: +${gold} de ouro para cada herói` : ''}`);
      const missed = Math.max(0, daysBetween(p.lastBattleDay, t) - 1);
      p.last = { id: uidGen(), day: battleDay, stage: st, win: res.win, gold, rounds: res.rounds, seed, mul, roster, missed: force ? 0 : missed, test: !!force };
      p.history = [{ day: battleDay, stage: st, win: res.win, gold, test: !!force }].concat(p.history || []).slice(0, 10);
      // batalha extra do evento (noite de domingo)
      if (!force && evB && evB.extra && dowOf(battleDay) === 0 && !(p.eventBattle && p.eventBattle.key === evB.key)) {
        const eseed = E.hashStr('evt:' + evB.key + ':' + S.room);
        const er = E.simulate(roster, st, eseed, false, mul, evB.extra);
        const eg = er.win ? E.goldReward(st) * evB.extra.gold : 0;
        if (er.win) { for (const h of hs) { p.earned[h.id] = (p.earned[h.id] || 0) + eg; const lr = E.rng(eseed ^ E.hashStr(h.id)); const rl = rollRelic(h.level, evB.extra.boss, lr, evB.extra.relic); sendInbox(h.id, 'loot', { relic: rl }); } }
        p.eventBattle = { id: uidGen(), key: evB.key, name: evB.name, day: battleDay, stage: st, win: er.win, gold: eg, rounds: er.rounds, seed: eseed, mul, roster, special: evB.extra, event: true };
        post('battle', `${evB.extra.title}: ${er.win ? `vitória! +${eg} de ouro para cada herói` : 'a guilda não resistiu desta vez'}`);
      }
      if (!force) p.lastBattleDay = t;
      await Store.saveParty(p);
      if (force) { const h = S.me && S.heroes[S.me]; if (h) { h.seenBattle = p.last.id; Store.saveHero(h); } openReplay(battleOf(p.last)); }
      else maybeShowReport();
    } finally { resolving = false; render(); }
  }
  function prevDay(s) { const [y, m, d] = s.split('-').map(Number); const dt = new Date(y, m - 1, d - 1); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; }
  function daysBetween(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 864e5); }
  // cada personagem vê a batalha na primeira vez que entra depois dela
  function maybeShowReport() {
    const last = S.party && S.party.last; if (!last || S.modal || S.readOnly) return;
    if (!['home', 'hero'].includes(S.view)) return;
    const h = S.me && S.heroes[S.me]; if (!h) return;
    if (h.seenBattle === last.id) { const eb = S.party.eventBattle; if (eb && h.seenEvent !== eb.id && eb.roster.some((x) => x.id === h.id)) { h.seenEvent = eb.id; Store.saveHero(h); openReplay(battleOf(eb)); } return; }
    if (!last.roster || !last.roster.some((x) => x.id === h.id)) { h.seenBattle = last.id; Store.saveHero(h); return; }
    h.seenBattle = last.id; Store.saveHero(h);
    openReplay(battleOf(last));
  }
  const newParty = () => ({ stage: 1, lastBattleDay: today(), earned: {}, history: [], last: null, diffMul: 1, creatorId: null });
  function computeChance() {
    const hs = heroList(); if (!hs.length) { S.chance = null; return; }
    const key = stage() + '|' + level().mul + '|' + hs.map((h) => [h.id, h.level, ancOf(h).id, JSON.stringify(h.skills), JSON.stringify(h.gear), h.mastery].join(':')).join('|');
    if (key === S.chanceKey) return;
    S.chanceKey = key; S.chance = E.winChance(hs, stage(), 60, level().mul);
  }

  /* ---------------- Render ---------------- */
  function render() {
    if (!S.ready || S.busy) { $app.innerHTML = `<div class="loading"><div><h2>Abrindo os portões da guilda…</h2><p class="muted">Carregando os heróis da família.</p></div></div>`; return; }
    if (S.room && S.view !== 'rooms') computeChance();
    const focus = document.activeElement && document.activeElement.id;
    const sel = document.activeElement && document.activeElement.selectionStart;
    let html = S.room || S.view === 'rooms' ? topbar() : '';
    if (S.mode === 'local') html += `<div class="banner">Modo local: os dados ficam salvos só neste aparelho.</div>`;
    if (S.stale) html += `<div class="banner ro">Ainda não deu para confirmar os dados mais recentes da guilda. O que aparece aqui pode estar desatualizado.</div>`;
    if (S.readOnly) html += `<div class="banner ro">Você pode ver a guilda, mas não editar. Peça para o dono da página te dar acesso de edição.</div>`;
    if (!S.room) S.view = 'rooms';
    else if (['home', 'hero', 'settings', 'bestiary', 'report'].includes(S.view) && !(S.me && S.heroes[S.me])) S.view = 'select';
    if (S.view === 'rooms') html += roomsView();
    else if (S.view === 'select') html += selectView();
    else if (S.view === 'create') html += createView();
    else if (S.view === 'settings') html += settingsView();
    else if (S.view === 'bestiary' && S.me) html += bestiaryView();
    else if (S.view === 'report' && S.me) html += reportView();
    else if (S.view === 'hero' && S.heroId === S.me && S.heroes[S.me]) html += heroView(S.heroes[S.me]);
    else { S.view = 'home'; html += homeView(); }
    if (!document.getElementById('page')) $app.innerHTML = '<div id="page"></div><div id="overlay"></div><div id="toast-root"></div>';
    document.getElementById('page').innerHTML = `<div class="wrap">${html}</div>`;
    const ov = document.getElementById('overlay');
    const keepScene = S.modal && S.modal.type === 'replay' && ov.dataset.key === S.modal.key && document.getElementById('scene');
    if (!keepScene) { ov.innerHTML = S.modal ? modalHtml() : ''; ov.dataset.key = S.modal && S.modal.key ? S.modal.key : ''; }
    document.getElementById('toast-root').innerHTML = S.toast ? toastHtml() : '';
    if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); if (sel != null && el.setSelectionRange) try { el.setSelectionRange(sel, sel); } catch (e) { /* ok */ } } }
    if (S.view === 'hero' && S.tab === 'habilidades') drawLinks();
    if (S.modal && S.modal.type === 'replay' && !keepScene) mountReplay();
    renderTut();
  }

  /* ---------------- Tutorial passo a passo ---------------- */
  const TUT = [
    { view: 'home', title: 'Bem-vindo à guilda!', text: (h) => `Olá, ${h.name}! Aqui cada tarefa de casa vira experiência para o seu herói. Vou mostrar o caminho em poucos passos.` },
    { view: 'home', sel: '.nightfight', title: 'A batalha da noite', text: () => 'Toda meia-noite a guilda enfrenta os inimigos deste card. Aqui ficam o desafio, a dificuldade e a chance de vitória. Vencer dá ouro e avança de estágio.' },
    { view: 'home', sel: '.slot.mine', title: 'Este é você', text: () => 'Seu herói fica no salão junto com a família. Toque nele para abrir tarefas, habilidades e loja.' },
    { view: 'home', sel: '.slot.other .kudos-btn', title: 'Elogios com emoji', text: () => 'Elogie alguém com um emoji. Ele aparece embaixo do herói o dia todo, e a pessoa ganha XP. São 3 elogios por dia.' },
    { view: 'home', sel: '.board', title: 'Quadro da guilda', text: () => 'Missões da casa. Escolha os responsáveis ou deixe para qualquer herói: quem cumprir primeiro leva a experiência.' },
    { view: 'hero', tab: 'tarefas', sel: '.addtask', title: 'Suas tarefas', text: () => 'Escreva o que vai fazer e escolha a dificuldade: difíceis valem mais. Terminar todas as tarefas do dia abre o baú.' },
    { view: 'hero', tab: 'tarefas', sel: '.tabs', title: 'Tudo sobre o seu herói', text: () => 'Recompensas da vida real, habilidades, loja, medalhas e visual ficam nestas abas.' },
    { view: 'hero', tab: 'habilidades', sel: '.tree', title: 'Habilidades', text: () => 'Cada nível dá 1 ponto. Gaste aqui: as habilidades deixam o herói bem mais forte na batalha. A árvore vai até o nível 50.' },
    { view: 'hero', tab: 'loja', sel: '.shop-cats', title: 'Loja', text: () => 'Use o ouro das vitórias em equipamentos, poções e itens de estilo. Toque na imagem de um item para ver de perto.' },
    { view: 'home', sel: '[data-act=settings]', title: 'Configurações', text: () => 'Como criador, aqui você define tarefas obrigatórias, recompensas, dificuldade, PIN e co-criadores.' },
    { view: 'home', sel: '[data-act=tutorial]', title: 'Pronto para a aventura!', text: () => 'Para rever este passo a passo quando quiser, toque em Tutorial.' },
  ];
  const tutOff = () => { try { return localStorage.getItem('guilda-notut') === '1'; } catch (e) { return false; } };
  function maybeStartTut() {
    const h = S.me && S.heroes[S.me];
    if (!h || h.tut || S.tut || S.modal || S.readOnly || tutOff() || !['home', 'hero'].includes(S.view)) return;
    S.tutAsked = S.tutAsked || {}; if (S.tutAsked[h.id]) return; S.tutAsked[h.id] = true;
    setTimeout(() => { if (!S.modal && !S.tut && S.me === h.id) startTut(); }, 500);
  }
  function startTut() { if (!S.me || !S.heroes[S.me]) return; S.modal = null; S.tut = { i: 0 }; tutGo(0, 1); }
  function tutGo(i, dir) {
    while (i >= 0 && i < TUT.length) {
      const st = TUT[i];
      if (st.view === 'home') { S.view = 'home'; S.heroId = null; } else { S.view = 'hero'; S.heroId = S.me; S.tab = st.tab || 'tarefas'; }
      S.tut.i = i; render();
      if (!st.sel || document.querySelector(st.sel)) break;
      i += dir;
    }
    if (i < 0) { S.tut.i = 0; return; }
    if (i >= TUT.length) { endTut(); return; }
    const st = TUT[i]; const el = st.sel && document.querySelector(st.sel);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' }); else scrollTo(0, 0);
    setTimeout(positionTut, 60);
  }
  function endTut() {
    S.tut = null; const h = S.me && S.heroes[S.me];
    if (h && !h.tut && !S.readOnly) { h.tut = 1; Store.saveHero(h); }
    S.view = 'home'; S.heroId = null; render(); scrollTo(0, 0);
  }
  function renderTut() {
    let root = document.getElementById('tut');
    if (!S.tut) { if (root) root.remove(); if (S.ready) maybeStartTut(); return; }
    if (!root) { root = document.createElement('div'); root.id = 'tut'; document.body.appendChild(root); }
    const st = TUT[S.tut.i]; const h = S.heroes[S.me] || { name: '' };
    const n = TUT.length, last = S.tut.i === n - 1;
    root.className = 'tut';
    root.innerHTML = `<div class="tut-hole" id="tut-hole"></div><div class="tut-pop" id="tut-pop" role="dialog" aria-modal="true" aria-labelledby="tut-t"><div class="eyebrow">Passo ${S.tut.i + 1} de ${n}</div><h3 id="tut-t">${esc(st.title)}</h3><p>${esc(st.text(h))}</p>
      <div class="tut-dots">${TUT.map((_, k) => `<i class="${k === S.tut.i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row"><button class="btn sm ghost" data-act="tutSkip">Pular tutorial</button><span class="spacer"></span>${S.tut.i ? '<button class="btn sm" data-act="tutPrev">Voltar</button>' : ''}<button class="btn sm primary" data-act="tutNext">${last ? 'Começar!' : 'Próximo'}</button></div></div>`;
    positionTut();
  }
  function positionTut() {
    if (!S.tut) return; const st = TUT[S.tut.i]; const hole = document.getElementById('tut-hole'), pop = document.getElementById('tut-pop'); if (!hole || !pop) return;
    const el = st.sel && document.querySelector(st.sel); const vw = innerWidth, vh = innerHeight;
    if (!el) { hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`; pop.style.left = Math.max(10, (vw - pop.offsetWidth) / 2) + 'px'; pop.style.top = Math.max(10, (vh - pop.offsetHeight) / 2) + 'px'; return; }
    const r = el.getBoundingClientRect(); const pad = 8;
    const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad), w = Math.min(vw - 8, r.width + pad * 2), hgt = Math.min(vh - 8, r.height + pad * 2);
    hole.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${hgt}px`;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let py = top + hgt + 12; if (py + ph > vh - 8) py = top - ph - 12; if (py < 8) py = vh - ph - 8; // alvo maior que a tela: balão no pé da tela
    let px = left + w / 2 - pw / 2; px = Math.max(8, Math.min(vw - pw - 8, px));
    pop.style.left = px + 'px'; pop.style.top = py + 'px';
  }
  addEventListener('resize', positionTut); addEventListener('scroll', positionTut, { passive: true });
  function countdown() {
    const n = new Date(); const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    const m = Math.max(0, Math.round((mid - n) / 60000)); return `${Math.floor(m / 60)}h ${pad(m % 60)}min`;
  }
  function topbar() {
    const inRoom = S.room && !['rooms'].includes(S.view);
    const me = S.me && S.heroes[S.me];
    const title = (S.roomMeta && S.roomMeta.name) || 'Guilda da Família';
    const back = ['hero', 'create', 'settings', 'bestiary', 'report'].includes(S.view) && S.me ? `<button class="back" data-act="home">← Salão</button>` : '';
    return `<header class="topbar"><div class="brand">${back}<h1>${esc(inRoom ? title : 'Guilda da Família')}</h1></div>
      ${inRoom ? `<div class="chips">${Acct.on() && S.acct.rooms.length > 1 ? `<label class="chip room-sw"><span class="sr-only">Trocar de sala</span><select id="room-switch" aria-label="Trocar de sala">${S.acct.rooms.map((r) => `<option value="${esc(r.code)}" ${r.code === S.room ? 'selected' : ''}>${esc(r.name || r.code)} · ${esc(r.code)}</option>`).join('')}</select></label>` : `<span class="chip">Sala <b class="num">${esc(S.room)}</b></span>`}${S.party && S.view !== 'select' ? `<span class="chip">Estágio <b class="num">${stage()}</b> · ${esc(E.regionOf(stage()).name)}</span><span class="chip warn">Batalha à meia-noite · <b class="num">${countdown()}</b></span>` : ''}</div>` : ''}</header>
      ${inRoom ? `<div class="sessbar">${me ? `<span class="who">${A.heroSvg(me, { noPet: true, noWeapon: true })}<span>Jogando como <b>${esc(me.name)}</b> ${roleTag(me)}</span></span>` : '<span class="muted">Escolha seu personagem</span>'}
        <span class="spacer"></span><button class="btn sm ghost" data-act="toggleSound" aria-pressed="${Sound.on}">${Sound.on ? 'Som ligado' : 'Som desligado'}</button>${me ? '<button class="btn sm ghost" data-act="tutorial">Tutorial</button>' : ''}${isCreator() && S.view !== 'settings' ? `<button class="btn sm" data-act="settings">Configurações${adminBadge() ? `<span class="dot">${adminBadge()}</span>` : ''}</button>` : ''}${me ? `<button class="btn sm ghost" data-act="switchHero">Trocar personagem</button>` : ''}<button class="btn sm ghost" data-act="leaveRoom">Sair da sala</button></div>` : ''}`;
  }
  const adminBadge = () => pendingItems().length + (typeof openRequests === 'function' ? openRequests().length : 0);
  /* ----- Entrada: código da sala ----- */
  function roomsView() {
    const last = lsGet('guilda-last-room', null);
    return `<section class="gate"><div class="gate-hero"><div class="eyebrow">Tarefas da família viram aventura</div><h2>Entre na sala da sua guilda</h2>
      <p class="muted">Cada sala é uma guilda separada, com até 5 heróis. Quem cria a sala recebe um código para passar para a família.</p></div>
      ${accountCard()}
      <div class="grid2"><form class="card" data-form="join"><div class="eyebrow">Já tenho um código</div><h3>Entrar numa sala</h3>
        <div class="field" style="margin-top:12px"><label for="room-code">Código da sala</label><input type="text" id="room-code" class="code-in" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters" value="${esc(S.joinDraft || '')}"></div>
        ${S.roomErr ? `<p class="small" style="color:var(--bad);margin-top:-8px">${esc(S.roomErr)}</p>` : ''}
        <div class="row"><button class="btn primary" type="submit">Entrar</button>${last ? `<button class="btn ghost" type="button" data-act="joinLast">Voltar para ${esc(last)}</button>` : ''}</div></form>
      <form class="card" data-form="newroom"><div class="eyebrow">Começar do zero</div><h3>Criar sala nova</h3>
        <div class="field" style="margin-top:12px"><label for="room-name">Nome da guilda</label><input type="text" id="room-name" value="${esc((S.inputs || {})["room-name"] || "")}" maxlength="28" placeholder="Guilda da Família" autocomplete="off"></div>
        <p class="small muted" style="margin-top:-6px">O primeiro herói criado na sala vira o criador e controla as configurações.</p>
        <button class="btn primary" type="submit">Criar sala</button></form></div></section>`;
  }
  function accountCard() {
    if (!Store.server) return '';
    if (!S.acct) {
      return `<section class="card acct-card"><div class="card-h"><div><div class="eyebrow">Conta (opcional)</div><h3>Entrar com e-mail</h3></div><span class="small muted">Com uma conta, todas as suas salas ficam reunidas e você troca entre elas num toque, em qualquer aparelho.</span></div>
        <form class="acct-form" data-form="login">
          <div class="field"><label for="acct-email">E-mail</label><input type="email" id="acct-email" autocomplete="username" maxlength="120" placeholder="voce@exemplo.com" value="${esc((S.inputs || {})['acct-email'] || '')}"></div>
          <div class="field"><label for="acct-pass">Senha</label><input type="password" id="acct-pass" autocomplete="current-password" maxlength="200" placeholder="Pelo menos 6 caracteres"></div>
          ${S.authErr ? `<p class="small" style="color:var(--bad);margin:0">${esc(S.authErr)}</p>` : ''}
          <div class="row"><button class="btn primary" type="submit" ${S.authBusy ? 'disabled' : ''}>Entrar</button><button class="btn ghost" type="button" data-act="register" ${S.authBusy ? 'disabled' : ''}>Criar conta</button></div>
        </form></section>`;
    }
    const rooms = S.acct.rooms || [];
    return `<section class="card acct-card"><div class="card-h"><div><div class="eyebrow">Minhas salas</div><h3>${esc(S.acct.email)}</h3></div><span class="row" style="gap:6px"><button class="btn sm ghost" data-act="showLogin">${S.passOpen ? 'Fechar' : 'Trocar senha'}</button><button class="btn sm ghost" data-act="logout">Sair da conta</button></span></div>
      ${S.passOpen ? `<form class="acct-form" data-form="pass" style="margin-top:10px"><div class="field"><label for="pass-old">Senha atual</label><input type="password" id="pass-old" autocomplete="current-password"></div><div class="field"><label for="pass-new">Senha nova</label><input type="password" id="pass-new" autocomplete="new-password" placeholder="Pelo menos 6 caracteres"></div>${S.authErr ? `<p class="small" style="color:var(--bad);margin:0">${esc(S.authErr)}</p>` : ''}<div class="row"><button class="btn primary" type="submit">Salvar senha nova</button></div></form>` : ''}
      ${rooms.length ? `<ul class="my-rooms">${rooms.map((r) => `<li><button class="room-go" data-act="goRoom" data-code="${esc(r.code)}"><b>${esc(r.name || r.code)}</b><span class="small muted">Sala ${esc(r.code)}${r.heroName ? ' · ' + esc(r.heroName) : ''}</span></button><button class="del" data-act="forgetRoom" data-code="${esc(r.code)}" title="Tirar da lista" aria-label="Tirar ${esc(r.name || r.code)} da lista">×</button></li>`).join('')}</ul>`
        : '<p class="small muted" style="margin:10px 0 0">Nenhuma sala ainda. Entre com um código ou crie uma sala: ela fica guardada aqui.</p>'}</section>`;
  }
  /* ----- Escolha do personagem ----- */
  function selectView() {
    const hs = heroList();
    const cards = hs.map((h) => { const c = D.CLASSES[h.cls]; return `<button class="pickme" data-act="pickMe" data-id="${h.id}"><span class="lv num">Nv ${h.level}</span><div class="fig"><div class="idle">${A.heroSvg(h)}</div></div><div class="nm">${esc(h.name)}</div><div class="cl"><span style="color:${c.color}">${c.name}</span> · ${ancOf(h).name}</div>${roleTag(h)}</button>`; }).join('');
    return `<section class="gate"><div class="gate-hero"><div class="eyebrow">Sala ${esc(S.room)}</div><h2>Quem está jogando?</h2><p class="muted">Escolha o seu personagem. Você só mexe nas tarefas, habilidades e itens dele.${S.party && !S.party.creatorId ? ' O primeiro herói criado vira o criador da sala.' : ''}</p></div>
      <div class="picklist">${cards}${hs.length < D.MAX_HEROES ? `<button class="pickme new" data-act="create" ${S.readOnly ? 'disabled' : ''}><div class="fig"><span class="plus">+</span></div><div class="nm">Criar herói</div><div class="cl">Vaga ${hs.length + 1} de ${D.MAX_HEROES}</div></button>` : ''}</div>
      <p class="small muted" style="margin-top:16px">Passe o código <b>${esc(S.room)}</b> para a família entrar na mesma sala.</p></section>`;
  }

  function homeView() {
    const hs = heroList();
    const slots = [];
    for (let i = 0; i < D.MAX_HEROES; i++) {
      const h = hs[i];
      if (h) {
        const c = D.CLASSES[h.cls]; const mine = h.id === S.me;
        const pend = (h.tasks || []).filter((t) => !t.done).length, done = (h.tasks || []).filter((t) => t.done === today()).length;
        slots.push(`<${mine ? 'button' : 'div'} class="slot${mine ? ' mine' : ' other'}" ${mine ? `data-act="open" data-id="${h.id}" aria-label="Abrir ${esc(h.name)}"` : ''}><span class="lv num">Nv ${h.level}</span><div class="fig"><div class="idle">${A.heroSvg(h)}</div></div>
          <div class="nm">${esc(h.name)}</div><div class="cl"><span style="color:${c.color}">${c.name}</span> · ${ancOf(h).name}</div>
          <div class="bar" style="margin:6px 12px 0"><i style="width:${Math.round((h.xp / D.xpToNext(h.level)) * 100)}%"></i></div>
          <div class="pend muted">${mine ? '<b style="color:var(--gold-2)">Você</b> · ' : ''}${done ? `${done} feita${done > 1 ? 's' : ''} hoje` : ''}${done && pend ? ' · ' : ''}${pend ? `${pend} pendente${pend > 1 ? 's' : ''}` : ''}${!done && !pend ? 'Sem tarefas hoje' : ''}</div>
          ${streakNow(h) > 1 ? `<div class="small" style="color:#ffb070">${streakNow(h)} dias seguidos</div>` : ''}${isBday(h) ? '<div class="tag bday-tag">Aniversariante</div>' : ''}${kudosStrip(h.id)}
          ${!mine && S.me && !S.readOnly ? `<button class="btn sm kudos-btn" data-act="askKudos" data-id="${h.id}" ${kudosLeft(h.id) ? '' : 'disabled'}>${kudosGivenTo(h.id) ? 'Elogiado hoje' : 'Elogiar'}</button>` : ''}</${mine ? 'button' : 'div'}>`);
      } else slots.push(`<div class="slot empty"><div class="fig"><span class="plus">+</span>Vaga livre</div><div class="cl">Vaga ${i + 1} de ${D.MAX_HEROES}</div></div>`);
    }
    return `${bdayBanner()}${battleBanner()}
      <section class="stage"><div class="lineup">${slots.join('')}</div></section>
      <p class="muted" style="margin:-8px 0 18px">Toque no seu herói para ver suas tarefas de hoje. Novos membros entram pela tela de escolha de personagem.</p>
      ${eventCard()}
      ${boardCard()}
      <div class="grid2">${lastBattleCard()}${rankingCard()}</div>
      ${mvpCard() ? `<div style="margin-top:18px">${mvpCard()}</div>` : ''}
      <div style="margin-top:18px">${activityCard()}</div>`;
  }
  function rankingCard() {
    const hs = heroList().map((h) => ({ h, x: weekXp(h), t: weekTasks(h) })).sort((a, b) => b.x - a.x || b.t - a.t);
    const ws = weekStart(today());
    return `<section class="card"><div class="card-h"><div><div class="eyebrow">Ranking da semana</div><h3>Quem mais ajudou</h3></div><span class="small muted">Desde ${D.WEEKDAYS[1].toLowerCase()}., ${fmtDay(ws)}</span></div>
      ${hs.length ? `<ol class="rank">${hs.map((r, i) => `<li class="${i < 3 && r.x ? 'top' + (i + 1) : ''}"><span class="pos num">${i + 1}</span><span class="ic">${A.heroSvg(r.h, { noPet: true, noWeapon: true })}</span><span class="nm">${esc(r.h.name)}${r.h.id === S.me ? ' <span class="small muted">(você)</span>' : ''}</span><span class="small muted num">${r.t} tarefa${r.t === 1 ? '' : 's'}</span><b class="num">${r.x} XP</b></li>`).join('')}</ol>` : '<p class="muted">Sem heróis ainda.</p>'}</section>`;
  }
  function activityCard() {
    const list = activityList().slice(0, 12);
    const when = (a) => { const d = new Date(a.at); return a.day === today() ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtDay(a.day); };
    return `<section class="card"><div class="card-h"><div><div class="eyebrow">Histórico da sala</div><h3>Atividades recentes</h3></div></div>
      ${list.length ? `<ul class="feedlist">${list.map((a) => `<li class="k-${esc(a.kind)}"><span class="when num">${when(a)}</span><span>${esc(a.text)}</span></li>`).join('')}</ul>` : '<p class="muted small">As tarefas cumpridas, elogios, conquistas e batalhas aparecem aqui.</p>'}</section>`;
  }
  const kudosGivenTo = (id) => { const h = S.me && S.heroes[S.me]; const k = h && h.kudos; return !!(k && k.day === today() && (k.to || []).includes(id)); };
  const KUDOS_EMO = ['⭐', '💪', '❤️', '🎉', '👏', '🏆', '😄', '🌟', '🙌', '🦸'];
  // elogios recebidos hoje por um herói: lidos dos heróis que elogiaram (cada um guarda os seus)
  function kudosFor(id) {
    const t = today(); const out = [];
    for (const g of heroList()) { const k = g.kudos; if (!k || k.day !== t || !(k.to || []).includes(id)) continue; const e = (k.emo || {})[id] || { e: '⭐', m: '' }; out.push({ from: g.name, e: e.e || '⭐', m: e.m || '' }); }
    return out;
  }
  function kudosStrip(id) {
    const ks = kudosFor(id); if (!ks.length) return '';
    return `<div class="kudos-emo" title="${esc(ks.map((k) => `${k.from}: ${k.e} ${k.m}`).join(' · '))}">${ks.map((k) => `<span class="ke" aria-label="Elogio de ${esc(k.from)}">${k.e}</span>`).join('')}</div>`;
  }
  const kudosLeft = (id) => { const h = S.me && S.heroes[S.me]; if (!h) return false; const k = h.kudos && h.kudos.day === today() ? h.kudos : { to: [] }; return k.to.length < D.KUDOS_PER_DAY && !k.to.includes(id); };
  // responsáveis por uma missão do quadro: lista vazia = qualquer herói
  const whoOf = (t) => (t && Array.isArray(t.who) ? t.who.filter((id) => S.heroes[id]) : []);
  const canDoBoard = (t, id) => { const w = whoOf(t); return !w.length || w.includes(id); };
  function whoPicker(sel, act) {
    const hs = heroList();
    return `<div class="field who-field"><span class="lbl">Responsáveis</span><div class="who-opts">
      <label class="who-item any${!sel.length ? ' on' : ''}"><input type="checkbox" data-act="${act}" value="" ${!sel.length ? 'checked' : ''}><span class="wi">✦</span><span>Qualquer herói</span></label>
      ${hs.map((h) => { const on = sel.includes(h.id); return `<label class="who-item${on ? ' on' : ''}"><input type="checkbox" data-act="${act}" value="${h.id}" ${on ? 'checked' : ''}><span class="wi">${A.heroSvg(h, { noPet: true, noWeapon: true })}</span><span>${esc(h.name)}</span></label>`; }).join('')}</div></div>`;
  }
  // retratinho redondo do herói (rosto)
  const face = (h, cls) => `<span class="face${cls ? ' ' + cls : ''}" title="${esc(h.name)}">${A.heroSvg(h, { noPet: true, noWeapon: true })}</span>`;
  function boardFaces(t) {
    const who = whoOf(t); const hs = who.length ? who.map((id) => S.heroes[id]) : heroList();
    if (!hs.length) return '';
    const doers = t.done ? (t.parts && t.parts.length ? t.parts : [t.doneBy]) : (t.parts || []);
    return `<span class="faces${who.length ? '' : ' any'}" title="${who.length ? 'Responsáveis: ' + esc(hs.map((h) => h.name).join(', ')) : 'Qualquer herói'}">${hs.map((h) => face(h, doers.includes(h.id) ? 'did' : '')).join('')}</span>`;
  }
  const boardFuture = (t) => !t.done && dueDay(t) > today();
  const boardFilterOk = (t) => { const f = S.boardFilter; if (!f || !S.heroes[f]) return true; const w = whoOf(t); return !w.length || w.includes(f); };
  // pode desfazer: missão que eu cumpri hoje (ou minha parte numa dupla)
  const canUndoBoard = (t) => !!S.me && !S.readOnly && ((t.done === today() && (t.doneBy === S.me || (t.parts || []).includes(S.me))) || (!t.done && (t.parts || []).includes(S.me)));
  const toggleWho = (list, v) => (v === '' ? [] : list.includes(v) ? list.filter((x) => x !== v) : list.concat(v));
  function boardRow(t) {
    const d = D.DIFF[t.diff]; const x = xpFor(t);
    const by = t.done ? (S.heroes[t.doneBy] ? S.heroes[t.doneBy].name : t.doneByName || 'alguém') : '';
    const parts = t.parts || []; const mine = S.me && parts.includes(S.me);
    const share = t.duo ? Math.round(x.total * D.DUO_SHARE) : x.total;
    const xpTxt = t.done ? `+${t.gain || x.base} XP` : t.duo ? `+${share} XP cada` : x.total !== x.base ? `<s>${x.base}</s>+${x.total} XP` : `+${x.total} XP`;
    const who = whoOf(t); const notMine = !!S.me && !canDoBoard(t, S.me); const future = boardFuture(t);
    const blocked = S.readOnly || !!t.done || mine || notMine || future;
    const meta = taskMeta(Object.assign({}, t, { pending: null }), x)
      + (t.duo ? `<span class="tag duo">Em dupla${parts.length === 1 && !t.done ? ` · ${esc(t.partNames && t.partNames[0] || '')} já fez a parte` : ''}</span>` : '')
      + (t.pending ? '<span class="tag wait">Aguardando aprovação</span>' : '')
      + (t.done ? `<span>feita por <b>${esc(t.duo && t.partNames ? t.partNames.join(' e ') : by)}</b></span>` : '')
      + (who.length && !t.done ? `<span class="tag who">Para: ${who.map((id) => esc(S.heroes[id].name)).join(', ')}</span>` : '');
    return `<li class="task${t.done ? ' done' : ''}${x.carried ? ' carried' : ''}" style="--c:${d.color}">
      <button class="done-btn" data-act="${blocked ? 'noop' : 'doneBoard'}" data-id="${t.id}" aria-label="${t.done ? 'Cumprida' : 'Cumprir ' + esc(t.title)}" ${blocked ? 'disabled' : ''}${notMine && !t.done ? ` title="Missão de ${esc(who.map((id) => S.heroes[id].name).join(', '))}"` : ''}>${t.done ? '✓' : mine ? '½' : ''}</button>
      <div><div class="t">${esc(t.title)}${boardFaces(t)}</div><div class="sub">${meta}</div></div>
      <div class="xp num">${xpTxt}</div>
      <div class="tact">${canUndoBoard(t) ? `<button class="del undo" data-act="undoBoard" data-id="${t.id}" aria-label="Desfazer: ${esc(t.title)}" title="Desfazer (não fiz)">↺</button>` : ''}${!t.done && !parts.length ? `<button class="del" data-act="editTask" data-scope="board" data-id="${t.id}" aria-label="Editar missão" title="Editar">✎</button>` : ''}<button class="del" data-act="delBoard" data-id="${t.id}" aria-label="Apagar missão" title="Apagar" ${S.readOnly ? 'disabled' : ''}>×</button></div></li>`;
  }
  function boardFilterBar() {
    const hs = heroList(); if (hs.length < 2) return '';
    const f = S.boardFilter && S.heroes[S.boardFilter] ? S.boardFilter : '';
    return `<div class="board-filter" role="group" aria-label="Filtrar missões por herói"><span class="small muted">Ver missões de</span>
      <button type="button" class="who-item any${!f ? ' on' : ''}" data-act="boardFilter" data-v="" aria-pressed="${!f}"><span class="wi">✦</span><span>Todos</span></button>
      ${hs.map((h) => `<button type="button" class="who-item${f === h.id ? ' on' : ''}" data-act="boardFilter" data-v="${h.id}" aria-pressed="${f === h.id}"><span class="wi">${A.heroSvg(h, { noPet: true, noWeapon: true })}</span><span>${esc(h.name)}</span></button>`).join('')}</div>`;
  }
  function boardCard() {
    const t = today(); const all = boardList().filter(boardFilterOk);
    const open = all.filter((x) => !x.done && !boardFuture(x)); const done = all.filter((x) => x.done === t); const later = all.filter(boardFuture);
    return `<section class="card board" style="margin-bottom:18px"><div class="card-h"><div><div class="eyebrow">Quadro da guilda</div><h3>Missões da guilda</h3></div><span class="small muted">Escolha os responsáveis ou deixe para qualquer herói. Quem cumprir primeiro leva a experiência.</span></div>
      <form class="addtask" data-form="board"><div class="row"><input type="text" id="board-title" value="${esc((S.inputs || {})["board-title"] || "")}" maxlength="80" placeholder="Ex.: Tirar o lixo, passear com o cachorro, regar as plantas" autocomplete="off" style="flex:1;min-width:200px" ${S.readOnly ? 'disabled' : ''}>
        <button class="btn primary" type="submit" ${S.readOnly ? 'disabled' : ''}>Fixar no quadro</button></div>
        <div class="row"><div class="seg" role="group" aria-label="Dificuldade">${diffButtons()}</div><label class="check"><input type="checkbox" id="board-duo" ${S.newDuo ? 'checked' : ''}> Em dupla</label></div>
        ${whoPicker(S.boardWho || [], 'boardWho')}
        ${freqControls(newFreqState(), 'new')}<div class="row"><label class="check" for="board-due">Até que horas? <input type="time" id="board-due" class="time-in" value="${esc(S.newDue)}"></label></div></form>
      ${boardFilterBar()}
      ${open.length || done.length ? `<ul class="tasks" style="margin-top:14px">${open.concat(done).map((x) => boardRow(x)).join('')}</ul>` : `<div class="empty-note" style="margin-top:14px">${S.boardFilter && S.heroes[S.boardFilter] ? `Nenhuma missão para ${esc(S.heroes[S.boardFilter].name)} hoje.` : 'Nenhuma missão no quadro. Tarefas da casa que qualquer um pode fazer ficam aqui.'}</div>`}
      ${later.length ? `<details class="later" ${S.showBoardLater ? 'open' : ''}><summary data-act="toggleBoardLater">Agendadas (${later.length})</summary><ul class="tasks">${later.map((x) => boardRow(x)).join('')}</ul></details>` : ''}</section>`;
  }
  function diffButtons() { return Object.values(D.DIFF).map((d) => `<button type="button" style="--c:${d.color}" data-act="diff" data-v="${d.id}" aria-pressed="${S.newDiff === d.id}">${d.name} · ${d.xp}</button>`).join(''); }
  // destaque do salão: o desafio da noite, com cenário, inimigos e dificuldade
  function battleBanner() {
    const st = stage(); const hs = heroList(); const lv = level();
    const foes = E.buildEnemies(st, Math.max(1, hs.length), lv.mul);
    const reg = E.regionOf(st), ri = E.regionIndex(st);
    const ch = S.chance;
    const cls = ch == null ? '' : ch >= 0.66 ? 'hi' : ch >= 0.33 ? 'mid' : 'lo';
    const advice = ch == null ? 'Crie pelo menos um herói para o grupo entrar em batalha.' : ch >= 0.9 ? 'O grupo está pronto. Vitória quase certa.' : ch >= 0.66 ? 'Boas chances. Mais algumas tarefas deixam a vitória garantida.' : ch >= 0.33 ? 'Batalha equilibrada. Cada tarefa cumprida hoje conta.' : 'Os inimigos estão mais fortes que o grupo. Cumpram tarefas para subir de nível e equipem-se na loja.';
    const ev = eventOn(); const evEnemy = ev && ev.fx && ev.fx.enemy;
    const baseMul = mulOf(S.party);
    const fpos = [[74, 78, 1], [62, 92, 1.05], [64, 62, 0.9], [86, 90, 1], [87, 64, 0.9]];
    const hpos = [[30, 80, 1], [20, 94, 1.05], [19, 64, 0.9], [9, 86, 1], [8, 66, 0.9]];
    const hsSorted = hs.slice().sort((a, c) => ((D.CLASSES[c.cls] || {}).aggro || 1) - ((D.CLASSES[a.cls] || {}).aggro || 1)).slice(0, 5);
    const foesSorted = foes.slice().sort((a, c) => (c.boss ? 1 : 0) - (a.boss ? 1 : 0));
    return `<section class="nightfight">
      <div class="nf-scene">${A.sceneSvg(ri)}
        ${hsSorted.map((h, i) => { const [x, y, sc] = hpos[i]; return `<div class="nf-u hero" style="left:${x}%;top:${y}%;--s:${sc};z-index:${y}"><div class="bob">${A.heroSvg(h, { noPet: true })}</div></div>`; }).join('')}
        ${foesSorted.map((f, i) => { const [x, y, sc] = fpos[i]; return `<div class="nf-u foe" style="left:${x}%;top:${y}%;--s:${sc * (f.boss ? 1.4 : f.count > 1 ? 1.2 : 1)};z-index:${y}"><div class="bob">${A.enemyArt(f)}</div></div>`; }).join('')}
        <div class="nf-vs">VS</div>
        <div class="nf-count">Batalha à meia-noite · <b class="num">${countdown()}</b></div>
      </div>
      <div class="nf-info">
        <div class="eyebrow">Desafio desta noite${st % 5 === 0 ? ' · chefe' : ''}</div>
        <h2>Estágio ${st} · ${esc(reg.name)}</h2>
        <div class="chips" style="margin:8px 0 10px"><span class="chip diffchip">Dificuldade <b>${esc(levelFor(baseMul).name)}</b> · <span class="num">${Math.round(baseMul * 100)}%</span></span>${evEnemy ? `<span class="chip warn">${esc(ev.name)}: inimigos +${Math.round(evEnemy * 100)}%</span>` : ''}</div>
        <ul class="nf-foes">${foes.map((f) => `<li>${f.boss ? '<span class="tag crown">Chefe</span> ' : ''}${esc(f.name)}${f.count > 1 ? ` <span class="cnt">×${f.count}</span>` : ''}</li>`).join('')}</ul>
        <div class="odds"><div class="pct num ${cls}">${ch == null ? '–' : Math.round(ch * 100) + '%'}</div><div><b>Chance de vitória</b><div class="small muted">${advice}</div></div></div>
        <p class="small muted" style="margin:10px 0">Vitória: <span class="gold num">${E.goldReward(st)}</span> <span class="coin"></span> para cada herói e o grupo avança. Derrota: o desafio se repete amanhã.</p>
        <div class="row"><button class="btn sm" data-act="practice" ${hs.length ? '' : 'disabled'}>Assistir treino</button><button class="btn sm ghost" data-act="bestiary">Bestiário</button>${S.party && S.party.last ? '<button class="btn sm ghost" data-act="replay">Rever última batalha</button>' : ''}</div>
      </div></section>`;
  }
  function lastBattleCard() {
    const p = S.party; const last = p && p.last;
    const hist = (p && p.history) || [];
    return `<section class="card"><div class="card-h"><div><div class="eyebrow">Diário de batalhas</div><h3>${last ? (last.win ? 'Última batalha: vitória' : 'Última batalha: derrota') : 'Nenhuma batalha ainda'}</h3></div>${last ? `<button class="btn sm" data-act="replay">Rever</button>` : ''}</div>
      ${last ? `<p class="muted small" style="margin-top:0">Estágio ${last.stage} · ${fmtDay(last.day)}${last.test ? ' · teste' : ''} · ${last.rounds} rodadas${last.win ? ` · +${last.gold} de ouro para cada herói` : ''}</p>` : `<p class="muted">A primeira batalha acontece na virada do dia. Até lá, cumpram tarefas para ganhar experiência.</p>`}
      ${hist.length ? `<ul class="hist">${hist.map((x) => `<li><span>${fmtDay(x.day)} · Estágio ${x.stage}${x.test ? ' (teste)' : ''}</span><span class="tag ${x.win ? 'win' : 'loss'}">${x.win ? 'Vitória' : 'Derrota'}</span></li>`).join('')}</ul>` : ''}</section>`;
  }

  /* ----- Quem mais ajudou na batalha ----- */
  // pontos: dano causado + dano absorvido x0,5 + cura + escudos x0,7 + cada bênção ou enfraquecimento vale 4% da vida total dos inimigos
  const SCORE_W = { dmg: 1, tank: 0.5, heal: 1, shield: 0.7 };
  const NEUTRAL_FLAGS = new Set(['esquiva', 'caiu', 'cura', 'escudo', 'renasce', 'crit', 'espinhos', '']);
  let contribCache = { id: null, v: null };
  function battleContrib(bt) {
    const units = {}; for (const u of bt.units) units[u.id] = u;
    const heroes = bt.units.filter((u) => u.side === 'h');
    const enemyHp = bt.units.filter((u) => u.side === 'e').reduce((a, u) => a + u.maxHp, 0);
    const V = Math.max(5, Math.round(enemyHp * 0.04));
    const R = {}; for (const h of heroes) R[h.id] = { id: h.id, name: h.name, cls: h.cls, dmg: 0, tank: 0, heal: 0, shield: 0, buff: 0, debuff: 0 };
    for (const ev of bt.log || []) {
      for (const f of ev.fx || []) {
        const [id, amt, , flag, by] = f; const tgt = units[id]; if (!tgt) continue;
        const who = by || (ev.tick ? null : ev.a); const src = who && units[who];
        if (amt < 0) {
          if (tgt.side === 'h' && R[id]) R[id].tank += -amt;
          if (tgt.side === 'e' && src && src.side === 'h' && R[who]) R[who].dmg += -amt;
        } else if (!ev.tick && src && src.side === 'h' && R[who]) {
          if (flag === 'cura' && tgt.side === 'h') R[who].heal += amt;
          else if (flag === 'renasce' && tgt.side === 'h' && who !== id) R[who].heal += amt * 1.5;
          else if (flag === 'escudo') R[who].shield += amt;
          else if (amt === 0 && !NEUTRAL_FLAGS.has(flag) && ev.s) { if (tgt.side === 'h') R[who].buff++; else R[who].debuff++; }
        }
      }
    }
    const list = Object.values(R).map((r) => Object.assign(r, { score: Math.round(r.dmg * SCORE_W.dmg + r.tank * SCORE_W.tank + r.heal * SCORE_W.heal + r.shield * SCORE_W.shield + (r.buff + r.debuff) * V) }));
    return { list: list.sort((a, b) => b.score - a.score), V };
  }
  function lastContrib() {
    const last = S.party && S.party.last; if (!last) return null;
    if (contribCache.id === last.id) return contribCache.v;
    let v = null; try { v = battleContrib(battleOf(last)); } catch (e) { v = null; }
    contribCache = { id: last.id, v }; return v;
  }
  const fmtN = (n) => Math.round(n).toLocaleString('pt-BR');
  function contribRows(c, compact) {
    const max = Math.max(1, c.list[0] ? c.list[0].score : 1);
    return `<ol class="mvp">${c.list.map((r, i) => { const h = S.heroes[r.id]; const cl = D.CLASSES[r.cls] || {};
      const parts = [['⚔', 'Dano causado', r.dmg], ['🛡', 'Dano absorvido', r.tank], ['✚', 'Cura', r.heal], ['◈', 'Escudos', r.shield], ['▲', 'Bênçãos', r.buff, true], ['▼', 'Enfraquecimentos', r.debuff, true]].filter((x) => x[2] > 0);
      return `<li class="${i === 0 ? 'top' : ''}"><span class="rk num">${i === 0 ? '👑' : i + 1}</span>${h && !compact ? `<span class="ic">${A.heroSvg(h, { noPet: true, noWeapon: true })}</span>` : ''}<div class="mv-main"><div class="row" style="gap:6px"><b>${esc(r.name)}</b><span class="small" style="color:${cl.color || 'inherit'}">${cl.name || ''}</span><span class="spacer"></span><b class="num">${fmtN(r.score)}</b><span class="small muted">pts</span></div>
        <div class="bar thin"><i style="width:${Math.round((r.score / max) * 100)}%"></i></div>
        <div class="mv-parts">${parts.map(([ic, nm, v, cnt]) => `<span title="${nm}">${ic} ${cnt ? v + '×' : fmtN(v)}</span>`).join('')}</div></div></li>`; }).join('')}</ol>`;
  }
  function mvpCard() {
    const c = lastContrib(); if (!c || !c.list.length) return '';
    const last = S.party.last;
    return `<section class="card"><div class="card-h"><div><div class="eyebrow">Destaques da última batalha</div><h3>Quem mais ajudou</h3></div><span class="small muted">Estágio ${last.stage} · ${fmtDay(last.day)}</span></div>
      ${contribRows(c)}
      <p class="small muted" style="margin:10px 0 0">Pontos = dano causado + metade do dano absorvido + cura + 70% dos escudos + ${fmtN(c.V)} por bênção ou enfraquecimento aplicado.</p></section>`;
  }

  /* ----- Criação ----- */
  function randomLook(anc) {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const L = D.LOOK; anc = anc || 'humano';
    return { anc, gender: pick(L.gender).id, skin: pick(D.ANCESTRIES[anc].skins), face: pick(L.face).id, hairStyle: pick(L.hairStyle).id, hairColor: pick(L.hairColor), outfit: pick(L.outfit).id, outfitColor: pick(L.outfitColor) };
  }
  function lookControls(look, prefix) {
    const L = D.LOOK;
    const chips = (key, list) => `<div class="opts">${list.map((o) => `<button class="opt" data-act="look" data-k="${key}" data-v="${o.id}" aria-pressed="${look[key] === o.id}">${o.name}</button>`).join('')}</div>`;
    const sws = (key, list) => `<div class="opts">${list.map((c) => `<button class="sw" style="background:${c}" data-act="look" data-k="${key}" data-v="${c}" aria-pressed="${look[key] === c}" aria-label="Cor ${c}"></button>`).join('')}</div>`;
    const anc = D.ANCESTRIES[look.anc || 'humano'];
    return `<div class="field"><span class="lbl">Ancestralidade</span><div class="ancs">${Object.values(D.ANCESTRIES).map((a) => `<button class="anc" data-act="look" data-k="anc" data-v="${a.id}" aria-pressed="${(look.anc || 'humano') === a.id}"><span class="an">${a.name}</span><span class="ap">${a.perk}</span></button>`).join('')}</div>
        <p class="small muted" style="margin:8px 0 0"><b>${anc.name}:</b> ${anc.blurb}</p></div>
      <div class="field"><span class="lbl">Gênero</span>${chips('gender', L.gender)}</div>
      <div class="field"><span class="lbl">${['humano', 'anao', 'elfo', 'gigante', 'halfling', 'fauno'].includes(anc.id) ? 'Tom de pele' : 'Cor da pele'}</span>${sws('skin', anc.skins)}</div>
      <div class="field"><span class="lbl">Rosto</span>${chips('face', L.face)}</div>
      <div class="field"><span class="lbl">Cabelo</span>${chips('hairStyle', L.hairStyle)}<div style="height:8px"></div>${sws('hairColor', L.hairColor)}</div>
      <div class="field"><span class="lbl">Roupa</span>${chips('outfit', L.outfit)}<div style="height:8px"></div>${sws('outfitColor', L.outfitColor)}</div>`;
  }
  function createView() {
    const d = S.draft;
    const c = D.CLASSES[d.cls];
    const preview = { name: d.name, cls: d.cls, look: d.look, cosmetics: {} };
    const st = E.heroStats({ cls: d.cls, level: 1, skills: {}, gear: {}, look: d.look });
    return `<div class="create"><div class="preview card"><div class="fig">${A.heroSvg(preview)}</div><h2 style="color:var(--gold-2);overflow-wrap:anywhere">${esc(d.name) || 'Sem nome'}</h2><div style="color:${c.color};font-weight:800">${D.ANCESTRIES[d.look.anc || 'humano'].name} · ${c.name}</div><div class="small muted">${c.role} · ${D.ANCESTRIES[d.look.anc || 'humano'].perk}</div>
      <div class="stats" style="margin-top:12px;text-align:left"><div class="stat"><div class="v num">${st.maxHp}</div><div class="l">Vida</div></div><div class="stat"><div class="v num">${Math.round(st.atk)}</div><div class="l">Poder</div></div><div class="stat"><div class="v num">${Math.round(st.def)}</div><div class="l">Defesa</div></div><div class="stat"><div class="v num">${st.spd}</div><div class="l">Velocidade</div></div></div>
      <button class="btn ghost sm" style="margin-top:12px" data-act="randLook">Sortear visual</button></div>
      <div><h2 style="margin-bottom:16px">Novo herói</h2>
      <div class="field"><label for="hero-name">Nome</label><input type="text" id="hero-name" maxlength="18" placeholder="Como seu herói se chama?" value="${esc(d.name)}" data-input="name" autocomplete="off"></div>
      <div class="field"><span class="lbl">Classe</span><div class="classes">${Object.values(D.CLASSES).map((k) => `<button class="cls" style="--cc:${k.color}" data-act="cls" data-v="${k.id}" aria-pressed="${d.cls === k.id}"><span class="cn">${k.name}</span><span class="cr">${k.role}</span><span class="cb">${k.blurb}</span></button>`).join('')}</div></div>
      <div class="field"><label for="hero-bday">Aniversário <span class="muted small">(opcional)</span></label><input type="date" id="hero-bday" class="txt date-in" value="${esc(d.birth || '')}" max="${today()}" data-input="bday"><div class="small muted" style="margin-top:4px">No dia do aniversário, o herói ganha uma caixa de presente com bênção e moedas de festa.</div></div>
      ${lookControls(d.look)}
      <div class="row"><button class="btn primary" data-act="saveHero" ${d.name.trim() ? '' : 'disabled'}>Criar herói</button><button class="btn ghost" data-act="home">Cancelar</button>${d.name.trim() ? '' : '<span class="small muted">Escolha um nome para continuar.</span>'}</div></div></div>`;
  }

  /* ----- Herói ----- */
  function heroView(h) {
    const c = D.CLASSES[h.cls];
    const need = D.xpToNext(h.level);
    const tabs = [['tarefas', 'Tarefas'], ['recompensas', 'Recompensas'], ['habilidades', 'Habilidades'], ['loja', 'Loja'], ['conquistas', 'Conquistas'], ['visual', 'Visual']];
    let body = '';
    if (S.tab === 'tarefas') body = tasksTab(h);
    else if (S.tab === 'habilidades') body = skillsTab(h);
    else if (S.tab === 'loja') body = shopTab(h);
    else if (S.tab === 'recompensas') body = rewardsTab(h);
    else if (S.tab === 'conquistas') body = achTab(h);
    else body = visualTab(h);
    return `<section class="hero-head"><div class="fig"><div class="idle">${A.heroSvg(h)}</div>${kudosStrip(h.id)}</div><div>
      <div class="eyebrow" style="color:${c.color}">${ancOf(h).name} · ${c.name} · ${c.role}</div><h2>${esc(h.name)}</h2>
      <div class="meta"><span class="chip">Nível <b class="num">${h.level}</b></span><span class="chip"><span class="coin"></span> <b class="num">${goldOf(h)}</b> ouro</span>${h.potion && h.potion.day === today() ? `<span class="chip warn">${esc((D.POTIONS.find((x) => x.id === h.potion.id) || {}).name || 'Poção')} esta noite</span>` : ''}${festaOf(h) ? `<span class="chip festa-chip"><span class="coin festa"></span> <b class="num">${festaOf(h)}</b> de festa</span>` : ''}<span class="chip"><span class="gem"></span> <b class="num">${redeemBal(h)}</b> XP de resgate</span>${streakNow(h) ? `<span class="chip streakchip"><b class="num">${streakNow(h)}</b> dia${streakNow(h) > 1 ? 's' : ''} seguido${streakNow(h) > 1 ? 's' : ''}</span>` : ''}${h.points ? `<span class="chip warn"><b class="num">${h.points}</b> ponto${h.points > 1 ? 's' : ''} de habilidade</span>` : ''}<span class="chip">Poder de combate <b class="num">${E.powerScore(E.heroStats(Object.assign({}, h, { bday: bdayBuffOn(h), potion: h.potion && h.potion.day === today() ? h.potion.id : null })))}</b></span></div>
      <div class="xpline"><span>Experiência</span><span class="num"><b>${h.xp}</b> / ${need} para o nível ${h.level + 1}${h.xpDebt ? ` <span class="muted" title="XP de tarefas desfeitas depois que o nível já tinha subido. As próximas tarefas pagam primeiro.">· −${h.xpDebt} a repor</span>` : ''}</span></div><div class="bar"><i style="width:${Math.round((h.xp / need) * 100)}%"></i></div></div></section>
      <nav class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${S.tab === k}" data-act="tab" data-v="${k}">${n}${k === 'habilidades' && h.points ? `<span class="dot">${h.points}</span>` : ''}${k === 'recompensas' && rewardList().some((r) => r.cost <= redeemBal(h)) ? '<span class="dot">!</span>' : ''}</button>`).join('')}</nav>${body}`;
  }
  const daysTxt = (days) => days && days.length && days.length < 7 ? days.slice().sort().map((d) => D.WEEKDAYS[d]).join(', ') : '';
  function taskMeta(t, x) {
    const bits = [];
    if (t.chore) bits.push('<span class="tag must">Obrigatória</span>');
    bits.push(`<span style="color:${D.DIFF[t.diff].color}">${D.DIFF[t.diff].name}</span>`);
    if (freqTxt(t)) bits.push(`<span class="freq">${freqTxt(t)}</span>`);
    if (!visibleToday(t) && !t.done) {
      if (t.repeat || hasSchedule(t)) { const n = nextOn(t, dueDay(t) > today() ? dueDay(t) : addDays(today(), 1)); if (n) bits.push(`<span class="tag sched">${dueDay(t) > today() && t.from ? 'Começa' : 'Próxima'}: ${D.WEEKDAYS[dowOf(n)].toLowerCase()}, ${fmtDay(n)}</span>`); }
      else if (dueDay(t) > today()) bits.push(`<span class="tag sched">Agendada: ${D.WEEKDAYS[dowOf(dueDay(t))].toLowerCase()}, ${fmtDay(dueDay(t))}</span>`);
    }
    if (t.due && !t.done) bits.push(x.late ? `<span class="tag late">Passou das ${t.due}</span>` : x.punctual ? `<span class="tag ontime">Até ${t.due}: +${Math.round(D.PUNCTUAL_BONUS * 100)}%</span>` : `<span>Até ${t.due}</span>`);
    if (x.carried) bits.push(`<span class="bonus">Acumulada +${Math.round(D.CARRY_BONUS * 100)}%</span>`);
    if (x.streak && !t.done) bits.push(`<span class="tag streak">Sequência +${Math.round(x.streak * 100)}%</span>`);
    if (x.ev && !t.done) bits.push(`<span class="tag evt">Evento +${Math.round(x.ev * 100)}%</span>`);
    if (t.pending) bits.push('<span class="tag wait">Aguardando aprovação</span>');
    if (dueDay(t) < today() && !t.done && !t.pending) bits.push(`<span>desde ${fmtDay(dueDay(t))}</span>`);
    return bits.join('');
  }
  function taskRow(t) {
    const d = D.DIFF[t.diff]; const x = xpFor(t);
    const xpTxt = t.done ? `+${t.gain || x.base} XP` : t.pending ? `${t.pendXp} XP` : x.total !== x.base ? `<s>${x.base}</s>+${x.total} XP` : `+${x.total} XP`;
    return `<li class="task${t.done ? ' done' : ''}${t.pending ? ' pending' : ''}${x.carried ? ' carried' : ''}" style="--c:${d.color}">
      <button class="done-btn" data-act="${t.done || t.pending ? 'noop' : 'done'}" data-id="${t.id}" aria-label="${t.done ? 'Concluída' : 'Concluir ' + esc(t.title)}" ${S.readOnly || t.done || t.pending ? 'disabled' : ''}>${t.done ? '✓' : t.pending ? '…' : ''}</button>
      <div><div class="t">${esc(t.title)}</div><div class="sub">${taskMeta(t, x)}</div></div>
      <div class="xp num">${xpTxt}</div>
      <div class="tact">${(t.done === today() || t.pending) && !S.readOnly ? `<button class="del undo" data-act="undoTask" data-id="${t.id}" aria-label="Desfazer: ${esc(t.title)}" title="Desfazer (não fiz)">↺</button>` : ''}${!t.chore && !t.done && !t.pending ? `<button class="del" data-act="editTask" data-scope="me" data-id="${t.id}" aria-label="Editar tarefa" title="Editar">✎</button>` : ''}${t.chore ? '' : `<button class="del" data-act="delTask" data-id="${t.id}" aria-label="Apagar tarefa" title="Apagar" ${S.readOnly ? 'disabled' : ''}>×</button>`}</div></li>`;
  }
  function dayChips(sel, act) { return `<div class="days" role="group" aria-label="Dias da semana">${D.WEEKDAYS.map((n, i) => `<button type="button" class="dchip" data-act="${act || 'day'}" data-v="${i}" aria-pressed="${(sel || []).includes(i)}">${n}</button>`).join('')}</div>`; }
  function tasksTab(h) {
    ensureHero(h);
    const t = today(); const tasks = h.tasks || [];
    const vis = tasks.filter(visibleToday);
    const carried = vis.filter((x) => !x.done && !x.pending && dueDay(x) < t);
    const fresh = vis.filter((x) => !x.done && !x.pending && dueDay(x) >= t);
    const pend = vis.filter((x) => x.pending);
    const done = tasks.filter((x) => x.done === t);
    const later = tasks.filter((x) => !visibleToday(x) && !x.done);
    const xpToday = done.reduce((s2, x) => s2 + (x.gain || 0), 0);
    const ch = chestState(h); const sn = streakNow(h);
    const bo = boardList().filter((x) => (!x.done && !boardFuture(x)) || x.done === t);
    return `<div class="grid2"><div>
      ${bdayCta(h)}
      ${ch.ready ? `<section class="chest-cta"><div class="chest-ic">${chestSvg(false)}</div><div><b>Baú do dia liberado!</b><div class="small">Você cumpriu todas as tarefas de hoje.</div></div><button class="btn primary" data-act="openChest">Abrir baú</button></section>`
        : ch.opened ? '' : ch.total >= 2 ? `<section class="chest-cta dim"><div class="chest-ic">${chestSvg(false)}</div><div><b>Baú do dia</b><div class="small">${ch.done} de ${ch.total} tarefas de hoje feitas. Termine todas para abrir.</div><div class="bar" style="margin-top:6px"><i style="width:${Math.round((ch.done / ch.total) * 100)}%"></i></div></div></section>` : ''}
      <form class="card addtask" data-form="task"><div class="eyebrow">Nova tarefa</div>
        <input type="text" id="task-title" value="${esc((S.inputs || {})["task-title"] || "")}" maxlength="80" placeholder="Ex.: Arrumar a cama, estudar 30 min, lavar a louça" autocomplete="off" ${S.readOnly ? 'disabled' : ''}>
        <div class="row"><div class="seg" role="group" aria-label="Dificuldade">${diffButtons()}</div></div>
        <div class="row"><div class="seg" role="group" aria-label="Para quem"><button type="button" data-act="target" data-v="me" aria-pressed="${S.newTarget === 'me'}">Só para ${esc(h.name)}</button><button type="button" data-act="target" data-v="guild" aria-pressed="${S.newTarget === 'guild'}">Quadro da guilda</button></div>
          ${S.newTarget === 'guild' ? `<label class="check"><input type="checkbox" id="task-duo" ${S.newDuo ? 'checked' : ''}> Em dupla</label>` : ''}</div>
        ${freqControls(newFreqState(), 'new')}
        <div class="row"><label class="check" for="task-due">Até que horas? <input type="time" id="task-due" class="time-in" value="${esc(S.newDue)}"></label><span class="spacer"></span><button class="btn primary" type="submit" ${S.readOnly ? 'disabled' : ''}>Adicionar</button></div>
      </form>
      ${carried.length ? `<div class="section-t"><h3>Acumuladas</h3><span class="small muted">Valem +${Math.round(D.CARRY_BONUS * 100)}% de XP, mas o grupo luta sem essa força esta noite.</span></div><ul class="tasks">${carried.map(taskRow).join('')}</ul>` : ''}
      <div class="section-t"><h3>Para hoje</h3><span class="small muted">${D.WEEKDAYS[dowOf(t)]}, ${fmtDay(t)}</span></div>
      ${fresh.length ? `<ul class="tasks">${fresh.map(taskRow).join('')}</ul>` : `<div class="empty-note">${tasks.length ? 'Tudo feito por hoje. O grupo agradece!' : 'Nenhuma tarefa ainda. Liste o que você quer cumprir hoje.'}</div>`}
      ${pend.length ? `<div class="section-t"><h3>Aguardando aprovação</h3><span class="small muted">O XP entra quando um criador aprovar.</span></div><ul class="tasks">${pend.map(taskRow).join('')}</ul>` : ''}
      ${bo.length ? `<div class="section-t"><h3>Quadro da guilda</h3><span class="small muted">Qualquer herói pode cumprir.</span></div><ul class="tasks">${bo.filter((x) => !x.done).concat(bo.filter((x) => x.done)).map((x) => boardRow(x, true)).join('')}</ul>` : ''}
      ${done.length ? `<div class="section-t"><h3>Feitas hoje</h3><span class="small muted num">+${xpToday} XP</span></div><ul class="tasks">${done.map(taskRow).join('')}</ul>` : ''}
      ${later.length ? `<details class="later" ${S.showLater ? 'open' : ''}><summary data-act="toggleLater">Outros dias (${later.length})</summary><ul class="tasks">${later.map(taskRow).join('')}</ul></details>` : ''}
    </div><div>
      <section class="card"><div class="eyebrow">Sua sequência</div><div class="streak-big"><span class="num">${sn}</span> dia${sn === 1 ? '' : 's'} seguido${sn === 1 ? '' : 's'}</div>
        <p class="small muted" style="margin:4px 0 0">${sn ? `Bônus de sequência hoje: +${Math.round(streakBonusNext(h) * 100)}% de XP. Cumpra ao menos uma tarefa por dia para manter.` : 'Cumpra uma tarefa hoje para começar uma sequência. Cada dia seguido dá +2% de XP (até +20%).'}</p>
        ${h.streak.best ? `<p class="small" style="margin:6px 0 0">Recorde: <b>${h.streak.best}</b> dias</p>` : ''}</section>
      <section class="card"><div class="eyebrow">Como funciona</div>
        <ul class="small" style="padding-left:18px;margin:8px 0 0;display:grid;gap:6px">
          <li><b>Muito fácil</b> 10 XP · <b>Fácil</b> 20 · <b>Médio</b> 35 · <b>Difícil</b> 60.</li>
          <li>Tarefa que fica para o dia seguinte vira <b>acumulada</b> e rende 50% a mais.</li>
          <li>Com horário, feita até a hora rende <b>+${Math.round(D.PUNCTUAL_BONUS * 100)}%</b>.</li>
          <li>Em dupla, cada um dos dois ganha ${Math.round(D.DUO_SHARE * 100)}% do XP.</li>
          <li>Terminando todas as tarefas do dia, abre o <b>baú diário</b>.</li>
          <li>Cada nível dá 1 ponto de habilidade. O nível ${h.level + 1} pede ${D.xpToNext(h.level)} XP.</li>
        </ul></section>
      <section class="card"><div class="eyebrow">Histórico de ${esc(h.name)}</div><div class="stats" style="margin-top:10px"><div class="stat"><div class="v num">${h.stats.done || 0}</div><div class="l">Tarefas feitas</div></div><div class="stat"><div class="v num">${h.stats.xp || 0}</div><div class="l">XP total</div></div><div class="stat"><div class="v num">${weekXp(h)}</div><div class="l">XP na semana</div></div></div>
      ${S.readOnly ? '' : `<button class="btn danger sm" style="margin-top:14px" data-act="askRetire">Aposentar herói</button>`}</section>
    </div></div>`;
  }
  const ZOOMS = [1, 1.8, 2.8];
  const ZOOM_FOCUS = { hat: '50% 12%', face: '50% 34%', neck: '50% 50%', armor: '50% 56%', cape: '50% 80%', weapon: '80% 48%', offhand: '22% 68%', aura: '50% 50%', pet: '10% 88%' };
  function zoomNav(x) {
    const list = D.COSMETICS.filter((c) => c.slot === x.slot && !c.gift); const i = list.findIndex((c) => c.id === x.id);
    const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    return `<button class="btn sm ghost" data-act="zoomItem" data-v="${prev.id}" aria-label="Item anterior">‹ Anterior</button><button class="btn sm ghost" data-act="zoomItem" data-v="${next.id}" aria-label="Próximo item">Próximo ›</button>`;
  }
  function potionSvg(id) {
    const c = { pot_str: '#e0665f', pot_stone: '#9aa4ae', pot_life: '#5ad08a', pot_luck: '#ffd36b' }[id] || '#c890ff';
    return `<svg viewBox="0 0 40 48" aria-hidden="true"><rect x="16" y="4" width="8" height="8" fill="#d8c8a8"/><rect x="14" y="2" width="12" height="4" rx="1.5" fill="#8a5a2a"/><circle cx="20" cy="30" r="14" fill="#e8f4ff" opacity=".5" stroke="#9ab0c0" stroke-width="1.5"/><path d="M6.5 31 a13.5 13.5 0 0 0 27 0Z" fill="${c}"/><circle cx="14" cy="24" r="2.6" fill="#fff" opacity=".75"/></svg>`;
  }
  function giftSvg(open) {
    const lid = open ? 'transform="translate(-2 -13) rotate(-14 32 22)"' : '';
    return `<svg viewBox="0 0 64 60" aria-hidden="true">${open ? '<circle cx="32" cy="26" r="18" fill="#ffe48a" opacity=".35"/>' : ''}<rect x="10" y="26" width="44" height="30" rx="3" fill="#e2558f"/><rect x="29" y="26" width="6" height="30" fill="#ffd36b"/><g ${lid}><rect x="6" y="16" width="52" height="11" rx="3" fill="#f06ba3"/><rect x="29" y="16" width="6" height="11" fill="#ffd36b"/><path d="M32 16 C24 4 14 8 20 14 C24 17 30 16 32 16 C34 16 40 17 44 14 C50 8 40 4 32 16Z" fill="#ffd36b" stroke="#d8a838" stroke-width="1"/></g></svg>`;
  }
  function confetti() {
    const cols = ['#ffd36b', '#ff6aa8', '#7ad8ff', '#8ee08a', '#c79bff'];
    let o = ''; for (let i = 0; i < 26; i++) o += `<i style="left:${(i * 37) % 100}%;background:${cols[i % cols.length]};animation-delay:${((i * 0.13) % 1.4).toFixed(2)}s;animation-duration:${(1.8 + (i % 5) * 0.25).toFixed(2)}s"></i>`;
    return `<div class="confetti" aria-hidden="true">${o}</div>`;
  }
  function bdayCta(h) {
    if (bdayGiftReady(h)) return `<section class="chest-cta bday-cta"><div class="chest-ic">${giftSvg(false)}</div><div><b>Feliz aniversário, ${esc(h.name)}!</b><div class="small">A guilda deixou uma caixa de presente para você.</div></div><button class="btn primary" data-act="openBday" ${S.readOnly ? 'disabled' : ''}>Abrir presente</button></section>`;
    if (bdayBuffOn(h)) return `<section class="chest-cta bday-cta dim"><div class="chest-ic">${giftSvg(true)}</div><div><b>Bênção de aniversário ativa</b><div class="small">Hoje suas tarefas valem +${Math.round(D.BDAY.xpPct * 100)}% de XP e você luta mais forte na batalha desta noite.</div></div></section>`;
    return '';
  }
  function bdayBanner() {
    const hs = heroList().filter((h) => isBday(h)); if (!hs.length) return '';
    const names = hs.map((h) => `<b>${esc(h.name)}</b>`); const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1] : names[0];
    return `<section class="bday-banner"><div class="bb-ic">${giftSvg(false)}</div><div><div class="eyebrow">Dia de festa</div><div>Hoje é aniversário de ${list}! Mande um elogio para comemorar.</div></div></section>`;
  }
  function chestSvg(open) {
    return `<svg viewBox="0 0 64 56" aria-hidden="true">${open ? '<path d="M8 22 L32 4 L56 22Z" fill="#8a5a2a" opacity=".0"/><path d="M6 18 C6 2 58 2 58 18 L58 12 C58 -2 6 -2 6 12Z" fill="#a8743a" transform="translate(0 -10) rotate(-14 6 18)"/><circle cx="32" cy="18" r="16" fill="#ffe48a" opacity=".55"/>' : '<path d="M6 24 C6 6 58 6 58 24Z" fill="#a8743a"/>'}<rect x="6" y="24" width="52" height="28" rx="3" fill="#8a5a2a"/><rect x="6" y="24" width="52" height="5" fill="#d6a531"/><rect x="28" y="22" width="8" height="12" rx="2" fill="#f4c84a"/><path d="M14 24 v28 M50 24 v28" stroke="#d6a531" stroke-width="3"/></svg>`;
  }
  function skillsTab(h) {
    const c = D.CLASSES[h.cls];
    const st = E.heroStats(h);
    const selS = S.selSkill && c.skillMap[S.selSkill];
    const rowOf = (t) => t + 1 + (selS && t > selS.tier ? 1 : 0);
    const nodes = c.skills.map((s) => {
      const rank = h.skills[s.id] || 0; const cl = E.canLearn(h, s);
      const state = rank ? 'learned' : cl.ok ? 'avail' : 'locked';
      const col = s.col + 1, row = rowOf(s.tier);
      return `<button class="node ${state}${rank && cl.ok ? ' avail' : ''}${S.selSkill === s.id ? ' sel' : ''}" id="node-${s.id}" style="grid-column:${col};grid-row:${row};--cc:${c.color}" data-act="selSkill" data-v="${s.id}">
        <span class="k">${s.type === 'a' ? 'Ativa' : 'Passiva'} · Nv ${s.minLevel}</span><span class="n">${s.name}</span><span class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span></button>`;
    }).join('');
    const sel = S.selSkill && c.skillMap[S.selSkill];
    let detail = '<div class="detail muted small">Toque numa habilidade para ver os detalhes. As mais fortes, no fim da árvore, pedem habilidades anteriores e nível mínimo.</div>';
    if (sel) {
      const rank = h.skills[sel.id] || 0; const cl = E.canLearn(h, sel);
      const reqs = sel.req ? sel.req.map((r) => c.skillMap[r].name).join(' + ') : sel.reqAny ? sel.reqAny.map((r) => c.skillMap[r].name).join(' ou ') : 'nenhum';
      detail = `<div class="detail inline" style="grid-column:1 / -1;grid-row:${sel.tier + 2}"><div class="row"><h3>${sel.name}</h3><span class="tag">${sel.type === 'a' ? `Ativa · recarga ${sel.cd} turnos` : `Passiva · ${rank}/${sel.max}`}</span></div>
        <p style="margin:8px 0">${sel.desc}</p><p class="small muted" style="margin:0 0 10px">Nível mínimo ${sel.minLevel} · Pré-requisito: ${reqs}</p>
        ${rank >= sel.max ? '<span class="tag win">Aprendida</span>' : `<button class="btn primary" data-act="learn" data-v="${sel.id}" ${cl.ok && !S.readOnly ? '' : 'disabled'}>${rank ? 'Melhorar' : 'Aprender'} · 1 ponto</button> ${cl.ok ? '' : `<span class="small muted">${cl.why}</span>`}`}</div>`;
    }
    const allMax = c.skills.every((s) => (h.skills[s.id] || 0) >= s.max);
    return `<div class="grid2"><div class="card"><div class="card-h"><h3>Árvore ${['Bruxa', 'Princesa'].includes(c.name) ? 'da' : 'do'} ${c.name}</h3><span class="chip">${h.points || 0} ponto${h.points === 1 ? '' : 's'}</span></div>
      <div class="tree" id="tree"><svg class="links" id="links"></svg>${nodes}${sel ? detail : ''}</div>${sel ? '' : detail}</div>
      <div><section class="card"><div class="eyebrow">Atributos</div><div class="stats" style="margin-top:10px">
        <div class="stat"><div class="v num">${st.maxHp}</div><div class="l">Vida</div></div><div class="stat"><div class="v num">${Math.round(st.atk)}</div><div class="l">Poder</div></div>
        <div class="stat"><div class="v num">${Math.round(st.def)}</div><div class="l">Defesa</div></div><div class="stat"><div class="v num">${st.spd}</div><div class="l">Velocidade</div></div>
        <div class="stat"><div class="v num">${Math.round(st.crit * 100)}%</div><div class="l">Crítico</div></div><div class="stat"><div class="v num">${Math.round(st.dodge * 100)}%</div><div class="l">Esquiva</div></div></div></section>
      <section class="card"><div class="eyebrow">Treinamento</div><p class="small" style="margin:6px 0 10px">Troque 1 ponto por +2% de vida, poder e defesa. Bom quando nada novo está disponível. ${h.mastery ? `Treinos feitos: <b>${h.mastery}</b>.` : ''}</p>
        <button class="btn sm" data-act="mastery" ${h.points && !S.readOnly ? '' : 'disabled'}>Treinar · 1 ponto</button>${allMax ? ' <span class="small muted">Árvore completa!</span>' : ''}</section></div></div>`;
  }
  function achTab(h) {
    ensureHero(h); const got = D.ACH.filter((a) => h.ach[a.id]).length;
    return `<div class="card"><div class="card-h"><div><div class="eyebrow">Mural de medalhas</div><h3>${got} de ${D.ACH.length} conquistas</h3></div><span class="small muted">Cada medalha dá ouro na hora.</span></div>
      <div class="bar" style="margin-bottom:14px"><i style="width:${Math.round((got / D.ACH.length) * 100)}%"></i></div>
      <div class="medals">${D.ACH.map((a) => { const on = h.ach[a.id]; return `<div class="medal${on ? ' on' : ''}"><div class="mic">${medalSvg(on)}</div><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.desc)}</div><div class="small">${on ? `Conquistada em ${fmtDay(on)}` : `<span class="coin"></span> ${a.gold}`}</div></div></div>`; }).join('')}</div></div>`;
  }
  function medalSvg(on) { return `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M12 0 h6 l4 14 h-6Z M22 0 h6 l-4 14 h-6Z" fill="${on ? '#c8413f' : '#3a4650'}"/><circle cx="20" cy="30" r="14" fill="${on ? '#f4c84a' : '#2a343c'}" stroke="${on ? '#a87a2a' : '#46525c'}" stroke-width="3"/><path d="M20 21 l3 6 6 .8 -4.5 4.2 1.2 6 -5.7 -3 -5.7 3 1.2 -6 -4.5 -4.2 6 -.8Z" fill="${on ? '#fff3c0' : '#3a4650'}"/></svg>`; }
  function rewardsTab(h) {
    const bal = redeemBal(h); const list = rewardList(); const mine = requestList().filter((q) => q.heroId === h.id).slice(0, 15);
    const next = list.find((r) => r.cost > bal && !rewardBlock(r, h));
    const st = { pending: ['Aguardando aprovação', 'wait'], approved: ['Aprovado · aguardando entrega', 'ontime'], delivered: ['Entregue', 'win'], refused: ['Recusado', 'late'] };
    return `<div class="grid2"><div class="card"><div class="card-h"><div><div class="eyebrow">Recompensas da vida real</div><h3>O que dá para pedir</h3></div><span class="chip"><span class="gem"></span> <b class="num">${bal}</b> XP de resgate</span></div>
      <p class="small muted" style="margin-top:0">Todo XP ganho entra neste saldo. O pedido vai para os criadores aprovarem e entregarem; o nível do herói não muda.${next ? ` Faltam <b>${next.cost - bal} XP</b> para "${esc(next.name)}".` : ''}</p>
      ${list.length ? `<ul class="rewards">${list.map((r) => { const blk = rewardBlock(r, h); const ok = bal >= r.cost && !blk; const pct = Math.min(100, Math.round((bal / r.cost) * 100));
        const lim = [r.perWeek ? `${r.perWeek}x por semana` : '', r.stock != null ? `${r.stock} em estoque` : ''].filter(Boolean).join(' · ');
        return `<li class="reward${ok ? ' ready' : ''}"><div><div class="t">${esc(r.name)}</div>${lim ? `<div class="small muted">${lim}</div>` : ''}<div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div></div><div class="xp num">${r.cost} XP</div>
          <button class="btn sm ${ok ? 'primary' : ''}" data-act="askRedeem" data-id="${r.id}" ${ok && !S.readOnly ? '' : 'disabled'}>${blk || 'Pedir'}</button></li>`; }).join('')}</ul>`
      : `<div class="empty-note">Ainda não há recompensas cadastradas. Os criadores da sala cadastram nas configurações.</div>`}</div>
      <div class="card"><div class="eyebrow">Pedidos de ${esc(h.name)}</div>
      ${mine.length ? `<ul class="hist" style="margin-top:10px">${mine.map((q) => `<li><span>${fmtDay(q.day)} · ${esc(q.name)} <span class="small muted">· ${q.cost} XP</span></span><span class="tag ${st[q.status][1]}">${st[q.status][0]}</span></li>`).join('')}</ul>` : '<p class="muted small">Nenhum pedido ainda.</p>'}
      <div class="stats" style="margin-top:12px"><div class="stat"><div class="v num">${(h.stats && h.stats.xp) || 0}</div><div class="l">XP ganho no total</div></div><div class="stat"><div class="v num">${h.redeemed || 0}</div><div class="l">XP usado em pedidos</div></div></div></div></div>`;
  }
  function rewardsAdmin(locked) {
    const list = rewardList();
    return `<div class="field" style="margin:0"><h3 style="margin-bottom:10px">Recompensas da vida real</h3>
      <form class="row" data-form="reward"><input type="text" id="rw-name" value="${esc((S.inputs || {})["rw-name"] || "")}" maxlength="60" placeholder="Ex.: Passeio no parquinho" autocomplete="off" class="txt" style="flex:1 1 100%" ${locked || S.readOnly ? 'disabled' : ''}>
        <label class="sr" for="rw-week">Limite por semana</label><input type="number" id="rw-week" min="1" max="50" step="1" placeholder="Por semana (opcional)" class="txt" style="flex:1;min-width:140px" ${locked || S.readOnly ? 'disabled' : ''}>
        <label class="sr" for="rw-stock">Estoque</label><input type="number" id="rw-stock" min="0" max="999" step="1" placeholder="Estoque (opcional)" class="txt" style="flex:1;min-width:130px" ${locked || S.readOnly ? 'disabled' : ''}>
        <label class="sr" for="rw-cost">Custo em XP</label><input type="number" id="rw-cost" value="${esc((S.inputs || {})["rw-cost"] || "")}" min="1" max="100000" step="1" placeholder="Custo em XP" class="txt" style="flex:1;min-width:120px" ${locked || S.readOnly ? 'disabled' : ''}>
        <button class="btn primary sm" type="submit" ${locked || S.readOnly ? 'disabled' : ''}>Cadastrar</button></form>
      ${list.length ? `<ul class="hist" style="margin-top:10px">${list.map((r) => `<li><span>${esc(r.name)}${r.perWeek || r.stock != null ? `<span class="small muted"> · ${[r.perWeek ? r.perWeek + 'x/semana' : '', r.stock != null ? r.stock + ' em estoque' : ''].filter(Boolean).join(' · ')}</span>` : ''}</span><span class="row" style="gap:8px"><span class="tag num">${r.cost} XP</span><button class="btn sm ghost" data-act="delReward" data-id="${r.id}" aria-label="Remover ${esc(r.name)}" ${locked || S.readOnly ? 'disabled' : ''}>Remover</button></span></li>`).join('')}</ul>` : '<p class="small muted" style="margin:8px 0 0">Nenhuma recompensa cadastrada.</p>'}</div>`;
  }
  /* ----- Relatório semanal (para os criadores) ----- */
  function reportView() {
    if (!isCreator()) return '<div class="card"><h3>O relatório é para os criadores da sala.</h3></div>';
    const t = today(); const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)); const prev = Array.from({ length: 7 }, (_, i) => addDays(t, i - 13));
    const sum = (h, ds, k) => ds.reduce((a, d) => a + ((h.log && h.log[d] && h.log[d][k]) || 0), 0);
    const hs = heroList();
    const tot = hs.reduce((a, h) => a + sum(h, days, 't'), 0), totPrev = hs.reduce((a, h) => a + sum(h, prev, 't'), 0);
    const xpTot = hs.reduce((a, h) => a + sum(h, days, 'x'), 0);
    const cmp = (a, b) => b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% em relação aos 7 dias anteriores` : a ? 'Primeira semana com registro' : 'Sem tarefas registradas';
    const maxT = Math.max(1, ...hs.map((h) => Math.max(...days.map((d) => (h.log && h.log[d] && h.log[d].t) || 0))));
    const chart = (h) => { const W = 280, Hh = 90, bw = 28, gap = (W - bw * 7) / 6;
      return `<svg class="mini" viewBox="0 0 ${W} ${Hh + 18}" role="img" aria-label="Tarefas por dia de ${esc(h.name)}">${[0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${Hh - Hh * f}" y2="${Hh - Hh * f}" stroke="#2c3840" stroke-dasharray="3 4"/>`).join('')}
        ${days.map((d, i) => { const v = (h.log && h.log[d] && h.log[d].t) || 0; const bh = Math.round((v / maxT) * (Hh - 14)); const x = i * (bw + gap); return `<rect x="${x}" y="${Hh - bh}" width="${bw}" height="${Math.max(bh, 2)}" rx="4" fill="${v ? D.CLASSES[h.cls].color : '#2c3840'}"/>${v ? `<text x="${x + bw / 2}" y="${Hh - bh - 4}" text-anchor="middle" font-size="11" fill="#f1e8d4">${v}</text>` : ''}<text x="${x + bw / 2}" y="${Hh + 14}" text-anchor="middle" font-size="10.5" fill="#9eaab0">${D.WEEKDAYS[dowOf(d)]}</text>`; }).join('')}</svg>`; };
    const medalsWeek = (h) => Object.values(h.ach || {}).filter((d) => d >= days[0]).length;
    const reqWeek = (h) => requestList().filter((q) => q.heroId === h.id && q.day >= days[0]);
    const pend = (h) => pendingItems().filter((x) => x.hero.id === h.id).length;
    return `<div class="eyebrow">Relatório dos últimos 7 dias · ${fmtDay(days[0])} a ${fmtDay(t)}</div><h2 style="margin:4px 0 14px">Como a guilda está indo</h2>
      <div class="stats" style="margin-bottom:18px"><div class="stat"><div class="v num">${tot}</div><div class="l">Tarefas da guilda</div></div><div class="stat"><div class="v num">${xpTot}</div><div class="l">XP ganho</div></div><div class="stat"><div class="v num">${(S.party && S.party.history || []).filter((x) => x.day >= days[0] && !x.test && x.win).length}/${(S.party && S.party.history || []).filter((x) => x.day >= days[0] && !x.test).length}</div><div class="l">Vitórias</div></div><div class="stat"><div class="v num">${pendingItems().length + openRequests().length}</div><div class="l">Esperando você</div></div></div>
      <p class="small muted" style="margin:-8px 0 16px">${cmp(tot, totPrev)}.</p>
      <div class="reports">${hs.map((h) => { const tw = sum(h, days, 't'), tp = sum(h, prev, 't'); const rq = reqWeek(h); return `<section class="card rep"><div class="rep-h"><span class="ic">${A.heroSvg(h, { noPet: true, noWeapon: true })}</span><div><h3>${esc(h.name)}</h3><div class="small muted">${D.CLASSES[h.cls].name} · nível ${h.level}</div></div></div>
        ${chart(h)}
        <ul class="rep-l small"><li><b class="num">${tw}</b> tarefas <span class="muted">(${tp ? cmp(tw, tp).split(' em')[0] : 'sem semana anterior'})</span></li><li><b class="num">${sum(h, days, 'x')}</b> XP ganho</li><li>Sequência atual: <b class="num">${streakNow(h)}</b> dia${streakNow(h) === 1 ? '' : 's'} · recorde ${(h.streak && h.streak.best) || 0}</li><li><b class="num">${medalsWeek(h)}</b> medalha${medalsWeek(h) === 1 ? '' : 's'} na semana</li>
        ${rq.length ? `<li>Pedidos: ${rq.map((q) => esc(q.name)).join(', ')}</li>` : ''}${pend(h) ? `<li style="color:#f0d070">${pend(h)} tarefa${pend(h) > 1 ? 's' : ''} esperando aprovação</li>` : ''}</ul></section>`; }).join('')}</div>`;
  }
  /* ----- Bestiário ----- */
  function bestiaryView() {
    const b = (S.party && S.party.bestiary) || {};
    const seen = Object.keys(b).length, total = D.SPECIES.length + Object.keys(D.BOSSES).length;
    const card = (sp) => { const e = b[sp.id]; const ti = e ? E.tierInfo(sp, e.t || 0, false) : null;
      return `<div class="beast${e ? '' : ' unknown'}${sp.boss ? ' boss' : ''}"><div class="bic">${A.enemySvg(Object.assign({}, sp, { sid: sp.id, name: e ? ti.name : '???', color: e ? ti.color : '#222a30', glow: e ? ti.glow : null, tier: e ? e.t : 0 }))}</div>
        <div class="bn">${e ? esc(sp.name) : '???'}</div><div class="small muted">${e ? `${e.k ? `${e.k} derrotado${e.k > 1 ? 's' : ''}` : 'Visto em batalha'}${e.t ? ` · até ${esc(E.tierInfo(sp, e.t, false).name.replace(sp.name, '').replace(/^,\s*[ao]\s*/, '').trim())}` : ''}` : 'Ainda não encontrado'}</div></div>`; };
    return `<div class="eyebrow">Bestiário da guilda</div><h2 style="margin:4px 0 6px">${seen} de ${total} criaturas encontradas</h2><p class="muted" style="margin:0 0 16px">Cada criatura aparece aqui depois da primeira batalha contra ela.</p>
      ${D.REGIONS.map((reg) => `<section class="card"><h3 style="margin-bottom:12px">${esc(reg.name)}</h3><div class="beasts">${reg.pool.map((id) => card(D.SPECIES_MAP[id])).join('')}${card(D.BOSSES[reg.boss])}</div></section>`).join('')}`;
  }
  /* ----- Configurações do criador da sala ----- */
  function settingsView() {
    if (!isCreator()) return `<div class="card"><h3>Só os criadores da sala mexem aqui</h3><p class="muted">As configurações ficam com quem criou a sala e com os co-criadores que essa pessoa escolher.</p></div>`;
    const p = S.party || {};
    if (p.pin && !S.masterOk) return `<section class="gate"><form class="card" data-form="pinGate" style="max-width:420px;margin:0 auto"><div class="eyebrow">Configurações protegidas</div><h3>Digite o PIN do criador</h3>
      <div class="field" style="margin-top:12px"><label for="pin-in">PIN</label><input type="password" id="pin-in" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" class="pin-in"></div>
      ${S.pinErr ? `<p class="small" style="color:var(--bad);margin-top:-8px">${esc(S.pinErr)}</p>` : ''}<button class="btn primary" type="submit">Destravar</button></form></section>`;
    const mul = S.diffPreview != null ? S.diffPreview : mulOf(p); const lv = levelFor(mul);
    const hs = heroList();
    const assignTxt = (c) => c.assign === 'all' ? 'Todos os heróis' : (c.assign || []).map((id) => (S.heroes[id] ? S.heroes[id].name : '')).filter(Boolean).join(', ') || 'Ninguém';
    return `<div class="row" style="align-items:flex-end"><div><div class="eyebrow">Sala ${esc(S.room)}</div><h2 style="margin:4px 0 16px">Configurações da guilda</h2></div><span class="spacer"></span><button class="btn" data-act="report" style="margin-bottom:16px">Relatório semanal</button></div>
      <div class="grid2"><div>
      <section class="card"><div class="card-h"><h3>Dificuldade</h3><span class="chip"><b id="diff-name">${lv.name}</b> · <span id="diff-pct" class="num">${Math.round(mul * 100)}%</span></span></div>
        <input type="range" id="diff-range" class="range" min="0.6" max="1.8" step="0.05" value="${mul}" aria-label="Dificuldade das batalhas">
        <div class="range-lbl small muted">${[[0.6, 'Tranquila'], [1, 'Normal'], [1.35, 'Épica'], [1.8, 'Lendária']].map(([v, n]) => `<span style="left:${((v - 0.6) / 1.2) * 100}%">${n}</span>`).join('')}</div>
        <p class="small" style="margin:10px 0 0"><span id="diff-blurb">${esc(lv.blurb)}</span> Chance de vitória esta noite com essa dificuldade: <b id="diff-chance" class="num">${hs.length ? Math.round(E.winChance(hs, stage(), 40, mul) * 100) + '%' : '–'}</b>.</p>
        <p class="small muted" style="margin:6px 0 0">Multiplica a vida e o poder de todos os inimigos. Vale a partir da próxima batalha.</p></section>
      ${approvalSection(hs)}
      <section class="card"><div class="card-h"><h3>Tarefas obrigatórias</h3><span class="small muted">Aparecem todo dia para quem você escolher. Só você pode apagar.</span></div>
        <form class="addtask" data-form="chore"><input type="text" id="chore-title" value="${esc((S.inputs || {})["chore-title"] || "")}" maxlength="80" placeholder="Ex.: Escovar os dentes, arrumar a mochila" autocomplete="off">
          <div class="row"><div class="seg" role="group" aria-label="Dificuldade">${diffButtons()}</div></div>
          ${freqControls(Object.assign(newFreqState(), { freq: S.newFreq === 'once' ? 'daily' : S.newFreq }), 'new', true)}
          <div class="row"><label class="check" for="chore-due">Até que horas? <input type="time" id="chore-due" class="time-in" value="${esc(S.newDue)}"></label></div>
          <div class="field" style="margin:0"><span class="lbl">Para quem</span><div class="opts"><label class="check"><input type="radio" name="chore-who" value="all" ${S.choreAssign === 'all' ? 'checked' : ''} data-act="choreWho"> Todos os heróis</label><label class="check"><input type="radio" name="chore-who" value="some" ${S.choreAssign !== 'all' ? 'checked' : ''} data-act="choreWho"> Escolher</label></div>
          ${S.choreAssign !== 'all' ? `<div class="opts" style="margin-top:8px">${hs.map((h) => `<label class="check"><input type="checkbox" class="chore-h" value="${h.id}"> ${esc(h.name)}</label>`).join('')}</div>` : ''}</div>
          <div class="row"><button class="btn primary" type="submit">Adicionar obrigatória</button></div></form>
        ${choreList().length ? `<ul class="hist" style="margin-top:12px">${choreList().map((c) => `<li><span><b>${esc(c.title)}</b> <span class="small muted">· ${D.DIFF[c.diff].name} · ${freqTxt(Object.assign({ chore: true }, c))}${c.from && c.from > today() ? ' · a partir de ' + fmtDay(c.from) : ''}${c.due ? ' · até ' + c.due : ''} · ${esc(assignTxt(c))}</span></span><span class="row" style="gap:6px"><button class="btn sm ghost" data-act="editTask" data-scope="chore" data-id="${c.id}">Editar</button><button class="btn sm ghost" data-act="delChore" data-id="${c.id}">Remover</button></span></li>`).join('')}</ul>` : '<p class="small muted" style="margin:10px 0 0">Nenhuma tarefa obrigatória.</p>'}</section>
      </div><div>
      ${requestsAdmin()}
      <section class="card">${rewardsAdmin(false)}</section>
      <section class="card"><div class="card-h"><h3>Co-criadores</h3><span class="small muted">Também abrem estas configurações.</span></div>
        ${(() => { const others = hs.filter((h) => h.id !== p.creatorId); const main = S.heroes[p.creatorId];
          return `<p class="small" style="margin:0 0 10px">${main ? `${roleTag(main)} <b>${esc(main.name)}</b>` : ''}</p>${others.length ? `<div class="co-list">${others.map((h) => { const on = isCoCreator(h.id); return `<label class="co-item${on ? ' on' : ''}"><input type="checkbox" data-act="toggleCo" value="${h.id}" ${on ? 'checked' : ''} ${isMainCreator() ? '' : 'disabled'}><span class="ic">${A.heroSvg(h, { noPet: true, noWeapon: true })}</span><span><b>${esc(h.name)}</b><br><span class="small muted">${D.CLASSES[h.cls].name}</span></span></label>`; }).join('')}</div>` : '<p class="small muted" style="margin:0">Quando outras pessoas criarem seus heróis na sala, elas aparecem aqui.</p>'}
          ${isMainCreator() ? '' : '<p class="small muted" style="margin:10px 0 0">Só quem criou a sala escolhe os co-criadores.</p>'}`; })()}</section>
      <section class="card"><h3>PIN das configurações</h3><p class="small muted" style="margin:6px 0 10px">${p.pin ? 'As configurações pedem o PIN para abrir, para o criador e para os co-criadores.' : 'Sem PIN, qualquer pessoa que escolher o personagem de um criador abre as configurações.'}</p>
        ${isMainCreator() ? `<div class="row"><button class="btn sm" data-act="setPinAsk">${p.pin ? 'Trocar PIN' : 'Criar PIN'}</button>${p.pin ? '<button class="btn sm ghost" data-act="clearPin">Remover PIN</button>' : ''}</div>` : '<p class="small muted" style="margin:0">Só quem criou a sala troca o PIN. Os co-criadores usam o mesmo PIN.</p>'}</section>
      <section class="card"><h3>Sala</h3><p class="small" style="margin:6px 0 10px">Código para a família entrar: <b class="code-big">${esc(S.room)}</b></p>
        <div class="row"><button class="btn sm" data-act="copyCode">Copiar código</button>${hs.length ? '<button class="btn sm ghost" data-act="forceBattle">Prévia da batalha</button>' : ''}</div>
        <p class="small muted" style="margin:8px 0 0">A prévia mostra como a batalha desta noite terminaria se fosse agora. Não dá recompensa nem muda o estágio.</p></section>
      </div></div>`;
  }
  function requestsAdmin() {
    const open = openRequests();
    return `<section class="card"><div class="card-h"><h3>Pedidos de recompensa</h3>${open.length ? `<span class="tag wait">${open.length} em aberto</span>` : ''}</div>
      ${open.length ? `<ul class="approvals">${open.map((q) => { const h = S.heroes[q.heroId]; return `<li><span class="ic">${h ? A.heroSvg(h, { noPet: true, noWeapon: true }) : ''}</span><span><b>${esc(q.heroName)}</b> · ${esc(q.name)}<br><span class="small muted">${fmtDay(q.day)} · ${q.cost} XP · ${q.status === 'pending' ? 'aguardando aprovação' : 'aprovado, falta entregar'}</span></span>
        <span class="row" style="gap:6px">${q.status === 'pending' ? `<button class="btn sm primary" data-act="reqOk" data-id="${q.id}">Aprovar</button><button class="btn sm ghost" data-act="reqNo" data-id="${q.id}">Recusar</button>` : `<button class="btn sm primary" data-act="reqDone" data-id="${q.id}">Marcar entregue</button>`}</span></li>`; }).join('')}</ul>` : '<p class="small muted" style="margin:0">Quando alguém pedir uma recompensa, o pedido aparece aqui.</p>'}</section>`;
  }
  function approvalSection(hs) {
    const c = approvalCfg(); const items = pendingItems();
    const kids = hs.filter((h) => !isCreator(h.id));
    return `<section class="card"><div class="card-h"><h3>Aprovação de tarefas</h3>${items.length ? `<span class="tag wait">${items.length} esperando</span>` : ''}</div>
      <p class="small muted" style="margin:0 0 8px">Com aprovação ligada, o XP só entra depois que um criador confirmar. Criadores não precisam de aprovação.</p>
      <div class="opts">${[['off', 'Desligada'], ['all', 'Para todos'], ['some', 'Para alguns']].map(([k, n]) => `<button class="opt" data-act="setApproval" data-v="${k}" aria-pressed="${c.mode === k}">${n}</button>`).join('')}</div>
      ${c.mode === 'some' ? `<div class="opts" style="margin-top:8px">${kids.length ? kids.map((h) => `<label class="check"><input type="checkbox" data-act="approvalHero" value="${h.id}" ${(c.heroes || []).includes(h.id) ? 'checked' : ''}> ${esc(h.name)}</label>`).join('') : '<span class="small muted">Ainda não há outros heróis.</span>'}</div>` : ''}
      ${items.length ? `<ul class="approvals">${items.map((it) => `<li><span class="ic">${A.heroSvg(it.hero, { noPet: true, noWeapon: true })}</span><span><b>${esc(it.hero.name)}</b> · ${esc(it.task.title)}<br><span class="small muted">${it.kind === 'board' ? 'Missão da guilda' : D.DIFF[it.task.diff].name} · ${it.xp} XP</span></span><span class="row" style="gap:6px"><button class="btn sm primary" data-act="approve" data-kind="${it.kind}" data-hero="${it.hero.id}" data-id="${it.task.id}">Aprovar</button><button class="btn sm ghost" data-act="reject" data-kind="${it.kind}" data-hero="${it.hero.id}" data-id="${it.task.id}">Recusar</button></span></li>`).join('')}</ul>` : c.mode !== 'off' ? '<p class="small muted" style="margin:10px 0 0">Nada esperando aprovação agora.</p>' : ''}</section>`;
  }
  function drawLinks() {
    const tree = document.getElementById('tree'), svg = document.getElementById('links'); if (!tree || !svg) return;
    const h = S.heroes[S.heroId]; const c = D.CLASSES[h.cls]; const box = tree.getBoundingClientRect();
    const pos = (id) => { const el = document.getElementById('node-' + id); const r = el.getBoundingClientRect(); return { x: r.left - box.left + r.width / 2, top: r.top - box.top, bot: r.bottom - box.top }; };
    let out = '';
    for (const s of c.skills) for (const r of s.req || s.reqAny || []) {
      const a = pos(r), b = pos(s.id); const on = h.skills[r] && h.skills[s.id];
      const my = (a.bot + b.top) / 2;
      out += `<path d="M${a.x} ${a.bot} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.top}" fill="none" stroke="${on ? c.color : '#3a4a55'}" stroke-width="${on ? 3 : 2}" ${s.reqAny ? 'stroke-dasharray="5 4"' : ''}/>`;
    }
    svg.innerHTML = out;
  }
  function shopTab(h) {
    const gold = goldOf(h); const c = D.CLASSES[h.cls];
    const gearCards = Object.entries(D.GEAR_SLOTS).map(([slot, info]) => {
      const cur = (h.gear || {})[slot] || 0; const next = D.GEAR_TIERS[cur];
      const curT = D.GEAR_TIERS[cur - 1];
      const nm = (t) => slot === 'weapon' ? `${c.weapon.split(' ')[0]} de ${t.n}` : slot === 'armor' ? `${D.ARMOR_NAME[h.cls]} de ${t.n}` : `Amuleto de ${t.n}`;
      return `<div class="item${cur ? ' owned' : ''}"><div class="eyebrow">${info.name}</div><div class="nm">${curT ? nm(curT) : 'Nenhum equipado'}</div><div class="small muted">${curT ? info.stat(curT) : 'Sem bônus'}</div>
        ${next ? `<hr style="border:0;border-top:1px dashed var(--line);width:100%;margin:6px 0"><div class="small">Próximo: <b>${nm(next)}</b></div><div class="small muted">${info.stat(next)}${h.level < next.lvl ? ` · requer nível ${next.lvl}` : ''}</div>
        <button class="btn sm ${gold >= priceOf(next.price, 'gear') && h.level >= next.lvl ? 'primary' : ''}" data-act="buyGear" data-v="${slot}" ${gold >= priceOf(next.price, 'gear') && h.level >= next.lvl && !S.readOnly ? '' : 'disabled'}><span class="coin"></span> ${priceOf(next.price, 'gear')}${priceOf(next.price, 'gear') < next.price ? ` <s class="small">${next.price}</s>` : ''}</button>` : '<span class="tag win">Melhor equipamento</span>'}</div>`;
    }).join('');
    const own = (h.cosmetics && h.cosmetics.owned) || [];
    const cgold = gold + festaOf(h);
    const cat = D.COSMETIC_SLOTS[S.shopCat] ? S.shopCat : 'hat';
    const catChips = `<div class="opts shop-cats">${Object.entries(D.COSMETIC_SLOTS).map(([slot, label]) => { const all = D.COSMETICS.filter((x) => x.slot === slot && !x.gift); const mine = all.filter((x) => own.includes(x.id)).length; return `<button class="opt" data-act="shopCat" data-v="${slot}" aria-pressed="${cat === slot}">${label} <span class="small muted">${mine}/${all.length}</span></button>`; }).join('')}</div>`;
    const cos = `${catChips}<div class="shop">${D.COSMETICS.filter((x) => x.slot === cat && !x.gift).map((x) => {
      const slot = x.slot; const has = own.includes(x.id); const on = h.cosmetics[slot] === x.id;
      const pv = Object.assign({}, h, { cosmetics: Object.assign({}, h.cosmetics, { [slot]: x.id }) });
      return `<div class="item${has ? ' owned' : ''}${on ? ' on' : ''}"><button class="pv zoomable" data-act="zoomItem" data-v="${x.id}" aria-label="Ver ${esc(x.name)} de perto">${A.heroSvg(pv, { noPet: slot !== 'pet' })}<span class="zoom-hint" aria-hidden="true">🔍</span></button><div class="nm">${x.name}</div>${D.PET_BONUS[x.id] ? `<div class="small" style="color:var(--good)">Em combate: ${D.PET_BONUS[x.id].txt}</div>` : ''}
        ${has ? `<button class="btn sm" data-act="equipCos" data-v="${x.id}" ${S.readOnly ? 'disabled' : ''}>${on ? 'Tirar' : 'Usar'}</button>` : `<button class="btn sm ${cgold >= priceOf(x.price, 'cos') ? 'primary' : ''}" data-act="buyCos" data-v="${x.id}" ${cgold >= priceOf(x.price, 'cos') && !S.readOnly ? '' : 'disabled'}><span class="coin"></span> ${priceOf(x.price, 'cos')}${priceOf(x.price, 'cos') < x.price ? ` <s class="small">${x.price}</s>` : ''}</button>`}</div>`;
    }).join('')}</div>`;
    const potOn = h.potion && h.potion.day === today() ? D.POTIONS.find((x) => x.id === h.potion.id) : null; const pp = D.potionPrice(h.level);
    const potionCard = `<div class="card"><div class="card-h"><div><h3>Poções</h3><span class="small muted">Valem só para a batalha desta noite. Uma por noite.</span></div>${potOn ? `<span class="chip warn">Bebida hoje: ${potOn.name}</span>` : ''}</div>
      <div class="shop">${D.POTIONS.map((x) => `<div class="item${potOn && potOn.id === x.id ? ' on' : ''}"><div class="pv potion-pv">${potionSvg(x.id)}</div><div class="nm">${x.name}</div><div class="small" style="color:var(--good)">${x.txt}</div>
        ${potOn ? (potOn.id === x.id ? '<span class="tag win">Bebida</span>' : '') : `<button class="btn sm ${gold >= pp ? 'primary' : ''}" data-act="buyPotion" data-v="${x.id}" ${gold >= pp && !S.readOnly ? '' : 'disabled'}><span class="coin"></span> ${pp}</button>`}</div>`).join('')}</div></div>`;
    const rel = h.relics || []; const on = h.relicOn || [];
    const relicCard = `<div class="card"><div class="card-h"><div><h3>Relíquias</h3><span class="small muted">Saque das vitórias e dos baús. Equipe até ${D.RELIC_SLOTS}.</span></div><span class="chip">${rel.length}/${D.MAX_RELICS}</span></div>
      ${rel.length ? `<div class="shop">${rel.map((rl) => { const R = D.RARITY[rl.rarity]; const eq = on.includes(rl.id); return `<div class="item relic${eq ? ' on' : ''}" style="--rc:${R.color}"><div class="rar" style="color:${R.color}">${R.name}</div><div class="nm">${esc(rl.name)}</div><div class="small muted">${relicTxt(rl)}</div>
        <div class="row" style="gap:6px"><button class="btn sm ${eq ? '' : 'primary'}" data-act="equipRelic" data-id="${rl.id}" ${S.readOnly ? 'disabled' : ''}>${eq ? 'Tirar' : 'Equipar'}</button><button class="btn sm ghost" data-act="sellRelic" data-id="${rl.id}" ${S.readOnly || eq ? 'disabled' : ''}>Vender · ${R.sell}</button></div></div>`; }).join('')}</div>` : '<div class="empty-note">Vença batalhas e abra baús para encontrar relíquias.</div>'}</div>`;
    return relicCard + potionCard + `<div class="card"><div class="card-h"><h3>Equipamentos</h3><span class="chip"><span class="coin"></span> <b class="num">${gold}</b> ouro</span></div><p class="small muted" style="margin-top:0">Ouro vem das vitórias do grupo. Equipamentos deixam o herói mais forte na batalha.</p><div class="shop">${gearCards}</div></div>
      <div class="card"><div class="card-h"><div><h3>Visual</h3><span class="small muted">Itens só de estilo. Depois de comprados, troque quando quiser.</span></div>${festaOf(h) ? `<span class="chip festa-chip"><span class="coin festa"></span> <b class="num">${festaOf(h)}</b> moedas de festa</span>` : ''}</div>${festaOf(h) ? '<p class="small muted" style="margin-top:0">As moedas de festa são gastas primeiro; se faltar, o resto sai do ouro.</p>' : ''}${cos}</div>`;
  }
  function visualTab(h) {
    const own = (h.cosmetics && h.cosmetics.owned) || [];
    return `<div class="grid2"><div class="card"><div class="card-h"><h3>Aparência</h3><button class="btn sm ghost" data-act="randLook">Sortear</button></div>
      <div class="field"><label for="rename">Nome</label><input type="text" id="rename" maxlength="18" value="${esc(h.name)}" data-input="rename" autocomplete="off" ${S.readOnly ? 'disabled' : ''}></div>
      <div class="field"><label for="birth-edit">Aniversário</label><input type="date" id="birth-edit" class="txt date-in" value="${esc(h.birth || '')}" max="${today()}" ${S.readOnly ? 'disabled' : ''}><div class="small muted" style="margin-top:4px">O presente de aniversário pode ser aberto uma vez por ano.</div></div>${lookControls(h.look)}</div>
      <div class="card"><div class="card-h"><h3>Itens de estilo</h3></div>${own.length ? Object.entries(D.COSMETIC_SLOTS).map(([slot, label]) => {
        const mine = D.COSMETICS.filter((x) => x.slot === slot && own.includes(x.id)); if (!mine.length) return '';
        return `<div class="field"><span class="lbl">${label}</span><div class="opts"><button class="opt" data-act="setCos" data-k="${slot}" data-v="" aria-pressed="${!h.cosmetics[slot]}">Nenhum</button>${mine.map((x) => `<button class="opt" data-act="setCos" data-k="${slot}" data-v="${x.id}" aria-pressed="${h.cosmetics[slot] === x.id}">${x.name}</button>`).join('')}</div></div>`;
      }).join('') : `<div class="empty-note">Compre chapéus, capas, auras e mascotes na loja com o ouro das vitórias.</div><button class="btn" style="margin-top:10px" data-act="tab" data-v="loja">Ir para a loja</button>`}</div></div>`;
  }

  /* ----- Modais ----- */
  function modalHtml() {
    const m = S.modal;
    if (m.type === 'levelup') {
      const h = S.heroes[m.heroId];
      return `<div class="modal-bg" data-act="closeModal"><div class="modal lvlup" role="dialog" aria-modal="true" aria-labelledby="lvl-t" data-stop><div class="eyebrow">Subiu de nível</div><div class="big num" id="lvl-t">${m.level}</div>
        <p><b>${esc(h ? h.name : '')}</b> ficou mais forte e ganhou ${m.ups > 1 ? m.ups + ' pontos' : '1 ponto'} de habilidade.</p><div class="row" style="justify-content:center"><button class="btn primary" data-act="goSkills">Escolher habilidade</button><button class="btn ghost" data-act="closeModal">Depois</button></div></div></div>`;
    }
    if (m.type === 'pickHero') {
      const t = S.board[m.taskId]; if (!t) return '';
      return `<div class="modal-bg" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pk-t" data-stop><div class="eyebrow">Missão da guilda</div><h3 id="pk-t">Quem cumpriu "${esc(t.title)}"?</h3>
        <div class="picker">${heroList().filter((h) => canDoBoard(t, h.id)).map((h) => `<button class="pick" data-act="doneBoardAs" data-id="${h.id}"><span class="ic">${A.heroSvg(h, { noPet: true })}</span><span>${esc(h.name)}</span></button>`).join('')}</div>
        <div class="row"><button class="btn ghost" data-act="closeModal">Cancelar</button></div></div></div>`;
    }
    if (m.type === 'pin') {
      return `<div class="modal-bg" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pin-t" data-stop><h3 id="pin-t">${m.mode === 'set' ? 'Criar PIN do mestre' : 'PIN do mestre'}</h3>
        <form data-form="pin"><div class="field" style="margin-top:12px"><label for="pin-in">${m.mode === 'set' ? 'Escolha de 4 a 8 números' : 'Digite o PIN'}</label><input type="password" id="pin-in" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" class="pin-in"></div>
        ${m.err ? `<p class="small" style="color:var(--bad);margin-top:-8px">${esc(m.err)}</p>` : ''}
        <div class="row"><button class="btn primary" type="submit">${m.mode === 'set' ? 'Salvar PIN' : 'Destravar'}</button><button class="btn ghost" type="button" data-act="closeModal">Cancelar</button></div></form></div></div>`;
    }
    if (m.type === 'editTask') {
      return `<div class="modal-bg" data-act="closeModal"><form class="modal" role="dialog" aria-modal="true" aria-labelledby="ed-t" data-stop data-form="edit"><div class="eyebrow">${m.scope === 'board' ? 'Missão da guilda' : m.scope === 'chore' ? 'Tarefa obrigatória' : 'Sua tarefa'}</div><h3 id="ed-t">Editar tarefa</h3>
        <div class="field" style="margin-top:12px"><label for="ed-title">Título</label><input type="text" id="ed-title" class="txt" style="width:100%" maxlength="80" value="${esc(m.title)}"></div>
        <div class="field"><span class="lbl">Dificuldade</span><div class="seg">${Object.values(D.DIFF).map((d) => `<button type="button" style="--c:${d.color}" data-act="edDiff" data-v="${d.id}" aria-pressed="${m.diff === d.id}">${d.name}</button>`).join('')}</div></div>
        <div class="field">${freqControls(m, 'ed', m.scope === 'chore')}</div>
        <div class="field"><label class="check" for="ed-due">Até que horas? <input type="time" id="ed-due" class="time-in" value="${esc(m.due || '')}"></label> <button type="button" class="btn sm ghost" data-act="edClearDue">Sem horário</button></div>
        ${m.scope === 'board' ? `<div class="field"><label class="check"><input type="checkbox" id="ed-duo" ${m.duo ? 'checked' : ''}> Em dupla</label></div>${whoPicker(m.who || [], 'edWho')}` : ''}
        <div class="row"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" data-act="closeModal">Cancelar</button></div></form></div>`;
    }
    if (m.type === 'zoom') {
      const h = S.heroes[S.heroId] || S.heroes[S.me]; const x = D.COSMETICS.find((c) => c.id === m.id); if (!h || !x) return '';
      const own = (h.cosmetics && h.cosmetics.owned) || []; const has = own.includes(x.id); const on = h.cosmetics[x.slot] === x.id;
      const withIt = Object.assign({}, h, { cosmetics: Object.assign({}, h.cosmetics, { [x.slot]: x.id }) });
      const without = Object.assign({}, h, { cosmetics: Object.assign({}, h.cosmetics, { [x.slot]: on ? null : h.cosmetics[x.slot] }) });
      const z = m.z || 1; const org = ZOOM_FOCUS[x.slot] || '50% 50%';
      const pane = (hh, label) => `<div class="zpane"><div class="zview"><div class="zin" style="transform:scale(${z});transform-origin:${org}">${A.heroSvg(hh, { noPet: x.slot !== 'pet' })}</div></div>${label ? `<div class="small muted" style="text-align:center;margin-top:4px">${label}</div>` : ''}</div>`;
      const pr = priceOf(x.price, 'cos'); const cg = goldOf(h) + festaOf(h);
      return `<div class="modal-bg" data-act="closeModal"><div class="modal zoom-modal" role="dialog" aria-modal="true" aria-labelledby="zm-t" data-stop>
        <div class="row"><div><div class="eyebrow">${esc(D.COSMETIC_SLOTS[x.slot])}</div><h3 id="zm-t" style="margin:2px 0 0">${esc(x.name)}</h3></div><span class="spacer"></span><button class="btn sm ghost" data-act="closeModal" aria-label="Fechar">✕</button></div>
        <div class="zpanes${m.cmp ? ' two' : ''}">${m.cmp ? pane(without, 'Sem o item') + pane(withIt, 'Com o item') : pane(withIt)}</div>
        <div class="row zctl"><div class="seg" role="group" aria-label="Zoom">${ZOOMS.map((v) => `<button type="button" data-act="zoomLvl" data-v="${v}" aria-pressed="${z === v}">${v === 1 ? 'Inteiro' : v + '×'}</button>`).join('')}</div>
          <label class="check"><input type="checkbox" data-act="zoomCmp" ${m.cmp ? 'checked' : ''}> Comparar com e sem</label></div>
        ${D.PET_BONUS[x.id] ? `<p class="small" style="color:var(--good);margin:4px 0 0">Em combate: ${D.PET_BONUS[x.id].txt}</p>` : '<p class="small muted" style="margin:4px 0 0">Item só de estilo: não muda a força na batalha.</p>'}
        <div class="row" style="margin-top:12px">${has ? `<button class="btn primary" data-act="equipCos" data-v="${x.id}" ${S.readOnly ? 'disabled' : ''}>${on ? 'Tirar' : 'Usar agora'}</button><span class="tag win">Já é seu</span>` : `<button class="btn primary" data-act="buyCos" data-v="${x.id}" ${cg >= pr && !S.readOnly ? '' : 'disabled'}>Comprar · <span class="coin"></span> ${pr}</button>${cg < pr ? `<span class="small muted">Faltam ${pr - cg} moedas.</span>` : ''}`}
          <span class="spacer"></span>${zoomNav(x)}</div></div></div>`;
    }
    if (m.type === 'kudos') {
      const to = S.heroes[m.to]; if (!to) return '';
      const msgs = ['Mandou bem!', 'Obrigado pela ajuda!', 'Que capricho!', 'Você é demais!', 'Orgulho da guilda!'];
      const emo = m.emo || '⭐';
      return `<div class="modal-bg" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="kd-t" data-stop><div class="eyebrow">Elogio</div><h3 id="kd-t">Elogiar ${esc(to.name)}</h3>
        <p class="small muted">${esc(to.name)} ganha ${D.KUDOS_XP} XP. Você pode dar ${D.KUDOS_PER_DAY} elogios por dia, um para cada pessoa.</p>
        <div class="lbl" style="margin-top:6px">1. Escolha um emoji</div><div class="emo-pick">${KUDOS_EMO.map((x) => `<button class="emo" data-act="kudosEmo" data-v="${x}" aria-pressed="${emo === x}" aria-label="Emoji ${x}">${x}</button>`).join('')}</div>
        <div class="lbl">2. Escolha a mensagem</div><div class="opts" style="margin:6px 0 14px">${msgs.map((x) => `<button class="opt" data-act="sendKudos" data-v="${esc(x)}">${emo} ${esc(x)}</button>`).join('')}</div>
        <button class="btn ghost" data-act="closeModal">Cancelar</button></div></div>`;
    }
    if (m.type === 'bday') {
      return `<div class="modal-bg" data-act="closeModal"><div class="modal chest-modal bday-modal" role="dialog" aria-modal="true" aria-labelledby="bd-t" data-stop>${confetti()}<div class="chest-anim">${giftSvg(true)}</div><div class="eyebrow">Presente de aniversário</div><h3 id="bd-t">${m.age ? `Parabéns pelos ${m.age} anos!` : 'Feliz aniversário!'}</h3>
        <ul class="loot">${m.items.map((x) => `<li>${x}</li>`).join('')}</ul><button class="btn primary" data-act="closeModal">Obrigado!</button></div></div>`;
    }
    if (m.type === 'chest') {
      return `<div class="modal-bg" data-act="closeModal"><div class="modal chest-modal" role="dialog" aria-modal="true" aria-labelledby="cs-t" data-stop><div class="chest-anim">${chestSvg(true)}</div><div class="eyebrow">Baú do dia</div><h3 id="cs-t">Tudo isso é seu!</h3>
        <ul class="loot">${m.items.map((x) => `<li>${x}</li>`).join('')}</ul><button class="btn primary" data-act="closeModal">Pegar tudo</button></div></div>`;
    }
    if (m.type === 'redeem') {
      const h = S.heroes[m.heroId], r = S.rewards[m.rewardId]; if (!h || !r) return '';
      return `<div class="modal-bg" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="rd-t" data-stop><div class="eyebrow">Resgatar recompensa</div><h3 id="rd-t">${esc(r.name)}</h3>
        <p><b>${esc(h.name)}</b> vai reservar <b>${r.cost} XP de resgate</b> e fica com ${redeemBal(h) - r.cost}. O pedido vai para os criadores da sala; se for recusado, o XP volta. O nível do herói não muda.</p>
        <div class="row"><button class="btn primary" data-act="redeem">Fazer pedido</button><button class="btn ghost" data-act="closeModal">Cancelar</button></div></div></div>`;
    }
    if (m.type === 'retire') {
      const h = S.heroes[m.heroId];
      return `<div class="modal-bg" data-act="closeModal"><div class="modal" role="dialog" aria-modal="true" data-stop><h3>Aposentar ${esc(h.name)}?</h3><p>O herói sai da guilda com todo o progresso, tarefas e itens. Isso não pode ser desfeito.</p>
        <div class="row"><button class="btn danger" data-act="retire">Aposentar</button><button class="btn ghost" data-act="closeModal">Manter herói</button></div></div></div>`;
    }
    if (m.type === 'replay') {
      const b = m.battle; const reg = Math.floor((b.stage - 1) / 5) % D.REGIONS.length;
      return `<div class="modal-bg"><div class="modal wide battle-modal" role="dialog" aria-modal="true" aria-labelledby="rp-t"><div class="card-h"><div><div class="eyebrow">${b.preview ? 'Prévia da batalha desta noite · não vale recompensa' : m.practice ? 'Treino · não vale recompensa' : b.event ? `Evento: ${esc(b.name)} · ${fmtDay(b.day)}` : `Batalha de ${fmtDay(b.day)}${b.test ? ' · teste' : ''}`} · Estágio ${b.stage}</div><h3 id="rp-t">${b.event ? esc(b.special.title) : esc(E.regionOf(b.stage).name)}</h3></div>
        <div class="row"><button class="btn sm ghost" data-act="toggleSound" id="snd-btn">${Sound.on ? 'Som ligado' : 'Som desligado'}</button><button class="btn sm" data-act="speed">Velocidade ${m.speed}×</button><button class="btn sm" data-act="skip">Pular</button><button class="btn sm ghost" data-act="closeModal">Fechar</button></div></div>
        ${b.missed ? `<p class="small muted" style="margin:0 0 8px">A guilda ficou ${b.missed} dia${b.missed > 1 ? 's' : ''} sem abrir; esta foi a batalha mais recente.</p>` : ''}
        <div class="scene" id="scene">${A.sceneSvg(reg)}<div class="round-chip" id="round">Rodada 1</div><div class="units" id="units"></div><div class="fxl" id="fxl"></div><div class="res-ov" id="result"></div></div>
        <div class="feed" id="feed" aria-live="polite">Os heróis se preparam…</div></div></div>`;
    }
    return '';
  }
  function toastHtml() { return `<div class="toast" role="status">${S.toast.html}${S.toast.undo ? `<button class="btn sm" data-act="undo">Desfazer</button>` : ''}</div>`; }
  let toastTimer = null;
  function showToast(html, undo) { S.toast = { html, undo }; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; render(); }, undo ? 6000 : 3500); render(); }

  /* ----- Reprodução da batalha: cena estilo jogo idle ----- */
  let replayTimer = null;
  // posições (x %, pé em y %, escala), da frente para trás
  const SLOTS = [[38, 80, 1], [27, 96, 1.07], [29, 62, 0.9], [16, 86, 1.02], [10, 66, 0.9]];
  const FOE_SLOTS = SLOTS.map(([x, y, sc]) => [100 - x, y, sc * 1.12]);
  function openReplay(battle, practice) { clearTimeout(replayTimer); S.modal = { type: 'replay', battle, practice, step: 0, speed: 1, hp: {}, finished: false, mounted: false, key: uidGen() }; render(); Sound.music(true); }
  function layoutUnits(b) {
    const hs = b.units.filter((u) => u.side === 'h').slice().sort((a, c) => ((D.CLASSES[c.cls] || {}).aggro || 1) - ((D.CLASSES[a.cls] || {}).aggro || 1));
    const es = b.units.filter((u) => u.side === 'e').slice().sort((a, c) => (c.boss ? 1 : 0) - (a.boss ? 1 : 0));
    const pos = {};
    hs.forEach((u, i) => { pos[u.id] = SLOTS[i % SLOTS.length]; });
    es.forEach((u, i) => { const p = FOE_SLOTS[i % FOE_SLOTS.length]; pos[u.id] = [p[0], p[1], p[2] * (u.boss ? 1.45 : u.count > 1 ? 1.25 : u.big ? 1.15 : u.small ? 0.85 : 1)]; });
    return pos;
  }
  function mountReplay() {
    const m = S.modal; const b = m.battle;
    const box = document.getElementById('units'); if (!box) return;
    if (!m.mounted) { m.mounted = true; b.units.forEach((u) => { m.hp[u.id] = u.maxHp; }); }
    const pos = layoutUnits(b);
    box.innerHTML = b.units.map((u) => {
      const [x, y, sc] = pos[u.id]; const hp = m.hp[u.id]; const pct = Math.max(0, hp / u.maxHp);
      const hero = u.side === 'h' ? Object.assign({ cosmetics: {} }, S.heroes[u.id] || { name: u.name, cls: u.cls, look: u.look || {}, cosmetics: u.cosmetics || {} }) : null;
      const alive = u.count > 1 ? Math.max(0, Math.ceil(hp / u.memberHp - 1e-6)) : 1;
      const art = hero ? A.heroSvg(hero, { noPet: true }) : A.enemyArt(u, alive);
      return `<div class="bu ${u.side === 'h' ? 'hero' : 'foe'}${hp <= 0 ? ' ko' : ''}" id="u-${u.id}" style="left:${x}%;top:${y}%;--s:${sc};z-index:${Math.round(y)}">
        <div class="hpw"><div class="bar ${u.side === 'h' ? 'hp' : 'ehp'}${pct < 0.3 ? ' low' : ''}"><i style="width:${pct * 100}%"></i></div></div>
        <div class="fig"><div class="bob" style="animation-delay:-${(x % 7) / 3}s">${art}</div></div><div class="bn"><span>${esc(u.name)}</span></div></div>`;
    }).join('');
    if (m.finished) showResult(); else scheduleStep();
  }
  function applyFx(ev) { for (const f of ev.fx) S.modal.hp[f[0]] = f[2]; }
  function scheduleStep() {
    clearTimeout(replayTimer);
    const m = S.modal; if (!m || m.type !== 'replay' || m.finished) return;
    const ev = m.battle.log[m.step];
    if (!ev) { replayTimer = setTimeout(() => { if (S.modal === m) { m.finished = true; showResult(); } }, 500 / m.speed); return; }
    const wait = (ev.tick ? 320 : ev.stunned ? 450 : 900) / m.speed;
    replayTimer = setTimeout(() => { if (S.modal !== m) return; playEvent(ev); m.step++; scheduleStep(); }, m.step === 0 ? 500 : wait);
  }
  function centerOf(el, sc) {
    const r = el.querySelector('.fig').getBoundingClientRect(), s = sc.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.45 };
  }
  function floatText(el, label, cls) {
    const fl = document.createElement('span'); fl.className = 'floater ' + cls; fl.textContent = label;
    fl.style.setProperty('--dx', (Math.random() * 30 - 15).toFixed(0) + 'px'); el.appendChild(fl); setTimeout(() => fl.remove(), 1100);
  }
  function updateUnit(id, hpAfter) {
    const m = S.modal; const u = m.battle.units.find((x) => x.id === id); const el = document.getElementById('u-' + id); if (!u || !el) return null;
    m.hp[id] = hpAfter; const pct = Math.max(0, hpAfter / u.maxHp);
    const bar = el.querySelector('.bar'); bar.querySelector('i').style.width = pct * 100 + '%'; bar.classList.toggle('low', pct < 0.3);
    el.classList.toggle('ko', hpAfter <= 0);
    if (u.count > 1) { const alive = Math.max(0, Math.ceil(hpAfter / u.memberHp - 1e-6)); el.querySelectorAll('.mem').forEach((mm, i) => mm.classList.toggle('gone', i >= alive && hpAfter > 0)); }
    return el;
  }
  /* ----- Efeitos visuais das habilidades ----- */
  const ELEM_COLOR = { fire: '#ff8a4c', ice: '#9fe4ff', arrow: '#f0e6c8', holy: '#ffe48a', slash: '#ffffff', nature: '#7bd36b', shadow: '#b997f2', curse: '#d36bc6', music: '#ffb36b', lightning: '#cfeeff', chi: '#ffcf7a', tech: '#7adfff', royal: '#ff8fc8', spirit: '#5fe0d8', poison: '#a6e86b', meteor: '#ff7a3a', bomb: '#ffb84a', quake: '#d8b070', claw: '#ff6a5a', dark: '#b06aff', shield: '#9fd8ff', star: '#ffe27a', rainbow: '#ff9ad5', unicorn: '#f6b8ff' };
  const RAINBOW = ['#ff6b6b', '#ffb04a', '#ffe66b', '#7be07b', '#6bc8ff', '#9b8bff', '#e08bff'];
  const PRINCESS_ELE = ['star', 'rainbow', 'unicorn'];
  const CLASS_ELEM = { guardiao: 'shield', gelo: 'ice', fogo: 'fire', arqueiro: 'arrow', paladino: 'holy', guerreiro: 'slash', druida: 'nature', curandeiro: 'holy', ladino: 'shadow', bruxa: 'curse', bardo: 'music', xama: 'lightning', monge: 'chi', inventor: 'tech', princesa: 'star' };
  const ELEM_WORDS = [
    [/meteoro|cometa|supernova|apocalipse|estrela cadente|estelar/, 'meteor'], [/raio|relâmpago|trovão|elétric|torreta|tempestade de raios/, 'lightning'],
    [/terremoto|sísmic|montanha|fúria do titã/, 'quake'], [/flecha|tiro|saraivada|chuva de flechas|chuva celestial|armadilha/, 'arrow'],
    [/bomba|míssil|robô|canhão|explosiv/, 'bomb'], [/gelo|neve|nevasca|granizo|glacial|congel|avalanche|ártic|inverno|polar/, 'ice'],
    [/fogo|chama|magma|vulcão|fênix|incend|solar|brasa/, 'fire'], [/veneno|praga|caldeirão|espinho|enxame|toxina|vinha/, 'poison'],
    [/luz|sagrad|divin|milagre|anjo|bênção|consagra|julgamento|ressurrei|santuário|purifica/, 'holy'], [/sombra|maldição|sabá|corvo|mau-olhado|drenar|noite das bruxas/, 'curse'],
    [/sapo/, 'nature'], [/lobo|espírit|ancestra|totem|elemento|avatar/, 'spirit'], [/pétala|encanto|baile|coroa|reino|beijo|cavaleiros|castelo|real/, 'royal'],
    [/nota|acorde|canção|balada|solo|hino|rock|serenata|sinfonia|dueto|marcha|grande final|ninar/, 'music'], [/soco|punho|palma|chute|joelhada|pressão|cem punhos/, 'chi'],
  ];
  function skillFx(u, name) {
    if (!u || !name) return null;
    if (u.side !== 'h') return { act: 'aoe', ele: 'dark', big: !!u.boss, tier: 9 };
    const c = D.CLASSES[u.cls]; const sk = c && c.skills.find((x) => x.name === name); if (!sk) return null;
    const low = name.toLowerCase(); let ele = CLASS_ELEM[u.cls] || 'slash';
    if (u.cls === 'princesa') ele = /unic|crina|chifre|manada|desfile/.test(low) ? 'unicorn' : /arco-íris/.test(low) ? 'rainbow' : 'star';
    else for (const [re, e] of ELEM_WORDS) if (re.test(low)) { ele = e; break; }
    return { act: sk.act, ele, tier: sk.tier, big: sk.tier >= 4 || (sk.act === 'aoe' && sk.p >= 1.3) };
  }
  function vxEl(layer, cls, x, y, color, life, html) {
    const d = document.createElement('div'); d.className = 'vx ' + cls; d.style.left = x + 'px'; d.style.top = y + 'px';
    if (color) d.style.setProperty('--vc', color); if (html) d.innerHTML = html;
    layer.appendChild(d); setTimeout(() => d.remove(), life); return d;
  }
  function vxBurst(layer, at, ele, spd, big) {
    const c = ELEM_COLOR[ele] || '#fff'; const life = 700 / spd;
    vxEl(layer, 'burst' + (big ? ' big' : ''), at.x, at.y, c, life);
    const n = big ? 10 : 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = (big ? 46 : 28) + Math.random() * 14; const p = vxEl(layer, 'spark e-' + ele, at.x, at.y, c, life); p.style.setProperty('--tx', Math.cos(a) * r + 'px'); p.style.setProperty('--ty', Math.sin(a) * r + 'px'); }
    if (ele === 'ice') for (let i = 0; i < 3; i++) { const sh = vxEl(layer, 'shard', at.x + (i - 1) * 10, at.y + 4, c, life); sh.style.setProperty('--rot', (i - 1) * 25 + 'deg'); }
    if (ele === 'slash' || ele === 'claw' || ele === 'chi') { const sl = vxEl(layer, 'slash' + (ele === 'claw' ? ' claw' : ''), at.x, at.y, c, life); sl.style.setProperty('--rot', (Math.random() * 60 - 30) + 'deg'); }
    if (ele === 'music') vxEl(layer, 'note', at.x, at.y, c, life, '♪');
    if (ele === 'royal') vxEl(layer, 'note', at.x, at.y, c, life, '✦');
    if (ele === 'star' || ele === 'rainbow' || ele === 'unicorn') vxPrincessBurst(layer, at, ele, life, big);
  }
  /* Princesa: estrelas, arco-íris e unicórnios */
  function vxGlyphSpark(layer, at, glyph, color, r, a, life, size) {
    const p = vxEl(layer, 'gspark', at.x, at.y, color, life, glyph);
    p.style.setProperty('--tx', Math.cos(a) * r + 'px'); p.style.setProperty('--ty', Math.sin(a) * r + 'px'); if (size) p.style.fontSize = size + 'px';
    return p;
  }
  function vxPrincessBurst(layer, at, ele, life, big) {
    const n = big ? 8 : 5;
    if (ele === 'star') { vxEl(layer, 'twinkle', at.x, at.y, '#fff6c0', life, '✦'); for (let i = 0; i < n; i++) vxGlyphSpark(layer, at, i % 2 ? '✦' : '★', '#ffe27a', (big ? 58 : 36) + Math.random() * 14, (i / n) * Math.PI * 2 + Math.random() * 0.4, life, 12 + Math.random() * 8); }
    if (ele === 'rainbow') { vxEl(layer, 'burst rb' + (big ? ' big' : ''), at.x, at.y, null, life); RAINBOW.forEach((col, i) => vxGlyphSpark(layer, at, '●', col, (big ? 54 : 34) + Math.random() * 10, (i / RAINBOW.length) * Math.PI * 2, life, 9)); }
    if (ele === 'unicorn') { vxEl(layer, 'twinkle', at.x, at.y, '#fff', life, '✨'); for (let i = 0; i < n; i++) vxGlyphSpark(layer, at, i % 3 === 0 ? '♥' : '✦', i % 2 ? '#f6b8ff' : '#ffb3d9', (big ? 52 : 32) + Math.random() * 12, (i / n) * Math.PI * 2 + Math.random() * 0.5, life, 12 + Math.random() * 6); }
  }
  function vxSvg(layer, life, inner) {
    const d = document.createElement('div'); d.className = 'vx vsvg'; const w = layer.clientWidth, h = layer.clientHeight;
    d.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`; layer.appendChild(d); setTimeout(() => d.remove(), life); return d;
  }
  const bowPaths = (d, w0) => RAINBOW.map((col, i) => `<path d="${d}" pathLength="1" fill="none" stroke="${col}" stroke-width="${w0}" stroke-linecap="round" style="translate:0 ${(i - 3) * w0 * 0.9}px"/>`).join('');
  function vxRainbowArc(layer, a, z, travel, delay, spd) {
    const mx = (a.x + z.x) / 2, my = Math.min(a.y, z.y) - Math.abs(z.x - a.x) * 0.45 - 30;
    setTimeout(() => { const d = vxSvg(layer, travel + 650 / spd, bowPaths(`M${a.x} ${a.y} Q${mx} ${my} ${z.x} ${z.y}`, 3.2)); d.classList.add('rbarc'); d.style.setProperty('--dur', travel + 'ms'); }, delay);
  }
  function vxSkyRainbow(layer, spd) {
    const w = layer.clientWidth, h = layer.clientHeight; const d = vxSvg(layer, 1500 / spd, bowPaths(`M${w * 0.06} ${h * 0.78} Q${w * 0.5} ${-h * 0.32} ${w * 0.94} ${h * 0.78}`, Math.max(4, w / 110)));
    d.classList.add('sky'); d.style.setProperty('--dur', 1500 / spd + 'ms');
  }
  function vxGallop(layer, fromLeft, spd, count) {
    const w = layer.clientWidth, h = layer.clientHeight; const dur = 1100 / spd;
    for (let k = 0; k < count; k++) {
      const y = h * (0.5 + k * 0.13), start = performance.now() + k * 160 / spd;
      const u = vxEl(layer, 'gallop' + (fromLeft ? ' flip' : ''), fromLeft ? -40 : w + 40, y, '#f6b8ff', dur + 400 / spd, '🦄');
      const tick = () => {
        const t = (performance.now() - start) / dur; if (t < 0) return requestAnimationFrame(tick); if (t > 1 || !u.isConnected) return;
        const x = fromLeft ? -40 + t * (w + 80) : w + 40 - t * (w + 80); u.style.left = x + 'px'; u.style.top = y - Math.abs(Math.sin(t * Math.PI * 6)) * 10 + 'px';
        if (Math.random() < 0.5) { const sp = vxEl(layer, 'trail', x + (fromLeft ? -14 : 14), y + 6, RAINBOW[Math.floor(t * 40) % RAINBOW.length], 600 / spd, '✦'); sp.style.fontSize = 10 + Math.random() * 6 + 'px'; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }
  function vxStarShower(layer, spd, n) {
    const w = layer.clientWidth, h = layer.clientHeight;
    for (let i = 0; i < n; i++) { const s = vxEl(layer, 'shower', w * (0.15 + Math.random() * 0.8), h * (0.05 + Math.random() * 0.2), '#ffe27a', 1200 / spd, '★'); s.style.animationDelay = Math.random() * 380 / spd + 'ms'; s.style.fontSize = 12 + Math.random() * 14 + 'px'; }
  }
  function vxProjectile(layer, a, z, ele, travel, delay) {
    const c = ELEM_COLOR[ele] || '#fff';
    const html = ele === 'music' ? '♫' : ele === 'royal' ? '✦' : ele === 'star' ? '★' : ele === 'unicorn' ? '🦄' : ele === 'rainbow' ? '●' : ele === 'arrow' ? '<i></i>' : '';
    const p = vxEl(layer, 'vproj e-' + ele + (ele === 'unicorn' && z.x > a.x ? ' flip' : ''), a.x, a.y, c, delay + travel + 80, html);
    p.style.setProperty('--rot', Math.atan2(z.y - a.y, z.x - a.x) + 'rad'); p.style.transitionDuration = travel + 'ms';
    setTimeout(() => { p.style.left = z.x + 'px'; p.style.top = z.y + 'px'; }, delay + 20);
  }
  function vxFall(layer, z, ele, travel, delay) {
    const c = ELEM_COLOR[ele] || '#fff';
    const p = vxEl(layer, 'vfall e-' + ele, z.x - 60, z.y - 240, c, delay + travel + 80, ele === 'arrow' ? '<i></i>' : ele === 'star' ? '<i></i>★' : '');
    p.style.transitionDuration = travel + 'ms';
    setTimeout(() => { p.style.left = z.x + 'px'; p.style.top = z.y + 'px'; }, delay + 20);
  }
  function vxBolt(layer, z, color, life) {
    let pts = `${z.x + 6},0`; const steps = 6; for (let i = 1; i <= steps; i++) pts += ` ${z.x + (i % 2 ? -10 : 10) * (1 - i / steps) + (Math.random() * 8 - 4)},${(z.y * i) / steps}`;
    const d = document.createElement('div'); d.className = 'vx bolt'; d.style.setProperty('--vc', color);
    d.innerHTML = `<svg width="100%" height="100%"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="7" opacity=".35"/><polyline points="${pts}" fill="none" stroke="#ffffff" stroke-width="2.5"/></svg>`;
    layer.appendChild(d); setTimeout(() => d.remove(), life);
  }
  function vxSupport(layer, at, kind, ele, spd) {
    const c = kind === 'heal' ? (ele === 'holy' ? '#ffe48a' : '#8fe07a') : kind === 'debuff' ? (['royal', 'music', 'ice', 'nature', 'lightning', 'chi', 'holy', 'spirit'].includes(ele) ? ELEM_COLOR[ele] : '#b06aff') : kind === 'shield' ? '#9fd8ff' : (ELEM_COLOR[ele] || '#ffe48a');
    const life = 1100 / spd;
    if (PRINCESS_ELE.includes(ele)) return vxPrincessSupport(layer, at, kind, ele, life);
    if (kind === 'heal' || kind === 'revive') { if (ele === 'holy' || kind === 'revive') vxEl(layer, 'pillar', at.x, at.y, c, life); for (let i = 0; i < 5; i++) { const p = vxEl(layer, 'rise', at.x + (i - 2) * 9, at.y + 14, c, life, '+'); p.style.animationDelay = i * 70 + 'ms'; } return; }
    if (kind === 'shield') { vxEl(layer, 'bubble', at.x, at.y, c, life); return; }
    if (kind === 'debuff') { vxEl(layer, 'swirl', at.x, at.y, c, life); for (let i = 0; i < 3; i++) { const p = vxEl(layer, 'sink', at.x + (i - 1) * 12, at.y - 22, c, life, '▼'); p.style.animationDelay = i * 90 + 'ms'; } return; }
    vxEl(layer, 'ring', at.x, at.y, c, life);
    const glyph = ele === 'music' ? ['♪', '♫', '♪'] : ele === 'royal' ? ['✦', '♛', '✦'] : ['▲', '▲', '▲'];
    glyph.forEach((g, i) => { const p = vxEl(layer, 'rise', at.x + (i - 1) * 12, at.y + 10, c, life, g); p.style.animationDelay = i * 90 + 'ms'; });
  }
  function vxPrincessSupport(layer, at, kind, ele, life) {
    const rise = (glyphs, colors, dy) => glyphs.forEach((g, i) => { const p = vxEl(layer, 'rise', at.x + (i - (glyphs.length - 1) / 2) * 11, at.y + (dy || 12), colors[i % colors.length], life, g); p.style.animationDelay = i * 70 + 'ms'; });
    if (kind === 'heal' || kind === 'revive') {
      if (ele === 'unicorn') { vxEl(layer, 'pillar', at.x, at.y, '#f6b8ff', life); rise(['♥', '✨', '♥', '✨', '♥'], ['#ff8fc8', '#ffffff', '#f6b8ff']); }
      else { vxEl(layer, 'minibow', at.x, at.y - 40, null, life); rise(['+', '+', '+', '+', '+'], RAINBOW.slice(1)); }
      return;
    }
    if (kind === 'shield') { vxEl(layer, 'bubble rb', at.x, at.y, '#ffd0ef', life); return; }
    if (kind === 'debuff') { vxEl(layer, 'swirl', at.x, at.y, '#ff8fc8', life); const o = vxEl(layer, 'orbit', at.x, at.y - 30, '#ff8fc8', life, '<b>♥</b><b>✦</b><b>♥</b>'); o.style.animationDuration = life + 'ms'; return; }
    vxEl(layer, 'ring', at.x, at.y, ELEM_COLOR[ele], life);
    if (ele === 'rainbow') vxEl(layer, 'minibow', at.x, at.y - 44, null, life);
    rise(ele === 'unicorn' ? ['✨', '🦄', '✨'] : ele === 'rainbow' ? ['★', '🌈', '★'] : ['✦', '★', '✦'], ['#ffe27a', '#ffffff', '#ffb3d9']);
  }
  function vxWave(layer, scene, fromLeft, color, spd) {
    const d = document.createElement('div'); d.className = 'vx wave' + (fromLeft ? '' : ' rev') + (color === 'rainbow' ? ' rb' : ''); d.style.setProperty('--vc', color === 'rainbow' ? '#ff9ad5' : color); d.style.animationDuration = 650 / spd + 'ms';
    layer.appendChild(d); setTimeout(() => d.remove(), 700 / spd);
  }
  function vxFlash(layer, color, spd) { const d = document.createElement('div'); d.className = 'vx flash'; d.style.setProperty('--vc', color); d.style.animationDuration = 600 / spd + 'ms'; layer.appendChild(d); setTimeout(() => d.remove(), 650 / spd); }
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function playEvent(ev) {
    const m = S.modal; const b = m.battle;
    const scene = document.getElementById('scene'), layer = document.getElementById('fxl'); if (!scene) return;
    const name = (id) => { const u = b.units.find((x) => x.id === id); return u ? u.name : '?'; };
    const actorU = b.units.find((x) => x.id === ev.a);
    const actor = document.getElementById('u-' + ev.a);
    const rc = document.getElementById('round'); if (rc) rc.textContent = 'Rodada ' + ev.r;
    const feed = document.getElementById('feed');
    const spd = m.speed;
    scene.style.setProperty('--spd', String(spd));
    // texto do diário
    if (feed) {
      if (ev.stunned) feed.innerHTML = `<b>${esc(name(ev.a))}</b> está ${esc(ev.k || 'congelado')} e perde a vez.`;
      else if (!ev.tick) {
        const dmg = ev.fx.filter((f) => f[1] < 0).reduce((s2, f) => s2 + -f[1], 0);
        const heal = ev.fx.filter((f) => f[3] === 'cura').reduce((s2, f) => s2 + f[1], 0);
        const ko = ev.fx.filter((f) => f[3] === 'caiu').map((f) => name(f[0]));
        feed.innerHTML = `<b>${esc(name(ev.a))}</b> ${ev.s ? `usa <b style="color:var(--gold-2)">${esc(ev.s)}</b>` : 'ataca'}${dmg ? ` · ${dmg} de dano` : ''}${heal ? ` · cura ${heal}` : ''}${ko.length ? ` · <span style="color:var(--bad)">${ko.map(esc).join(', ')} caiu</span>` : ''}`;
      }
    }
    if (ev.stunned && actor) { floatText(actor, ev.k || 'congelado', 'info'); return; }
    if (ev.tick) { for (const f of ev.fx) { const el = updateUnit(f[0], f[2]); if (el && f[1] < 0) floatText(el, String(-f[1]), f[3] === 'queimando' ? 'burn' : 'poison'); else if (el && f[1] > 0) floatText(el, '+' + f[1], 'heal'); } return; }
    // animação do atacante
    if (actor) {
      actor.classList.remove('lunge', 'cast'); void actor.offsetWidth;
      const support = ev.fx.length && ev.fx.every((f) => f[1] >= 0);
      if (ev.s && actorU && actorU.side === 'h') sfx(actorU.cls === 'princesa' ? 'twinkle' : 'magic');
      actor.classList.add(support || (ev.s && !ev.fx.some((f) => f[1] < 0)) ? 'cast' : 'lunge');
      if (ev.s) { const c = document.createElement('div'); c.className = 'callout'; c.textContent = ev.s; actor.appendChild(c); setTimeout(() => c.remove(), 1200 / spd + 300); }
    }
    const color = actorU && actorU.side === 'h' ? ((D.CLASSES[actorU.cls] || {}).color || '#ffd98a') : (actorU && actorU.boss ? '#c86aff' : '#ff6a5a');
    const ranged = actorU && actorU.side === 'h' && ['gelo', 'fogo', 'arqueiro', 'curandeiro', 'druida', 'bruxa', 'bardo', 'xama', 'inventor', 'princesa'].includes(actorU.cls);
    const sf = skillFx(actorU, ev.s); const calm = reduceMotion();
    const ele = sf ? sf.ele : actorU && actorU.side === 'h' ? (ranged ? CLASS_ELEM[actorU.cls] : 'slash') : 'claw';
    const style = !sf ? (ranged ? 'proj' : 'melee') : sf.ele === 'star' ? (sf.act === 'aoe' || sf.tier >= 5 ? 'fall' : 'proj') : sf.ele === 'rainbow' ? 'rainbow' : sf.ele === 'unicorn' ? 'proj' : sf.ele === 'meteor' || sf.ele === 'bomb' || (sf.ele === 'arrow' && sf.act === 'aoe') ? 'fall' : sf.ele === 'lightning' ? 'bolt' : sf.ele === 'quake' || (!ranged && actorU.side === 'h') || actorU.side !== 'h' ? 'melee' : 'proj';
    const travel = (style === 'fall' ? 420 : style === 'bolt' ? 60 : 300) / spd;
    let delay = 0;
    const hits = ev.fx.filter((f) => f[1] < 0 && f[3] !== 'espinhos');
    if (sf && !calm) {
      const ec = ELEM_COLOR[sf.ele] || color;
      if (sf.act === 'aoe' || sf.act === 'nature' || sf.act === 'debuff' && hits.length > 1) vxWave(layer, scene, actorU.side === 'h', sf.ele === 'rainbow' ? 'rainbow' : ec, spd);
      if (PRINCESS_ELE.includes(sf.ele) && sf.big) {
        const ult = sf.tier >= 9;
        if (sf.ele === 'rainbow' || ult || (sf.ele === 'unicorn' && sf.act === 'buff')) vxSkyRainbow(layer, spd);
        if (sf.ele === 'unicorn' || ult) vxGallop(layer, actorU.side === 'h', spd, ult || sf.act === 'multi' ? 3 : 2);
        if (sf.ele === 'star' || ult) vxStarShower(layer, spd, ult ? 14 : 9);
      }
      if (sf.big) { vxFlash(layer, ec, spd); }
      if (sf.ele === 'quake' || (sf.big && (sf.ele === 'meteor' || sf.ele === 'bomb'))) { scene.classList.remove('quake'); void scene.offsetWidth; scene.classList.add('quake'); }
    }
    ev.fx.forEach((f) => {
      const [id, amt, hpAfter, flag] = f;
      const isHit = amt < 0 && flag !== 'espinhos';
      const flies = isHit && actor && style !== 'melee' && (ranged || hits.length > 1 || style !== 'proj');
      const t = isHit ? (flies ? travel : 160 / spd) + delay : 120 / spd;
      const tgt = document.getElementById('u-' + id);
      if (flies && tgt && !calm) {
        const a = centerOf(actor, scene), z = centerOf(tgt, scene);
        if (style === 'fall') vxFall(layer, z, ele, travel, delay);
        else if (style === 'proj') vxProjectile(layer, a, z, ele, travel, delay);
        else if (style === 'rainbow') vxRainbowArc(layer, a, z, travel, delay, spd);
      }
      if (isHit && (flies || hits.length > 1)) delay += (style === 'bolt' ? 110 : 70) / spd;
      setTimeout(() => {
        if (S.modal !== m) return;
        const el = updateUnit(id, hpAfter); if (!el) return;
        const z = !calm && scene ? centerOf(el, scene) : null;
        const tu = b.units.find((x) => x.id === id); const ally = tu && actorU && tu.side === actorU.side;
        if (amt < 0) {
          sfx(flag === 'crit' ? 'crit' : 'hit'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); floatText(el, String(-amt), flag === 'crit' ? 'crit' : 'dmg');
          if (flag === 'crit') { scene.classList.remove('shake'); void scene.offsetWidth; scene.classList.add('shake'); }
          if (z && flag !== 'espinhos') { if (style === 'bolt') vxBolt(layer, z, ELEM_COLOR[ele] || '#cfeeff', 380 / spd); vxBurst(layer, z, ele, spd, !!(sf && sf.big) || flag === 'crit'); }
        } else if (flag === 'cura' || flag === 'renasce') { sfx('heal'); floatText(el, '+' + amt, 'heal'); el.classList.remove('glow'); void el.offsetWidth; el.classList.add('glow'); if (z && ev.s) vxSupport(layer, z, flag === 'renasce' ? 'revive' : 'heal', ele, spd); }
        else if (flag === 'escudo') { floatText(el, 'escudo', 'info'); el.classList.add('shielded'); setTimeout(() => el.classList.remove('shielded'), 1400 / spd); if (z) vxSupport(layer, z, 'shield', ele, spd); }
        else if (flag === 'esquiva') floatText(el, 'esquivou', 'info');
        else if (flag === 'caiu') { sfx('ko'); }
        else if (flag) { floatText(el, flag, 'info'); if (z && ev.s) vxSupport(layer, z, ally ? 'buff' : 'debuff', ele, spd); }
      }, t);
    });
  }
  function showResult() {
    const m = S.modal; const b = m.battle; const r = document.getElementById('result'); if (!r) return;
    for (const u of b.units) updateUnit(u.id, m.hp[u.id]);
    const rc = document.getElementById('round'); if (rc) rc.textContent = `Rodada ${b.rounds}`;
    const feed = document.getElementById('feed'); if (feed) feed.textContent = `A batalha durou ${b.rounds} rodadas.`;
    r.innerHTML = b.win
      ? `<div class="res win"><h2>Vitória!</h2><p>${b.preview ? 'Se a batalha fosse agora, o grupo venceria. Nada mudou: a batalha de verdade é à meia-noite.' : m.practice ? 'No treino, o grupo venceu. Esta noite pode ser diferente: a sorte também luta.' : b.event ? `Cada herói ganhou <b class="gold">${b.gold}</b> <span class="coin"></span> de ouro e uma relíquia ${D.RARITY[b.special.relic].name.toLowerCase()}.` : `Cada herói ganhou <b class="gold">${b.gold}</b> <span class="coin"></span> de ouro. O grupo avança para o estágio ${b.stage + 1}.`}</p></div>`
      : `<div class="res loss"><h2>Derrota</h2><p>${b.preview ? 'Se a batalha fosse agora, o grupo perderia. Ainda dá tempo de cumprir tarefas antes da meia-noite.' : b.event ? 'O desafio especial venceu desta vez. Nada foi perdido.' : m.practice ? 'No treino, o grupo perdeu. Cumpram mais tarefas hoje para chegar mais fortes à meia-noite.' : 'O desafio continua o mesmo. Cumpram tarefas, subam de nível e tentem de novo à meia-noite.'}</p></div>`;
    if (!b.preview && !m.practice) { try { const c = battleContrib(b); const top = c.list[0]; if (top && top.score > 0) r.querySelector('.res').insertAdjacentHTML('beforeend', `<p class="mvp-line">👑 Destaque da batalha: <b>${esc(top.name)}</b> · ${fmtN(top.score)} pontos</p>`); } catch (e) { /* sem destaque */ } }
    r.classList.add('on');
    Sound.music(false); if (!m.soundDone) { m.soundDone = true; sfx(b.win ? 'win' : 'loss'); }
    const ko = b.units.filter((u) => m.hp[u.id] <= 0).length; void ko;
  }

  const sfx = (k) => Sound.play(k);
  /* ---------------- Ações ---------------- */
  function hero() { return S.heroes[S.heroId]; }
  function saveCur(h) { Store.saveHero(h); render(); }
  const actions = {
    home() { S.view = S.me ? 'home' : 'select'; S.heroId = null; S.diffPreview = null; render(); scrollTo(0, 0); },
    pickMe(el) { S.toast = null; S.me = el.dataset.id; lsSet('guilda-me:' + S.room, S.me); S.masterOk = false; Acct.room(S.me); S.view = 'home'; tidyAll(); render(); scrollTo(0, 0); maybeShowReport(); processInbox(); },
    switchHero() { S.toast = null; S.me = null; lsSet('guilda-me:' + S.room, null); S.masterOk = false; S.view = 'select'; render(); scrollTo(0, 0); },
    leaveRoom() { Store.close(); S.me = null; S.roomMeta = null; S.masterOk = false; applyDocs({}); S.view = 'rooms'; S.roomErr = ''; render(); scrollTo(0, 0); },
    joinLast() { enterRoom(lsGet('guilda-last-room', '')); },
    undoTask(el) {
      const h = ensureHero(hero()); const t = (h.tasks || []).find((x) => x.id === el.dataset.id); if (!t) return;
      if (t.pending) {
        t.pending = null; t.pendXp = 0; unmarkDay(h, t.diff); S.undo = null; saveCur(h);
        showToast(`<span>Envio cancelado · <b>${esc(t.title)}</b> voltou para a lista.</span>`); return;
      }
      if (t.done !== today()) return;
      const gain = t.gain || 0;
      removeXp(h, gain); unmarkDay(h, t.diff); if (t.wasPunctual) h.stats.punctual = Math.max(0, (h.stats.punctual || 0) - 1);
      Object.assign(t, { done: null, gain: 0, wasPunctual: null });
      S.undo = null; saveCur(h);
      post('undo', `${h.name} desfez "${t.title}"`);
      showToast(`<span>Desfeita · <b>${esc(t.title)}</b>${gain ? ` · −${gain} XP` : ''}</span>`);
    },
    undoBoard(el) {
      const t = S.board[el.dataset.id]; if (!t || !canUndoBoard(t) || !S.heroes[S.me]) return;
      const h = ensureHero(S.heroes[S.me]); const me = h.id;
      const b = clone(t); const parts = b.parts || []; let gain = 0;
      if (b.duo && parts.includes(me)) {
        const i = parts.indexOf(me);
        gain = (b.partGains && b.partGains[i]) || (b.done ? b.gain : Math.round(xpCalc(b, h).total * D.DUO_SHARE)) || 0;
        b.parts = parts.filter((x) => x !== me); b.partNames = (b.partNames || []).filter((_, k) => k !== i); b.partGains = (b.partGains || []).filter((_, k) => k !== i);
        Object.assign(b, { done: null, doneBy: null, doneByName: null, gain: 0, pending: null });
        h.stats.duo = Math.max(0, (h.stats.duo || 0) - 1); h.stats.board = Math.max(0, (h.stats.board || 0) - 1);
        removeXp(h, gain); unmarkDay(h, null);
      } else {
        const wasPending = !!b.pending; gain = wasPending ? 0 : b.gain || 0;
        Object.assign(b, { done: null, doneBy: null, doneByName: null, gain: 0, pending: null, approved: null, punct: null });
        if (!wasPending) { h.stats.board = Math.max(0, (h.stats.board || 0) - 1); if (t.punct) h.stats.punctual = Math.max(0, (h.stats.punctual || 0) - 1); removeXp(h, gain); }
        unmarkDay(h, t.diff);
      }
      Store.setDoc('board/' + b.id, b); S.undo = null; Store.saveHero(h);
      post('undo', `${h.name} desfez a missão "${t.title}"`);
      showToast(`<span>Missão desfeita · <b>${esc(t.title)}</b>${gain ? ` · −${gain} XP` : ''}</span>`); render();
    },
    boardFilter(el) { S.boardFilter = el.dataset.v || null; render(); },
    toggleBoardLater() { S.showBoardLater = !S.showBoardLater; },
    goRoom(el) { if (el.dataset.code === S.room && S.view !== 'rooms') return; enterRoom(el.dataset.code); },
    forgetRoom(el) { Acct.forget(el.dataset.code); },
    register() { const e = document.getElementById('acct-email'), p = document.getElementById('acct-pass'); if (!e.value.trim()) { e.focus(); return; } if (!p.value) { p.focus(); return; } Acct.enter('register', e.value, p.value); },
    logout() { Acct.logout(); },
    showLogin() { S.passOpen = !S.passOpen; S.authErr = ''; render(); },
    settings() { if (!isCreator()) return; S.view = 'settings'; S.diffPreview = null; S.pinErr = ''; render(); scrollTo(0, 0); },
    choreWho(el) { S.choreAssign = el.value; render(); },
    delChore(el) { if (masterLocked()) return; Store.delDoc('chores/' + el.dataset.id); render(); },
    copyCode() { const c = S.room; try { navigator.clipboard.writeText(c).then(() => showToast(`Código <b>${c}</b> copiado.`), () => showToast(`Código da sala: <b>${c}</b>`)); } catch (e) { showToast(`Código da sala: <b>${c}</b>`); } },
    create() { if (heroList().length >= D.MAX_HEROES) return; S.draft = { name: '', cls: 'guerreiro', look: randomLook('humano') }; S.view = 'create'; render(); scrollTo(0, 0); },
    open(el) { if (el.dataset.id !== S.me) return; S.heroId = el.dataset.id; S.view = 'hero'; S.tab = 'tarefas'; S.selSkill = null; tidyAll(); render(); scrollTo(0, 0); },
    cls(el) { S.draft.cls = el.dataset.v; render(); },
    look(el) {
      const k = el.dataset.k, v = el.dataset.v;
      const apply = (look) => { look[k] = v; if (k === 'anc') { const sk = D.ANCESTRIES[v].skins; if (!sk.includes(look.skin)) look.skin = sk[Math.min(1, sk.length - 1)]; } };
      if (S.view === 'create') { apply(S.draft.look); render(); }
      else { const h = hero(); if (S.readOnly) return; apply(h.look); S.chanceKey = ''; saveCur(h); }
    },
    randLook() { if (S.view === 'create') { S.draft.look = randomLook(S.draft.look.anc); render(); } else { const h = hero(); if (S.readOnly) return; h.look = randomLook(h.look.anc); saveCur(h); } },
    saveHero() {
      if (!S.draft.name.trim() || heroList().length >= D.MAX_HEROES) return;
      const h = newHero(S.draft);
      if (S.party && S.party.last) h.seenBattle = S.party.last.id; // herói novo não precisa rever batalhas antigas
      Store.saveHero(h);
      const p = clone(S.party || newParty());
      if (!p.creatorId || !S.heroes[p.creatorId]) { p.creatorId = h.id; Store.saveParty(p); }
      S.me = h.id; lsSet('guilda-me:' + S.room, h.id); S.masterOk = false; Acct.room(h.id);
      S.heroId = h.id; S.view = 'hero'; S.tab = 'tarefas'; S.draft = null; render(); scrollTo(0, 0);
      showToast(`<span><b>${esc(h.name)}</b> entrou para a guilda!</span>`);
    },
    tab(el) { S.tab = el.dataset.v; render(); },
    diff(el) { S.newDiff = el.dataset.v; render(); },
    freq(el) { S.newFreq = el.dataset.v; render(); },
    edFreq(el) { keepEdit(); S.modal.freq = el.dataset.v; render(); },
    done(el) {
      const h = ensureHero(hero()); const t = h.tasks.find((x) => x.id === el.dataset.id); if (!t || t.done || t.pending) return;
      const before = clone(h);
      const x = xpCalc(t, h);
      h.stats.done = (h.stats.done || 0) + 1; h.stats.byDiff[t.diff] = (h.stats.byDiff[t.diff] || 0) + 1;
      markDay(h); logDay(h, 't', 1);
      if (needsApproval(h)) {
        t.pending = today(); t.pendXp = x.total; t.wasPunctual = x.punctual;
        saveCur(h); S.undo = { heroId: h.id, before };
        showToast(`<span>Enviada para aprovação · ${esc(t.title)}</span>`, true); post('pend', `${h.name} concluiu "${t.title}" e aguarda aprovação`); return;
      }
      t.done = today(); t.gain = x.total; t.wasPunctual = x.punctual; if (x.punctual) h.stats.punctual = (h.stats.punctual || 0) + 1;
      const ups = grantXp(h, x.total); checkAch(h);
      saveCur(h); sfx('task');
      S.undo = { heroId: h.id, before };
      const extras = [x.carried && 'acumulada', x.punctual && 'no horário', x.streak && 'sequência', x.ev && 'evento', x.bday && 'aniversário'].filter(Boolean);
      showToast(`<span><b>+${x.total} XP</b>${extras.length ? ' (' + extras.join(', ') + ')' : ''} · ${esc(t.title)}</span>`, true);
      post('task', `${h.name} cumpriu "${t.title}" (+${x.total} XP)`);
      if (ups) { S.modal = { type: 'levelup', heroId: h.id, level: h.level, ups }; post('level', `${h.name} subiu para o nível ${h.level}`); sfx('level'); render(); }
    },
    openChest() {
      const h = ensureHero(hero()); if (!chestState(h).ready) return;
      const r = E.rng(E.hashStr(h.id + today()));
      const mul = 1 + (typeof eventMul === 'function' ? eventMul('chest') : 0);
      const gold = Math.round((15 + h.level * 3 + r() * 20) * mul), xp = Math.round((10 + h.level * 2 + r() * 10) * mul);
      h.bonusGold = (h.bonusGold || 0) + gold; const ups = grantXp(h, xp); h.chest = { last: today() }; h.stats.chests = (h.stats.chests || 0) + 1;
      const items = [`<span class="coin"></span> <b>${gold}</b> de ouro`, `<b>${xp}</b> XP`];
      if (r() < 0.15 * mul) { const rl = rollRelic(h.level, null, r); if (addRelic(h, rl)) items.push(`Relíquia: <b>${esc(rl.name)}</b>`); }
      checkAch(h); Store.saveHero(h); S.modal = { type: 'chest', items }; sfx('chest'); render();
      post('chest', `${h.name} abriu o baú do dia`);
      if (ups) setTimeout(() => { if (!S.modal || S.modal.type !== 'chest') return; }, 0);
    },
    openBday() {
      const h = ensureHero(hero()); if (!h || !bdayGiftReady(h)) return;
      const t = today(); h.bdayGift = t.slice(0, 4); h.bdayBuff = t; h.festa = festaOf(h) + D.BDAY.coins;
      h.cosmetics = h.cosmetics || { owned: [] }; h.cosmetics.owned = h.cosmetics.owned || [];
      const items = [`<span class="coin festa"></span> <b>${D.BDAY.coins}</b> moedas de festa para itens visuais`, `<b>Bênção de aniversário</b> até o fim do dia: +${Math.round(D.BDAY.xpPct * 100)}% de XP nas tarefas`, `Na batalha desta noite: <b>+${Math.round(D.BDAY.mod.atkPct * 100)}% de poder e vida</b> e +${Math.round(D.BDAY.mod.defPct * 100)}% de defesa`];
      if (!h.cosmetics.owned.includes(D.BDAY.hat)) { h.cosmetics.owned.push(D.BDAY.hat); h.cosmetics.hat = D.BDAY.hat; items.push('Item exclusivo: <b>Chapéu de Aniversário</b> (já está na cabeça!)'); }
      h.stats.bdays = (h.stats.bdays || 0) + 1;
      Store.saveHero(h); S.modal = { type: 'bday', items, age: ageOn(h) }; sfx('chest'); setTimeout(() => sfx('level'), 450); render();
      post('bday', `${h.name} está de aniversário e abriu o presente!`);
    },
    askKudos(el) { if (!kudosLeft(el.dataset.id)) return; S.modal = { type: 'kudos', to: el.dataset.id }; render(); },
    kudosEmo(el) { if (S.modal) { S.modal.emo = el.dataset.v; render(); } },
    sendKudos(el) {
      const m = S.modal; const me = ensureHero(S.heroes[S.me]); const to = S.heroes[m.to]; const emo = m.emo || '⭐'; S.modal = null;
      if (!me || !to || !kudosLeft(to.id)) { render(); return; }
      me.kudos = me.kudos && me.kudos.day === today() ? me.kudos : { day: today(), to: [], emo: {} }; me.kudos.to.push(to.id);
      me.kudos.emo = me.kudos.emo || {}; me.kudos.emo[to.id] = { e: emo, m: el.dataset.v };
      me.stats.kudosGiven = (me.stats.kudosGiven || 0) + 1; checkAch(me); Store.saveHero(me);
      const xp = Math.round(D.KUDOS_XP * (1 + (typeof eventMul === 'function' ? eventMul('kudos') : 0)));
      sendInbox(to.id, 'kudos', { msg: el.dataset.v, xp, emo });
      post('kudos', `${me.name} elogiou ${to.name}: ${emo} "${el.dataset.v}"`);
      showToast(`<span>Elogio enviado para <b>${esc(to.name)}</b>.</span>`); render();
    },
    tutorial() { startTut(); },
    tutNext() { if (!S.tut) return; if (S.tut.i >= TUT.length - 1) endTut(); else tutGo(S.tut.i + 1, 1); },
    tutPrev() { if (!S.tut) return; tutGo(Math.max(0, S.tut.i - 1), -1); },
    tutSkip() { endTut(); },
    toggleLater() { S.showLater = !S.showLater; render(); },
    day(el) { const v = Number(el.dataset.v); S.newDays = S.newDays.includes(v) ? S.newDays.filter((x) => x !== v) : S.newDays.concat(v); render(); },
    editTask(el) {
      const scope = el.dataset.scope, id = el.dataset.id;
      const t = scope === 'me' ? (hero().tasks || []).find((x) => x.id === id) : scope === 'board' ? S.board[id] : S.chores[id];
      if (!t) return; if (scope === 'chore' && masterLocked()) return;
      S.modal = { type: 'editTask', scope, id, title: t.title, diff: t.diff, freq: scope === 'chore' && freqOf(t) === 'once' ? 'daily' : freqOf(Object.assign({ chore: scope === 'chore' }, t)), days: (t.days || []).slice(), every: t.every || 7, start: t.start || null, dom: t.dom || null, from: t.from && t.from > today() ? t.from : t.created > today() ? t.created : null, due: t.due || '', duo: !!t.duo, who: whoOf(t) }; render();
    },
    edDiff(el) { S.modal.diff = el.dataset.v; keepEdit(); render(); },
    edDay(el) { const v = Number(el.dataset.v); const m = S.modal; keepEdit(); m.days = m.days.includes(v) ? m.days.filter((x) => x !== v) : m.days.concat(v); render(); },
    edClearDue() { keepEdit(); S.modal.due = ''; render(); },
    setApproval(el) { if (masterLocked()) return; const p = clone(S.party); p.approval = Object.assign({ heroes: [] }, p.approval || {}, { mode: el.dataset.v }); Store.saveParty(p); render(); },
    approvalHero(el) { if (masterLocked()) return; const p = clone(S.party); const c = Object.assign({ mode: 'some', heroes: [] }, p.approval || {}); const set = new Set(c.heroes); if (el.checked) set.add(el.value); else set.delete(el.value); c.heroes = [...set]; p.approval = c; Store.saveParty(p); render(); },
    approve(el) { decide(el, true); },
    reject(el) { decide(el, false); },
    undo() { if (!S.undo) return; const u = S.undo; S.undo = null; S.toast = null; if (S.modal && S.modal.type === 'levelup') S.modal = null; Store.saveHero(u.before); if (u.board) Store.setDoc('board/' + u.board.id, u.board); render(); },
    delTask(el) { const h = hero(); h.tasks = h.tasks.filter((x) => x.id !== el.dataset.id); saveCur(h); },
    selSkill(el) { S.selSkill = el.dataset.v; render(); },
    learn(el) {
      const h = hero(); const s = D.CLASSES[h.cls].skillMap[el.dataset.v]; if (!E.canLearn(h, s).ok) return;
      h.skills[s.id] = (h.skills[s.id] || 0) + 1; h.points--; ensureHero(h); checkAch(h); saveCur(h);
      showToast(`<span>Aprendeu <b>${s.name}</b>${s.max > 1 ? ` (${h.skills[s.id]}/${s.max})` : ''}</span>`);
    },
    mastery() { const h = hero(); if (!h.points) return; h.points--; h.mastery = (h.mastery || 0) + 1; saveCur(h); },
    buyGear(el) {
      const h = hero(); const slot = el.dataset.v; const cur = (h.gear || {})[slot] || 0; const next = D.GEAR_TIERS[cur];
      const pr = priceOf(next.price, 'gear'); if (!next || goldOf(h) < pr || h.level < next.lvl) return;
      h.gear = h.gear || {}; h.gear[slot] = cur + 1; h.spent = (h.spent || 0) + pr; checkAch(h); saveCur(h);
      showToast(`<span>Novo equipamento: <b>${D.GEAR_SLOTS[slot].name} de ${next.n}</b></span>`);
    },
    zoomItem(el) { const prev = S.modal && S.modal.type === 'zoom' ? S.modal : {}; S.modal = { type: 'zoom', id: el.dataset.v, z: prev.z || 1.8, cmp: !!prev.cmp }; render(); },
    zoomLvl(el) { if (S.modal && S.modal.type === 'zoom') { S.modal.z = Number(el.dataset.v); render(); } },
    zoomCmp(el) { if (S.modal && S.modal.type === 'zoom') { S.modal.cmp = el.checked; render(); } },
    shopCat(el) { S.shopCat = el.dataset.v; render(); },
    buyPotion(el) {
      const h = hero(); const x = D.POTIONS.find((p) => p.id === el.dataset.v); const pr = D.potionPrice(h.level);
      if (!x || goldOf(h) < pr || (h.potion && h.potion.day === today())) return;
      h.potion = { id: x.id, day: today() }; h.spent = (h.spent || 0) + pr; saveCur(h);
      showToast(`<span>Bebeu <b>${x.name}</b>: ${x.txt} na batalha desta noite</span>`);
    },
    buyCos(el) {
      const h = hero(); const x = D.COSMETICS.find((c) => c.id === el.dataset.v); const pr = x ? priceOf(x.price, 'cos') : 0; if (!x || x.gift || goldOf(h) + festaOf(h) < pr || h.cosmetics.owned.includes(x.id)) return;
      const fz = Math.min(festaOf(h), pr); h.festa = festaOf(h) - fz;
      h.cosmetics.owned.push(x.id); h.cosmetics[x.slot] = x.id; h.spent = (h.spent || 0) + (pr - fz); saveCur(h);
      showToast(`<span>Comprou <b>${x.name}</b></span>`);
    },
    equipCos(el) { const h = hero(); const x = D.COSMETICS.find((c) => c.id === el.dataset.v); h.cosmetics[x.slot] = h.cosmetics[x.slot] === x.id ? null : x.id; saveCur(h); },
    setCos(el) { const h = hero(); h.cosmetics[el.dataset.k] = el.dataset.v || null; saveCur(h); },
    askRetire() { S.modal = { type: 'retire', heroId: S.heroId }; render(); },
    retire() {
      const id = S.modal.heroId; S.modal = null;
      if (S.party && (S.party.creatorId === id || (S.party.coCreators || []).includes(id))) {
        const p = clone(S.party); p.coCreators = (p.coCreators || []).filter((x) => x !== id);
        if (p.creatorId === id) { p.creatorId = p.coCreators.shift() || null; } // um co-criador assume a sala
        Store.saveParty(p);
      }
      Store.deleteHero(id); S.view = 'home'; S.heroId = null; render(); },
    closeModal(el, ev) { if (ev && ev.target.closest('[data-stop]') && el.classList.contains('modal-bg')) return; const was = S.modal && S.modal.type; clearTimeout(replayTimer); Sound.music(false); S.modal = null; render(); if (was === 'replay') setTimeout(maybeShowReport, 300); },
    goSkills() { S.modal = null; S.view = 'hero'; S.tab = 'habilidades'; render(); },
    practice() { const hs = heroList(); const st = stage(); const res = E.simulate(hs, st, Math.floor(Math.random() * 1e9), true, level().mul); openReplay({ day: today(), stage: st, win: res.win, gold: 0, rounds: res.rounds, log: res.log, units: res.units }, true); },
    // prévia: mostra como seria a batalha desta noite se fosse agora; não muda nada no jogo
    forceBattle() {
      if (masterLocked()) return; const hs = heroList(); if (!hs.length) return;
      const st = stage(); const t = today(); const roster = hs.map((h) => snapshotHero(h, t));
      const seed = E.hashStr(t + ':' + st + ':' + hs.length);
      const res = E.simulate(roster, st, seed, true, level().mul);
      openReplay({ day: t, stage: st, win: res.win, gold: res.win ? E.goldReward(st) : 0, rounds: res.rounds, log: res.log, units: res.units, preview: true }, true);
    },
    target(el) { S.newTarget = el.dataset.v; render(); },
    askRedeem(el) { const h = hero(); const r = S.rewards[el.dataset.id]; if (!r || redeemBal(h) < r.cost) return; S.modal = { type: 'redeem', heroId: h.id, rewardId: r.id }; render(); },
    redeem() {
      const m = S.modal; const h = ensureHero(S.heroes[m.heroId]); const r = S.rewards[m.rewardId]; S.modal = null;
      if (!h || !r || redeemBal(h) < r.cost || rewardBlock(r, h)) { render(); return; }
      S.undo = null; h.redeemed = (h.redeemed || 0) + r.cost; h.stats.redeemed = (h.stats.redeemed || 0) + 1; checkAch(h);
      const id = 'q' + uidGen();
      Store.setDoc('requests/' + id, { id, heroId: h.id, heroName: h.name, rewardId: r.id, name: r.name, cost: r.cost, status: 'pending', day: today(), at: Date.now() });
      if (r.stock != null) Store.setDoc('rewards/' + r.id, Object.assign(clone(r), { stock: Math.max(0, r.stock - 1) }));
      saveCur(h); post('req', `${h.name} pediu a recompensa "${r.name}"`);
      showToast(`<span>Pedido enviado: <b>${esc(r.name)}</b>. Aguarde a aprovação.</span>`);
    },
    reqOk(el) { const q = S.requests[el.dataset.id]; if (!q || masterLocked()) return; Store.setDoc('requests/' + q.id, Object.assign(clone(q), { status: 'approved' })); sendInbox(q.heroId, 'reqok', { title: q.name }); post('ok', `${S.heroes[S.me].name} aprovou o pedido "${q.name}" de ${q.heroName}`); render(); },
    reqNo(el) {
      const q = S.requests[el.dataset.id]; if (!q || masterLocked()) return;
      Store.setDoc('requests/' + q.id, Object.assign(clone(q), { status: 'refused' })); sendInbox(q.heroId, 'refund', { cost: q.cost, title: q.name });
      const rw = S.rewards[q.rewardId]; if (rw && rw.stock != null) Store.setDoc('rewards/' + rw.id, Object.assign(clone(rw), { stock: rw.stock + 1 }));
      post('no', `${S.heroes[S.me].name} recusou o pedido "${q.name}" de ${q.heroName}`); render();
    },
    reqDone(el) { const q = S.requests[el.dataset.id]; if (!q || masterLocked()) return; Store.setDoc('requests/' + q.id, Object.assign(clone(q), { status: 'delivered', deliveredDay: today() })); sendInbox(q.heroId, 'delivered', { title: q.name }); post('ok', `${q.heroName} recebeu "${q.name}"`); prune(); render(); },
    equipRelic(el) { const h = hero(); h.relicOn = (h.relicOn || []).filter((x) => (h.relics || []).some((r) => r.id === x)); if (h.relicOn.includes(el.dataset.id)) h.relicOn = h.relicOn.filter((x) => x !== el.dataset.id); else { if (h.relicOn.length >= D.RELIC_SLOTS) h.relicOn.shift(); h.relicOn.push(el.dataset.id); } S.chanceKey = ''; saveCur(h); },
    sellRelic(el) { const h = hero(); const rl = (h.relics || []).find((x) => x.id === el.dataset.id); if (!rl || (h.relicOn || []).includes(rl.id)) return; h.relics = h.relics.filter((x) => x.id !== rl.id); h.bonusGold = (h.bonusGold || 0) + D.RARITY[rl.rarity].sell; saveCur(h); showToast(`<span>Vendeu <b>${esc(rl.name)}</b> por <span class="coin"></span> ${D.RARITY[rl.rarity].sell}</span>`); },
    claimGoal() {
      const ev = eventOn(); const h = ensureHero(hero() || S.heroes[S.me]); if (!ev || !ev.goal || !h || goalProgress(ev) < ev.goal.tasks) return;
      h.evClaims = h.evClaims || {}; if (h.evClaims[ev.key]) return; h.evClaims[ev.key] = true;
      h.bonusGold = (h.bonusGold || 0) + ev.goal.gold; const ups = grantXp(h, ev.goal.xp); checkAch(h); Store.saveHero(h); sfx('chest');
      showToast(`<span>${esc(ev.name)}: <span class="coin"></span> ${ev.goal.gold} e ${ev.goal.xp} XP!</span>`); post('event', `${h.name} coletou o prêmio de "${ev.name}"`);
      if (ups) S.modal = { type: 'levelup', heroId: h.id, level: h.level, ups }; render();
    },
    buyMerchant(el) {
      const ev = eventOn(); const h = ensureHero(S.heroes[S.me]); if (!ev || !ev.merchant || !h) return; const i = Number(el.dataset.i);
      const it = merchantStock(ev)[i]; h.evBought = h.evBought || {}; const b = h.evBought[ev.key] || [];
      if (b.includes(i) || goldOf(h) < it.price) return;
      if (!addRelic(h, it.relic)) { showToast('Sua mochila de relíquias está cheia. Venda alguma antes.'); return; }
      h.evBought[ev.key] = b.concat(i); h.spent = (h.spent || 0) + it.price; checkAch(h); Store.saveHero(h); sfx('chest');
      showToast(`<span>Comprou <b>${esc(it.relic.name)}</b> do mercador.</span>`); post('event', `${h.name} comprou "${it.relic.name}" do Mercador Errante`); render();
    },
    respec() {
      const ev = eventOn(); const h = hero() || S.heroes[S.me]; if (!ev || !ev.respec || !h) return;
      const spent = Object.values(h.skills || {}).reduce((a, b) => a + b, 0);
      h.skills = {}; h.points = (h.points || 0) + spent; S.chanceKey = ''; Store.saveHero(h);
      S.heroId = h.id; S.view = 'hero'; S.tab = 'habilidades'; render(); showToast(`<span>${spent} pontos devolvidos. Escolha as habilidades de novo.</span>`);
    },
    replayEvent() { const eb = S.party && S.party.eventBattle; if (eb) openReplay(battleOf(eb)); },
    report() { if (!isCreator()) return; S.view = 'report'; render(); scrollTo(0, 0); },
    toggleSound() { Sound.toggle(); document.querySelectorAll('[data-act="toggleSound"]').forEach((b) => { b.textContent = Sound.on ? 'Som ligado' : 'Som desligado'; }); if (!(S.modal && S.modal.type === 'replay')) render(); },
    bestiary() { S.view = 'bestiary'; render(); scrollTo(0, 0); },

    delReward(el) { if (masterLocked()) return; Store.delDoc('rewards/' + el.dataset.id); render(); },
    boardWho(el) { S.boardWho = toggleWho(S.boardWho || [], el.value); render(); },
    edWho(el) { const m = S.modal; if (!m || m.type !== 'editTask') return; keepEdit(); const d = document.getElementById('ed-duo'); if (d) m.duo = d.checked; m.who = toggleWho(m.who || [], el.value); render(); },
    pickBoard(el) { if (!heroList().length) { showToast('Crie um herói primeiro para cumprir missões.'); return; } S.modal = { type: 'pickHero', taskId: el.dataset.id }; render(); },
    doneBoard(el) { if (!S.me) return; completeBoard(el.dataset.id, S.me); },
    
    doneBoardAs(el) { const tid = S.modal.taskId; S.modal = null; render(); completeBoard(tid, el.dataset.id); },
    delBoard(el) { Store.delDoc('board/' + el.dataset.id); render(); },
    askPin() { actions.settings(); },
    toggleCo(el) {
      if (masterLocked() || !isMainCreator()) return;
      const p = clone(S.party); const set = new Set((p.coCreators || []).filter((id) => S.heroes[id]));
      if (el.checked) set.add(el.value); else set.delete(el.value);
      p.coCreators = [...set]; Store.saveParty(p); render();
      const h = S.heroes[el.value]; showToast(el.checked ? `<span><b>${esc(h.name)}</b> agora ${h.look && h.look.gender === 'f' ? 'é co-criadora' : 'é co-criador'} da sala.</span>` : `<span><b>${esc(h.name)}</b> não mexe mais nas configurações.</span>`);
    },
    setPinAsk() { if (masterLocked() || !isMainCreator()) return; S.modal = { type: 'pin', mode: 'set' }; render(); setTimeout(() => { const i = document.getElementById('pin-in'); if (i) i.focus(); }, 30); },
    clearPin() { if (masterLocked() || !isMainCreator()) return; const p = clone(S.party); delete p.pin; Store.saveParty(p); S.masterOk = false; render(); showToast('PIN removido.'); },
    replay() { const last = S.party && S.party.last; if (last) openReplay(battleOf(last)); },
    speed() { const m = S.modal; m.speed = m.speed === 1 ? 2 : m.speed === 2 ? 4 : 1; const b = document.querySelector('[data-act="speed"]'); if (b) b.textContent = `Velocidade ${m.speed}×`; },
    skip() { const m = S.modal; clearTimeout(replayTimer); if (!m.mounted) { m.mounted = true; m.battle.units.forEach((u) => { m.hp[u.id] = u.maxHp; }); } while (m.step < m.battle.log.length) { applyFx(m.battle.log[m.step]); m.step++; } m.finished = true; mountReplay(); },
    noop() {},
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    if (a === 'closeModal' && el.classList.contains('modal-bg') && ev.target !== el) return;
    if (el.tagName === 'INPUT') { actions[a] && actions[a](el, ev); return; }
    ev.preventDefault();
    if (S.readOnly && ['saveHero', 'askRedeem', 'redeem', 'delReward', 'done', 'delTask', 'undoTask', 'undoBoard', 'doneBoard', 'pickBoard', 'doneBoardAs', 'delBoard', 'setPinAsk', 'clearPin', 'delChore', 'toggleCo', 'openChest', 'openBday', 'askKudos', 'sendKudos', 'approve', 'reject', 'setApproval', 'reqOk', 'reqNo', 'reqDone', 'equipRelic', 'sellRelic', 'claimGoal', 'buyMerchant', 'respec', 'learn', 'mastery', 'buyGear', 'buyCos', 'buyPotion', 'equipCos', 'setCos', 'retire', 'look', 'randLook', 'forceBattle'].includes(a) && S.view !== 'create') return;
    actions[a] && actions[a](el, ev);
  });
  let renameTimer = null, diffTimer = null;
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (['task-title', 'board-title', 'chore-title', 'rw-name', 'rw-cost', 'room-name', 'acct-email'].includes(el.id)) { S.inputs = S.inputs || {}; S.inputs[el.id] = el.value; }
    if (el.id === 'room-code') { const v = normCode(el.value); if (v !== el.value) el.value = v; S.joinDraft = v; }
    if (el.id === 'diff-range') {
      const v = Number(el.value); S.diffPreview = v; const lv = levelFor(v);
      document.getElementById('diff-name').textContent = lv.name; document.getElementById('diff-pct').textContent = Math.round(v * 100) + '%'; document.getElementById('diff-blurb').textContent = lv.blurb;
      clearTimeout(diffTimer); diffTimer = setTimeout(() => { const hs = heroList(); const c = document.getElementById('diff-chance'); if (c && hs.length) c.textContent = Math.round(E.winChance(hs, stage(), 40, v) * 100) + '%'; }, 120);
    }
    if (el.dataset.input === 'name') { S.draft.name = el.value; const btn = document.querySelector('[data-act="saveHero"]'); if (btn) btn.disabled = !el.value.trim(); const p = document.querySelector('.preview h2'); if (p) p.textContent = el.value || 'Sem nome'; }
    if (el.dataset.input === 'bday' && S.draft) S.draft.birth = /^\d{4}-\d{2}-\d{2}$/.test(el.value) ? el.value : null;
    if (el.dataset.input === 'rename') { const h = hero(); const v = el.value.trim(); if (!v) return; h.name = v; clearTimeout(renameTimer); renameTimer = setTimeout(() => Store.saveHero(h), 700); }
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'birth-edit' && !S.readOnly) { const h = hero(); const v = ev.target.value; if (h && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) && v <= today()) { h.birth = v || null; saveCur(h); } }
    if (ev.target.id === 'room-switch' && ev.target.value && ev.target.value !== S.room) { enterRoom(ev.target.value); return; }
    if (ev.target.id === 'new-every') S.newEvery = ev.target.value;
    if (ev.target.id === 'new-dom') S.newDom = ev.target.value;
    if (ev.target.id === 'new-from') { S.newFrom = ev.target.value; render(); }
    if (ev.target.id === 'ed-from' && S.modal && S.modal.type === 'editTask') { keepEdit(); S.modal.from = ev.target.value; render(); }
    if (ev.target.id === 'task-duo' || ev.target.id === 'board-duo') S.newDuo = ev.target.checked;
    if (['task-due', 'board-due', 'chore-due'].includes(ev.target.id)) S.newDue = ev.target.value;
    if (ev.target.id === 'diff-range' && !masterLocked()) { const p = clone(S.party); p.diffMul = Math.round(Number(ev.target.value) * 100) / 100; delete p.difficulty; Store.saveParty(p); S.chanceKey = ''; showToast(`<span>Dificuldade: <b>${levelFor(p.diffMul).name}</b> (${Math.round(p.diffMul * 100)}%)</span>`); }
  });
  function prune() { const old = addDays(today(), -30); requestList().filter((q) => (q.status === 'delivered' || q.status === 'refused') && q.day < old).forEach((q) => Store.delDoc('requests/' + q.id)); }
  function readNewFreq() { const e = document.getElementById('new-every'), dm = document.getElementById('new-dom'), fr = document.getElementById('new-from'); if (e) S.newEvery = e.value; if (dm) S.newDom = dm.value; if (fr) S.newFrom = fr.value; return newFreqState(); }
  function clearInput(id) { if (S.inputs) delete S.inputs[id]; }
  function addBoardTask(title, repeat, due, duo, who) {
    const id = 'b' + uidGen(); who = (who || []).filter((x) => S.heroes[x]);
    const fq = freqFields(readNewFreq());
    Store.setDoc('board/' + id, Object.assign({ id, title, diff: S.newDiff }, fq, { due: due || null, duo: !!duo, who: who.length ? who : null, parts: [], partNames: [], created: fq.from || today(), done: null, doneBy: null, doneByName: null, gain: 0, createdAt: Date.now() }));
    if (fq.from) showToast(`<span>Missão agendada para <b>${D.WEEKDAYS[dowOf(fq.from)].toLowerCase()}, ${fmtDay(fq.from)}</b>.</span>`);
    S.newFrom = null;
    post('new', `${S.me && S.heroes[S.me] ? S.heroes[S.me].name : 'Alguém'} fixou "${title}" no quadro da guilda`);
  }
  document.addEventListener('submit', (ev) => {
    const form = ev.target.dataset.form; if (!form) return; ev.preventDefault();
    if (form === 'pin') return submitPin();
    if (form === 'pinGate') { const v = (document.getElementById('pin-in').value || '').trim(); if (S.party && v === S.party.pin) { S.masterOk = true; S.pinErr = ''; } else S.pinErr = 'PIN incorreto.'; render(); return; }
    if (form === 'join') { enterRoom(document.getElementById('room-code').value); return; }
    if (form === 'login') { const e = document.getElementById('acct-email'), p = document.getElementById('acct-pass'); if (!e.value.trim()) { e.focus(); return; } if (!p.value) { p.focus(); return; } Acct.enter('login', e.value, p.value); return; }
    if (form === 'pass') {
      const o = document.getElementById('pass-old').value, n = document.getElementById('pass-new').value;
      Acct.call('pass', S.acct.token, o, n).then((r) => { Acct.keep(r); S.passOpen = false; render(); showToast('Senha trocada. Os outros aparelhos vão pedir login de novo.'); }).catch((e) => { S.authErr = String(e.message || e); render(); });
      return;
    }
    if (form === 'newroom') { createRoom(document.getElementById('room-name').value.trim() || 'Guilda da Família'); return; }
    if (S.readOnly) return;
    if (form === 'chore') {
      if (masterLocked()) return;
      const inp = document.getElementById('chore-title'); const title = inp.value.trim(); if (!title) { inp.focus(); return; }
      let assign = 'all';
      if (S.choreAssign !== 'all') { assign = [...document.querySelectorAll('.chore-h:checked')].map((x) => x.value); if (!assign.length) { showToast('Escolha pelo menos um herói.'); return; } }
      const fs = readNewFreq(); if (fs.freq === 'once') fs.freq = 'daily';
      const id = 'o' + uidGen(); Store.setDoc('chores/' + id, Object.assign({ id, title, diff: S.newDiff, assign }, freqFields(fs), { due: document.getElementById('chore-due').value || null, createdAt: Date.now() }));
      S.newDue = ''; S.newFrom = null; post('chore', `Nova tarefa obrigatória: "${title}"`);
      inp.value = ''; clearInput(inp.id); render(); showToast(`<span>Tarefa obrigatória: <b>${esc(title)}</b></span>`); return;
    }
    if (form === 'reward') {
      if (masterLocked()) return actions.askPin();
      const n = document.getElementById('rw-name'), c = document.getElementById('rw-cost');
      const name = n.value.trim(), cost = Math.round(Number(c.value));
      if (!name) { n.focus(); return; } if (!(cost > 0)) { c.focus(); return; }
      const wk = Math.round(Number(document.getElementById('rw-week').value)) || null; const stv = document.getElementById('rw-stock').value; const stock = stv === '' ? null : Math.max(0, Math.round(Number(stv)));
      const id = 'r' + uidGen(); Store.setDoc('rewards/' + id, { id, name, cost, perWeek: wk, stock, createdAt: Date.now() });
      document.getElementById('rw-week').value = ''; document.getElementById('rw-stock').value = '';
      n.value = ''; c.value = ''; clearInput('rw-name'); clearInput('rw-cost'); render(); document.getElementById('rw-name').focus(); showToast(`<span>Recompensa cadastrada: <b>${esc(name)}</b></span>`); return;
    }
    if (form === 'edit') return saveEdit();
    if (form === 'board') {
      const inp = document.getElementById('board-title'); const title = inp.value.trim(); if (!title) { inp.focus(); return; }
      addBoardTask(title, null, document.getElementById('board-due').value, document.getElementById('board-duo').checked, S.boardWho || []); inp.value = ''; clearInput(inp.id); S.newDue = ''; render(); document.getElementById('board-title').focus(); return;
    }
    const inp = document.getElementById('task-title'); const title = inp.value.trim(); if (!title) { inp.focus(); return; }
    const due = document.getElementById('task-due').value || null;
    if (S.newTarget === 'guild') { const duoEl = document.getElementById('task-duo'); addBoardTask(title, null, due, duoEl && duoEl.checked); inp.value = ''; clearInput(inp.id); S.newDue = ''; render(); showToast('<span>Missão fixada no <b>quadro da guilda</b>.</span>'); document.getElementById('task-title').focus(); return; }
    const h = hero(); h.tasks = h.tasks || [];
    if (h.tasks.length >= MAX_TASKS) { showToast(`Limite de ${MAX_TASKS} tarefas. Conclua ou apague algumas.`); return; }
    const fq = freqFields(readNewFreq()); S.newFrom = null;
    h.tasks.push(Object.assign({ id: 't' + uidGen(), title, diff: S.newDiff }, fq, { due, created: fq.from || today(), done: null, gain: 0 }));
    const nt = h.tasks[h.tasks.length - 1]; if (!visibleToday(nt)) { const n = nt.repeat ? nextOn(nt, dueDay(nt)) : dueDay(nt); showToast(`<span>Tarefa criada. Aparece ${n ? `${D.WEEKDAYS[dowOf(n)].toLowerCase()}, ${fmtDay(n)}` : 'nos dias marcados'}.</span>`); }
    inp.value = ''; clearInput(inp.id); S.newDue = ''; saveCur(h); document.getElementById('task-title').focus();
  });
  async function enterRoom(code) {
    code = normCode(code); S.roomErr = '';
    if (code.length !== 6) { S.roomErr = 'O código tem 6 letras e números.'; render(); return; }
    S.busy = true; render();
    let meta = null;
    try { meta = await Store.roomMeta(code); } catch (e) { S.busy = false; S.roomErr = 'Não deu para conferir a sala agora. Tente de novo.'; render(); return; }
    if (!meta) { S.busy = false; S.roomErr = `Não encontramos a sala ${code}. Confira o código.`; S.view = 'rooms'; render(); return; }
    S.roomMeta = meta; S.joinDraft = '';
    await Store.open(code);
    S.busy = false;
    lsSet('guilda-last-room', code);
    let me = lsGet('guilda-me:' + code, null);
    if (!(me && S.heroes[me])) { const am = Acct.heroIn(code); if (am && S.heroes[am]) { me = am; lsSet('guilda-me:' + code, am); } }
    S.me = me && S.heroes[me] ? me : null; S.masterOk = false;
    Acct.room();
    S.view = S.me ? 'home' : 'select';
    tidyAll(); render(); scrollTo(0, 0);
    await resolveDay(false); maybeShowReport(); processInbox();
  }
  async function createRoom(name) {
    S.busy = true; render();
    for (let i = 0; i < 6; i++) {
      const code = newCode();
      let ok = false;
      try { ok = await Store.createRoom(code, { code, name, createdAt: Date.now() }, newParty()); } catch (e) { console.warn(e); }
      if (ok) { S.busy = false; showToast(`Sala criada! Código: <b>${code}</b>`); return enterRoom(code); }
    }
    S.busy = false; S.roomErr = 'Não deu para criar a sala agora. Tente de novo.'; render();
  }
  function submitPin() {
    const v = (document.getElementById('pin-in').value || '').trim(); const m = S.modal;
    if (m.mode === 'set') {
      if (!/^[0-9]{4,8}$/.test(v)) { m.err = 'Use de 4 a 8 números.'; render(); return; }
      const p = clone(S.party || { stage: 1, lastBattleDay: today(), earned: {}, history: [], last: null }); p.pin = v; Store.saveParty(p); S.masterOk = true; S.modal = null; render(); showToast('PIN do criador criado.'); return;
    }
    if (S.party && v === S.party.pin) { S.masterOk = true; S.modal = null; render(); showToast('Mesa do mestre destravada.'); }
    else { m.err = 'PIN incorreto.'; render(); }
  }
  async function completeBoard(taskId, heroId) {
    const t = S.board[taskId]; const h0 = S.heroes[heroId]; if (!t || !h0 || t.done) return;
    if (!canDoBoard(t, heroId)) { showToast(`<span>Esta missão é de <b>${esc(whoOf(t).map((id) => S.heroes[id].name).join(', '))}</b>.</span>`); return; }
    const before = clone(h0), boardBefore = clone(t);
    const x = xpCalc(t, h0);
    const evB = typeof eventMul === 'function' ? eventMul('board') : 0;
    const total = Math.round(x.total * (1 + evB));
    if (t.duo) { // dupla: cada um faz a sua parte; a missão fecha quando o segundo marca
      const parts = t.parts || [];
      if (parts.includes(heroId)) { showToast('Você já fez a sua parte. Falta o parceiro.'); return; }
      const share = Math.round(total * D.DUO_SHARE);
      let ok;
      if (!parts.length) { ok = true; Store.setDoc('board/' + taskId, Object.assign(clone(t), { parts: [heroId], partNames: [h0.name], partGains: [share] })); }
      else ok = await Store.claim('board/' + taskId, { done: today(), doneBy: heroId, doneByName: h0.name, gain: share, parts: parts.concat(heroId), partNames: (t.partNames || []).concat(h0.name), partGains: (t.partGains || []).concat(share) });
      if (!ok) { showToast('Essa missão em dupla já foi fechada.'); render(); return; }
      const h = ensureHero(S.heroes[heroId] || h0); h.stats.done = (h.stats.done || 0) + 1; h.stats.duo = (h.stats.duo || 0) + 1; h.stats.board = (h.stats.board || 0) + 1;
      markDay(h); logDay(h, 't', 1); const ups = grantXp(h, share); checkAch(h); Store.saveHero(h); sfx('task');
      showToast(parts.length ? `<span>Dupla completa com <b>${esc(t.partNames[0])}</b>! +${share} XP</span>` : `<span>Sua parte está feita: +${share} XP. Falta um parceiro.</span>`);
      post('duo', parts.length ? `${t.partNames[0]} e ${h.name} completaram "${t.title}" em dupla` : `${h.name} fez a parte de "${t.title}" e procura um parceiro`);
      if (ups) S.modal = { type: 'levelup', heroId: h.id, level: h.level, ups };
      render(); return;
    }
    const pend = needsApproval(h0);
    const ok = await Store.claim('board/' + taskId, { done: today(), doneBy: heroId, doneByName: h0.name, gain: total, pending: pend || null, punct: !pend && x.punctual ? true : null });
    if (!ok) { showToast('Alguém já cumpriu essa missão.'); render(); return; }
    const h = ensureHero(S.heroes[heroId] || h0); h.stats.done = (h.stats.done || 0) + 1; h.stats.byDiff[t.diff] = (h.stats.byDiff[t.diff] || 0) + 1;
    markDay(h); logDay(h, 't', 1);
    if (pend) { Store.saveHero(h); showToast(`<span>Missão enviada para aprovação · ${esc(t.title)}</span>`); post('pend', `${h.name} cumpriu a missão "${t.title}" e aguarda aprovação`); render(); return; }
    h.stats.board = (h.stats.board || 0) + 1; if (x.punctual) h.stats.punctual = (h.stats.punctual || 0) + 1;
    const ups = grantXp(h, total); checkAch(h); Store.saveHero(h); sfx('task');
    S.undo = { heroId: h.id, before, board: boardBefore };
    showToast(`<span><b>${esc(h.name)}</b> +${total} XP · ${esc(t.title)}</span>`, true);
    post('board', `${h.name} cumpriu a missão da guilda "${t.title}" (+${total} XP)`);
    if (ups) S.modal = { type: 'levelup', heroId: h.id, level: h.level, ups };
    render();
  }
  // um criador aprova ou recusa: a missão do quadro muda aqui; o XP vai pela caixa de entrada do herói
  function decide(el, ok) {
    if (masterLocked()) return;
    const kind = el.dataset.kind, heroId = el.dataset.hero, id = el.dataset.id; const h = S.heroes[heroId]; if (!h) return;
    if (kind === 'task') {
      const t = (h.tasks || []).find((x) => x.id === id); if (!t) return;
      sendInbox(heroId, ok ? 'approve' : 'reject', { ref: { type: 'task', id }, xp: t.pendXp || 0, title: t.title });
    } else {
      const b = S.board[id]; if (!b) return;
      if (ok) Store.setDoc('board/' + id, Object.assign(clone(b), { pending: null, approved: true }));
      else Store.setDoc('board/' + id, Object.assign(clone(b), { done: null, doneBy: null, doneByName: null, gain: 0, pending: null }));
      sendInbox(heroId, ok ? 'approve' : 'reject', { ref: { type: 'board', id }, xp: b.gain || 0, title: b.title });
    }
    post(ok ? 'ok' : 'no', `${S.heroes[S.me].name} ${ok ? 'aprovou' : 'recusou'} "${(kind === 'task' ? (h.tasks.find((x) => x.id === id) || {}).title : S.board[id] && S.board[id].title) || 'tarefa'}" de ${h.name}`);
    showToast(ok ? 'Aprovada. O XP entra quando a pessoa abrir o app.' : 'Recusada.'); render();
  }
  function keepEdit() { const m = S.modal; if (!m || m.type !== 'editTask') return; const ti = document.getElementById('ed-title'); if (ti) m.title = ti.value; const ee = document.getElementById('ed-every'); if (ee) m.every = ee.value; const ed = document.getElementById('ed-dom'); if (ed) m.dom = ed.value; const du = document.getElementById('ed-due'); if (du) m.due = du.value; const dd = document.getElementById('ed-duo'); if (dd) m.duo = dd.checked; const ef = document.getElementById('ed-from'); if (ef) m.from = ef.value; }
  function saveEdit() {
    keepEdit(); const m = S.modal; const title = (m.title || '').trim(); if (!title) { document.getElementById('ed-title').focus(); return; }
    const fq = freqFields(m.scope === 'chore' && m.freq === 'once' ? Object.assign({}, m, { freq: 'daily' }) : m);
    const patch = Object.assign({ title, diff: m.diff, due: m.due || null }, fq);
    // mudar a data de início: tarefa agendada passa a aparecer só no novo dia; tirar a data traz para hoje
    const redate = (t) => (fq.from ? { created: fq.from } : t.created > today() ? { created: today() } : {});
    if (m.scope === 'me') { const h = hero(); const t = h.tasks.find((x) => x.id === m.id); if (t) { Object.assign(t, patch, t.done ? {} : redate(t)); Store.saveHero(h); } }
    else if (m.scope === 'board') { const b = S.board[m.id]; if (b) Store.setDoc('board/' + m.id, Object.assign(clone(b), patch, b.done ? {} : redate(b), { duo: !!m.duo, who: (m.who || []).length ? m.who.slice() : null })); }
    else if (m.scope === 'chore' && !masterLocked()) { const c = S.chores[m.id]; if (c) { const { repeat, ...rest } = patch; Store.setDoc('chores/' + m.id, Object.assign(clone(c), rest)); } }
    S.modal = null; render(); showToast('Tarefa atualizada.');
  }

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.tut) { endTut(); return; } if (ev.key === 'Escape' && S.modal) { clearTimeout(replayTimer); Sound.music(false); S.modal = null; render(); } });
  window.addEventListener('resize', () => { if (S.view === 'hero' && S.tab === 'habilidades') drawLinks(); });

  // virada do dia e contagem regressiva
  let lastDay = today();
  setInterval(() => {
    if (!S.ready) return;
    const t = today();
    if (t !== lastDay) { lastDay = t; tidyAll(); resolveDay(false); }
    const chip = document.querySelector('.chip.warn b'); if (chip) chip.textContent = countdown();
  }, 30000);

  window.__guildaDebug = { playFx: (ev) => { clearTimeout(replayTimer); playEvent(ev); }, battle: () => S.modal && S.modal.battle, eventFor: (d) => eventFor(d), eventOn: (d) => eventOn(d), isBday: (h, d) => isBday(h, d), contrib: () => { const last = S.party && S.party.last; if (!last) return 'sem batalha'; try { return battleContrib(battleOf(last)); } catch (e) { return 'erro: ' + e.message; } } };
  async function start(snap) {
    render();
    await Store.init();
    await Acct.load();
    S.ready = true;
    const room = (snap && snap.room) || lsGet('guilda-last-room', null);
    if (room) {
      await enterRoom(room);
      if (snap && snap.room === S.room && snap.view && S.me) { S.view = snap.view === 'create' && !snap.draft ? 'home' : snap.view; S.heroId = snap.heroId; S.tab = snap.tab || 'tarefas'; S.draft = snap.draft || null; render(); }
    } else { S.view = 'rooms'; render(); }
  }
  if (window.claude && window.claude.hot) window.claude.hot.snapshot(() => ({ room: S.room, view: S.view, heroId: S.heroId, tab: S.tab, draft: S.draft }));
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
