// Auditoria de dados e motor: node test/audit_engine.js
require('../src/data.js'); require('../src/engine.js'); require('../src/avatar.js');
const D = globalThis.DATA, E = globalThis.ENGINE, A = globalThis.ART;
const out = []; const fail = [];
const ok = (c, msg) => { (c ? out : fail).push((c ? 'OK   ' : 'FALHA ') + msg); };

// Classes e árvores
const want = ['Mago de Gelo', 'Mago de Fogo', 'Arqueiro', 'Paladino', 'Guerreiro', 'Druida da Natureza', 'Curandeiro', 'Ladino'];
const names = Object.values(D.CLASSES).map((c) => c.name);
ok(want.every((n) => names.includes(n)), `8 classes pedidas presentes: ${names.join(', ')}`);
for (const c of Object.values(D.CLASSES)) {
  const ids = new Set(c.skills.map((s) => s.id));
  const badReq = c.skills.filter((s) => (s.req || []).concat(s.reqAny || []).some((r) => !ids.has(r)));
  ok(!badReq.length, `${c.name}: pré-requisitos apontam para habilidades existentes`);
  const withReq = c.skills.filter((s) => (s.req && s.req.length) || (s.reqAny && s.reqAny.length));
  const withLvl = c.skills.filter((s) => s.minLevel > 1);
  ok(withReq.length >= 3 && withLvl.length >= 3, `${c.name}: ${c.skills.length} habilidades, ${withReq.length} com pré-requisito, ${withLvl.length} com nível mínimo`);
  // árvore inteira alcançável: aprender em ordem até nível 30
  const h = { cls: c.id, level: 60, points: 999, skills: {} };
  let changed = true; while (changed) { changed = false; for (const s of c.skills) if (E.canLearn(h, s).ok) { h.skills[s.id] = (h.skills[s.id] || 0) + 1; changed = true; } }
  ok(c.skills.every((s) => h.skills[s.id]), `${c.name}: todas as habilidades alcançáveis`);
  // pré-requisito bloqueia
  const top = c.skills.find((s) => s.req && s.req.length);
  if (top) ok(!E.canLearn({ cls: c.id, level: 30, points: 5, skills: {} }, top).ok, `${c.name}: "${top.name}" bloqueada sem pré-requisito`);
  const lv = c.skills.find((s) => s.minLevel > 1 && !(s.req && s.req.length) && !(s.reqAny && s.reqAny.length));
  if (lv) ok(!E.canLearn({ cls: c.id, level: lv.minLevel - 1, points: 5, skills: {} }, lv).ok, `${c.name}: "${lv.name}" bloqueada abaixo do nível ${lv.minLevel}`);
}

// Ancestralidades
const ancNames = Object.values(D.ANCESTRIES).map((a) => a.name);
const dh = ['Clank', 'Drakona', 'Anão', 'Elfo', 'Fada', 'Fauno', 'Firbolg', 'Fungril', 'Galapa', 'Gigante', 'Goblin', 'Halfling', 'Humano', 'Infernis', 'Katari', 'Orc', 'Ribbet', 'Simiah'];
ok(dh.every((n) => ancNames.includes(n)) && ancNames.includes('Troll'), `18 ancestralidades de Daggerheart + Troll (${ancNames.length})`);
const look = { gender: 'm', face: 'alegre', hairStyle: 'curto', hairColor: '#6b4226', outfit: 'tunica', outfitColor: '#3d5a99' };
const svgs = Object.values(D.ANCESTRIES).map((a) => A.heroSvg({ cls: 'guerreiro', look: Object.assign({ anc: a.id, skin: a.skins[0] }, look), cosmetics: {} }).replace(/av\d+g/g, 'X'));
ok(new Set(svgs).size === svgs.length, 'cada ancestralidade gera um desenho diferente (mesma roupa/cabelo/pele de índice 0)');
// troca de pele que não existe na ancestralidade
let svgErr = 0; for (const a of Object.values(D.ANCESTRIES)) for (const o of D.LOOK.outfit) for (const hs of D.LOOK.hairStyle) for (const g of ['m', 'f']) { try { const s = A.heroSvg({ cls: 'paladino', look: { anc: a.id, skin: a.skins[0], gender: g, face: 'sabio', hairStyle: hs.id, hairColor: '#222222', outfit: o.id, outfitColor: '#aa3333' }, cosmetics: { hat: 'hat_wizard', cape: 'cape_red', pet: 'pet_cat' } }); if (/undefined|NaN/.test(s)) svgErr++; } catch (e) { svgErr++; } }
ok(!svgErr, `desenho sem "undefined"/"NaN" em todas as combinações (ancestralidade × roupa × cabelo × gênero): ${svgErr} problemas`);

// Opções de visual
for (const k of ['gender', 'skin', 'face', 'hairStyle', 'hairColor', 'outfit', 'outfitColor']) ok(D.LOOK[k] && D.LOOK[k].length >= 2, `visual: opções de ${k} = ${D.LOOK[k] && D.LOOK[k].length}`);

// Dificuldades e bônus
ok(['mf', 'f', 'm', 'd'].every((k) => D.DIFF[k]) && D.DIFF.mf.xp < D.DIFF.f.xp && D.DIFF.f.xp < D.DIFF.m.xp && D.DIFF.m.xp < D.DIFF.d.xp, `4 dificuldades crescentes: ${Object.values(D.DIFF).map((d) => d.name + ' ' + d.xp).join(', ')}`);
ok(D.CARRY_BONUS > 0, `bônus de tarefa acumulada: +${D.CARRY_BONUS * 100}%`);
ok(D.MAX_HEROES === 5, 'grupo de 5 heróis');

