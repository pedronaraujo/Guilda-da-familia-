// Gera a tabela de calibração da dificuldade (src/calibration.js): node test/calibrate.js
// Para cada tamanho de grupo (1 a 6) e estágio (1 a 40), monta grupos de referência no nível esperado
// do estágio e procura o multiplicador de inimigos em que eles vencem metade das vezes (sem a sorte do dia).
// O ajuste faz esse ponto cair sempre no mesmo lugar da régua (TARGET).
require('../src/data.js'); require('../src/engine.js');
const D = globalThis.DATA, E = globalThis.ENGINE; const { autoHero, gearFor } = require('./helpers.js');
const fs = require('fs');
const TARGET = 1.15; // régua 100% → chance ~70% para um grupo no nível esperado
// 6 grupos de referência que, juntos, usam todas as classes em todas as posições
const ALL = Object.keys(D.CLASSES);
const COMBOS = Array.from({ length: 6 }, (_, k) => Array.from({ length: 6 }, (_, i) => ALL[(k * 2 + i * 7) % ALL.length]));
const SEEDS = Array.from({ length: 16 }, (_, i) => 5000 + i * 104729);
const MAXST = 80;
const rate = (hs, st, m) => SEEDS.reduce((w, sd) => w + (E.simulate(hs, st, sd, false, m, null, { noLuck: true, noCal: true }).win ? 1 : 0), 0) / SEEDS.length;
function threshold(hs, st) {
  let lo = 0.2, hi = 6;
  for (let i = 0; i < 12; i++) { const mid = Math.sqrt(lo * hi); if (rate(hs, st, mid) >= 0.5) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}
const cumGold = (st) => { let g = 0; for (let s = 1; s < st; s++) g += E.goldReward(s); return g; };
const CAL = {};
const t0 = Date.now();
for (let n = 1; n <= 6; n++) {
  CAL[n] = [];
  for (let st = 1; st <= MAXST; st++) {
    const L = Math.max(1, Math.round(E.stageLevel(st)));
    let lsum = 0;
    for (const combo of COMBOS) {
      const hs = combo.slice(0, n).map((c, i) => { const h = autoHero(c, L, i); gearFor(h, cumGold(st) * 0.5); return h; });
      lsum += Math.log(threshold(hs, st));
    }
    CAL[n].push(Math.exp(lsum / COMBOS.length) / TARGET);
  }
  // suaviza a curva por estágio (média móvel de 3)
  const raw = CAL[n].slice(); CAL[n] = raw.map((v, i) => { const a = raw.slice(Math.max(0, i - 1), i + 2); return Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length); });
  CAL[n] = CAL[n].map((v) => Math.round(v * 1000) / 1000);
  console.log('n' + n, CAL[n].join(' '), `(${Math.round((Date.now() - t0) / 1000)}s)`);
}
fs.writeFileSync(__dirname + '/../src/calibration.js', `/* Gerado por test/calibrate.js — não edite à mão. Ajuste de força dos inimigos por tamanho do grupo (1-6) e estágio (1-80). */\n(function (G) { G.ENGINE.setCal(${JSON.stringify(CAL)}); })(typeof window !== 'undefined' ? window : globalThis);\n`);
console.log('ok');
