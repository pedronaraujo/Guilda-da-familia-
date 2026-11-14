// Campanha longa (1+ ano): taxa de vitória por trimestre. node test/longrun.js [dias]
require('../src/data.js'); require('../src/engine.js');
const D = globalThis.DATA, E = globalThis.ENGINE;
for (const k of ['xpd', 'late', 'growth', 'late2', 'growth2', 's2']) if (process.env[k]) E.ENEMY_K[k] = +process.env[k];
function learnAll(h) { const c = D.CLASSES[h.cls]; let g = 80; while (h.points > 0 && g--) { const o = c.skills.filter((s) => E.canLearn(h, s).ok); if (!o.length) { h.mastery++; h.points--; continue; } o.sort((a, b) => (b.type === 'a') - (a.type === 'a') || b.tier - a.tier); h.skills[o[0].id] = (h.skills[o[0].id] || 0) + 1; h.points--; } }
function shop(h, gold) { for (let t = 1; t <= D.GEAR_TIERS.length; t++) for (const s of ['weapon', 'armor', 'amulet']) { const T = D.GEAR_TIERS[t - 1]; if ((h.gear[s] || 0) === t - 1 && h.level >= T.lvl && gold.v - h.spent >= T.price) { h.gear[s] = t; h.spent += T.price; } } }
function campaign(xpd, days, seed, party) {
  const r = E.rng(seed);
  const hs = party.map((c, i) => ({ id: 'h' + i, cls: c, level: 1, xp: 0, points: 1, skills: {}, gear: {}, mastery: 0, spent: 0, look: { anc: 'humano' } }));
  const gold = hs.map(() => ({ v: 0 })); let stage = 1; const q = [];
  for (let d = 1; d <= days; d++) {
    hs.forEach((h, i) => { h.xp += Math.max(0, xpd * (0.5 + r())); while (h.xp >= D.xpToNext(h.level)) { h.xp -= D.xpToNext(h.level); h.level++; h.points++; } learnAll(h); shop(h, gold[i]); });
    const res = E.simulate(hs, stage, Math.floor(r() * 1e9), false, 1);
    const qi = Math.floor((d - 1) / 91); q[qi] = q[qi] || [0, 0];
    q[qi][0]++; if (res.win) { q[qi][1]++; gold.forEach((g) => (g.v += E.goldReward(stage) * 0.75)); stage++; }
  }
  return { q: q.map(([n, w]) => Math.round((w / n) * 100)), stage, level: hs[0].level };
}
const days = +process.argv[2] || 455;
const parties = {
  clássico: ['guerreiro', 'curandeiro', 'fogo', 'arqueiro', 'ladino'],
  novos: ['monge', 'princesa', 'bruxa', 'inventor', 'xama'],
  misto: ['paladino', 'bardo', 'gelo', 'druida', 'monge'],
  'trio novo': ['monge', 'bardo', 'bruxa'],
};
for (const xpd of [100, 150]) for (const [nm, p] of Object.entries(parties)) {
  const runs = [0, 1, 2].map((s) => campaign(xpd, days, s * 977 + 3, p));
  const q = runs[0].q.map((_, i) => Math.round(runs.reduce((a, r) => a + r.q[i], 0) / runs.length));
  console.log(`xp/dia ${xpd} ${nm.padEnd(10)} vitórias por trimestre: ${q.map((v) => v + '%').join(' ')} · estágio final ~${Math.round(runs.reduce((a, r) => a + r.stage, 0) / 3)} · nível ${runs[0].level}`);
}
