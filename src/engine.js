/* ===== Motor: progressão, inimigos e batalha automática ===== */
(function (G) {
  const D = G.DATA;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- Progressão ---------- */
  function levelFromXp(total) { let L = 1; while (total >= D.xpToNext(L)) { total -= D.xpToNext(L); L++; } return L + total / D.xpToNext(L); }

  function canLearn(hero, skill) {
    const cls = D.CLASSES[hero.cls];
    const rank = (hero.skills && hero.skills[skill.id]) || 0;
    if (rank >= skill.max) return { ok: false, why: 'Nível máximo' };
    if (hero.level < skill.minLevel) return { ok: false, why: `Requer nível ${skill.minLevel}` };
    if (skill.req && !skill.req.every((r) => hero.skills[r])) return { ok: false, why: 'Requer ' + skill.req.map((r) => cls.skillMap[r].name).join(' + ') };
    if (skill.reqAny && !skill.reqAny.some((r) => hero.skills[r])) return { ok: false, why: 'Requer ' + skill.reqAny.map((r) => cls.skillMap[r].name).join(' ou ') };
    if ((hero.points || 0) < 1) return { ok: false, why: 'Sem pontos de habilidade' };
    return { ok: true };
  }

  /* ---------- Atributos do herói ---------- */
  function heroStats(hero, partyMods) {
    const c = D.CLASSES[hero.cls];
    const L = hero.level;
    const m = { hpPct: 0, atkPct: 0, defPct: 0, spd: 0, crit: 0, critDmg: 0, dodge: 0, lifesteal: 0, healPow: 0, thorns: 0, regen: 0, pierce: 0, burnPct: 0, poisonOnHit: 0, partyDefPct: 0, selfRevive: 0 };
    const actives = [];
    for (const [sid, rank] of Object.entries(hero.skills || {})) {
      const s = c.skillMap[sid]; if (!s || !rank) continue;
      if (s.type === 'p') for (const [k, v] of Object.entries(s.mod)) m[k] += v * rank;
      else actives.push(s);
    }
    const anc = D.ANCESTRIES[(hero.look && hero.look.anc) || hero.anc || 'humano'] || D.ANCESTRIES.humano;
    for (const [k, v] of Object.entries(anc.mod)) m[k] += v;
    const g = hero.gear || {};
    const W = D.GEAR_TIERS[g.weapon - 1], A = D.GEAR_TIERS[g.armor - 1], AM = D.GEAR_TIERS[g.amulet - 1];
    if (W) m.atkPct += W.w;
    if (A) { m.hpPct += A.a; m.defPct += A.a; }
    if (AM) { m.crit += AM.crit; m.spd += AM.spd; }
    if (hero.bday && D.BDAY) for (const [k, v] of Object.entries(D.BDAY.mod)) m[k] += v;
    const pot = hero.potion && D.POTIONS && D.POTIONS.find((x) => x.id === hero.potion); if (pot) for (const [k, v] of Object.entries(pot.mod)) m[k] += v;
    const pet = hero.cosmetics && D.PET_BONUS[hero.cosmetics.pet];
    if (pet) for (const [k, v] of Object.entries(pet.mod)) m[k] += v;
    for (const rl of (hero.relics || []).filter((x) => (hero.relicOn || []).includes(x.id))) for (const [k, v] of Object.entries(rl.mod || {})) m[k] = (m[k] || 0) + v;
    const mast = (hero.mastery || 0) * 0.02;
    const pd = partyMods ? partyMods.defPct : 0;
    return {
      maxHp: Math.round((c.hp + c.hpG * (L - 1)) * (1 + m.hpPct + mast)),
      atk: (c.atk + c.atkG * (L - 1)) * (1 + m.atkPct + mast),
      def: (c.def + c.defG * (L - 1)) * (1 + m.defPct + mast + pd),
      spd: Math.max(3, c.spd + m.spd + Math.floor(L / 5)),
      crit: Math.min(0.75, c.crit + m.crit),
      critDmg: 1.5 + m.critDmg,
      dodge: Math.min(0.5, m.dodge),
      lifesteal: m.lifesteal, healPow: 1 + m.healPow, thorns: m.thorns, regen: m.regen,
      pierce: Math.min(0.7, m.pierce), burnPct: m.burnPct, poisonOnHit: m.poisonOnHit,
      partyDefPct: m.partyDefPct, selfRevive: m.selfRevive,
      aggro: c.aggro, actives,
    };
  }
  function powerScore(st) { return Math.round(st.maxHp * 0.35 + st.atk * 6 + st.def * 4 + st.spd * 2 + st.crit * 100); }

  /* ---------- Inimigos por estágio ---------- */
  // Nível equivalente de um estágio: o que um herói alcança com ~100 XP/dia
  function stageLevel(s) { const K = ENEMY_K; return levelFromXp(K.xpd * s) * 0.92 + 0.3 + Math.max(0, Math.min(s, K.s2) - 18) * K.late + Math.max(0, s - K.s2) * K.late2; }
  const ENEMY_K = { early: [1.22, 1.15, 1.05, 0.9, 0.92, 0.9, 0.93, 0.98], xpd: 100, late: 0.5, growth: 1.015, s2: 30, late2: 0.25, growth2: 1.002, hp: 2.5, atk: 2.5, small: [1, 0.72, 0.82, 1.0, 1.05] };
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    return '#' + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('');
  }
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function tierInfo(sp, tier, pack) {
    const top = D.TIERS.length - 1;
    const T = D.TIERS[Math.min(tier, top)];
    let adj = pack ? T[sp.g + 'p'] : T[sp.g];
    if (tier > top) adj += ' ' + (ROMAN[tier - top + 1] || String(tier - top + 1));
    let name;
    if (sp.boss) name = adj ? `${sp.name}, ${sp.g === 'f' ? 'a' : 'o'} ${T[sp.g]}${tier > top ? ' ' + (ROMAN[tier - top + 1] || '') : ''}` : sp.name;
    else name = pack ? `${sp.group} de ${sp.plural}${adj ? ' ' + adj : ''}` : `${sp.name}${adj ? ' ' + adj : ''}`;
    return { name, color: T.tint ? mixHex(sp.color, T.tint, T.amt) : sp.color, glow: T.glow };
  }
  function regionIndex(stage) { return Math.floor((stage - 1) / 5) % D.REGIONS.length; }
  // Encontro procedural: o estágio dá um "orçamento" de força que é dividido entre
  // inimigos comuns, elites (um nível acima) e bandos (vários membros numa unidade).
  function buildEnemies(stage, heroCount, mul, special) {
    mul = (mul || 1) * (special && special.mul ? special.mul : 1);
    heroCount = Math.max(1, heroCount || 5);
    const r = rng(hashStr('stage' + stage));
    const ri = regionIndex(stage), reg = D.REGIONS[ri];
    const k = (stage - 1) % 5;
    const isBoss = k === 4 || !!special;
    const L = stageLevel(stage);
    const gw = Math.pow(ENEMY_K.growth, Math.min(stage, ENEMY_K.s2) - 1) * Math.pow(ENEMY_K.growth2, Math.max(0, stage - ENEMY_K.s2));
    const scale = heroCount / 5;
    const base = { hp: (78 + 11 * (L - 1)) * ENEMY_K.hp * mul * gw, atk: (10 + 2.35 * (L - 1)) * ENEMY_K.atk * mul * gw, def: 5 + 1.45 * (L - 1), spd: 9 };
    const ramp = stage <= ENEMY_K.early.length ? ENEMY_K.early[stage - 1] : 1;
    const statScale = ramp * (heroCount < 5 ? ENEMY_K.small[heroCount] : 1);
    let budget = (stage <= 2 ? 3 : stage < 10 ? 4 : 5) * scale;
    const tierBase = Math.floor((stage - 1) / 10);
    const packChance = Math.min(0.65, 0.15 + 0.07 * k + stage * 0.008);
    const eliteChance = Math.min(0.55, 0.08 + 0.07 * k + stage * 0.006);
    const out = [];
    const mk = (sp, tier, opts) => {
      const ti = tierInfo(sp, tier, opts.count > 1);
      const hp = Math.round(base.hp * sp.hp * statScale * opts.hpMul);
      return {
        id: 'e' + out.length, side: 'e', sid: sp.id, tier, name: ti.name, shape: sp.shape, color: ti.color, glow: ti.glow,
        boss: !!sp.boss, big: !!sp.big, crown: !!sp.crown, horns: !!sp.horns, wings: !!sp.wings, lava: !!sp.lava, small: !!sp.small,
        count: opts.count || 1, memberHp: Math.round(hp / (opts.count || 1)),
        maxHp: hp, atk: base.atk * sp.atk * statScale * opts.atkMul, def: base.def * sp.def * (1 + 0.08 * (tier - tierBase)),
        spd: base.spd * sp.spd + (tier - tierBase), crit: 0.05, critDmg: 1.5, dodge: sp.dodge || 0, lifesteal: sp.drain || 0, regen: sp.regen || 0,
        poisonOnHit: sp.poison || 0, aoe: opts.count > 1 ? 0 : sp.aoe || 0, healPow: 1, thorns: 0, pierce: 0, burnPct: 0, aggro: 1, actives: [],
      };
    };
    if (isBoss) {
      const b = D.BOSSES[special ? special.boss : reg.boss];
      const u = mk(b, tierBase + (special ? special.tierUp || 0 : 0), { hpMul: Math.max(0.35, scale), atkMul: 1, count: 1 });
      if (special && special.title) u.name = special.title;
      out.push(u); budget -= 2;
    }
    let guard = 0;
    while (budget >= 0.45 && out.length < 5 && guard++ < 20) {
      const sp = D.SPECIES_MAP[reg.pool[Math.floor(r() * reg.pool.length)]];
      if (sp.group && budget >= 1.4 && r() < packChance) {
        const n = budget >= 2.1 && r() < 0.5 ? 3 : 2;
        out.push(mk(sp, tierBase, { count: n, hpMul: n * 0.7 * 0.92, atkMul: 0.7 })); budget -= n * 0.7;
      } else if (budget >= 1.4 && r() < eliteChance) {
        out.push(mk(sp, tierBase + 1, { count: 1, hpMul: 1.4, atkMul: 1.35 })); budget -= 1.4;
      } else {
        const c = Math.min(1, budget);
        out.push(mk(sp, tierBase, { count: 1, hpMul: c, atkMul: c })); budget -= c;
      }
    }
    return out;
  }
  function regionOf(stage) { return D.REGIONS[regionIndex(stage)]; }

  /* ---------- Batalha ---------- */
  function simulate(heroes, stage, seed, withLog, mul, special) {
    const r = rng(seed);
    const partyDef = heroes.reduce((s, h) => s + heroStats(h).partyDefPct, 0);
    const H = heroes.map((h) => {
      const st = heroStats(h, { defPct: partyDef });
      return Object.assign(st, { id: h.id, side: 'h', name: h.name, cls: h.cls, look: h.look, cosmetics: h.cosmetics });
    });
    const E = buildEnemies(stage, heroes.length, mul, special);
    const all = H.concat(E);
    for (const u of all) {
      Object.assign(u, { hp: u.maxHp, shield: 0, cds: {}, uses: {}, dots: [], stun: 0, chill: 0, taunt: 0, buffs: [], revived: false, ko: false });
    }
    const log = [];
    const ev = (o) => { if (withLog) log.push(o); };
    const alive = (side) => all.filter((u) => u.side === side && !u.ko);
    const foes = (u) => alive(u.side === 'h' ? 'e' : 'h');
    const friends = (u) => alive(u.side);
    const buffSum = (u, k) => u.buffs.reduce((s, b) => s + (b[k] || 0), 0);

    function pickTarget(u) {
      const f = foes(u); if (!f.length) return null;
      const t = f.filter((x) => x.taunt > 0); if (t.length) return t[0];
      if (u.side === 'h') { // heróis focam o inimigo com menos vida
        return f.reduce((a, b) => (a.hp < b.hp ? a : b));
      }
      const tot = f.reduce((s, x) => s + x.aggro, 0); let k = r() * tot;
      for (const x of f) { k -= x.aggro; if (k <= 0) return x; } return f[0];
    }
    function hit(src, tgt, mult, opt, fx) {
      opt = opt || {};
      if (tgt.ko) return 0;
      if (r() < Math.min(0.6, tgt.dodge + buffSum(tgt, 'dodge'))) { fx.push([tgt.id, 0, tgt.hp, 'esquiva']); return 0; }
      const atk = src.atk * Math.max(0.3, 1 + buffSum(src, 'atk')) * (enrage);
      const def = tgt.def * Math.max(0.2, 1 + buffSum(tgt, 'def')) * (1 - Math.min(0.85, (src.pierce || 0) + (opt.pierce || 0)));
      let dmg = atk * mult * (60 / (60 + def)) * (0.9 + r() * 0.2);
      const crit = r() < src.crit + buffSum(src, 'crit') + (opt.critBonus || 0);
      if (crit) dmg *= src.critDmg;
      if (opt.exec && tgt.hp / tgt.maxHp < 0.35) dmg *= 2;
      dmg = Math.max(1, Math.round(dmg));
      dealRaw(tgt, dmg, fx, crit ? 'crit' : '');
      if (src.lifesteal || opt.drain) heal(src, dmg * ((src.lifesteal || 0) + (opt.drain || 0)), fx, true);
      if (tgt.thorns && !tgt.ko) dealRaw(src, Math.round(dmg * tgt.thorns), fx, 'espinhos', tgt.id);
      if (opt.burn) tgt.dots.push({ k: 'queimando', dmg: src.atk * opt.burn * (1 + (src.burnPct || 0)), t: 3, src: src.id });
      if (opt.poison) tgt.dots.push({ k: 'envenenado', dmg: src.atk * opt.poison, t: 3, src: src.id });
      if (opt.dot) tgt.dots.push({ k: opt.dot.k, dmg: src.atk * opt.dot.p, t: 3, src: src.id });
      if (src.poisonOnHit && !opt.noPoh) tgt.dots.push({ k: 'envenenado', dmg: src.atk * src.poisonOnHit, t: 2, src: src.id });
      const sk = opt.stunK || 'congelado';
      if (opt.stun && !tgt.ko) { tgt.stun = Math.max(tgt.stun, opt.stun); tgt.stunK = sk; fx.push([tgt.id, 0, tgt.hp, sk]); }
      if (opt.stunChance && !tgt.ko && r() < opt.stunChance) { tgt.stun = Math.max(tgt.stun, 1); tgt.stunK = sk; fx.push([tgt.id, 0, tgt.hp, sk]); }
      if (opt.chill) tgt.chill = Math.max(tgt.chill, opt.chill);
      return dmg;
    }
    function dealRaw(tgt, dmg, fx, flag, by) {
      let d = dmg;
      if (tgt.shield > 0) { const a = Math.min(tgt.shield, d); tgt.shield -= a; d -= a; }
      tgt.hp = Math.max(0, tgt.hp - d);
      fx.push(by ? [tgt.id, -dmg, tgt.hp, flag || '', by] : [tgt.id, -dmg, tgt.hp, flag || '']);
      if (tgt.hp <= 0) {
        if (tgt.selfRevive && !tgt.revived) { tgt.revived = true; tgt.hp = Math.round(tgt.maxHp * tgt.selfRevive); fx.push([tgt.id, tgt.hp, tgt.hp, 'renasce']); }
        else { tgt.ko = true; tgt.dots = []; tgt.taunt = 0; fx.push([tgt.id, 0, 0, 'caiu']); }
      }
    }
    function heal(u, amt, fx, quiet) {
      if (u.ko) return; const a = Math.round(Math.min(u.maxHp - u.hp, amt));
      if (a <= 0) return; u.hp += a; if (!quiet || a > 3) fx.push([u.id, a, u.hp, 'cura']);
    }
    function healPower(u) { return (u.atk * 0.8 + u.maxHp * 0.06) * u.healPow; }

    function chooseActive(u) {
      const ready = u.actives.filter((s) => !(u.cds[s.id] > 0) && !(s.uses && (u.uses[s.id] || 0) >= s.uses));
      if (!ready.length) return null;
      const fr = friends(u);
      const dead = all.filter((x) => x.side === u.side && x.ko);
      const hurt = fr.filter((x) => x.hp / x.maxHp < 0.6);
      const lowest = fr.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
      const nFoes = foes(u).length;
      const score = (s) => {
        switch (s.act) {
          case 'revive': return dead.length ? 100 : -1;
          case 'miracle': return hurt.length >= 2 || dead.length ? 95 : -1;
          case 'healAll': return hurt.length >= 2 ? 90 : -1;
          case 'heal': return lowest.hp / lowest.maxHp < 0.55 ? 88 : -1;
          case 'nature': return 70 + nFoes + hurt.length * 5;
          case 'taunt': return u.taunt > 0 ? -1 : (fr.length > 1 ? 80 : -1);
          case 'shield': return fr.some((x) => x.shield <= 0) ? 75 : -1;
          case 'buffAtk': case 'buffDodge': return fr.some((x) => x.buffs.some((b) => b.src === s.id)) ? -1 : 74;
          case 'buff': return (s.self ? [u] : fr).some((x) => x.buffs.some((b) => b.src === s.id)) ? -1 : (s.heal && hurt.length >= 2 ? 92 : 74);
          case 'debuff': { const fo = foes(u); const fresh = fo.some((x) => !x.buffs.some((b) => b.src === s.id)); return fresh ? 66 + (s.all ? fo.length * 2 : 0) + (s.p || 0) * 6 : (s.p ? 40 + s.p * 10 : -1); }
          case 'selfBuff': return u.buffs.some((b) => b.src === s.id) ? -1 : 72;
          case 'aoe': return nFoes >= 2 ? 50 + s.p * 10 * nFoes : 40 + s.p * 10;
          case 'multi': return 45 + s.p * s.hits * 6;
          case 'execute': return foes(u).some((x) => x.hp / x.maxHp < 0.35) ? 68 : 40 + s.p * 10;
          default: return 40 + s.p * 10 + (s.stun ? 8 : 0);
        }
      };
      let best = null, bs = -1;
      for (const s of ready) { const v = score(s); if (v > bs) { bs = v; best = s; } }
      return bs >= 0 ? best : null;
    }

    function act(u, round) {
      const fx = [];
      const s = u.side === 'h' ? chooseActive(u) : null;
      if (u.side === 'e' && u.aoe && round % 3 === 0) {
        for (const t of foes(u)) hit(u, t, u.aoe, {}, fx);
        ev({ r: round, a: u.id, s: u.boss ? 'Fúria do Chefe' : 'Ataque Sombrio', fx }); return;
      }
      if (!s && u.count > 1) { // bando: cada membro vivo ataca
        const alive = Math.max(1, Math.ceil(u.hp / u.memberHp - 1e-6));
        for (let i = 0; i < alive; i++) { const t = pickTarget(u); if (!t) break; hit(u, t, 1, {}, fx); }
        ev({ r: round, a: u.id, s: '', fx }); return;
      }
      if (!s) {
        const t = pickTarget(u); if (!t) return;
        hit(u, t, 1, {}, fx); ev({ r: round, a: u.id, s: '', fx }); return;
      }
      u.cds[s.id] = s.cd + 1;
      if (s.uses) u.uses[s.id] = (u.uses[s.id] || 0) + 1;
      const opt = { pierce: s.pierce, stun: s.stun, stunChance: s.stunChance, stunK: s.stunK, chill: s.chill, burn: s.burn, poison: s.poison, dot: s.dot, drain: s.drain, critBonus: s.critBonus, exec: s.act === 'execute' };
      const fr = friends(u);
      switch (s.act) {
        case 'strike': case 'execute': { const t = pickTarget(u); if (t) hit(u, t, s.p, opt, fx); break; }
        case 'aoe': for (const t of foes(u)) hit(u, t, s.p, Object.assign({ noPoh: true }, opt), fx); break;
        case 'multi': for (let i = 0; i < s.hits; i++) { const f = foes(u); if (!f.length) break; hit(u, f[Math.floor(r() * f.length)], s.p, Object.assign({ noPoh: i > 0 }, opt), fx); } break;
        case 'heal': { const t = fr.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b)); heal(t, healPower(u) * s.p, fx); break; }
        case 'healAll': for (const t of fr) heal(t, healPower(u) * s.p, fx); break;
        case 'shield': for (const t of fr) { const v = Math.round((u.atk * 1.2 + u.def * 2) * s.p * u.healPow); t.shield = Math.max(t.shield, v); fx.push([t.id, v, t.hp, 'escudo']); } break;
        case 'buffAtk': for (const t of fr) { t.buffs.push({ atk: s.v, t: s.turns, src: s.id }); fx.push([t.id, 0, t.hp, 'fortalecido']); } break;
        case 'buffDodge': for (const t of fr) { t.buffs.push({ dodge: s.v, t: s.turns, src: s.id }); fx.push([t.id, 0, t.hp, 'oculto']); } break;
        case 'taunt': u.taunt = s.turns; u.buffs.push({ def: s.def, t: s.turns, src: s.id }); fx.push([u.id, 0, u.hp, 'provoca']); break;
        case 'selfBuff': u.buffs.push(Object.assign({ atk: s.atk || 0, def: s.def || 0 }, s.buff || {}, { t: s.turns, src: s.id })); if (s.taunt) u.taunt = s.taunt; fx.push([u.id, 0, u.hp, s.fxK || 'transforma']); break;
        case 'buff': if (s.taunt) u.taunt = s.taunt; for (const t of (s.self ? [u] : fr)) { if (s.heal) heal(t, healPower(u) * s.heal, fx); t.buffs.push(Object.assign({}, s.buff, { t: s.turns, src: s.id })); fx.push([t.id, 0, t.hp, s.fxK || 'fortalecido']); } break;
        case 'debuff': { const tg = s.all ? foes(u) : [pickTarget(u)].filter(Boolean); for (const t of tg) { if (s.p) hit(u, t, s.p, Object.assign({ noPoh: true }, opt), fx); if (t.ko) continue; t.buffs.push(Object.assign({}, s.debuff, { t: s.turns, src: s.id })); fx.push([t.id, 0, t.hp, s.fxK || 'enfraquecido']); } break; }
        case 'revive': { const d = all.filter((x) => x.side === u.side && x.ko); if (d.length) { const t = d[0]; t.ko = false; t.hp = Math.round(t.maxHp * s.p); fx.push([t.id, t.hp, t.hp, 'renasce']); } break; }
        case 'nature': for (const t of foes(u)) hit(u, t, s.p, { noPoh: true }, fx); for (const t of friends(u)) heal(t, healPower(u) * s.p * 0.7, fx); break;
        case 'miracle': for (const t of fr) { t.dots = []; heal(t, healPower(u) * s.p, fx); t.shield = Math.max(t.shield, Math.round(t.maxHp * 0.15)); } break;
      }
      ev({ r: round, a: u.id, s: s.name, fx });
    }

    let enrage = 1, round = 0, result = null;
    const MAXR = 30;
    for (round = 1; round <= MAXR && !result; round++) {
      if (round > 12) enrage = 1 + (round - 12) * 0.15;
      const order = all.filter((u) => !u.ko).map((u) => ({ u, k: (u.spd + buffSum(u, 'spd')) * (u.chill > 0 ? 0.7 : 1) + r() * 3 })).sort((a, b) => b.k - a.k).map((o) => o.u);
      for (const u of order) {
        if (u.ko) continue;
        // início do turno
        const fx = [];
        for (const d of u.dots) { if (!u.ko) dealRaw(u, Math.max(1, Math.round(d.dmg)), fx, d.k, d.src); d.t--; }
        u.dots = u.dots.filter((d) => d.t > 0);
        const rg = (u.regen || 0) + buffSum(u, 'regen'); if (rg > 0 && !u.ko) heal(u, u.maxHp * rg, fx, true);
        if (fx.length) ev({ r: round, a: u.id, s: '', tick: true, fx });
        for (const k in u.cds) if (u.cds[k] > 0) u.cds[k]--;
        u.buffs.forEach((b) => b.t--); u.buffs = u.buffs.filter((b) => b.t > 0);
        if (u.chill > 0) u.chill--;
        if (u.taunt > 0) u.taunt--;
        if (u.ko) { if (!alive('h').length) { result = 'loss'; break; } if (!alive('e').length) { result = 'win'; break; } continue; }
        if (u.stun > 0) { u.stun--; ev({ r: round, a: u.id, s: '', stunned: true, k: u.stunK || 'congelado', fx: [] }); continue; }
        act(u, round);
        if (!alive('e').length) { result = 'win'; break; }
        if (!alive('h').length) { result = 'loss'; break; }
      }
    }
    if (!result) result = 'loss';
    return {
      win: result === 'win', rounds: Math.min(round, MAXR), log,
      units: all.map((u) => ({ id: u.id, side: u.side, name: u.name, maxHp: u.maxHp, cls: u.cls, sid: u.sid, tier: u.tier, shape: u.shape, color: u.color, glow: u.glow, boss: u.boss, big: u.big, crown: u.crown, horns: u.horns, wings: u.wings, lava: u.lava, small: u.small, count: u.count || 1, memberHp: u.memberHp })),
      survivors: alive('h').length,
    };
  }

  function winChance(heroes, stage, n, mul, special) {
    if (!heroes.length) return 0;
    n = n || 60; let w = 0;
    for (let i = 0; i < n; i++) if (simulate(heroes, stage, 1000 + i * 7919, false, mul, special).win) w++;
    return w / n;
  }
  function goldReward(stage) { return Math.round((20 + 8 * stage) * (stage % 5 === 0 ? 2.5 : 1)); }

  G.ENGINE = { tierInfo, regionIndex, rng, hashStr, levelFromXp, canLearn, heroStats, powerScore, stageLevel, buildEnemies, regionOf, simulate, winChance, goldReward, ENEMY_K };
})(typeof window !== 'undefined' ? window : globalThis);