// Inimigos
ok(D.SPECIES.length === 50, `50 espécies de inimigo (${D.SPECIES.length})`);
ok(new Set(D.SPECIES.map((s) => s.name)).size === 50, 'nomes de espécies únicos');
ok(D.REGIONS.length === 8, `8 cenários (${D.REGIONS.map((r) => r.name).join(', ')})`);
const scenes = new Set(); for (let i = 0; i < 8; i++) scenes.add(A.sceneSvg(i)); ok(scenes.size === 8, '8 desenhos de cenário diferentes');
const shapes = new Set(); for (const s of D.SPECIES) { const svg = A.enemySvg(Object.assign({ color: s.color }, s)); shapes.add(svg); if (svg.length < 200) fail.push('FALHA desenho vazio para ' + s.name); }
ok(shapes.size === 50, `50 desenhos de inimigos distintos (${shapes.size})`);
// evolução procedural
const seenNames = new Set(); let packs = 0, groups = 0, tierNames = 0, colorChanges = 0;
for (let st = 1; st <= 120; st++) {
  const foes = E.buildEnemies(st, 4, 1);
  if (foes.length > 1) groups++;
  for (const f of foes) { seenNames.add(f.name); if (f.count > 1 || f.memberHp) packs++; if (f.tier) { tierNames++; const sp = D.SPECIES_MAP[f.sid]; if (sp && f.color !== sp.color) colorChanges++; } }
}
ok(groups > 30, `estágios com grupo de inimigos (1–120): ${groups}`);
ok(packs > 20, `matilhas (ex.: 2 lobos) em 1–120: ${packs}`);
ok(tierNames > 40 && colorChanges > 30, `versões mais fortes com nome e cor novos: ${tierNames} (cor diferente em ${colorChanges})`);
ok(seenNames.size > 100, `nomes de inimigos diferentes até o estágio 120: ${seenNames.size}`);
const sample = [1, 2, 5, 6, 10, 15, 25, 41, 45, 60, 85, 121].map((s) => `${s}: ${E.buildEnemies(s, 4, 1).map((f) => f.name + (f.count > 1 ? ' x' + f.count : '')).join(' + ')}`);
out.push('     amostra → ' + sample.join(' | '));
// sem nomes com "undefined"
let badName = 0; for (let st = 1; st <= 300; st++) for (const f of E.buildEnemies(st, 3, 1.2)) if (/undefined|null|NaN/.test(f.name)) badName++;
ok(!badName, 'nenhum nome de inimigo quebrado até o estágio 300');

// Batalha: determinismo e dificuldade
const party = (lvl, n) => Object.keys(D.CLASSES).slice(0, n).map((c, i) => ({ id: 'h' + i, name: 'H' + i, cls: c, level: lvl, skills: {}, gear: {}, look: { anc: 'humano' } }));
const r1 = E.simulate(party(3, 4), 4, 123, true, 1), r2 = E.simulate(party(3, 4), 4, 123, true, 1);
ok(JSON.stringify(r1.log) === JSON.stringify(r2.log), 'mesma semente = mesma batalha (replay fiel)');
const wc = (mul) => E.winChance(party(1, 5), 1, 200, mul);
const easy = wc(0.6), norm = wc(1), hard = wc(1.8);
ok(easy >= norm && norm >= hard, `slider de dificuldade muda a chance no estágio 1 com 5 heróis nível 1: fácil ${Math.round(easy * 100)}% · normal ${Math.round(norm * 100)}% · máximo ${Math.round(hard * 100)}%`);
ok(norm < 0.95 && norm > 0.2, 'primeira batalha não é trivial nem impossível (Normal)');
const solo = E.winChance(party(1, 1), 1, 200, 1);
out.push(`     herói sozinho nível 1 no estágio 1 (Normal): ${Math.round(solo * 100)}%`);
// ouro
ok(E.goldReward(5) > E.goldReward(4) * 2, `ouro de chefe (estágio 5) maior: ${E.goldReward(4)} → ${E.goldReward(5)}`);
// buff de aniversário
const base = E.heroStats({ cls: 'guerreiro', level: 3, skills: {}, gear: {}, look: { anc: 'humano' } });
const bd = E.heroStats({ cls: 'guerreiro', level: 3, skills: {}, gear: {}, look: { anc: 'humano' }, bday: true });
ok(bd.atk > base.atk && bd.maxHp > base.maxHp, `bênção de aniversário aumenta poder (${base.atk.toFixed(1)}→${bd.atk.toFixed(1)}) e vida (${base.maxHp}→${bd.maxHp})`);
// mascotes
ok(Object.keys(D.PET_BONUS).length === D.COSMETICS.filter((c) => c.slot === 'pet').length, `todo mascote tem bônus de combate (${Object.keys(D.PET_BONUS).length})`);
// eventos
ok(D.EVENTS.length === 20, `20 eventos de fim de semana (${D.EVENTS.length})`);
ok(new Set(D.EVENTS.map((e) => e.name)).size === 20, 'nomes de eventos únicos');
const kinds = {}; D.EVENTS.forEach((e) => { kinds[e.kind || e.type || '?'] = (kinds[e.kind || e.type || '?'] || 0) + 1; }); out.push('     tipos de evento: ' + JSON.stringify(kinds));
ok(D.ACH.length >= 20, `conquistas: ${D.ACH.length}`);

console.log(out.join('\n')); console.log(fail.length ? '\n' + fail.join('\n') : '\nSem falhas.');
