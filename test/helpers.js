const D = globalThis.DATA, E = globalThis.ENGINE;
function autoHero(cls, level, i) {
  const h = { id: 'h' + i, name: cls, cls, level, skills: {}, points: level, gear: {}, mastery: 0 };
  const c = D.CLASSES[cls]; let guard = 100;
  while (h.points > 0 && guard--) {
    const opts = c.skills.filter((s) => E.canLearn(h, s).ok);
    if (!opts.length) { h.mastery++; h.points--; continue; }
    opts.sort((a, b) => (b.type === 'a') - (a.type === 'a') || b.tier - a.tier);
    const s = opts[0]; h.skills[s.id] = (h.skills[s.id] || 0) + 1; h.points--;
  }
  return h;
}
function gearFor(h, gold) {
  let g = gold; const slots = ['weapon', 'armor', 'amulet'];
  for (let t = 1; t <= D.GEAR_TIERS.length; t++) for (const s of slots) {
    const T = D.GEAR_TIERS[t - 1]; if (h.level >= T.lvl && g >= T.price) { g -= T.price; h.gear[s] = t; }
  }
}
module.exports = { autoHero, gearFor };
