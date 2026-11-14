/* ===== Arte em SVG: heróis, inimigos, mascotes ===== */
(function (G) {
  const D = G.DATA;
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return '#' + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
  }
  let uid = 0;

  // paleta padrão de cada arma; as variações da loja (D.WEAPON_SKINS) trocam essas cores e somam efeitos
  const WDEF = {
    staffIce: { wood: '#8a6a4a', metal: '#bfeeff', metalDk: '#5fb8de', gem: '#8fd8f5', accent: '#bfeeff' },
    staffFire: { wood: '#5a3a2a', metal: '#ff8a4c', metalDk: '#c8412f', gem: '#ffd36b', accent: '#ff8a4c' },
    bow: { wood: '#8a5a2a', metal: '#e8e0c8', metalDk: '#6a4a22', gem: '#e8e0c8', accent: '#c8a060' },
    hammer: { wood: '#7a5a3a', metal: '#d8d2c0', metalDk: '#a89a6a', gem: '#f4d675', accent: '#f4d675' },
    sword: { wood: '#5a3a2a', metal: '#dfe6ee', metalDk: '#9aa6b4', gem: '#b08a3a', accent: '#b08a3a' },
    branch: { wood: '#6a4a2a', metal: '#63c784', metalDk: '#4aa66a', gem: '#ffe48a', accent: '#63c784' },
    scepter: { wood: '#d6b85a', metal: '#d6b85a', metalDk: '#a8862a', gem: '#fff6c8', accent: '#fff6c8' },
    daggers: { wood: '#3a2a2a', metal: '#dfe6ee', metalDk: '#9aa6b4', gem: '#6a4a8a', accent: '#6a4a8a' },
    witchStaff: { wood: '#4a3346', metal: '#d36bc6', metalDk: '#8a3a80', gem: '#e9a8ff', accent: '#7bd36b' },
    lute: { wood: '#5a3a22', metal: '#c8843a', metalDk: '#7a4a22', gem: '#f4d675', accent: '#f0e6d0' },
    totem: { wood: '#8a6a4a', metal: '#4fc1c1', metalDk: '#2a7a7a', gem: '#7adfff', accent: '#e0665f' },
    bo: { wood: '#a07848', metal: '#c8413f', metalDk: '#8a2a28', gem: '#f4d675', accent: '#c8413f' },
    wrench: { wood: '#6a4a2a', metal: '#b8c0c8', metalDk: '#6a747e', gem: '#7adfff', accent: '#c9a36b' },
    shieldSpear: { wood: '#7a5a3a', metal: '#c8d0d8', metalDk: '#6a747e', gem: '#6fa3d8', accent: '#f4d675' },
    wand: { wood: '#f4e8f4', metal: '#ffe48a', metalDk: '#d8a838', gem: '#ff8fc8', accent: '#ff8fc8' },
  };
  // ponta de cada arma (onde ficam o brilho e os efeitos)
  const WTIP = { staffIce: [92, 56], staffFire: [92, 50], bow: [96, 98], hammer: [92, 64], sword: [74, 52], branch: [92, 54], scepter: [92, 64], daggers: [100, 90], witchStaff: [96, 52], lute: [95, 90], totem: [92, 52], bo: [112, 44], wrench: [104, 56], wand: [99, 65], shieldSpear: [92, 40] };
  function weaponSvg(kind, color, skinId) {
    const sk = skinId && D.WEAPON_SKINS ? D.WEAPON_SKINS.find((x) => x.id === skinId) : null;
    const P = Object.assign({}, WDEF[kind] || WDEF.sword, sk ? sk.pal : {});
    let w = '';
    switch (kind) {
      case 'staffIce': w = `<g transform="translate(92 60)"><rect x="-2" y="0" width="4" height="78" rx="2" fill="${P.wood}"/><path d="M0 -14 L7 -2 L0 6 L-7 -2Z" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1.5"/><circle cx="0" cy="-3" r="12" fill="${P.gem}" opacity=".25"/></g>`; break;
      case 'staffFire': w = `<g transform="translate(92 60)"><rect x="-2" y="0" width="4" height="78" rx="2" fill="${P.wood}"/><path d="M0 -18 C8 -8 8 2 0 6 C-8 2 -8 -8 0 -18Z" fill="${P.metal}"/><path d="M0 -10 C4 -4 4 1 0 4 C-4 1 -4 -4 0 -10Z" fill="${P.gem}"/></g>`; break;
      case 'bow': w = `<g transform="translate(90 98)"><path d="M0 -34 Q18 0 0 34" fill="none" stroke="${P.wood}" stroke-width="4" stroke-linecap="round"/><line x1="0" y1="-34" x2="0" y2="34" stroke="${P.metal}" stroke-width="1"/><circle cx="7" cy="0" r="2.4" fill="${P.accent}"/></g>`; break;
      case 'hammer': w = `<g transform="translate(92 70) rotate(12)"><rect x="-2" y="0" width="4" height="50" rx="2" fill="${P.wood}"/><rect x="-12" y="-12" width="24" height="15" rx="3" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1.5"/><rect x="-3" y="-11" width="6" height="13" fill="${P.gem}"/></g>`; break;
      case 'sword': w = `<g transform="translate(92 104) rotate(-20)"><rect x="-2.5" y="-52" width="5" height="46" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1"/><path d="M-2.5 -52 L0 -58 L2.5 -52Z" fill="${P.metal}"/><rect x="-9" y="-7" width="18" height="4" rx="2" fill="${P.gem}"/><rect x="-2" y="-3" width="4" height="10" fill="${P.wood}"/></g>`; break;
      case 'branch': w = `<g transform="translate(92 58)"><path d="M0 0 L-1 80" stroke="${P.wood}" stroke-width="5" stroke-linecap="round"/><path d="M0 4 C-10 -4 -10 -14 -2 -16 C4 -14 6 -6 0 4Z" fill="${P.metal}"/><path d="M1 10 C12 4 14 -6 8 -8 C2 -6 -2 2 1 10Z" fill="${P.metalDk}"/></g>`; break;
      case 'scepter': w = `<g transform="translate(92 70)"><rect x="-2" y="0" width="4" height="60" rx="2" fill="${P.wood}"/><circle cx="0" cy="-6" r="8" fill="none" stroke="${P.metal}" stroke-width="3"/><circle cx="0" cy="-6" r="4" fill="${P.gem}"/><circle cx="0" cy="-6" r="13" fill="${P.gem}" opacity=".25"/></g>`; break;
      case 'daggers': { const d = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-2 0 L0 -22 L2 0Z" fill="${P.metal}" stroke="${P.metalDk}" stroke-width=".8"/><rect x="-5" y="0" width="10" height="3" fill="${P.gem}"/><rect x="-1.5" y="3" width="3" height="7" fill="${P.wood}"/></g>`; w = `<g>${d(91, 106, -30)}${d(29, 106, 30)}</g>`; break; }
      case 'witchStaff': w = `<g transform="translate(92 60)"><path d="M0 80 C-2 60 3 40 -1 20 C-3 8 2 0 6 -6" stroke="${P.wood}" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M6 -6 C14 -10 14 -20 6 -22 C10 -16 6 -12 2 -12Z" fill="${P.wood}"/><circle cx="4" cy="-8" r="6" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1.5"/><circle cx="2.5" cy="-9.5" r="1.8" fill="#fff" opacity=".7"/><circle cx="4" cy="-8" r="11" fill="${P.gem}" opacity=".25"/><path d="M-2 18 l-6 4 M-1 30 l6 3" stroke="${P.accent}" stroke-width="2" stroke-linecap="round"/></g>`; break;
      case 'lute': w = `<g transform="translate(94 92) rotate(28)"><rect x="-2.2" y="-38" width="4.4" height="30" rx="1.5" fill="${P.wood}"/><path d="M-4 -44 h8 l-1 7 h-6Z" fill="${P.metalDk}"/><ellipse cx="0" cy="0" rx="12" ry="15" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1.5"/><circle cx="0" cy="-3" r="3.6" fill="${P.metalDk}"/><path d="M-1 -38 V8 M1 -38 V8" stroke="${P.accent}" stroke-width=".7"/><rect x="-5" y="7" width="10" height="2.4" rx="1" fill="${P.wood}"/><circle cx="0" cy="-3" r="1.2" fill="${P.gem}"/></g>`; break;
      case 'totem': w = `<g transform="translate(92 58)"><rect x="-2.5" y="8" width="5" height="72" rx="2" fill="${P.wood}"/><rect x="-7" y="-14" width="14" height="22" rx="3" fill="${P.wood}" stroke="${shade(P.wood, -0.35)}" stroke-width="1.2"/><circle cx="-3" cy="-7" r="1.6" fill="${P.gem}"/><circle cx="3" cy="-7" r="1.6" fill="${P.gem}"/><path d="M-3 0 h6" stroke="${shade(P.wood, -0.45)}" stroke-width="1.6"/><path d="M-7 -12 C-14 -14 -16 -6 -12 -2 M7 -12 C14 -14 16 -6 12 -2" stroke="${P.metal}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M-2 14 C-10 18 -10 26 -6 30" stroke="${P.accent}" stroke-width="2.2" fill="none"/><path d="M-6 30 l-3 6 4 -1Z" fill="${P.accent}"/><circle cx="0" cy="-4" r="13" fill="${P.gem}" opacity=".2"/></g>`; break;
      case 'bo': w = `<g transform="translate(88 92) rotate(28)"><rect x="-2.6" y="-62" width="5.2" height="104" rx="2.6" fill="${P.wood}"/><rect x="-3" y="-60" width="6" height="7" rx="2" fill="${P.metal}"/><rect x="-3" y="33" width="6" height="7" rx="2" fill="${P.metal}"/><path d="M-3 -6 h6 M-3 -2 h6 M-3 2 h6" stroke="${P.metalDk}" stroke-width="1.4"/></g>`; break;
      case 'wrench': w = `<g transform="translate(92 92) rotate(18)"><rect x="-2.6" y="-26" width="5.2" height="44" rx="2" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1"/><path d="M-8 -26 C-10 -34 -6 -40 0 -40 C6 -40 10 -34 8 -26 L4 -26 L4 -33 L-4 -33 L-4 -26Z" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1.2"/><circle cx="0" cy="10" r="2" fill="${P.metalDk}"/><g transform="translate(9 -12)"><circle r="5" fill="${P.accent}"/><circle r="2" fill="${shade(P.accent, -0.4)}"/><path d="M0 -7 V7 M-7 0 H7 M-5 -5 L5 5 M-5 5 L5 -5" stroke="${P.accent}" stroke-width="2.2"/></g><path d="M-6 -44 l3 3 -2 1 3 3" stroke="${P.gem}" stroke-width="1.4" fill="none"/></g>`; break;
      case 'shieldSpear': w = `<g transform="translate(92 56)"><rect x="-2" y="0" width="4" height="84" rx="2" fill="${P.wood}"/><path d="M0 -24 L6 -6 L2 0 L-2 0 L-6 -6Z" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1.2"/><path d="M-5 0 h10 v3 h-10Z" fill="${P.accent}"/></g><g transform="translate(29 104)"><path d="M-14 -20 Q0 -26 14 -20 L13 8 Q8 20 0 25 Q-8 20 -13 8Z" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="2"/><path d="M-10 -16 Q0 -21 10 -16 L9.5 6 Q6 15 0 19 Q-6 15 -9.5 6Z" fill="${P.gem}"/><path d="M0 -16 V18 M-9.5 -2 H9.5" stroke="${P.accent}" stroke-width="2.6"/><circle cx="0" cy="-2" r="3.2" fill="${P.accent}" stroke="${P.metalDk}" stroke-width=".8"/></g>`; break;
      case 'wand': w = `<g transform="translate(92 92) rotate(14)"><rect x="-1.6" y="-24" width="3.2" height="32" rx="1.5" fill="${P.wood}" stroke="${shade(P.wood, -0.25)}" stroke-width=".8"/><path d="M0 -40 L3.5 -31 L13 -31 L5.5 -25.5 L8.5 -16 L0 -21.5 L-8.5 -16 L-5.5 -25.5 L-13 -31 L-3.5 -31Z" fill="${P.metal}" stroke="${P.metalDk}" stroke-width="1"/><circle cx="0" cy="-27" r="2.4" fill="${P.gem}"/><path d="M-1.5 -8 C-6 -6 -8 -1 -5 2 M1.5 -8 C6 -6 8 -1 5 2" stroke="${P.accent}" stroke-width="1.6" fill="none"/><circle cx="0" cy="-27" r="15" fill="${P.gem}" opacity=".2"/></g>`; break;
    }
    if (sk) {
      const [tx, ty] = WTIP[kind] || [92, 60];
      if (sk.glow) w = `<circle cx="${tx}" cy="${ty}" r="15" fill="${sk.glow}" opacity=".32"/>` + w;
      if (sk.fx === 'flame') w += `<path d="M${tx - 5} ${ty - 6} q2 -8 5 -12 q3 4 4 10 q-4 -3 -5 2Z M${tx + 4} ${ty - 2} q1 -5 4 -8 q2 4 1 8Z" fill="#ffb84a" opacity=".85"/>`;
      if (sk.fx === 'leaves') w += `<path d="M${tx - 8} ${ty - 4} c-4 -6 2 -10 6 -6 c-2 2 -4 4 -6 6Z M${tx + 6} ${ty + 4} c6 -2 8 4 4 6 c-1 -2 -2 -4 -4 -6Z" fill="#7bd36b"/>`;
      if (sk.fx === 'sparks') w += `<path d="M${tx - 9} ${ty - 9} l3 4 -2 0 3 4 M${tx + 8} ${ty - 8} l-2 4 2 0 -2 4" stroke="#bff4ff" stroke-width="1.6" fill="none"/>`;
      if (sk.fx === 'stars') w += `<g fill="#fff6c8"><circle cx="${tx - 9}" cy="${ty - 8}" r="1.6"/><circle cx="${tx + 9}" cy="${ty - 4}" r="1.2"/><circle cx="${tx + 2}" cy="${ty - 13}" r="1.4"/></g>`;
      if (sk.fx === 'hearts') w += `<path d="M${tx - 9} ${ty - 10} c-2 -3 -6 0 0 4 c6 -4 2 -7 0 -4Z M${tx + 8} ${ty - 4} c-1.5 -2 -4.5 0 0 3 c4.5 -3 1.5 -5 0 -3Z" fill="#ff7aa8"/>`;
    }
    return w;
  }

  function hairBack(style, c, gender) {
    const d = shade(c, -0.25);
    switch (style) {
      case 'longo': return `<path d="M32 46 C30 80 34 100 40 104 L80 104 C86 100 90 80 88 46Z" fill="${d}"/>`;
      case 'rabo': return `<path d="M78 40 C98 44 100 70 92 92 C88 76 84 62 78 54Z" fill="${d}"/>`;
      case 'trancas': return `<g fill="${d}"><path d="M34 52 C30 70 32 90 36 100 L42 100 C40 86 40 70 40 54Z"/><path d="M86 52 C90 70 88 90 84 100 L78 100 C80 86 80 70 80 54Z"/><circle cx="39" cy="102" r="3" fill="${shade(c, 0.2)}"/><circle cx="81" cy="102" r="3" fill="${shade(c, 0.2)}"/></g>`;
      case 'cacheado': return `<g fill="${d}">${[[34, 40], [30, 56], [34, 72], [86, 40], [90, 56], [86, 72], [44, 26], [60, 20], [76, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11"/>`).join('')}</g>`;
      case 'coque': return `<circle cx="60" cy="18" r="11" fill="${d}"/>`;
    }
    return '';
  }
  function hairFront(style, c) {
    const l = shade(c, 0.15);
    switch (style) {
      case 'curto': return `<path d="M35 48 C34 28 46 22 60 22 C76 22 86 30 85 48 C80 38 72 34 60 35 C50 35 40 38 35 48Z" fill="${c}"/><path d="M50 26 C56 24 64 24 70 27" stroke="${l}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      case 'espetado': return `<path d="M34 50 L32 34 L40 38 L40 22 L50 30 L56 16 L62 28 L72 16 L74 30 L84 24 L82 38 L88 36 L86 50 C78 38 70 35 60 35 C50 35 42 38 34 50Z" fill="${c}"/>`;
      case 'longo': return `<path d="M34 60 C30 30 44 22 60 22 C78 22 90 30 86 60 C84 46 80 38 70 34 C64 40 52 40 44 36 C38 42 36 50 34 60Z" fill="${c}"/>`;
      case 'rabo': return `<path d="M35 48 C34 28 46 22 60 22 C76 22 86 30 85 48 C82 40 74 34 62 36 C52 36 42 40 35 48Z" fill="${c}"/><circle cx="80" cy="42" r="3" fill="${shade(c, 0.35)}"/>`;
      case 'coque': return `<path d="M35 50 C34 28 46 24 60 24 C76 24 86 30 85 50 C82 40 74 34 60 34 C48 34 40 40 35 50Z" fill="${c}"/>`;
      case 'trancas': return `<path d="M35 52 C34 28 46 22 60 22 C76 22 86 30 85 52 C82 40 72 34 60 34 C48 34 38 40 35 52Z" fill="${c}"/><path d="M60 22 L60 34" stroke="${shade(c, -0.3)}" stroke-width="1.5"/>`;
      case 'cacheado': return `<g fill="${c}">${[[40, 36], [50, 28], [62, 26], [74, 30], [82, 40], [36, 48], [86, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</g>`;
      case 'moicano': return `<path d="M52 36 C52 22 56 8 60 6 C64 8 68 22 68 36 C64 32 56 32 52 36Z" fill="${c}"/><path d="M38 46 C40 40 44 38 50 37 M82 46 C80 40 76 38 70 37" stroke="${shade(c, -0.1)}" stroke-width="2" opacity=".5" fill="none"/>`;
      case 'careca': return `<path d="M44 30 C50 27 56 26 62 27" stroke="#fff" stroke-width="2.5" opacity=".35" fill="none" stroke-linecap="round"/>`;
    }
    return '';
  }
  function faceSvg(face, gender, skin, hairC, o) {
    o = o || {};
    const E = o.eyes !== false, M = o.mouth !== false;
    const ink = '#2a1d1a';
    const e = (s) => (E ? s : ''), m = (s) => (M ? s : '');
    const lash = e(gender === 'f' ? `<path d="M44 52 l-3 -3 M76 52 l3 -3" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>` : '');
    const bo = o.rosy ? 0.5 : (gender === 'f' ? 0.35 : 0.18);
    const blush = o.noBlush ? '' : `<ellipse cx="44" cy="62" rx="${o.rosy ? 6 : 5}" ry="${o.rosy ? 3.6 : 3}" fill="#ff7a7a" opacity="${bo}"/><ellipse cx="76" cy="62" rx="${o.rosy ? 6 : 5}" ry="${o.rosy ? 3.6 : 3}" fill="#ff7a7a" opacity="${bo}"/>`;
    const eyes = (r) => e(`<ellipse cx="49" cy="54" rx="3.2" ry="${r}" fill="${o.eyeC || ink}"/><ellipse cx="71" cy="54" rx="3.2" ry="${r}" fill="${o.eyeC || ink}"/><circle cx="50.2" cy="52.6" r="1" fill="#fff"/><circle cx="72.2" cy="52.6" r="1" fill="#fff"/>`);
    switch (face) {
      case 'alegre': return `${blush}${eyes(4)}${lash}${e(`<path d="M45 47 q4 -3 8 0 M67 47 q4 -3 8 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}${m(`<path d="M53 63 q7 7 14 0" fill="#7a2a2a" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>`)}`;
      case 'firme': return `${blush}${eyes(3.6)}${lash}${e(`<path d="M44 47 l9 2 M76 47 l-9 2" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`)}${m(`<path d="M54 65 h12" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`)}`;
      case 'sereno': return `${blush}${e(`<path d="M45 54 q4 3 8 0 M67 54 q4 3 8 0" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`)}${lash}${e(`<path d="M45 47 q4 -2 8 0 M67 47 q4 -2 8 0" stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)}${m(`<path d="M55 64 q5 3 10 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}`;
      case 'travesso': return `${blush}${e(`<ellipse cx="49" cy="54" rx="3.2" ry="4" fill="${o.eyeC || ink}"/><path d="M67 54 q4 -3 8 0" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="50.2" cy="52.6" r="1" fill="#fff"/>`)}${lash}${e(`<path d="M45 46 q4 -3 8 1 M67 48 q4 -3 8 -2" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}${m(`<path d="M53 63 q8 5 14 -2" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M62 65 q2 4 4 0" fill="#e86a7a"/>`)}`;
      case 'sabio': return `${eyes(3.4)}${lash}${e(`<path d="M44 47 q5 -3 9 0 M67 47 q5 -3 9 0" stroke="${shade(hairC, -0.1)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`)}${o.noBeard ? '' : `<path d="M40 60 C42 80 52 86 60 86 C68 86 78 80 80 60 C74 66 66 64 60 66 C54 64 46 66 40 60Z" fill="${hairC}"/>`}${m(`<path d="M54 66 q6 3 12 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}`;
      case 'sardas': return `${blush}${eyes(4)}${lash}<g fill="${shade(skin, -0.35)}"><circle cx="42" cy="60" r=".9"/><circle cx="45" cy="62" r=".9"/><circle cx="41" cy="63" r=".9"/><circle cx="78" cy="60" r=".9"/><circle cx="75" cy="62" r=".9"/><circle cx="79" cy="63" r=".9"/></g>${e(`<path d="M45 47 q4 -2 8 0 M67 47 q4 -2 8 0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)}${m(`<path d="M54 63 q6 5 12 0" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`)}`;
    }
    return eyes(4);
  }
  // pés/pernas por ancestralidade: null (botas), 'bare' (pés grandes e peludos), 'goat' (pernas de bode com cascos)
  function feetSvg(feet, skin, hairC) {
    if (feet === 'bare') {
      const tuft = shade(hairC, -0.05);
      return `<ellipse cx="49" cy="139.5" rx="11" ry="5" fill="${skin}" stroke="${shade(skin, -0.25)}" stroke-width="1"/><ellipse cx="71" cy="139.5" rx="11" ry="5" fill="${skin}" stroke="${shade(skin, -0.25)}" stroke-width="1"/><path d="M44 136 l-2 -4 M48 135 l0 -4 M52 136 l2 -4 M68 136 l-2 -4 M72 135 l0 -4 M76 136 l2 -4" stroke="${tuft}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    if (feet === 'goat') return `<path d="M46 137 h11 l-1 6 h-9Z M63 137 h11 l-1 6 h-9Z" fill="#2a2020"/><path d="M51.5 138 v5 M68.5 138 v5" stroke="#5a4a40" stroke-width="1"/>`;
    return `<ellipse cx="51" cy="140" rx="8" ry="4" fill="#3a2a22"/><ellipse cx="69" cy="140" rx="8" ry="4" fill="#3a2a22"/>`;
  }
  function legsSvg(feet, c, skin, hairC) {
    if (feet === 'goat') {
      const fur = shade(hairC, -0.1), fd = shade(hairC, -0.35);
      return `<path d="M45 112 C43 120 49 124 50 128 L47 138 L56 138 L57 127 C59 120 59 116 59 112Z" fill="${fur}"/><path d="M75 112 C77 120 71 124 70 128 L73 138 L64 138 L63 127 C61 120 61 116 61 112Z" fill="${fur}"/><path d="M47 118 l3 2 M52 122 l2 2 M48 130 l3 1 M73 118 l-3 2 M68 122 l-2 2 M72 130 l-3 1" stroke="${fd}" stroke-width="1.4" stroke-linecap="round"/>` + feetSvg(feet, skin, hairC);
    }
    const h = feet === 'bare' ? 20 : 24;
    return `<rect x="47" y="114" width="10" height="${h}" rx="4" fill="${shade(c, -0.55)}"/><rect x="63" y="114" width="10" height="${h}" rx="4" fill="${shade(c, -0.55)}"/>` + feetSvg(feet, skin, hairC);
  }
  function outfitSvg(style, c, gender, skin, clsColor, feet, hairC) {
    const dk = shade(c, -0.3), lt = shade(c, 0.2);
    const legs = legsSvg(feet, c, skin, hairC || '#5a3a22');
    const waist = gender === 'f' ? 4 : 0;
    const torso = `M40 ${80} C40 74 48 72 60 72 C72 72 80 74 80 80 L${78 - waist} 100 L${80} 118 L40 118 L${42 + waist} 100Z`;
    const emblem = `<path d="M60 88 l4 5 -4 5 -4 -5Z" fill="${clsColor}" stroke="${dk}" stroke-width=".8"/>`;
    switch (style) {
      case 'tunica': return legs + `<path d="${torso}" fill="${c}"/><rect x="40" y="104" width="40" height="5" fill="${dk}"/><rect x="57" y="103" width="6" height="7" rx="1" fill="#d6b85a"/><path d="M52 72 L60 82 L68 72" fill="none" stroke="${lt}" stroke-width="2"/>${emblem}`;
      case 'manto': return `${feetSvg(feet, skin, hairC || '#5a3a22')}<path d="M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L88 138 L32 138Z" fill="${c}"/><path d="M60 74 L60 138" stroke="${dk}" stroke-width="2"/><path d="M32 138 L88 138" stroke="${lt}" stroke-width="3"/><path d="M48 72 L60 84 L72 72" fill="${dk}"/>${emblem}`;
      case 'armadura': return legs + `<path d="${torso}" fill="#b8c0c8"/><path d="${torso}" fill="${c}" opacity=".45"/><path d="M44 92 h32 M44 104 h32" stroke="${shade('#b8c0c8', -0.3)}" stroke-width="1.5"/><ellipse cx="40" cy="80" rx="9" ry="7" fill="#d0d6dc" stroke="${shade('#b8c0c8', -0.3)}"/><ellipse cx="80" cy="80" rx="9" ry="7" fill="#d0d6dc" stroke="${shade('#b8c0c8', -0.3)}"/>${emblem}`;
      case 'gibao': return legs + `<path d="${torso}" fill="${lt}"/><path d="M44 76 L52 74 L56 118 L41 118Z M76 76 L68 74 L64 118 L79 118Z" fill="${c}"/><rect x="40" y="102" width="40" height="6" fill="#5a3a22"/><rect x="56" y="101" width="8" height="8" rx="1" fill="none" stroke="#d6b85a" stroke-width="2"/><path d="M60 78 v20" stroke="${dk}" stroke-dasharray="2 3"/>`;
      case 'vestido': return legs + `<path d="M42 80 C42 74 50 72 60 72 C70 72 78 74 78 80 L${76 - waist} 98 L86 126 L34 126 L${44 + waist} 98Z" fill="${c}"/><path d="M34 126 Q60 132 86 126" stroke="${lt}" stroke-width="3" fill="none"/><rect x="${44 + waist}" y="96" width="${32 - waist * 2}" height="4" fill="${dk}"/>${emblem}`;
    }
    // ----- roupas temáticas -----
    const T = themedOutfit(style, c, gender, skin, clsColor, feet, hairC, torso, waist);
    if (T) return T;
    return legs + `<path d="${torso}" fill="${c}"/>`;
  }
  // pernas com cor e calçado escolhidos (respeita pés de hobbit/sátiro)
  function legsCol(feet, col, boot, skin, hairC, h) {
    if (feet === 'goat') return legsSvg(feet, col, skin, hairC);
    if (feet === 'bare') return `<rect x="47" y="114" width="10" height="20" rx="4" fill="${col}"/><rect x="63" y="114" width="10" height="20" rx="4" fill="${col}"/>` + feetSvg(feet, skin, hairC);
    h = h || 24;
    return `<rect x="47" y="114" width="10" height="${h}" rx="4" fill="${col}"/><rect x="63" y="114" width="10" height="${h}" rx="4" fill="${col}"/><ellipse cx="51" cy="140" rx="8" ry="4" fill="${boot}"/><ellipse cx="69" cy="140" rx="8" ry="4" fill="${boot}"/>`;
  }
  const isDark = (c) => { const n = parseInt(String(c).slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 70; };
  function themedOutfit(style, c, gender, skin, clsColor, feet, hairC, torso, waist) {
    const dk = shade(c, -0.3), lt = shade(c, 0.25);
    const long = (bottom) => `M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L${78 - waist} 100 L${82} ${bottom} L38 ${bottom} L${42 + waist} 100Z`;
    switch (style) {
      case 'natal': {
        const red = '#c8302c', fur = '#f6f2ee';
        return legsCol(feet, red, '#1c1414', skin, hairC) + `<path d="${long(120)}" fill="${red}"/><path d="M38 116 Q60 122 82 116 L82 122 Q60 128 38 122Z" fill="${fur}"/><rect x="56" y="74" width="8" height="44" fill="${fur}"/><rect x="40" y="99" width="40" height="7" fill="#1c1414"/><rect x="55" y="98" width="10" height="9" rx="1.5" fill="none" stroke="#f4c84a" stroke-width="2"/><path d="M48 74 Q60 80 72 74" stroke="${fur}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="60" cy="86" r="1.6" fill="#1c1414"/><circle cx="60" cy="92" r="1.6" fill="#1c1414"/>`;
      }
      case 'cyberpunk': {
        const neon = isDark(c) ? '#3af0ff' : shade(c, 0.15), base = '#1a1a24';
        return legsCol(feet, '#22222e', '#0e0e14', skin, hairC) + `<path d="M48 120 v14 M72 120 v14" stroke="${neon}" stroke-width="1.6" opacity=".9"/><path d="${torso}" fill="${base}"/><path d="M44 76 L52 72 L60 84 L68 72 L76 76 L74 82 L60 92 L46 82Z" fill="#2a2a3a"/><path d="M60 84 L66 118" stroke="${neon}" stroke-width="2"/><path d="M42 104 H78" stroke="${neon}" stroke-width="1.4" opacity=".8"/><path d="M44 90 l6 0 M70 96 l6 0 M44 112 l8 0" stroke="${neon}" stroke-width="1.6" stroke-linecap="round"/><rect x="66" y="86" width="9" height="5" rx="1" fill="${neon}" opacity=".85"/><circle cx="48" cy="98" r="1.3" fill="#ff3ab4"/>`;
      }
      case 'praia': {
        const shorts = isDark(c) ? '#3a6ab0' : shade(c, -0.4);
        const flowers = [[48, 84, '#fff6c8'], [66, 80, '#ffffff'], [56, 96, '#ffd84a'], [72, 98, '#fff6c8'], [46, 104, '#ffffff']].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${f}" opacity=".9"/><circle cx="${x}" cy="${y}" r="1.1" fill="#ff8a3a"/>`).join('');
        const legsBare = feet ? feetSvg(feet, skin, hairC) : `<rect x="47" y="118" width="10" height="20" rx="4" fill="${skin}"/><rect x="63" y="118" width="10" height="20" rx="4" fill="${skin}"/><ellipse cx="51" cy="140.5" rx="8" ry="3" fill="#ff8ab8"/><ellipse cx="69" cy="140.5" rx="8" ry="3" fill="#ff8ab8"/><path d="M48 138 l3 2.5 3 -2.5 M66 138 l3 2.5 3 -2.5" stroke="#ff5a8a" stroke-width="1.4" fill="none"/>`;
        return legsBare + `<path d="M42 104 h36 l2 20 h-17 l-3 -8 l-3 8 h-17Z" fill="${shorts}"/><path d="M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L78 108 L42 108Z" fill="${c}"/>${flowers}<path d="M52 72 L60 84 L68 72" fill="none" stroke="${lt}" stroke-width="2.2"/>`;
      }
      case 'pesada': {
        const m = '#9aa4ae', md = '#5e6872', ml = '#c8d0d8';
        return legsCol(feet, md, '#4a525a', skin, hairC) + `<ellipse cx="52" cy="124" rx="5" ry="4" fill="${ml}" stroke="${md}"/><ellipse cx="68" cy="124" rx="5" ry="4" fill="${ml}" stroke="${md}"/><path d="${torso}" fill="${m}" stroke="${md}" stroke-width="1.5"/><path d="M40 108 L46 122 L56 118 L60 124 L64 118 L74 122 L80 108Z" fill="${m}" stroke="${md}" stroke-width="1.2"/><rect x="55" y="80" width="10" height="40" fill="${c}"/><path d="M55 80 h10 M55 120 l5 4 5 -4" stroke="${shade(c, -0.35)}" stroke-width="1.2" fill="none"/><path d="M44 92 h11 M65 92 h11 M44 102 h11 M65 102 h11" stroke="${md}" stroke-width="1.5"/><ellipse cx="38" cy="80" rx="14" ry="10" fill="${ml}" stroke="${md}" stroke-width="1.5"/><ellipse cx="82" cy="80" rx="14" ry="10" fill="${ml}" stroke="${md}" stroke-width="1.5"/><path d="M27 82 Q38 88 49 82 M71 82 Q82 88 93 82" stroke="${md}" stroke-width="1.4" fill="none"/>${`<path d="M60 84 l3 4 -3 4 -3 -4Z" fill="${clsColor}"/>`}`;
      }
      case 'kimono': {
        const obi = isDark(c) ? '#d8a838' : shade(c, -0.45);
        return legsCol(feet, shade(c, -0.25), '#8a5a32', skin, hairC, 22) + `<path d="M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L80 130 L40 130Z" fill="${c}"/><path d="M48 72 L66 104 L80 80 L80 130 L62 130Z" fill="${dk}" opacity=".35"/><path d="M50 72 L64 100 M70 72 L58 92" stroke="#f6f2ee" stroke-width="3" stroke-linecap="round"/><rect x="40" y="96" width="40" height="11" fill="${obi}"/><path d="M40 101.5 h40" stroke="${shade(obi, 0.35)}" stroke-width="1.4"/><path d="M66 107 l6 10 -8 -3Z" fill="${obi}"/><g fill="${lt}" opacity=".6"><circle cx="46" cy="118" r="2.2"/><circle cx="72" cy="122" r="2.2"/><circle cx="52" cy="126" r="1.6"/></g>`;
      }
      case 'pirata': {
        const stripe = isDark(c) ? '#c8302c' : c;
        return legsCol(feet, '#4a3a2e', '#1c1414', skin, hairC) + `<path d="${torso}" fill="#f6f2ee"/><g stroke="${stripe}" stroke-width="3">${[80, 87, 94, 101, 108, 115].map((y) => `<path d="M42 ${y} H78"/>`).join('')}</g><path d="M40 80 C40 74 46 72 50 72 L54 118 L40 118Z M80 80 C80 74 74 72 70 72 L66 118 L80 118Z" fill="#3a2a1e"/><path d="M40 104 Q60 110 80 104 L80 110 Q60 116 40 110Z" fill="#c8302c"/><path d="M76 108 l6 12 -6 -2Z" fill="#a8241f"/><circle cx="52" cy="86" r="1.2" fill="#d6b85a"/><circle cx="52" cy="94" r="1.2" fill="#d6b85a"/>`;
      }
      case 'astronauta': {
        const w = '#eef0f4', wd = '#b8c0cc';
        return legsCol(feet, w, '#8a94a4', skin, hairC) + `<path d="M46 124 h10 M64 124 h10" stroke="${wd}" stroke-width="2"/><path d="${torso}" fill="${w}" stroke="${wd}" stroke-width="1.4"/><rect x="48" y="84" width="24" height="14" rx="2" fill="#4a5262"/><circle cx="53" cy="91" r="2" fill="${c}"/><circle cx="60" cy="91" r="2" fill="#ffd84a"/><circle cx="67" cy="91" r="2" fill="#3af07a"/><rect x="40" y="104" width="40" height="6" fill="${wd}"/><path d="M42 78 H78" stroke="${c}" stroke-width="3"/><rect x="68" y="76" width="8" height="5" fill="#2a4a9a"/><path d="M68 77.6 h8 M68 79.4 h8" stroke="#fff" stroke-width=".7"/>`;
      }
      case 'ninja': {
        const base = '#22222c', band = isDark(c) ? '#c8302c' : c;
        return legsCol(feet, '#1a1a22', '#101016', skin, hairC) + `<path d="M48 120 l8 4 M48 126 l8 4 M64 120 l8 4 M64 126 l8 4" stroke="#3a3a48" stroke-width="1.6"/><path d="${torso}" fill="${base}"/><path d="M48 72 L60 90 L72 72" fill="none" stroke="#3a3a48" stroke-width="3"/><path d="M50 72 L64 96" stroke="#3a3a48" stroke-width="2"/><rect x="40" y="100" width="40" height="7" fill="${band}"/><path d="M42 107 l-4 10 6 -4Z" fill="${band}"/>`;
      }
      case 'caipira': {
        const jeans = '#3a5a8a';
        const plaid = `<g stroke="${dk}" stroke-width="2.2" opacity=".75">${[78, 86, 94, 102].map((y) => `<path d="M40 ${y} H80"/>`).join('')}${[46, 54, 62, 70, 78].map((x) => `<path d="M${x} 72 V112"/>`).join('')}</g><g stroke="#f6f2ee" stroke-width=".9" opacity=".6">${[82, 90, 98].map((y) => `<path d="M40 ${y} H80"/>`).join('')}${[50, 58, 66, 74].map((x) => `<path d="M${x} 72 V112"/>`).join('')}</g>`;
        return legsCol(feet, jeans, '#5a3a22', skin, hairC) + `<rect x="48" y="122" width="7" height="7" fill="#e8c870" transform="rotate(-8 51 125)"/><rect x="65" y="118" width="7" height="6" fill="#c8302c" transform="rotate(10 68 121)"/><path d="M41 108 h38 v10 h-38Z" fill="${jeans}"/><defs><clipPath id="cp${style}"><path d="M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L79 110 L41 110Z"/></clipPath></defs><path d="M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L79 110 L41 110Z" fill="${c}"/><g clip-path="url(#cp${style})">${plaid}</g><path d="M52 72 L60 80 L68 72" fill="#f6f2ee"/><circle cx="60" cy="88" r="1.2" fill="#f6f2ee"/><circle cx="60" cy="96" r="1.2" fill="#f6f2ee"/><rect x="41" y="106" width="38" height="4" fill="#5a3a22"/>`;
      }
      case 'pijama': {
        const dots = [[46, 84], [70, 82], [58, 96], [48, 108], [72, 106], [52, 126], [68, 130]].map(([x, y], i) => i % 2 ? `<path d="M${x} ${y - 3} l1 2.2 2.4 .3 -1.8 1.6 .5 2.4 -2.1 -1.2 -2.1 1.2 .5 -2.4 -1.8 -1.6 2.4 -.3Z" fill="#fff6c8"/>` : `<path d="M${x + 2} ${y - 3} a3.2 3.2 0 1 0 0 6 a2.4 2.4 0 1 1 0 -6Z" fill="#fff6c8"/>`).join('');
        return `<rect x="46" y="114" width="12" height="24" rx="4" fill="${c}"/><rect x="62" y="114" width="12" height="24" rx="4" fill="${c}"/>${feet ? feetSvg(feet, skin, hairC) : `<ellipse cx="51" cy="140" rx="9" ry="5" fill="#f6c8d8"/><ellipse cx="69" cy="140" rx="9" ry="5" fill="#f6c8d8"/><circle cx="46" cy="136" r="2.4" fill="#f6c8d8"/><circle cx="74" cy="136" r="2.4" fill="#f6c8d8"/>`}<path d="${torso}" fill="${c}"/><path d="M50 72 L60 82 L70 72" fill="${lt}"/><path d="M60 82 V118" stroke="${dk}" stroke-width="1.4"/><circle cx="62.5" cy="90" r="1.3" fill="${lt}"/><circle cx="62.5" cy="100" r="1.3" fill="${lt}"/><circle cx="62.5" cy="110" r="1.3" fill="${lt}"/>${dots}`;
      }
      case 'heroi': {
        const boot = '#c8302c', gold = '#f4c84a';
        return legsCol(feet, c, boot, skin, hairC) + `<rect x="46" y="128" width="12" height="10" rx="3" fill="${boot}"/><rect x="62" y="128" width="12" height="10" rx="3" fill="${boot}"/><path d="${torso}" fill="${c}"/><path d="M46 80 L74 80 L60 98Z" fill="${gold}" stroke="${shade(gold, -0.3)}" stroke-width="1.2"/><path d="M57 84 L63 84 L60 90Z" fill="${c}"/><rect x="40" y="104" width="40" height="5" fill="${gold}"/><rect x="56" y="103" width="8" height="7" rx="2" fill="${boot}"/><path d="M44 112 L60 116 L76 112 L76 118 L44 118Z" fill="${dk}"/>`;
      }
      case 'gala': {
        const tie = c;
        return legsCol(feet, '#16161c', '#0a0a0e', skin, hairC) + `<path d="M40 80 C40 74 48 72 60 72 C72 72 80 74 80 80 L${78 - waist} 100 L82 120 L38 120 L${42 + waist} 100Z" fill="#1c1c24"/><path d="M52 72 L60 100 L68 72Z" fill="#f6f2ee"/><path d="M52 72 L60 100 L56 104 L46 78Z M68 72 L60 100 L64 104 L74 78Z" fill="#2a2a36"/><path d="M54 77 L60 80 L66 77 L66 83 L60 80 L54 83Z" fill="${tie}"/><circle cx="60" cy="88" r="1" fill="#1c1c24"/><circle cx="60" cy="94" r="1" fill="#1c1c24"/><path d="M70 86 l5 -1 0 3 -5 1Z" fill="#f6f2ee"/>`;
      }
      case 'explorador': {
        const khaki = '#c8b07a', kd = '#9a8452';
        return legsCol(feet, kd, '#5a3a22', skin, hairC) + `<path d="${torso}" fill="${khaki}"/><rect x="44" y="82" width="11" height="10" rx="1.5" fill="${kd}"/><rect x="65" y="82" width="11" height="10" rx="1.5" fill="${kd}"/><path d="M44 85 h11 M65 85 h11" stroke="${shade(kd, -0.3)}" stroke-width="1"/><path d="M52 72 L60 80 L68 72" fill="${kd}"/><rect x="40" y="104" width="40" height="6" fill="#5a3a22"/><rect x="56" y="103" width="8" height="8" rx="1" fill="none" stroke="#d6b85a" stroke-width="1.8"/><path d="M44 76 L76 110" stroke="${c}" stroke-width="3"/><circle cx="73" cy="106" r="4" fill="#8a949e" stroke="#5a646e"/>`;
      }
      case 'viking': {
        const fur = '#8a6a44', fd = '#5a4228';
        return legsCol(feet, '#5a4a3a', '#3a2a1e', skin, hairC) + `<path d="M48 118 l8 6 M48 124 l8 6 M48 130 l8 6 M64 118 l8 6 M64 124 l8 6 M64 130 l8 6" stroke="#b8a07a" stroke-width="1.5"/><path d="${long(120)}" fill="${c}"/><path d="M38 114 l4 6 4 -6 4 6 4 -6 4 6 4 -6 4 6 4 -6 4 6 4 -6 4 6" stroke="${dk}" stroke-width="2" fill="none"/><rect x="40" y="99" width="40" height="7" fill="#4a3220"/><circle cx="60" cy="102.5" r="5" fill="#d6b85a" stroke="#8a6a2a" stroke-width="1.2"/><path d="M30 80 C32 70 46 68 60 72 C74 68 88 70 90 80 C84 86 78 82 74 86 C70 80 66 84 60 82 C54 84 50 80 46 86 C42 82 36 86 30 80Z" fill="${fur}"/><path d="M36 80 l2 3 M44 78 l1 4 M54 78 v4 M66 78 v4 M76 78 l-1 4 M84 80 l-2 3" stroke="${fd}" stroke-width="1.4"/>`;
      }
    }
    return '';
  }
  // cor das mangas de cada roupa (as temáticas têm cor própria)
  function sleeveOf(style, c, skin) {
    switch (style) {
      case 'natal': return { c: '#c8302c', cuff: '#f6f2ee' };
      case 'cyberpunk': return { c: '#1a1a24', cuff: isDark(c) ? '#3af0ff' : shade(c, 0.15) };
      case 'praia': return { c: skin, top: c };
      case 'pesada': return { c: '#9aa4ae', cuff: '#5e6872' };
      case 'kimono': return { c, w: 13 };
      case 'pirata': return { c: '#f6f2ee' };
      case 'astronauta': return { c: '#eef0f4', cuff: c };
      case 'ninja': return { c: '#22222c' };
      case 'pijama': return { c };
      case 'gala': return { c: '#1c1c24', cuff: '#f6f2ee' };
      case 'explorador': return { c: '#c8b07a' };
      case 'viking': return { c: '#5a4a3a' };
      default: return { c };
    }
  }
  function hatSvg(id, clsColor) {
    switch (id) {
      case 'hat_wizard': return `<path d="M30 32 Q60 40 90 32 L64 -6 Q58 -10 56 -2Z" fill="#3a3a8a"/><path d="M30 32 Q60 42 90 32 Q60 26 30 32Z" fill="#2a2a6a"/><circle cx="62" cy="14" r="2.5" fill="#ffe48a"/><circle cx="52" cy="22" r="1.6" fill="#ffe48a"/>`;
      case 'hat_hood': return `<path d="M30 60 C26 22 46 14 60 14 C76 14 94 22 90 60 C88 40 80 30 60 30 C42 30 32 40 30 60Z" fill="#5a4a3a"/>`;
      case 'hat_helm': return `<path d="M33 46 C32 22 46 16 60 16 C74 16 88 22 87 46 L80 46 C80 34 72 30 60 30 C48 30 40 34 40 46Z" fill="#b8c0c8" stroke="#7a848e" stroke-width="1.5"/><rect x="57" y="10" width="6" height="22" rx="2" fill="#c8413f"/>`;
      case 'hat_hunter': return `<path d="M28 34 Q60 22 92 34 Q80 40 60 38 Q40 40 28 34Z" fill="#3f6a3a"/><path d="M40 34 C42 18 54 14 62 14 C72 14 80 20 80 34Z" fill="#4f7d4a"/><path d="M76 24 C90 10 96 8 98 6 C92 14 86 20 78 28Z" fill="#d84a3a"/>`;
      case 'hat_flowers': return `<path d="M34 34 Q60 22 86 34" stroke="#4aa66a" stroke-width="3" fill="none"/>${[[36, 34, '#ff8ab8'], [46, 28, '#ffe48a'], [58, 25, '#ffffff'], [70, 27, '#ff8ab8'], [82, 32, '#b997f2']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.8" fill="#e8a63a"/>`).join('')}`;
      case 'hat_horns': return `<path d="M33 46 C32 22 46 16 60 16 C74 16 88 22 87 46 L80 46 C80 34 72 30 60 30 C48 30 40 34 40 46Z" fill="#8a7a6a" stroke="#5a4a3a" stroke-width="1.5"/><path d="M36 30 C24 24 20 10 24 2 C28 14 34 20 42 24Z M84 30 C96 24 100 10 96 2 C92 14 86 20 78 24Z" fill="#f0e6d0" stroke="#bfae8a"/>`;
      case 'hat_party': return `<path d="M46 32 L60 -4 L74 32Z" fill="#ff6aa8"/><path d="M50 22 L70 22 M54 12 L66 12 M48 28 L72 28" stroke="#ffe48a" stroke-width="2.5"/><path d="M57 4 l3 -1 M61 18 l2 2" stroke="#7ad8ff" stroke-width="2"/><circle cx="60" cy="-5" r="4.5" fill="#ffe48a"/><path d="M44 32 Q60 37 76 32" stroke="#c84a8a" stroke-width="3" fill="none"/>`;
      case 'hat_bandana': return `<path d="M35 40 C45 33 75 33 85 40 L85 46 C75 40 45 40 35 46Z" fill="#c8413f"/><path d="M84 41 l11 -5 -2 7Z M84 44 l9 7 -7 1Z" fill="#a8332f"/><g fill="#fff" opacity=".7"><circle cx="46" cy="40" r="1.2"/><circle cx="56" cy="38" r="1.2"/><circle cx="66" cy="38" r="1.2"/><circle cx="76" cy="40" r="1.2"/></g>`;
      case 'hat_straw': return `<ellipse cx="60" cy="33" rx="40" ry="8" fill="#e8c870" stroke="#b8963a" stroke-width="1.2"/><path d="M42 33 C42 14 78 14 78 33Z" fill="#f0d888" stroke="#b8963a" stroke-width="1.2"/><path d="M42 29 C50 31 70 31 78 29 L78 33 C70 35 50 35 42 33Z" fill="#c8413f"/><path d="M30 34 l6 1 M86 34 l-6 1 M48 22 l4 2 M68 20 l4 2" stroke="#b8963a" stroke-width="1"/>`;
      case 'hat_beanie': return `<path d="M34 42 C31 16 89 16 86 42Z" fill="#3a6ab0"/><path d="M44 22 V40 M54 18 V40 M66 18 V40 M76 22 V40" stroke="#2a4a80" stroke-width="2"/><rect x="32" y="37" width="56" height="9" rx="4.5" fill="#e8e8f0"/><circle cx="60" cy="15" r="6.5" fill="#e8e8f0"/>`;
      case 'hat_bunny': return `<path d="M46 32 C36 4 40 -12 47 -12 C55 -12 55 8 53 32Z M67 32 C65 8 65 -12 73 -12 C80 -12 84 4 74 32Z" fill="#f6f2f2" stroke="#d8cccc" stroke-width="1.2"/><path d="M47 26 C42 6 44 -6 47 -6 C51 -6 51 8 50 26Z M70 26 C69 8 69 -6 73 -6 C76 -6 78 6 73 26Z" fill="#ffb8c8"/><path d="M38 34 Q60 26 82 34" stroke="#ff8ab8" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      case 'hat_witch': return `<path d="M24 37 Q60 47 96 37 Q60 28 24 37Z" fill="#2a1a3a"/><path d="M41 35 C47 21 53 7 61 -6 C65 -11 74 -9 77 -2 C71 -4 68 0 66 6 C70 16 74 26 79 35Z" fill="#3a2550"/><path d="M41 31 Q60 37 79 31 L79 35 Q60 41 41 35Z" fill="#7bd36b"/><rect x="55" y="31" width="9" height="7" rx="1" fill="none" stroke="#f4d675" stroke-width="1.8"/>`;
      case 'hat_tophat': return `<ellipse cx="60" cy="33" rx="29" ry="5.5" fill="#15151c"/><rect x="45" y="2" width="30" height="31" rx="2" fill="#22222c"/><rect x="45" y="24" width="30" height="5" fill="#c8413f"/><path d="M49 6 v16" stroke="#3a3a48" stroke-width="2"/>`;
      case 'hat_antlers': return `<g stroke="#8a6a44" stroke-width="3.2" fill="none" stroke-linecap="round"><path d="M44 30 C38 18 34 10 26 4 M38 18 L28 16 M35 11 L38 2"/><path d="M76 30 C82 18 86 10 94 4 M82 18 L92 16 M85 11 L82 2"/></g>`;
      case 'hat_pirate': return `<path d="M24 36 Q38 8 60 18 Q82 8 96 36 Q60 26 24 36Z" fill="#1c1c22" stroke="#d6b85a" stroke-width="1.6"/><circle cx="60" cy="24" r="4" fill="#f0f0f0"/><path d="M56.5 29 l7 0 M57 30 l6 -3 M57 27 l6 3" stroke="#f0f0f0" stroke-width="1.2"/><circle cx="58.5" cy="23.5" r=".9" fill="#1c1c22"/><circle cx="61.5" cy="23.5" r=".9" fill="#1c1c22"/>`;
      case 'hat_tiara': return `<path d="M39 33 Q60 25 81 33 L78 31 L74 21 L70 28 L65 15 L60 25 L55 15 L50 28 L46 21 L42 31Z" fill="#f4d675" stroke="#c8962a" stroke-width="1"/><circle cx="60" cy="25" r="2.6" fill="#ff6aa8"/><circle cx="50" cy="28" r="1.6" fill="#7ad8ff"/><circle cx="70" cy="28" r="1.6" fill="#7ad8ff"/>`;
      case 'hat_halo': return `<ellipse cx="60" cy="10" rx="20" ry="5.5" fill="#ffe48a" opacity=".25"/><ellipse cx="60" cy="10" rx="17" ry="4.5" fill="none" stroke="#ffe48a" stroke-width="3.5"/>`;
      case 'hat_crown': return `<path d="M40 30 L40 14 L48 22 L54 10 L60 20 L66 10 L72 22 L80 14 L80 30Z" fill="#f4c84a" stroke="#c8962a" stroke-width="1.5"/><circle cx="60" cy="25" r="3" fill="#d84a5a"/><circle cx="48" cy="26" r="2" fill="#4a8ad8"/><circle cx="72" cy="26" r="2" fill="#4a8ad8"/>`;
    }
    return '';
  }
  function capeSvg(cape, id) {
    const c = cape.color, d = `M42 76 C30 100 28 124 30 136 L90 136 C92 124 90 100 78 76Z`;
    let pat = '';
    const lt = shade(c, 0.35), dk = shade(c, -0.3);
    if (cape.pattern === 'stars') pat = `<g fill="#ffe48a">${[[36, 104], [40, 122], [33, 128], [84, 100], [86, 118], [80, 130], [45, 132], [76, 112]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.2 : 2}"/>`).join('')}</g>`;
    if (cape.pattern === 'frost') pat = `<path d="M30 130 l4 -6 4 6 4 -8 4 8 4 -5 4 5 4 -7 4 7 4 -6 4 6 4 -8 4 8 4 -5 4 5V136H30Z" fill="#e8fbff" opacity=".8"/><g stroke="#e8fbff" stroke-width="1.2" opacity=".7"><path d="M36 104 l6 6 M42 104 l-6 6 M39 103 v8"/><path d="M80 110 l6 6 M86 110 l-6 6 M83 109 v8"/></g>`;
    if (cape.pattern === 'feathers') pat = `<g fill="none" stroke="${lt}" stroke-width="2.2">${[96, 108, 120, 132].map((y) => `<path d="M30 ${y} q6 -8 12 0 M78 ${y} q6 -8 12 0"/>`).join('')}</g>`;
    if (cape.pattern === 'scales') pat = `<g fill="none" stroke="${lt}" stroke-width="1.4" opacity=".8">${[92, 100, 108, 116, 124, 132].map((y, i) => [28, 36, 80, 88].map((x) => `<path d="M${x + (i % 2) * 4} ${y} a4 4 0 0 0 8 0"/>`).join('')).join('')}</g>`;
    if (cape.pattern === 'ermine') pat = `<rect x="28" y="128" width="64" height="8" fill="#f6f4f0"/><g fill="#1a1a1a"><path d="M36 131 l1 3 1 -3Z M48 131 l1 3 1 -3Z M60 131 l1 3 1 -3Z M72 131 l1 3 1 -3Z M84 131 l1 3 1 -3Z"/></g><path d="M42 76 C40 82 38 86 36 90 M78 76 C80 82 82 86 84 90" stroke="#f4d675" stroke-width="3" fill="none"/>`;
    return `<defs><clipPath id="${id}cp"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${c}"/>${pat ? `<g clip-path="url(#${id}cp)">${pat}</g>` : ''}<path d="M30 136 L90 136" stroke="${dk}" stroke-width="3"/>`;
  }
  // armaduras: peças por cima da roupa (peitoral e ombreiras)
  function armorSvg(id) {
    const plate = (f, st) => `<path d="M44 78 C44 75 52 73.5 60 73.5 C68 73.5 76 75 76 78 L74.5 101 L45.5 101Z" fill="${f}" stroke="${st}" stroke-width="1.2"/>`;
    const paul = (f, st, r) => `<ellipse cx="40" cy="80" rx="${r || 10}" ry="${(r || 10) * 0.78}" fill="${f}" stroke="${st}" stroke-width="1.2"/><ellipse cx="80" cy="80" rx="${r || 10}" ry="${(r || 10) * 0.78}" fill="${f}" stroke="${st}" stroke-width="1.2"/>`;
    switch (id) {
      case 'arm_leather': return plate('#8a5a32', '#5a3a1e') + `<path d="M46 80 L74 98 M74 80 L46 98" stroke="#5a3a1e" stroke-width="2.4"/><circle cx="60" cy="89" r="2.4" fill="#d6b85a"/>` + paul('#6a4222', '#4a2a12', 8);
      case 'arm_chain': return plate('#8a949e', '#5a646e') + `<g stroke="#c8d0d8" stroke-width="1.1" stroke-dasharray="2 1.6">${[78, 82, 86, 90, 94, 98].map((y) => `<path d="M46 ${y} H74"/>`).join('')}</g>`;
      case 'arm_iron': return plate('#b8c0c8', '#6a747e') + `<path d="M60 75 V100" stroke="#8a949e" stroke-width="2"/><g fill="#6a747e"><circle cx="49" cy="80" r="1.2"/><circle cx="71" cy="80" r="1.2"/><circle cx="49" cy="96" r="1.2"/><circle cx="71" cy="96" r="1.2"/></g>` + paul('#c8d0d8', '#6a747e');
      case 'arm_bark': return plate('#7a5a3a', '#4a3420') + `<path d="M50 76 C49 84 51 92 49 100 M60 75 C61 84 59 92 61 100 M70 76 C71 84 69 92 71 100" stroke="#5a3e24" stroke-width="1.6" fill="none"/>` + paul('#6a4a2e', '#4a3420', 9) + `<path d="M36 74 c-4 -6 2 -9 5 -5Z M84 74 c4 -6 -2 -9 -5 -5Z" fill="#63c784"/>`;
      case 'arm_spikes': return paul('#4a4a52', '#2a2a30', 11) + `<g fill="#d8d8e0"><path d="M32 76 l-4 -8 7 5Z M38 72 l0 -9 4 8Z M44 74 l4 -8 0 9Z M88 76 l4 -8 -7 5Z M82 72 l0 -9 -4 8Z M76 74 l-4 -8 0 9Z"/></g>`;
      case 'arm_scale': return plate('#3a7a5a', '#245a40') + `<g fill="none" stroke="#6ab88a" stroke-width="1.2">${[80, 86, 92, 98].map((y, i) => [47, 54, 61, 68].map((x) => `<path d="M${x + (i % 2) * 3} ${y} a3.5 3.5 0 0 0 7 0"/>`).join('')).join('')}</g>` + paul('#3a7a5a', '#245a40');
      case 'arm_shadow': return plate('#3a2a4a', '#1a1024') + `<path d="M46 80 H74 M47 92 H73" stroke="#9a5aff" stroke-width="1.6" opacity=".9"/><path d="M60 78 l3 5 -3 5 -3 -5Z" fill="#b06aff"/>` + paul('#3a2a4a', '#1a1024', 11) + `<path d="M34 74 l-3 -7 6 4Z M86 74 l3 -7 -6 4Z" fill="#9a5aff"/>`;
      case 'arm_samurai': return plate('#a8332f', '#6a1a18') + `<g stroke="#f4d675" stroke-width="1.1">${[80, 86, 92, 98].map((y) => `<path d="M46 ${y} H74"/>`).join('')}<path d="M53 76 V100 M67 76 V100" stroke-dasharray="1.5 2.5"/></g><rect x="27" y="76" width="18" height="11" rx="2" fill="#a8332f" stroke="#6a1a18"/><rect x="75" y="76" width="18" height="11" rx="2" fill="#a8332f" stroke="#6a1a18"/><path d="M27 81 H45 M75 81 H93" stroke="#f4d675" stroke-width="1"/>`;
      case 'arm_crystal': return plate('#bfeeff', '#6ab8de') + `<path d="M44 78 L60 90 L76 78 M60 90 V101 M45 95 L60 90 L75 95" stroke="#ffffff" stroke-width="1" fill="none" opacity=".8"/><path d="M60 82 l3.5 4 -3.5 5 -3.5 -5Z" fill="#8fd8f5"/>` + paul('#d8f6ff', '#6ab8de');
      case 'arm_gold': return plate('#f4c84a', '#b8862a') + `<path d="M60 75 V100" stroke="#d8a838" stroke-width="2"/><path d="M48 80 C54 84 66 84 72 80" stroke="#fff1a8" stroke-width="1.4" fill="none"/><circle cx="60" cy="90" r="3.2" fill="#d84a5a" stroke="#8a2a2a" stroke-width=".8"/>` + paul('#f4c84a', '#b8862a', 11);
    }
    return '';
  }
  function faceItemSvg(id) {
    const ink = '#2a1d1a';
    switch (id) {
      case 'face_glasses': return `<circle cx="49" cy="54" r="6.2" fill="#fff" opacity=".15" stroke="#4a3a2a" stroke-width="1.7"/><circle cx="71" cy="54" r="6.2" fill="#fff" opacity=".15" stroke="#4a3a2a" stroke-width="1.7"/><path d="M55 53 Q60 51 65 53 M42.8 53 L36 51 M77.2 53 L84 51" stroke="#4a3a2a" stroke-width="1.7" fill="none"/>`;
      case 'face_shades': return `<rect x="41" y="49" width="15" height="10" rx="4" fill="#15151c"/><rect x="64" y="49" width="15" height="10" rx="4" fill="#15151c"/><path d="M56 52 H64 M41 52 L35 50 M79 52 L85 50" stroke="#15151c" stroke-width="2"/><path d="M44 51.5 l4 0 M67 51.5 l4 0" stroke="#fff" stroke-width="1.2" opacity=".55"/>`;
      case 'face_monocle': return `<circle cx="71" cy="54" r="6.6" fill="#fff" opacity=".18" stroke="#d6b85a" stroke-width="2"/><path d="M76 59 C80 66 78 72 82 78" stroke="#d6b85a" stroke-width="1" fill="none"/>`;
      case 'face_patch': return `<path d="M36 44 L84 58" stroke="${ink}" stroke-width="1.6"/><ellipse cx="49" cy="54" rx="6.5" ry="5.6" fill="${ink}"/>`;
      case 'face_mask': return `<path fill-rule="evenodd" d="M35 48 C46 45 74 45 85 48 L84 59 C74 61 66 57 60 59 C54 57 46 61 36 59Z M43 54 a6 4.6 0 1 0 12 0 a6 4.6 0 1 0 -12 0Z M65 54 a6 4.6 0 1 0 12 0 a6 4.6 0 1 0 -12 0Z" fill="#2a3a8a"/><path d="M85 50 l8 -4 M85 54 l9 1" stroke="#2a3a8a" stroke-width="2.4" stroke-linecap="round"/>`;
      case 'face_mustache': return `<path d="M60 61 C56 58 50 58 47 61 C45 63 42 62 42 60 C42 64 48 66 52 64 C55 63 58 62 60 62 C62 62 65 63 68 64 C72 66 78 64 78 60 C78 62 75 63 73 61 C70 58 64 58 60 61Z" fill="#3a2a1a"/>`;
      case 'face_paint': return `<path d="M39 59 l9 1 M39 63 l9 1 M81 59 l-9 1 M81 63 l-9 1" stroke="#c8413f" stroke-width="2.4" stroke-linecap="round"/><path d="M58 40 l2 -4 2 4" stroke="#c8413f" stroke-width="2" fill="none"/>`;
      case 'face_star': return `<path d="M78 58 l1.6 3.2 3.5 .5 -2.5 2.4 .6 3.5 -3.2 -1.7 -3.2 1.7 .6 -3.5 -2.5 -2.4 3.5 -.5Z" fill="#ffd36b" stroke="#d8a838" stroke-width=".6"/>`;
    }
    return '';
  }
  function neckSvg(id) {
    switch (id) {
      case 'neck_bow': return `<path d="M60 77 L51 72 L51 82Z M60 77 L69 72 L69 82Z" fill="#c8413f" stroke="#8a2a28" stroke-width=".8"/><circle cx="60" cy="77" r="2.4" fill="#a8332f"/>`;
      case 'neck_bandana': return `<path d="M46 73 Q60 79 74 73 L60 90Z" fill="#c8413f"/><g fill="#fff" opacity=".7"><circle cx="54" cy="77" r="1"/><circle cx="62" cy="79" r="1"/><circle cx="60" cy="84" r="1"/><circle cx="67" cy="76" r="1"/></g>`;
      case 'neck_scarf': return `<rect x="46" y="69" width="28" height="9" rx="4.5" fill="#d84a3a"/><path d="M52 69 v9 M60 69 v9 M68 69 v9" stroke="#f0e6d0" stroke-width="2"/><path d="M64 76 L70 98 L62 98 L60 77Z" fill="#d84a3a"/><path d="M62 92 h8" stroke="#f0e6d0" stroke-width="2"/>`;
      case 'neck_fang': return `<path d="M47 74 Q60 86 73 74" stroke="#6a4a2a" stroke-width="1.4" fill="none"/>${[[51, 79], [55, 81.5], [60, 82.5], [65, 81.5], [69, 79]].map(([x, y]) => `<path d="M${x - 1.6} ${y} L${x} ${y + 5} L${x + 1.6} ${y}Z" fill="#f4ecd8" stroke="#c8b890" stroke-width=".5"/>`).join('')}`;
      case 'neck_pearls': return `<g fill="#f8f4ee" stroke="#d8d0c4" stroke-width=".5">${Array.from({ length: 11 }, (_, i) => { const t = i / 10; const x = 47 + 26 * t, y = 74 + 9 * Math.sin(Math.PI * t); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7"/>`; }).join('')}</g>`;
      case 'neck_medal': return `<path d="M50 73 L60 87 L70 73" stroke="#3a6ab0" stroke-width="2.2" fill="none"/><circle cx="60" cy="91" r="5.4" fill="#f4c84a" stroke="#b8862a" stroke-width="1"/><path d="M60 88 l1 2 2.2 .3 -1.6 1.5 .4 2.2 -2 -1 -2 1 .4 -2.2 -1.6 -1.5 2.2 -.3Z" fill="#fff1a8"/>`;
      case 'neck_amulet': return `<path d="M50 73 L60 86 L70 73" stroke="#b8c0c8" stroke-width="1.2" fill="none"/><path d="M60 85 l5 5 -5 7 -5 -7Z" fill="#8fd8f5" stroke="#4a9ac8" stroke-width=".8"/><circle cx="60" cy="90" r="9" fill="#8fd8f5" opacity=".22"/>`;
    }
    return '';
  }
  function offhandSvg(id, clsColor) {
    switch (id) {
      case 'off_shield': return `<circle cx="29" cy="104" r="13" fill="#8a5a2a" stroke="#b8c0c8" stroke-width="2.6"/><path d="M29 92 V116 M17 104 H41" stroke="#6a4222" stroke-width="1.4"/><circle cx="29" cy="104" r="3.6" fill="#c8d0d8" stroke="#6a747e"/>`;
      case 'off_kite': return `<path d="M16 92 Q29 86 42 92 Q42 112 29 124 Q16 112 16 92Z" fill="#dfe4ea" stroke="#7a848e" stroke-width="1.6"/><path d="M29 93 V118 M20 102 H38" stroke="${clsColor}" stroke-width="3.2"/>`;
      case 'off_book': return `<g transform="rotate(-12 30 104)"><rect x="20" y="94" width="20" height="24" rx="2" fill="#5a2a7a" stroke="#3a1a50" stroke-width="1"/><rect x="38" y="95" width="3" height="22" fill="#f0e6d0"/><circle cx="30" cy="106" r="4.5" fill="none" stroke="#f4d675" stroke-width="1.4"/><path d="M30 102 v8 M26 106 h8" stroke="#f4d675" stroke-width="1"/></g>`;
      case 'off_lantern': return `<path d="M34 108 V114" stroke="#5a4a3a" stroke-width="1.4"/><circle cx="34" cy="124" r="11" fill="#ffd36b" opacity=".22"/><rect x="28" y="114" width="12" height="15" rx="2" fill="#ffe48a" stroke="#5a4a3a" stroke-width="1.6"/><path d="M28 118 H40 M28 125 H40" stroke="#5a4a3a" stroke-width="1.2"/><path d="M34 119.5 q-2 2 0 4.5 q2 -2.5 0 -4.5Z" fill="#ff8a4c"/>`;
      case 'off_orb': return `<circle cx="24" cy="92" r="11" fill="${clsColor}" opacity=".25"/><circle cx="24" cy="92" r="6" fill="${clsColor}" stroke="#fff" stroke-width="1" opacity=".95"/><circle cx="22" cy="90" r="1.8" fill="#fff" opacity=".8"/>`;
      case 'off_flowers': return `<path d="M34 108 L30 96 M34 108 L35 95 M34 108 L39 98" stroke="#4aa66a" stroke-width="1.6"/><circle cx="29" cy="94" r="3.4" fill="#ff8ab8"/><circle cx="35" cy="92" r="3.4" fill="#ffe48a"/><circle cx="40" cy="96" r="3.4" fill="#b997f2"/><circle cx="29" cy="94" r="1.2" fill="#fff"/><circle cx="35" cy="92" r="1.2" fill="#e8a63a"/><circle cx="40" cy="96" r="1.2" fill="#fff"/>`;
      case 'off_potion': return `<rect x="31" y="92" width="6" height="6" fill="#d8c8a8"/><rect x="30" y="90" width="8" height="3" rx="1" fill="#8a5a2a"/><circle cx="34" cy="104" r="7.5" fill="#e8f4ff" opacity=".6" stroke="#9ab0c0" stroke-width="1"/><path d="M27 105 a7 7 0 0 0 14 0Z" fill="#ff5a8a"/><circle cx="31" cy="101" r="1.4" fill="#fff" opacity=".8"/>`;
      case 'off_teddy': return `<circle cx="27" cy="94" r="3" fill="#a8743a"/><circle cx="37" cy="94" r="3" fill="#a8743a"/><circle cx="32" cy="98" r="7" fill="#b8844a"/><ellipse cx="32" cy="110" rx="8" ry="8.5" fill="#b8844a"/><ellipse cx="32" cy="100.5" rx="3" ry="2.2" fill="#e8c8a0"/><circle cx="29.5" cy="96.5" r="1" fill="#2a1a1a"/><circle cx="34.5" cy="96.5" r="1" fill="#2a1a1a"/><circle cx="32" cy="100" r=".9" fill="#2a1a1a"/><ellipse cx="32" cy="111" rx="4" ry="4.5" fill="#d8b080"/>`;
    }
    return '';
  }
  function petSvg(id) {
    const g = (s) => `<g transform="translate(6 112) scale(.9)">${s}</g>`;
    switch (id) {
      case 'pet_cat': return g(`<ellipse cx="14" cy="22" rx="11" ry="8" fill="#e8a24a"/><circle cx="14" cy="10" r="8" fill="#e8a24a"/><path d="M7 6 L8 -2 L12 4Z M21 6 L20 -2 L16 4Z" fill="#e8a24a"/><circle cx="11" cy="10" r="1.3" fill="#222"/><circle cx="17" cy="10" r="1.3" fill="#222"/><path d="M24 22 C32 20 32 10 28 8" stroke="#e8a24a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M10 18 h8" stroke="#c87a2a" stroke-width="1.5"/>`);
      case 'pet_owl': return g(`<ellipse cx="14" cy="16" rx="11" ry="13" fill="#8a6a4a"/><ellipse cx="14" cy="20" rx="7" ry="8" fill="#d8c09a"/><circle cx="9" cy="10" r="4.5" fill="#fff"/><circle cx="19" cy="10" r="4.5" fill="#fff"/><circle cx="9" cy="10" r="2" fill="#222"/><circle cx="19" cy="10" r="2" fill="#222"/><path d="M12 14 L14 17 L16 14Z" fill="#e8a63a"/><path d="M4 2 L8 6 M24 2 L20 6" stroke="#8a6a4a" stroke-width="3" stroke-linecap="round"/>`);
      case 'pet_slime': return g(`<path d="M2 28 C0 12 8 4 14 4 C22 4 30 12 28 28Z" fill="#7bd3e0" opacity=".9"/><circle cx="10" cy="16" r="2" fill="#123"/><circle cx="19" cy="16" r="2" fill="#123"/><path d="M11 21 q3 3 6 0" stroke="#123" stroke-width="1.4" fill="none"/><ellipse cx="9" cy="10" rx="3" ry="2" fill="#fff" opacity=".6"/>`);
      case 'pet_fox': return g(`<ellipse cx="14" cy="22" rx="10" ry="7" fill="#e8743a"/><path d="M4 12 L6 0 L12 8 L16 8 L22 0 L24 12 C24 20 4 20 4 12Z" fill="#e8743a"/><path d="M8 14 C10 20 18 20 20 14 L14 18Z" fill="#fff"/><circle cx="10" cy="11" r="1.3" fill="#222"/><circle cx="18" cy="11" r="1.3" fill="#222"/><path d="M24 24 C34 22 34 12 30 10 C32 18 28 22 24 22Z" fill="#e8743a"/><circle cx="31" cy="11" r="2" fill="#fff"/>`);
      case 'pet_bunny': return g(`<ellipse cx="14" cy="23" rx="10" ry="7" fill="#f6f2f2"/><circle cx="14" cy="12" r="7" fill="#f6f2f2"/><path d="M10 7 C8 -4 11 -6 12 -6 C14 -6 13 2 12 7Z M16 7 C16 2 15 -6 17 -6 C19 -6 21 -3 18 7Z" fill="#f6f2f2" stroke="#e0d4d4" stroke-width=".6"/><path d="M11 5 C10 -1 11 -3 12 -3 M17 5 C18 -1 18 -3 17 -3" stroke="#ffb8c8" stroke-width="1.2" fill="none"/><circle cx="11" cy="11" r="1.2" fill="#222"/><circle cx="17" cy="11" r="1.2" fill="#222"/><path d="M13 14 h2 l-1 1.2Z" fill="#ff8ab8"/><circle cx="24" cy="24" r="3" fill="#fff"/>`);
      case 'pet_turtle': return g(`<ellipse cx="14" cy="26" rx="12" ry="3" fill="#4a7a3a"/><path d="M3 24 C3 12 25 12 25 24Z" fill="#8a6a3a" stroke="#5a4220" stroke-width="1"/><path d="M14 15 l4 3 0 4 -4 2 -4 -2 0 -4Z M7 20 l3 2 0 2 M21 20 l-3 2 0 2" fill="none" stroke="#c4a060" stroke-width="1.2"/><circle cx="28" cy="20" r="4.5" fill="#6a9a4a"/><circle cx="29.5" cy="19" r="1" fill="#222"/><path d="M5 26 v3 M11 26 v3 M17 26 v3 M23 26 v3" stroke="#6a9a4a" stroke-width="2.2" stroke-linecap="round"/>`);
      case 'pet_raven': return g(`<path d="M6 22 C4 10 22 6 24 16 C26 24 16 28 6 22Z" fill="#22222c"/><path d="M8 18 C14 14 20 16 22 22 C16 22 12 22 8 18Z" fill="#3a3a48"/><circle cx="21" cy="9" r="6" fill="#22222c"/><path d="M26 8 L33 10 L26 12Z" fill="#c8a85a"/><circle cx="22.5" cy="8" r="1.4" fill="#ffd36b"/><path d="M4 22 L-3 26 L4 25Z" fill="#22222c"/><path d="M12 27 v3 M17 27 v3" stroke="#c8a85a" stroke-width="1.3"/>`);
      case 'pet_golem': return g(`<rect x="4" y="12" width="20" height="17" rx="3" fill="#8a8a92" stroke="#5a5a62" stroke-width="1"/><rect x="7" y="3" width="14" height="11" rx="2" fill="#9a9aa2" stroke="#5a5a62" stroke-width="1"/><circle cx="11" cy="8.5" r="1.8" fill="#7adfff"/><circle cx="17" cy="8.5" r="1.8" fill="#7adfff"/><rect x="0" y="14" width="5" height="10" rx="2" fill="#7a7a82"/><rect x="23" y="14" width="5" height="10" rx="2" fill="#7a7a82"/><path d="M8 18 l4 3 M18 16 l-3 5" stroke="#5a5a62" stroke-width="1"/><circle cx="14" cy="21" r="2" fill="#7adfff" opacity=".7"/>`);
      case 'pet_unicorn': return g(`<ellipse cx="13" cy="22" rx="11" ry="7" fill="#fbf8ff"/><path d="M18 18 C20 10 24 6 28 8 C31 10 30 15 26 16 C24 16 22 18 21 21Z" fill="#fbf8ff"/><path d="M27 7 L30 -3 L29 8Z" fill="#f4c84a"/><path d="M20 10 C17 8 16 12 17 15 C14 12 14 18 15 20" stroke="#ff8ab8" stroke-width="2.4" fill="none"/><path d="M21 9 C19 6 22 4 24 6" stroke="#7ad8ff" stroke-width="2" fill="none"/><circle cx="26.5" cy="11" r="1.1" fill="#222"/><path d="M4 26 v4 M9 27 v4 M17 27 v4 M22 26 v4" stroke="#e8e0f0" stroke-width="2.4" stroke-linecap="round"/><path d="M2 20 C-3 22 -3 28 1 28" stroke="#b997f2" stroke-width="2.4" fill="none"/>`);
      case 'pet_dragon': return g(`<path d="M4 16 C-2 6 2 2 8 8 Z M24 16 C30 6 26 2 20 8Z" fill="#c8412f" opacity=".8"/><ellipse cx="14" cy="22" rx="10" ry="8" fill="#d8533f"/><circle cx="14" cy="11" r="8" fill="#d8533f"/><path d="M9 4 L8 -2 L12 3 M19 4 L20 -2 L16 3" stroke="#f4d675" stroke-width="2" fill="none"/><circle cx="11" cy="10" r="1.6" fill="#ffe48a"/><circle cx="17" cy="10" r="1.6" fill="#ffe48a"/><ellipse cx="14" cy="24" rx="5" ry="4" fill="#f4b07a"/><path d="M24 26 C30 28 32 22 34 24" stroke="#d8533f" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    }
    return '';
  }


  /* ----- Ancestralidades ----- */
  function earsSvg(type, skin) {
    const dk = shade(skin, -0.18), inn = shade(skin, -0.3);
    switch (type) {
      case 'round': return `<ellipse cx="35" cy="56" rx="4" ry="6" fill="${skin}"/><ellipse cx="85" cy="56" rx="4" ry="6" fill="${skin}"/>`;
      case 'pointy': return `<path d="M38 50 L20 40 L36 64Z" fill="${skin}"/><path d="M82 50 L100 40 L84 64Z" fill="${skin}"/><path d="M35 52 L25 45 L35 60Z M85 52 L95 45 L85 60Z" fill="${inn}" opacity=".35"/>`;
      case 'pointySmall': return `<path d="M38 50 L27 44 L36 63Z" fill="${skin}"/><path d="M82 50 L93 44 L84 63Z" fill="${skin}"/>`;
      case 'goblin': return `<path d="M38 48 L4 38 Q12 52 36 64Z" fill="${skin}"/><path d="M82 48 L116 38 Q108 52 84 64Z" fill="${skin}"/><path d="M34 52 L14 44 Q20 52 34 59Z M86 52 L106 44 Q100 52 86 59Z" fill="${inn}" opacity=".35"/>`;
      case 'troll': return `<path d="M38 50 L2 30 Q14 52 36 62Z" fill="${skin}"/><path d="M82 50 L118 30 Q106 52 84 62Z" fill="${skin}"/><path d="M34 52 L12 38 Q20 52 34 58Z M86 52 L108 38 Q100 52 86 58Z" fill="${inn}" opacity=".3"/>`;
      case 'droop': return `<path d="M38 50 C22 50 14 60 18 66 C24 68 32 64 38 60Z" fill="${skin}"/><path d="M82 50 C98 50 106 60 102 66 C96 68 88 64 82 60Z" fill="${skin}"/><path d="M34 54 C26 56 22 60 23 63 C27 63 32 61 35 58Z M86 54 C94 56 98 60 97 63 C93 63 88 61 85 58Z" fill="#e8a0a0" opacity=".6"/>`;
      case 'monkey': return `<circle cx="34" cy="54" r="8" fill="${skin}"/><circle cx="86" cy="54" r="8" fill="${skin}"/><circle cx="34" cy="54" r="4.5" fill="${shade(skin, 0.3)}"/><circle cx="86" cy="54" r="4.5" fill="${shade(skin, 0.3)}"/>`;
      case 'fin': return `<path d="M37 48 L22 40 L26 50 L20 56 L36 62Z" fill="${dk}"/><path d="M83 48 L98 40 L94 50 L100 56 L84 62Z" fill="${dk}"/>`;
      case 'bolt': return `<rect x="30" y="50" width="7" height="12" rx="2" fill="${dk}"/><rect x="83" y="50" width="7" height="12" rx="2" fill="${dk}"/><circle cx="33.5" cy="56" r="1.6" fill="${shade(skin, 0.4)}"/><circle cx="86.5" cy="56" r="1.6" fill="${shade(skin, 0.4)}"/>`;
    }
    return '';
  }
  const SHELL = { rim: '#4e3519', base: '#7d5a30', scute: '#9a7442', hi: '#c49a5c' };
  function behindSvg(extras, skin, L, hairC) {
    let o = '';
    if (extras.includes('wings')) o += `<g opacity=".8"><path d="M54 84 C26 40 -2 50 4 78 C8 96 34 98 54 90Z" fill="#cfe8ff" stroke="#9ac8f0" stroke-width="1.5"/><path d="M66 84 C94 40 122 50 116 78 C112 96 86 98 66 90Z" fill="#cfe8ff" stroke="#9ac8f0" stroke-width="1.5"/><path d="M50 82 C34 66 18 64 14 72 M70 82 C86 66 102 64 106 72" stroke="#9ac8f0" stroke-width="1" fill="none"/><path d="M54 92 C36 100 24 118 34 122 C46 122 54 108 56 96Z M66 92 C84 100 96 118 86 122 C74 122 66 108 64 96Z" fill="#e8d0ff" stroke="#c0a0f0" stroke-width="1.2"/></g>`;
    if (extras.includes('shell')) {
      const S = SHELL;
      o += `<path d="M14 114 C8 66 34 48 60 48 C86 48 112 66 106 114 C100 132 82 140 60 140 C38 140 20 132 14 114Z" fill="${S.rim}"/>`
        + `<path d="M19 112 C14 72 37 54 60 54 C83 54 106 72 101 112 C96 127 80 134 60 134 C40 134 24 127 19 112Z" fill="${S.base}"/>`
        + `<g fill="${S.scute}" stroke="${S.rim}" stroke-width="2"><path d="M60 56 l12 7 0 13 -12 7 -12 -7 0 -13Z"/><path d="M36 64 l11 6 0 12 -11 7 -11 -7 0 -12Z"/><path d="M84 64 l11 6 0 12 -11 7 -11 -7 0 -12Z"/><path d="M27 92 l10 6 0 12 -10 6 -9 -6 0 -12Z"/><path d="M93 92 l9 6 0 12 -9 6 -10 -6 0 -12Z"/><path d="M34 116 l9 5 0 9 -9 5 -9 -5 0 -9Z"/><path d="M86 116 l9 5 0 9 -9 5 -9 -5 0 -9Z"/></g>`
        + `<path d="M24 74 C30 64 40 58 50 56 M96 74 C90 64 80 58 70 56" stroke="${S.hi}" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>`;
    }
    if (extras.includes('tailDevil')) o += `<path d="M70 116 C92 120 100 108 98 96" stroke="${shade(skin, -0.15)}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M98 96 l-6 -2 8 -8 2 10Z" fill="${shade(skin, -0.15)}"/>`;
    if (extras.includes('tailCat')) o += `<path d="M72 118 C96 124 102 106 94 92" stroke="${skin}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M96 98 C97 95 96 93 94 92" stroke="${shade(skin, -0.3)}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    if (extras.includes('tailMonkey')) o += `<path d="M72 118 C100 128 106 100 92 96 C86 96 86 104 92 104" stroke="${skin}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    if (extras.includes('tailScaly')) o += `<path d="M70 118 C88 132 106 128 112 114 C102 120 90 120 76 110Z" fill="${shade(skin, -0.1)}"/><path d="M84 124 l3 -5 2 6 M94 124 l4 -5 1 6 M103 120 l4 -5 0 6" fill="${shade(skin, -0.3)}"/>`;
    if (extras.includes('tailGoat')) o += `<path d="M72 110 C82 104 88 108 86 114 C82 113 78 114 74 116Z" fill="${shade(hairC, -0.1)}"/>`;
    return o;
  }
  function headUnderSvg(extras, skin, hairC) {
    let o = '';
    const dk = shade(skin, -0.2), lt = shade(skin, 0.3);
    if (extras.includes('monkeyMask')) o += `<path d="M60 44 C54 36 36 38 38 52 C40 64 52 68 60 63 C68 68 80 64 82 52 C84 38 66 36 60 44Z" fill="${shade(skin, 0.42)}"/>`;
    if (extras.includes('muzzle')) o += `<ellipse cx="60" cy="62" rx="15" ry="11" fill="${shade(skin, 0.35)}"/>`;
    if (extras.includes('catFace')) o += `<ellipse cx="60" cy="61" rx="11" ry="7" fill="${shade(skin, 0.35)}"/>`;
    if (extras.includes('catStripes')) o += `<path d="M54 26 l2 8 M60 25 v9 M66 26 l-2 8 M36 50 h6 M36 55 h5 M84 50 h-6 M84 55 h-5" stroke="${shade(skin, -0.35)}" stroke-width="2.2" stroke-linecap="round"/>`;
    if (extras.includes('turtleHead')) {
      // cabeça careca de tartaruga: placas no alto, mandíbula clara e pescoço enrugado
      o += `<g fill="${dk}" opacity=".75"><path d="M60 26 l7 4 0 7 -7 4 -7 -4 0 -7Z"/><path d="M46 31 l6 3 0 6 -6 4 -6 -4 0 -6Z"/><path d="M74 31 l6 3 0 6 -6 4 -6 -4 0 -6Z"/><path d="M53 43 l4 2 0 4 -4 2 -4 -2 0 -4Z" opacity=".6"/><path d="M67 43 l4 2 0 4 -4 2 -4 -2 0 -4Z" opacity=".6"/></g>`
        + `<path d="M40 60 C44 74 52 77 60 77 C68 77 76 74 80 60 C74 68 66 70 60 70 C54 70 46 68 40 60Z" fill="${lt}" opacity=".7"/>`
        + `<path d="M40 50 C40 30 80 30 80 50" stroke="${shade(skin, 0.25)}" stroke-width="2" fill="none" opacity=".35"/>`;
    }
    if (extras.includes('frogHead')) o += `<ellipse cx="60" cy="68" rx="15" ry="7" fill="${shade(skin, 0.45)}"/><g fill="${dk}" opacity=".7"><circle cx="42" cy="46" r="2.6"/><circle cx="78" cy="44" r="2"/><circle cx="72" cy="40" r="1.5"/><circle cx="47" cy="40" r="1.4"/></g>`;
    if (extras.includes('metalHead')) o += `<path d="M36 42 C46 38 74 38 84 42" stroke="${shade(skin, -0.35)}" stroke-width="1.4" fill="none"/><path d="M60 25 V40" stroke="${shade(skin, -0.35)}" stroke-width="1.4"/><ellipse cx="48" cy="32" rx="9" ry="4" fill="#fff" opacity=".35" transform="rotate(-20 48 32)"/>`;
    if (extras.includes('snout')) o += `<path d="M42 58 C42 52 52 54 60 54 C68 54 78 52 78 58 C80 70 70 76 60 76 C50 76 40 70 42 58Z" fill="${shade(skin, 0.12)}" stroke="${dk}" stroke-width="1"/>`;
    if (extras.includes('heavyBrow')) o += `<path d="M38 46 C46 40 56 42 60 45 C64 42 74 40 82 46 C76 46 68 46 60 49 C52 46 44 46 38 46Z" fill="${dk}"/>`;
    if (extras.includes('sporeSpots')) o += `<g fill="${shade(skin, 0.4)}"><circle cx="40" cy="60" r="2.2"/><circle cx="44" cy="66" r="1.4"/><circle cx="80" cy="60" r="2.2"/><circle cx="76" cy="66" r="1.4"/></g>`;
    return o;
  }
  function faceExtrasSvg(extras, skin, hairC, L) {
    let o = '';
    const ink = '#2a1d1a';
    if (extras.includes('tusksSmall')) o += `<path d="M53 67 l1 -6 2.5 6Z M67 67 l-1 -6 -2.5 6Z" fill="#f4ecd8"/>`;
    if (extras.includes('tusksBig')) o += `<path d="M51 68 C49 62 49 56 52 52 C53 58 55 63 56 67Z M69 68 C71 62 71 56 68 52 C67 58 65 63 64 67Z" fill="#f4ecd8" stroke="#c8b890" stroke-width=".8"/>`;
    if (extras.includes('bovineNose')) o += `<ellipse cx="60" cy="60" rx="7" ry="4.5" fill="#e8a0a8"/><ellipse cx="57.5" cy="60" rx="1.3" ry="1.6" fill="#8a4a50"/><ellipse cx="62.5" cy="60" rx="1.3" ry="1.6" fill="#8a4a50"/>`;
    if (extras.includes('catFace')) o += `<path d="M57 58 h6 l-3 3Z" fill="#e87a8a"/><path d="M48 61 h-10 M48 63.5 l-9 2 M72 61 h10 M72 63.5 l9 2" stroke="${ink}" stroke-width=".9" opacity=".7"/>`;
    if (extras.includes('muzzle')) o += `<ellipse cx="57.5" cy="60" rx="1.3" ry="1" fill="${ink}"/><ellipse cx="62.5" cy="60" rx="1.3" ry="1" fill="${ink}"/>`;
    if (extras.includes('scales')) { const c = shade(skin, -0.22); o += `<g fill="${c}" opacity=".8"><circle cx="41" cy="50" r="1.6"/><circle cx="38" cy="55" r="1.6"/><circle cx="42" cy="56" r="1.3"/><circle cx="79" cy="50" r="1.6"/><circle cx="82" cy="55" r="1.6"/><circle cx="78" cy="56" r="1.3"/></g>`; }
    if (extras.includes('rivets')) { const c = shade(skin, 0.35); o += `<g fill="${c}" stroke="${shade(skin, -0.3)}" stroke-width=".6"><circle cx="38" cy="47" r="1.6"/><circle cx="82" cy="47" r="1.6"/><circle cx="40" cy="64" r="1.6"/><circle cx="80" cy="64" r="1.6"/></g>`; }
    if (extras.includes('lenses')) o += `<circle cx="49" cy="54" r="6.5" fill="none" stroke="${shade(skin, -0.4)}" stroke-width="2"/><circle cx="71" cy="54" r="6.5" fill="none" stroke="${shade(skin, -0.4)}" stroke-width="2"/>`;
    if (extras.includes('grill')) o += `<rect x="50" y="61" width="20" height="8" rx="2.5" fill="${shade(skin, -0.5)}"/><path d="M54 62 v6 M58 62 v6 M62 62 v6 M66 62 v6" stroke="${shade(skin, 0.3)}" stroke-width="1.2"/>`;
    if (extras.includes('beak')) o += `<path d="M48 60 Q60 56 72 60 Q70 69 60 72 Q50 69 48 60Z" fill="#d9c27a" stroke="#8a7438" stroke-width="1.2"/><path d="M50 63 Q60 66 70 63" stroke="#8a7438" stroke-width="1.2" fill="none"/><path d="M57 60.5 h1.5 M61.5 60.5 h1.5" stroke="#6a5628" stroke-width="1.2" stroke-linecap="round"/>`;
    if (extras.includes('frogMouth')) o += `<path d="M38 60 Q60 74 82 60" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="56" cy="56" r=".9" fill="${ink}"/><circle cx="64" cy="56" r=".9" fill="${ink}"/>`;
    if (extras.includes('snout')) o += `<ellipse cx="54" cy="60" rx="1.8" ry="1.2" fill="${ink}"/><ellipse cx="66" cy="60" rx="1.8" ry="1.2" fill="${ink}"/><path d="M46 68 Q60 74 74 68" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M50 69 l1.5 3 1.5 -2.6 M70 69 l-1.5 3 -1.5 -2.6" fill="#fff"/>`;
    if (extras.includes('bigNose')) o += `<ellipse cx="60" cy="59" rx="5.5" ry="5" fill="${shade(skin, -0.1)}"/><ellipse cx="58" cy="57" rx="1.8" ry="1.3" fill="#fff" opacity=".35"/>`;
    if (extras.includes('longNose')) o += `<path d="M57 51 C59 56 66 61 70 63 C65 65 60 63 56 60Z" fill="${shade(skin, -0.1)}" stroke="${shade(skin, -0.3)}" stroke-width=".8"/>`;
    if (extras.includes('dwarfBeard')) {
      const hc = hairC, hd = shade(hairC, -0.25), hl = shade(hairC, 0.25);
      if (L.gender !== 'f') o += `<path d="M37 54 C36 76 44 98 60 106 C76 98 84 76 83 54 C78 64 72 67 66 66 C62 64 58 64 54 66 C48 67 42 64 37 54Z" fill="${hc}"/><path d="M48 76 C50 88 54 96 58 102 M72 76 C70 88 66 96 62 102 M60 70 V100" stroke="${hd}" stroke-width="1.6" fill="none"/><circle cx="60" cy="101" r="3" fill="#d6b85a"/><path d="M46 66 C50 60 56 60 60 63 C64 60 70 60 74 66 C68 68 64 66 60 66 C56 66 52 68 46 66Z" fill="${hd}"/><path d="M42 62 C44 70 48 76 52 78" stroke="${hl}" stroke-width="1.2" fill="none" opacity=".6"/>`;
      else o += `<path d="M36 54 C34 66 36 80 38 88 L44 88 C42 78 42 66 42 58Z M84 54 C86 66 84 80 82 88 L76 88 C78 78 78 66 78 58Z" fill="${hc}"/><path d="M37 64 h5 M37 72 h5 M38 80 h5 M78 64 h5 M78 72 h5 M77 80 h5" stroke="${hd}" stroke-width="1.4"/><circle cx="41" cy="90" r="2.6" fill="#d6b85a"/><circle cx="79" cy="90" r="2.6" fill="#d6b85a"/>`;
    }
    return o;
  }
  function topSvg(extras, skin, hairC) {
    let o = '';
    const horn = '#e8dcc0', hornDk = '#a8987a';
    if (extras.includes('crest')) o += `<path d="M50 30 L54 14 L58 26 L60 8 L62 26 L66 14 L70 30 C64 26 56 26 50 30Z" fill="${shade(skin, -0.3)}"/>`;
    if (extras.includes('backHorns')) o += `<path d="M42 32 C36 20 28 14 18 16 C28 20 32 28 36 38Z M78 32 C84 20 92 14 102 16 C92 20 88 28 84 38Z" fill="${horn}" stroke="${hornDk}"/>`;
    if (extras.includes('devilHorns')) o += `<path d="M44 32 C40 22 42 14 48 10 C47 18 49 24 52 29Z M76 32 C80 22 78 14 72 10 C73 18 71 24 68 29Z" fill="#3a2a30" stroke="#1a1014"/>`;
    if (extras.includes('goatHorns')) o += `<g fill="${horn}" stroke="${hornDk}" stroke-width="1.2"><path d="M46 32 C40 18 26 14 20 24 C16 32 22 40 28 38 C24 34 24 28 30 26 C36 24 40 30 42 36Z"/><path d="M74 32 C80 18 94 14 100 24 C104 32 98 40 92 38 C96 34 96 28 90 26 C84 24 80 30 78 36Z"/></g><path d="M26 30 C28 28 32 28 34 30 M94 30 C92 28 88 28 86 30" stroke="${hornDk}" stroke-width="1" fill="none"/>`;
    if (extras.includes('cowHorns')) o += `<path d="M38 36 C30 34 24 26 26 18 C30 24 36 28 42 30Z M82 36 C90 34 96 26 94 18 C90 24 84 28 78 30Z" fill="${horn}" stroke="${hornDk}"/>`;
    if (extras.includes('catEars')) o += `<path d="M36 36 L38 12 L54 28Z M84 36 L82 12 L66 28Z" fill="${skin}"/><path d="M40 30 L41 18 L49 27Z M80 30 L79 18 L71 27Z" fill="#e8a0a8"/>`;
    if (extras.includes('frogEyes')) {
      const lid = shade(skin, -0.15);
      o += `<circle cx="45" cy="34" r="11" fill="${skin}" stroke="${lid}" stroke-width="1.5"/><circle cx="75" cy="34" r="11" fill="${skin}" stroke="${lid}" stroke-width="1.5"/><circle cx="45" cy="34" r="7.5" fill="#f4e27a"/><circle cx="75" cy="34" r="7.5" fill="#f4e27a"/><ellipse cx="45" cy="34" rx="5" ry="2.4" fill="#1a1010"/><ellipse cx="75" cy="34" rx="5" ry="2.4" fill="#1a1010"/><circle cx="42.5" cy="31" r="1.6" fill="#fff"/><circle cx="72.5" cy="31" r="1.6" fill="#fff"/>`;
    }
    if (extras.includes('antenna')) o += `<path d="M60 25 L60 8" stroke="${shade(skin, -0.3)}" stroke-width="2.5"/><circle cx="60" cy="6" r="4" fill="#7adfff"/><circle cx="60" cy="6" r="7" fill="#7adfff" opacity=".25"/>`;
    if (extras.includes('mushroomCap')) o += `<path d="M24 44 C22 18 42 6 60 6 C78 6 98 18 96 44 C84 38 72 36 60 36 C48 36 36 38 24 44Z" fill="${hairC}"/><path d="M30 42 l3 -4 M38 39 l2 -4 M46 37 l1 -4 M54 36 v-4 M66 36 v-4 M74 37 l-1 -4 M82 39 l-2 -4 M90 42 l-3 -4" stroke="${shade(hairC, -0.35)}" stroke-width="1.2"/><circle cx="44" cy="22" r="5" fill="#fff" opacity=".85"/><circle cx="66" cy="15" r="4" fill="#fff" opacity=".85"/><circle cx="80" cy="28" r="4.5" fill="#fff" opacity=".85"/><circle cx="34" cy="36" r="3" fill="#fff" opacity=".85"/>`;
    if (extras.includes('thirdEye')) o += `<ellipse cx="60" cy="41" rx="3.6" ry="2.8" fill="#fff" stroke="#2a1d1a" stroke-width="1"/><circle cx="60" cy="41" r="1.7" fill="#3a6ab0"/><circle cx="60" cy="41" r=".8" fill="#1a1010"/>`;
    if (extras.includes('sparkles')) o += `<g fill="#fff6c8">${[[14, 40, 3], [104, 46, 2.5], [22, 96, 2], [100, 104, 2.5], [10, 70, 1.8]].map(([x, y, r]) => `<path d="M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5}Z"/>`).join('')}</g>`;
    return o;
  }

  function heroSvg(h, opts) {
    opts = opts || {};
    const L = h.look || {};
    const cls = D.CLASSES[h.cls] || D.CLASSES.guerreiro;
    const skin = L.skin || D.LOOK.skin[1];
    const hairC = L.hairColor || D.LOOK.hairColor[1];
    const outC = L.outfitColor || D.LOOK.outfitColor[0];
    const cos = h.cosmetics || {};
    const id = 'av' + (++uid);
    const aura = cos.aura ? D.COSMETICS.find((c) => c.id === cos.aura) : null;
    const cape = cos.cape ? D.COSMETICS.find((c) => c.id === cos.cape) : null;
    const hat = cos.hat;
    const anc = D.ANCESTRIES[L.anc || 'humano'] || D.ANCESTRIES.humano;
    const ex = anc.extras;
    const hideHair = hat === 'hat_helm' || hat === 'hat_horns' || hat === 'hat_hood' || ex.includes('mushroomCap') || ex.includes('bald');
    const feet = ex.includes('goatLegs') ? 'goat' : ex.includes('bareFeet') ? 'bare' : null;
    const faceOpt = { eyes: !ex.includes('frogEyes'), mouth: !(ex.includes('beak') || ex.includes('frogMouth') || ex.includes('grill') || ex.includes('snout') || (ex.includes('dwarfBeard') && L.gender !== 'f')), rosy: ex.includes('rosy'), noBlush: ex.includes('metalHead') || ex.includes('turtleHead'), noBeard: ex.includes('dwarfBeard'), eyeC: anc.eyeC };
    const parts = [];
    parts.push(`<defs><radialGradient id="${id}g"><stop offset="0" stop-color="${aura ? aura.color : '#000'}" stop-opacity=".7"/><stop offset="1" stop-color="${aura ? aura.color : '#000'}" stop-opacity="0"/></radialGradient></defs>`);
    parts.push(`<ellipse cx="60" cy="142" rx="30" ry="5" fill="#000" opacity=".25"/>`);
    if (aura) parts.push(`<ellipse class="aura" cx="60" cy="86" rx="58" ry="70" fill="url(#${id}g)"/>`);
    const body = [];
    const pushB = (x) => body.push(x);
    parts.push('__BODY__');
    pushB(behindSvg(ex, skin, L, hairC));
    if (cape) pushB(capeSvg(cape, id));
    if (!hideHair) pushB(hairBack(L.hairStyle, hairC, L.gender));
    // braços
    { const sl = sleeveOf(L.outfit, outC, skin); const w = sl.w || 9;
      pushB(`<path d="M42 78 C34 84 32 96 34 106" stroke="${sl.c}" stroke-width="${w}" fill="none" stroke-linecap="round"/><path d="M78 78 C86 84 88 96 86 106" stroke="${sl.c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`
        + (sl.top ? `<path d="M42 78 C38 81 36 84 35.5 88" stroke="${sl.top}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M78 78 C82 81 84 84 84.5 88" stroke="${sl.top}" stroke-width="10" fill="none" stroke-linecap="round"/>` : '')
        + (sl.cuff ? `<path d="M33.6 101 L34 105 M86.4 101 L86 105" stroke="${sl.cuff}" stroke-width="${w + 1}" stroke-linecap="butt"/>` : '')); }
    pushB(outfitSvg(L.outfit, outC, L.gender, skin, cls.color, feet, hairC));
    if (cos.armor) pushB(armorSvg(cos.armor));
    pushB(`<circle cx="34" cy="108" r="5" fill="${skin}"/><circle cx="86" cy="108" r="5" fill="${skin}"/>`);
    if (cos.offhand) pushB(offhandSvg(cos.offhand, cls.color));
    // cabeça
    pushB(`<rect x="54" y="66" width="12" height="9" fill="${shade(skin, -0.12)}"/>${earsSvg(anc.ears, skin)}<ellipse cx="60" cy="50" rx="25" ry="26" fill="${skin}"/>`);
    if (cos.neck) pushB(neckSvg(cos.neck));
    pushB(headUnderSvg(ex, skin, hairC));
    pushB(faceSvg(L.face, L.gender, skin, hairC, faceOpt));
    pushB(faceExtrasSvg(ex, skin, hairC, L));
    if (cos.face) pushB(faceItemSvg(cos.face));
    if (!hideHair) pushB(hairFront(L.hairStyle, hairC));
    pushB(topSvg(ex, skin, hairC));
    if (hat) pushB(hatSvg(hat, cls.color));
    if (!opts.noWeapon) pushB(weaponSvg(cls.wkind, cls.color, cos.weapon));
    const sc = Array.isArray(anc.scale) ? anc.scale : [anc.scale, anc.scale];
    const bodyG = sc[0] === 1 && sc[1] === 1 ? body.join('') : `<g transform="translate(60 144) scale(${sc[0]} ${sc[1]}) translate(-60 -144)">${body.join('')}</g>`;
    const out = parts.join('').replace('__BODY__', bodyG) + (cos.pet && !opts.noPet ? petSvg(cos.pet) : '');
    return `<svg class="hero-svg" viewBox="-4 -12 128 160" role="img" aria-label="${(h.name || 'Herói').replace(/"/g, '')}">${out}</svg>`;
  }

  function enemySvg(u) {
    const c = u.color || '#7bd36b', dk = shade(c, -0.35), lt = shade(c, 0.25);
    const eyeC = u.glow || '#ffe48a';
    const eye = (x, y, r, col) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col || eyeC}"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="#1a1010"/>`;
    const crown = u.crown ? `<path d="M34 16 L34 4 L42 10 L50 0 L58 10 L66 4 L66 16Z" fill="#f4c84a" stroke="#a87a2a"/>` : '';
    const horns = u.horns ? `<path d="M30 30 C24 18 26 8 32 4 C33 14 36 20 40 26Z M70 30 C76 18 74 8 68 4 C67 14 64 20 60 26Z" fill="#2a1a1a"/>` : '';
    const wingsBack = (col) => `<path d="M40 50 C20 30 4 34 2 50 C10 50 12 60 8 66 C20 62 30 64 38 62Z M60 50 C80 30 96 34 98 50 C90 50 88 60 92 66 C80 62 70 64 62 62Z" fill="${col}"/>`;
    const teeth = (y, x0, x1) => { let o = ''; for (let x = x0; x < x1; x += 6) o += `<path d="M${x} ${y} l3 5 3 -5Z" fill="#fff"/>`; return o; };
    let s = '';
    switch (u.shape) {
      case 'slime': s = `<path d="M10 86 C6 50 30 28 50 28 C70 28 94 50 90 86Z" fill="${c}" opacity=".92"/><ellipse cx="34" cy="46" rx="8" ry="5" fill="#fff" opacity=".45"/>${eye(38, 60, 6, '#fff')}${eye(62, 60, 6, '#fff')}<path d="M42 74 q8 5 16 0" stroke="${dk}" stroke-width="3" fill="none"/>`; break;
      case 'goblin': s = `<path d="M22 44 L2 30 L26 56Z M78 44 L98 30 L74 56Z" fill="${c}"/><ellipse cx="50" cy="52" rx="30" ry="28" fill="${c}"/><path d="M24 92 C26 76 36 72 50 72 C64 72 74 76 76 92Z" fill="${dk}"/>${eye(38, 48, 6)}${eye(62, 48, 6)}<path d="M34 40 l10 4 M66 40 l-10 4" stroke="${dk}" stroke-width="3"/><path d="M36 64 Q50 72 64 64 L60 66 L56 61 L52 67 L48 61 L44 67 L40 61Z" fill="#fff" stroke="${dk}"/>${u.big ? `<path d="M38 66 l-3 -8 M62 66 l3 -8" stroke="#f0e6d0" stroke-width="4" stroke-linecap="round"/>` : ''}`; break;
      case 'kobold': s = `<path d="M30 40 L18 22 L38 34Z M70 40 L82 22 L62 34Z" fill="${dk}"/><ellipse cx="50" cy="50" rx="24" ry="22" fill="${c}"/><path d="M40 56 C40 70 60 70 64 56 L78 60 C74 72 54 78 40 70Z" fill="${lt}"/><path d="M28 92 C30 78 40 72 50 72 C60 72 70 78 72 92Z" fill="${dk}"/>${eye(40, 46, 4.5)}${eye(58, 46, 4.5)}<circle cx="74" cy="60" r="1.5" fill="#1a1010"/>`; break;
      case 'wolf': s = `<path d="M20 30 L30 8 L40 30Z M60 30 L70 8 L80 30Z" fill="${c}"/><path d="M14 50 C14 24 86 24 86 50 L70 80 L50 92 L30 80Z" fill="${c}"/><path d="M36 66 L50 92 L64 66Z" fill="${lt}"/><ellipse cx="50" cy="74" rx="6" ry="4" fill="#1a1a1a"/>${eye(36, 50, 5, u.glow || '#ff5a3a')}${eye(64, 50, 5, u.glow || '#ff5a3a')}`; break;
      case 'boar': s = `<path d="M22 34 L28 18 L38 32Z M78 34 L72 18 L62 32Z" fill="${dk}"/><ellipse cx="50" cy="58" rx="36" ry="30" fill="${c}"/><path d="M30 30 Q50 18 70 30 L66 40 Q50 32 34 40Z" fill="${dk}"/><ellipse cx="50" cy="70" rx="15" ry="11" fill="${lt}"/><circle cx="45" cy="70" r="2.5" fill="#2a1a1a"/><circle cx="55" cy="70" r="2.5" fill="#2a1a1a"/><path d="M34 74 C28 70 26 62 28 58 M66 74 C72 70 74 62 72 58" stroke="#f4ecd8" stroke-width="4" fill="none" stroke-linecap="round"/>${eye(36, 52, 4.5, u.glow || '#ff5a3a')}${eye(64, 52, 4.5, u.glow || '#ff5a3a')}`; break;
      case 'mushroom': s = `<path d="M34 56 C32 76 34 88 40 92 L60 92 C66 88 68 76 66 56Z" fill="#f0e2c8"/><path d="M8 56 C6 26 30 12 50 12 C70 12 94 26 92 56 C78 50 64 48 50 48 C36 48 22 50 8 56Z" fill="${c}"/><circle cx="32" cy="32" r="6" fill="#fff" opacity=".85"/><circle cx="56" cy="22" r="5" fill="#fff" opacity=".85"/><circle cx="74" cy="38" r="6" fill="#fff" opacity=".85"/>${eye(43, 68, 4, '#2a1a1a')}${eye(57, 68, 4, '#2a1a1a')}<path d="M45 80 q5 4 10 0" stroke="#6a4a3a" stroke-width="2" fill="none"/>`; break;
      case 'bat': s = `<path d="M50 50 C30 30 10 30 2 40 C10 44 12 52 8 60 C18 56 26 60 30 66 C36 58 44 58 50 62 C56 58 64 58 70 66 C74 60 82 56 92 60 C88 52 90 44 98 40 C90 30 70 30 50 50Z" fill="${c}"/><ellipse cx="50" cy="56" rx="14" ry="16" fill="${dk}"/><path d="M40 42 L42 30 L48 40 M60 42 L58 30 L52 40" fill="${dk}"/>${eye(44, 52, 3.5, u.glow || '#ff4a4a')}${eye(56, 52, 3.5, u.glow || '#ff4a4a')}<path d="M45 62 l2 5 2 -5 M51 62 l2 5 2 -5" fill="#fff"/>`; break;
      case 'skull': s = `<path d="M26 74 C14 60 16 24 50 22 C84 24 86 60 74 74 L70 90 L30 90Z" fill="${c}"/><ellipse cx="37" cy="54" rx="9" ry="10" fill="#1a1414"/><ellipse cx="63" cy="54" rx="9" ry="10" fill="#1a1414"/><circle cx="37" cy="55" r="3" fill="${u.glow || (u.boss ? '#7affc8' : '#ff6a3a')}"/><circle cx="63" cy="55" r="3" fill="${u.glow || (u.boss ? '#7affc8' : '#ff6a3a')}"/><path d="M46 70 L50 62 L54 70Z" fill="#1a1414"/><path d="M34 80 v10 M42 80 v10 M50 80 v10 M58 80 v10 M66 80 v10" stroke="${dk}" stroke-width="2"/>`; break;
      case 'spider': s = `<g stroke="${dk}" stroke-width="4" fill="none" stroke-linecap="round">${[-1, 1].map((sd) => [0, 1, 2, 3].map((i) => `<path d="M${50 + sd * 14} ${56 + i * 5} q${sd * 18} ${-16 + i * 8} ${sd * 34} ${8 + i * 6}"/>`).join('')).join('')}</g><ellipse cx="50" cy="70" rx="22" ry="18" fill="${c}"/><circle cx="50" cy="46" r="16" fill="${c}"/>${eye(43, 44, 3.5, u.glow || '#ff4a4a')}${eye(57, 44, 3.5, u.glow || '#ff4a4a')}<circle cx="50" cy="38" r="2.5" fill="${u.glow || '#ff4a4a'}"/><path d="M58 64 l4 8 -4 8 -4 -8Z" fill="#c84a3a"/>`; break;
      case 'rat': s = `<path d="M70 80 C90 84 96 70 92 60" stroke="#c8a0a0" stroke-width="3" fill="none"/><ellipse cx="54" cy="70" rx="28" ry="20" fill="${c}"/><circle cx="30" cy="34" r="12" fill="${c}"/><circle cx="62" cy="34" r="12" fill="${c}"/><circle cx="30" cy="34" r="7" fill="#e8b0b0"/><circle cx="62" cy="34" r="7" fill="#e8b0b0"/><path d="M26 50 C26 36 66 36 66 50 C66 62 54 72 46 76 C38 72 26 62 26 50Z" fill="${c}"/>${eye(38, 50, 4, u.glow || '#ff4a4a')}${eye(54, 50, 4, u.glow || '#ff4a4a')}<circle cx="46" cy="70" r="3" fill="#e88a9a"/><path d="M42 74 h8" stroke="#fff" stroke-width="3"/>`; break;
      case 'zombie': s = `<path d="M22 92 C24 76 34 72 50 72 C66 72 76 76 78 92Z" fill="#5a6a7a"/><path d="M24 52 C22 28 40 18 52 18 C68 18 80 30 76 54 C74 70 64 76 50 76 C36 76 26 68 24 52Z" fill="${c}"/><path d="M30 30 L40 26 M44 22 L48 30 M66 26 l-6 6" stroke="#3a2a2a" stroke-width="3"/>${eye(40, 48, 5, '#fff8c8')}<circle cx="62" cy="48" r="6" fill="#1a1010"/><path d="M38 64 h24" stroke="#3a2a2a" stroke-width="3"/><path d="M42 61 v6 M48 61 v6 M54 61 v6" stroke="#3a2a2a" stroke-width="1.5"/><path d="M58 30 l8 8 M62 30 l-4 8" stroke="#3a2a2a" stroke-width="1.5"/>`; break;
      case 'imp': s = `${u.wings ? wingsBack(dk) : ''}<path d="M36 30 C30 18 32 8 38 4 C39 14 42 20 46 26Z M64 30 C70 18 68 8 62 4 C61 14 58 20 54 26Z" fill="${shade(c, -0.55)}"/><path d="M30 92 C30 76 40 70 50 70 C60 70 70 76 70 92Z" fill="${dk}"/><ellipse cx="50" cy="50" rx="24" ry="24" fill="${c}"/>${eye(41, 48, 5)}${eye(59, 48, 5)}<path d="M38 62 Q50 70 62 62" stroke="#1a1010" stroke-width="3" fill="none"/><path d="M42 63 l2 4 2 -4 M54 63 l2 4 2 -4" fill="#fff"/><path d="M68 84 C82 86 88 76 86 66 l4 -4 -6 0Z" fill="${dk}"/>`; break;
      case 'ghost': s = `<path d="M20 90 L20 46 C20 22 80 22 80 46 L80 90 L70 82 L60 92 L50 82 L40 92 L30 82Z" fill="${c}" opacity=".85"/><ellipse cx="38" cy="50" rx="6" ry="9" fill="#1a2430"/><ellipse cx="62" cy="50" rx="6" ry="9" fill="#1a2430"/><ellipse cx="50" cy="70" rx="7" ry="9" fill="#1a2430"/>${u.glow ? `<circle cx="38" cy="52" r="2" fill="${u.glow}"/><circle cx="62" cy="52" r="2" fill="${u.glow}"/>` : ''}`; break;
      case 'golem': s = `<rect x="18" y="38" width="64" height="54" rx="8" fill="${c}"/><rect x="30" y="14" width="40" height="30" rx="6" fill="${lt}"/><rect x="4" y="44" width="16" height="36" rx="6" fill="${dk}"/><rect x="80" y="44" width="16" height="36" rx="6" fill="${dk}"/>${u.lava ? `<rect x="36" y="24" width="10" height="6" fill="#ffb03a"/><rect x="54" y="24" width="10" height="6" fill="#ffb03a"/><path d="M26 50 l12 10 -4 12 l10 8 M74 46 l-10 14 6 10 M50 40 v14" stroke="#ff8a2a" stroke-width="3" fill="none"/><circle cx="50" cy="64" r="7" fill="#ffd36a"/>` : `<rect x="36" y="24" width="10" height="6" fill="${u.glow || '#7adfff'}"/><rect x="54" y="24" width="10" height="6" fill="${u.glow || '#7adfff'}"/><path d="M30 56 l12 8 -4 12 M70 52 l-8 14" stroke="${dk}" stroke-width="2" fill="none"/><circle cx="50" cy="64" r="6" fill="${u.glow || '#7adfff'}" opacity=".8"/>`}`; break;
      case 'bird': s = `<path d="M44 50 C24 30 6 34 2 46 C14 46 18 54 14 62 C26 58 36 60 44 62Z M56 50 C76 30 94 34 98 46 C86 46 82 54 86 62 C74 58 64 60 56 62Z" fill="${dk}"/><ellipse cx="50" cy="62" rx="18" ry="22" fill="${c}"/><circle cx="50" cy="36" r="14" fill="${c}"/><path d="M50 40 L62 46 L50 50Z" fill="#e8b84a"/>${eye(45, 34, 3.5, u.glow || '#ffe48a')}<path d="M42 84 l-4 10 M58 84 l4 10" stroke="#e8b84a" stroke-width="3"/>${u.sid === 'fenix' ? '<path d="M38 26 C40 12 50 6 50 6 C50 6 60 12 62 26" fill="#ffd36a" opacity=".8"/>' : ''}`; break;
      case 'bear': s = `<circle cx="28" cy="26" r="10" fill="${c}"/><circle cx="72" cy="26" r="10" fill="${c}"/><path d="M14 92 C14 56 28 40 50 40 C72 40 86 56 86 92Z" fill="${c}"/><ellipse cx="50" cy="42" rx="26" ry="22" fill="${c}"/><ellipse cx="50" cy="52" rx="12" ry="9" fill="${lt}"/><ellipse cx="50" cy="48" rx="5" ry="3.5" fill="#1a1010"/>${eye(38, 38, 4)}${eye(62, 38, 4)}<path d="M44 58 h12" stroke="#1a1010" stroke-width="2"/>${u.horns ? '<path d="M28 20 C22 10 24 2 30 -2 C30 8 32 14 36 18Z M72 20 C78 10 76 2 70 -2 C70 8 68 14 64 18Z" fill="#cfd8e0"/>' : ''}`; break;
      case 'cultist': s = `<path d="M20 92 L30 40 C32 20 68 20 70 40 L80 92Z" fill="${c}"/><path d="M34 46 C34 30 66 30 66 46 L62 60 L38 60Z" fill="#140c12"/>${eye(43, 48, 3, u.glow || '#ff4ac8')}${eye(57, 48, 3, u.glow || '#ff4ac8')}<path d="M44 72 l6 -8 6 8 -6 8Z" fill="${u.glow || '#ff4ac8'}" opacity=".8"/><circle cx="50" cy="72" r="14" fill="${u.glow || '#ff4ac8'}" opacity=".15"/>`; break;
      case 'witch': s = `<path d="M22 92 L32 50 C34 36 66 36 68 50 L78 92Z" fill="${c}"/><ellipse cx="50" cy="50" rx="15" ry="15" fill="#9ac88a"/><path d="M50 50 L46 62 L52 56Z" fill="#7aa86a"/>${eye(44, 48, 3, '#ffe48a')}${eye(56, 48, 3, '#ffe48a')}<path d="M44 58 q6 3 12 0" stroke="#2a3a2a" stroke-width="2" fill="none"/><path d="M18 40 Q50 30 82 40 Q50 46 18 40Z" fill="#1e2a1a"/><path d="M34 38 L58 0 L66 36Z" fill="#1e2a1a"/><path d="M36 34 h28" stroke="${u.glow || '#a8e05a'}" stroke-width="3"/><path d="M80 92 L84 50" stroke="#6a4a2a" stroke-width="3"/><circle cx="84" cy="48" r="5" fill="${u.glow || '#a8e05a'}"/>`; break;
      case 'eye': s = `<g stroke="${dk}" stroke-width="4" fill="none" stroke-linecap="round"><path d="M30 70 q-8 14 -2 24 M42 76 q-2 12 4 20 M58 76 q2 12 -4 20 M70 70 q8 14 2 24"/></g><circle cx="50" cy="48" r="32" fill="${c}"/><circle cx="50" cy="48" r="20" fill="#fff"/><circle cx="50" cy="48" r="12" fill="${u.glow || '#c83a5a'}"/><circle cx="50" cy="48" r="5" fill="#1a1010"/><circle cx="44" cy="42" r="3" fill="#fff"/><path d="M18 34 Q50 14 82 34" stroke="${dk}" stroke-width="4" fill="none"/>`; break;
      case 'knight': s = `<path d="M20 92 C20 66 32 58 50 58 C68 58 80 66 80 92Z" fill="${c}"/><path d="M20 66 C14 62 10 70 14 78 L22 76Z M80 66 C86 62 90 70 86 78 L78 76Z" fill="${lt}"/><path d="M30 54 C28 26 40 14 50 14 C60 14 72 26 70 54 C66 62 34 62 30 54Z" fill="${lt}"/><rect x="34" y="36" width="32" height="6" fill="#0a0a10"/><circle cx="42" cy="39" r="2" fill="${u.glow || '#ff4a3a'}"/><circle cx="58" cy="39" r="2" fill="${u.glow || '#ff4a3a'}"/><path d="M50 14 C46 4 54 -2 60 4" stroke="#8a2a2a" stroke-width="4" fill="none"/><path d="M50 44 v12" stroke="${dk}" stroke-width="2"/><path d="M84 30 L84 92" stroke="#c8ccd4" stroke-width="4"/><rect x="78" y="62" width="12" height="4" fill="#8a6a3a"/>`; break;
      case 'serpent': s = `<path d="M18 90 C10 76 30 70 50 74 C72 78 90 72 84 60 C80 52 64 56 60 48" stroke="${c}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M40 40 C40 22 76 22 76 40 C76 52 64 58 58 58 C50 58 40 52 40 40Z" fill="${c}"/><path d="M42 34 C50 16 70 18 74 34" fill="${dk}" opacity=".5"/>${eye(50, 36, 4, u.glow || '#ffe44a')}${eye(66, 36, 4, u.glow || '#ffe44a')}<path d="M58 56 l-2 10 M58 66 l-4 4 M58 66 l4 4" stroke="#e84a5a" stroke-width="2"/>`; break;
      case 'mimic': s = `<rect x="14" y="44" width="72" height="46" rx="4" fill="${c}"/><path d="M14 44 C14 18 86 18 86 44Z" fill="${lt}"/><path d="M14 44 h72" stroke="#3a2412" stroke-width="3"/><rect x="44" y="40" width="12" height="12" rx="2" fill="#f4c84a"/><path d="M18 46 l6 10 6 -10 6 10 6 -10 6 10 6 -10 6 10 6 -10 6 10 6 -10" fill="#fff" stroke="#c8c0b0" stroke-width=".5"/><path d="M38 50 C42 70 58 72 62 50" fill="#c83a4a"/>${eye(30, 32, 4, u.glow || '#ffe44a')}${eye(70, 32, 4, u.glow || '#ffe44a')}<path d="M14 66 h72 M30 44 v46 M70 44 v46" stroke="#3a2412" stroke-width="2"/>`; break;
      case 'frog': s = `<ellipse cx="50" cy="68" rx="38" ry="24" fill="${c}"/><circle cx="30" cy="40" r="13" fill="${c}"/><circle cx="70" cy="40" r="13" fill="${c}"/><circle cx="30" cy="38" r="8" fill="#fff8c8"/><circle cx="70" cy="38" r="8" fill="#fff8c8"/><ellipse cx="30" cy="38" rx="2.5" ry="6" fill="#1a1010"/><ellipse cx="70" cy="38" rx="2.5" ry="6" fill="#1a1010"/><path d="M22 66 Q50 82 78 66" stroke="#1a2a10" stroke-width="3" fill="none"/><ellipse cx="50" cy="80" rx="22" ry="8" fill="${lt}" opacity=".6"/><circle cx="28" cy="58" r="3" fill="${dk}"/><circle cx="72" cy="58" r="3" fill="${dk}"/>`; break;
      case 'worm': s = `<path d="M14 92 C14 64 32 50 50 50 C68 50 86 64 86 92Z" fill="${c}"/><path d="M26 66 Q50 58 74 66 M20 80 Q50 72 80 80" stroke="${dk}" stroke-width="3" fill="none"/><ellipse cx="50" cy="40" rx="${u.big ? 30 : 22}" ry="${u.big ? 26 : 20}" fill="${c}"/><circle cx="50" cy="40" r="${u.big ? 18 : 12}" fill="#3a1a1a"/>${teeth(30, 38, 62)}<circle cx="50" cy="42" r="${u.big ? 8 : 5}" fill="#8a2a3a"/>${u.glow ? `<circle cx="32" cy="28" r="3" fill="${u.glow}"/><circle cx="68" cy="28" r="3" fill="${u.glow}"/>` : ''}`; break;
      case 'wisp': s = `<circle cx="50" cy="56" r="34" fill="${c}" opacity=".18"/><path d="M50 14 C66 34 74 52 66 70 C60 82 40 82 34 70 C26 52 34 36 50 14Z" fill="${c}" opacity=".85"/><path d="M50 36 C58 48 60 58 56 66 C52 72 48 72 44 66 C40 58 42 48 50 36Z" fill="#fff" opacity=".7"/><circle cx="44" cy="58" r="3" fill="#1a3a2a"/><circle cx="56" cy="58" r="3" fill="#1a3a2a"/>`; break;
      case 'croc': { const sm = u.small; s = `<path d="M${sm ? 70 : 76} 76 C90 78 98 70 98 60 C92 66 84 68 74 66Z" fill="${dk}"/><ellipse cx="54" cy="72" rx="34" ry="18" fill="${c}"/><path d="M4 56 C4 46 26 40 50 44 L56 60 C40 64 20 66 4 62Z" fill="${c}"/><path d="M4 62 C20 66 40 66 56 62 L54 70 C36 74 18 72 6 68Z" fill="${lt}"/><path d="M8 62 l3 -4 3 4 3 -4 3 4 3 -4 3 4 3 -4 3 4 3 -4 3 4" fill="none" stroke="#fff" stroke-width="2"/>${eye(40, 44, 4.5, u.glow || '#ffe44a')}<path d="M30 74 l-4 16 M70 76 l4 14" stroke="${dk}" stroke-width="6" stroke-linecap="round"/><path d="M50 60 l6 -6 6 6 6 -6 6 6" fill="none" stroke="${dk}" stroke-width="2"/>`; } break;
      case 'insect': s = `<ellipse cx="34" cy="38" rx="20" ry="9" fill="#d8eef8" opacity=".6" transform="rotate(-25 34 38)"/><ellipse cx="66" cy="38" rx="20" ry="9" fill="#d8eef8" opacity=".6" transform="rotate(25 66 38)"/><ellipse cx="50" cy="66" rx="12" ry="18" fill="${c}"/><path d="M40 60 h20 M40 68 h20 M42 76 h16" stroke="${dk}" stroke-width="2"/><circle cx="50" cy="44" r="10" fill="${dk}"/><circle cx="45" cy="42" r="4" fill="${u.glow || '#c83a3a'}"/><circle cx="55" cy="42" r="4" fill="${u.glow || '#c83a3a'}"/><path d="M50 50 L50 64" stroke="#2a1a1a" stroke-width="2"/><path d="M40 70 l-12 14 M60 70 l12 14 M42 78 l-8 16 M58 78 l8 16" stroke="${dk}" stroke-width="2"/>`; break;
      case 'treant': s = `<path d="M36 92 C38 70 34 54 30 40 L70 40 C66 54 62 70 64 92Z" fill="${c}"/><path d="M30 40 C14 34 10 20 18 12 C26 16 30 26 34 30 M70 40 C86 34 90 20 82 12 C74 16 70 26 66 30 M50 40 C50 24 56 12 64 8" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="20" cy="14" r="9" fill="#5a7a3a" opacity=".8"/><circle cx="82" cy="14" r="9" fill="#4a6a2a" opacity=".8"/><circle cx="64" cy="8" r="8" fill="#6a7a3a" opacity=".8"/><ellipse cx="42" cy="54" rx="5" ry="6" fill="#1a1008"/><ellipse cx="58" cy="54" rx="5" ry="6" fill="#1a1008"/><circle cx="42" cy="55" r="2" fill="${u.glow || '#c8ff6a'}"/><circle cx="58" cy="55" r="2" fill="${u.glow || '#c8ff6a'}"/><path d="M40 70 Q50 64 60 70 L56 76 Q50 72 44 76Z" fill="#1a1008"/><path d="M36 92 l-10 -2 M64 92 l10 -2" stroke="${dk}" stroke-width="5" stroke-linecap="round"/>`; break;
      case 'scorpion': s = `<path d="M70 70 C90 64 94 40 82 26 C78 20 70 22 70 28" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M70 28 l-8 -4 4 10Z" fill="#2a1a1a"/><g stroke="${dk}" stroke-width="3" stroke-linecap="round">${[0, 1, 2].map((i) => `<path d="M${36 + i * 8} 78 l-6 14 M${44 + i * 8} 78 l6 14"/>`).join('')}</g><ellipse cx="48" cy="70" rx="24" ry="13" fill="${c}"/><path d="M26 64 C14 58 10 48 14 40 M14 40 l-8 -4 M14 40 l2 -8 M70 64 C82 60 90 52 88 46" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>${eye(40, 62, 3, u.glow || '#ff4a3a')}${eye(50, 62, 3, u.glow || '#ff4a3a')}<path d="M30 70 h36" stroke="${dk}" stroke-width="2"/>`; break;
      case 'mummy': s = `<path d="M24 92 C24 70 34 62 50 62 C66 62 76 70 76 92Z" fill="${c}"/><path d="M28 50 C26 26 40 16 50 16 C60 16 74 26 72 50 C70 62 60 66 50 66 C40 66 30 62 28 50Z" fill="${c}"/><g stroke="${shade(c, -0.25)}" stroke-width="2.5" fill="none"><path d="M28 28 L72 36 M28 40 L72 32 M30 54 L70 48 M32 60 L68 64 M26 72 L74 80 M26 84 L74 76"/></g><rect x="34" y="40" width="32" height="10" fill="#1a1008"/>${eye(42, 45, 3, u.glow || '#ffe44a')}${eye(58, 45, 3, u.glow || '#ffe44a')}<path d="M72 66 C82 66 88 72 86 80" stroke="${c}" stroke-width="5" fill="none"/>`; break;
      case 'elemental': s = `<circle cx="50" cy="54" r="40" fill="${c}" opacity=".18"/><path d="M50 8 L64 30 L84 30 L72 52 L82 76 L58 72 L50 94 L42 72 L18 76 L28 52 L16 30 L36 30Z" fill="${c}"/><path d="M50 22 L58 36 L70 36 L62 50 L68 66 L54 62 L50 76 L46 62 L32 66 L38 50 L30 36 L42 36Z" fill="${lt}" opacity=".7"/>${eye(43, 46, 4, '#fff')}${eye(57, 46, 4, '#fff')}<path d="M44 58 q6 4 12 0" stroke="${dk}" stroke-width="2.5" fill="none"/>`; break;
      case 'bandit': s = `<path d="M22 92 C22 72 34 64 50 64 C66 64 78 72 78 92Z" fill="${c}"/><path d="M28 92 L36 66 L44 92Z" fill="${dk}"/><path d="M28 48 C26 26 40 16 50 16 C60 16 74 26 72 48 C70 60 60 66 50 66 C40 66 30 60 28 48Z" fill="#c89a6a"/><path d="M24 42 C22 14 78 14 76 42 C66 34 34 34 24 42Z" fill="#e8d8b0"/><path d="M28 50 h44 v10 C60 66 40 66 28 60Z" fill="#e8d8b0"/>${eye(41, 46, 3.5, u.glow || '#2a1a1a')}${eye(59, 46, 3.5, u.glow || '#2a1a1a')}<path d="M70 70 L92 48" stroke="#c8ccd4" stroke-width="4"/><path d="M68 72 l6 -2 -2 6Z" fill="#8a6a3a"/>`; break;
      case 'penguin': s = `<ellipse cx="50" cy="62" rx="26" ry="32" fill="${c}"/><ellipse cx="50" cy="66" rx="17" ry="25" fill="#f4f4f0"/><circle cx="50" cy="32" r="18" fill="${c}"/><ellipse cx="50" cy="36" rx="11" ry="9" fill="#f4f4f0"/>${eye(44, 32, 3, '#1a1010')}${eye(56, 32, 3, '#1a1010')}<path d="M46 38 L50 44 L54 38Z" fill="#f0a030"/><path d="M24 56 C14 66 16 76 22 78 M76 56 C86 66 84 76 78 78" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M40 92 h-8 M60 92 h8" stroke="#f0a030" stroke-width="4" stroke-linecap="round"/><path d="M30 18 h40 l-4 -8 h-32Z" fill="#8a2a2a"/><path d="M80 80 L92 40" stroke="#c8ccd4" stroke-width="3"/>`; break;
      case 'walrus': s = `<ellipse cx="50" cy="66" rx="40" ry="26" fill="${c}"/><ellipse cx="50" cy="44" rx="28" ry="22" fill="${c}"/><ellipse cx="40" cy="54" rx="10" ry="8" fill="${lt}"/><ellipse cx="60" cy="54" rx="10" ry="8" fill="${lt}"/><path d="M40 58 C38 70 40 80 42 84 M60 58 C62 70 60 80 58 84" stroke="#f4ecd8" stroke-width="5" fill="none" stroke-linecap="round"/>${eye(38, 38, 3.5, u.glow || '#1a1010')}${eye(62, 38, 3.5, u.glow || '#1a1010')}<circle cx="50" cy="48" r="3.5" fill="#1a1010"/>`; break;
      case 'mammoth': s = `<path d="M10 92 C8 60 24 40 50 40 C76 40 92 60 90 92Z" fill="${c}"/><path d="M26 92 v-10 M74 92 v-10" stroke="${dk}" stroke-width="10"/><ellipse cx="50" cy="44" rx="24" ry="22" fill="${shade(c, 0.1)}"/><path d="M18 34 C8 40 8 58 16 64 C22 54 24 44 28 40Z M82 34 C92 40 92 58 84 64 C78 54 76 44 72 40Z" fill="${dk}"/><path d="M44 58 C42 72 46 84 54 90" stroke="${shade(c, 0.1)}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M38 56 C26 64 22 76 30 82 M62 56 C74 64 78 76 70 82" stroke="#f4ecd8" stroke-width="5" fill="none" stroke-linecap="round"/>${eye(40, 42, 3.5)}${eye(60, 42, 3.5)}`; break;
      case 'dragon': s = `<path d="M10 30 L34 46 L20 60Z M90 30 L66 46 L80 60Z" fill="${dk}"/><path d="M28 28 L36 6 L42 28 M72 28 L64 6 L58 28" fill="#f0e6d0"/><path d="M18 56 C18 24 82 24 82 56 C82 76 66 92 50 92 C34 92 18 76 18 56Z" fill="${c}"/><ellipse cx="50" cy="74" rx="18" ry="12" fill="${lt}"/><circle cx="43" cy="72" r="2.5" fill="#1a1010"/><circle cx="57" cy="72" r="2.5" fill="#1a1010"/>${eye(36, 50, 6)}${eye(64, 50, 6)}<path d="M28 42 l14 6 M72 42 l-14 6" stroke="${dk}" stroke-width="3"/>`; break;
      case 'hydra': { const head = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-12 0 C-12 -14 12 -14 12 0 C12 10 4 14 0 14 C-4 14 -12 10 -12 0Z" fill="${c}"/><path d="M-6 8 h12" stroke="#fff" stroke-width="2" stroke-dasharray="2 2"/><circle cx="-5" cy="-3" r="2.5" fill="${eyeC}"/><circle cx="5" cy="-3" r="2.5" fill="${eyeC}"/></g>`;
        s = `<ellipse cx="50" cy="80" rx="36" ry="14" fill="${dk}"/><path d="M30 80 C20 60 16 40 22 28 M50 80 C50 56 50 36 50 20 M70 80 C80 60 84 40 78 28" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>${head(22, 26, 1)}${head(50, 18, 1.15)}${head(78, 26, 1)}`; } break;
      case 'sphinx': s = `<path d="M8 92 C8 70 26 58 50 58 C74 58 92 70 92 92Z" fill="${c}"/><path d="M50 10 C26 10 16 30 18 50 C20 66 32 76 50 76 C68 76 80 66 82 50 C84 30 74 10 50 10Z" fill="#2a4a8a"/><path d="M26 18 h48 M24 30 h52 M22 42 h56" stroke="#e8c84a" stroke-width="3"/><ellipse cx="50" cy="48" rx="18" ry="22" fill="${lt}"/>${eye(43, 44, 3.5, u.glow || '#2a1a1a')}${eye(57, 44, 3.5, u.glow || '#2a1a1a')}<path d="M44 58 q6 3 12 0" stroke="#6a4a2a" stroke-width="2" fill="none"/><path d="M46 66 h8 v10 h-8Z" fill="#2a4a8a"/>`; break;
    }
    let pre = '';
    const gc = u.boss ? u.glow || '#ffd98a' : u.glow;
    if (gc) { const gid = 'eg' + (++uid); pre = `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="${gc}" stop-opacity=".45"/><stop offset="1" stop-color="${gc}" stop-opacity="0"/></radialGradient></defs><ellipse cx="50" cy="56" rx="52" ry="50" fill="url(#${gid})"/>`; }
    return `<svg class="enemy-svg${u.boss ? ' boss' : ''}" viewBox="0 -6 100 104" role="img" aria-label="${u.name}">${pre}${crown}${u.shape !== 'imp' && u.shape !== 'bear' ? horns : ''}${s}</svg>`;
  }
  // um bando desenha vários membros numa só unidade; os que caíram somem
  function enemyArt(u, alive) {
    const n = u.count || 1;
    if (n <= 1) return enemySvg(u);
    if (alive == null) alive = n;
    const one = enemySvg(Object.assign({}, u, { count: 1 }));
    return `<div class="pack n${n}">${Array.from({ length: n }, (_, i) => `<div class="mem m${i}${i >= alive ? ' gone' : ''}">${one}</div>`).join('')}</div>`;
  }

  /* ----- Cenários de batalha (um por região) ----- */
  function sceneSvg(region) {
    const R = (seed) => { let a = seed; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; };
    const r = R(7 + region * 13);
    const W = 1000, H = 560, hor = 268;
    const defs = (sky, ground) => `<defs><linearGradient id="sk${region}" x1="0" y1="0" x2="0" y2="1">${sky.map((c, i) => `<stop offset="${i / (sky.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
      <linearGradient id="gr${region}" x1="0" y1="0" x2="0" y2="1">${ground.map((c, i) => `<stop offset="${i / (ground.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
      <radialGradient id="vg${region}" cx=".5" cy=".55" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>`;
    const base = (extraSky, extraGround) => `<rect width="${W}" height="${hor + 10}" fill="url(#sk${region})"/>${extraSky}<rect y="${hor}" width="${W}" height="${H - hor}" fill="url(#gr${region})"/>${extraGround}<rect width="${W}" height="${H}" fill="url(#vg${region})"/>`;
    let o = '';
    if (region === 0) { // Floresta Sussurrante
      let trees = '';
      for (let i = 0; i < 34; i++) { const x = i * 31 + r() * 20 - 10, h = 70 + r() * 90, y = hor + 6; trees += `<path d="M${x} ${y - h} L${x + h * 0.28} ${y} L${x - h * 0.28} ${y}Z" fill="${i % 2 ? '#14241f' : '#1a2e26'}"/>`; }
      let fire = ''; for (let i = 0; i < 16; i++) fire += `<circle class="ff" style="animation-delay:${(r() * 4).toFixed(2)}s" cx="${(r() * W).toFixed(0)}" cy="${(hor - 40 + r() * 220).toFixed(0)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="#ffe48a"/>`;
      o = defs(['#1b2440', '#3e3656', '#a8616a', '#f0a66a'], ['#3c5a30', '#2c4424', '#1a2a16']) + base(
        `<circle cx="760" cy="232" r="70" fill="#ffd79a" opacity=".55"/><path d="M0 230 Q150 180 320 222 T640 210 T1000 226 L1000 ${hor + 10} L0 ${hor + 10}Z" fill="#2a3838" opacity=".9"/>${trees}`,
        `<path d="M260 ${H} C380 420 620 420 740 ${H}Z" fill="#5a4a32" opacity=".45"/><path d="M0 ${H} L0 470 C60 450 90 480 120 ${H}Z M1000 ${H} L1000 460 C940 445 900 480 880 ${H}Z" fill="#132016"/>${fire}`);
    } else if (region === 1) { // Cripta Esquecida
      let tombs = ''; for (let i = 0; i < 9; i++) { const x = 40 + i * 115 + r() * 30, y = hor + 18 + r() * 30, w = 24 + r() * 16; tombs += `<path d="M${x} ${y} v-${w * 1.2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${w * 1.2}Z" fill="#3a3448" stroke="#2a2436"/>`; }
      let arch = ''; for (let i = 0; i < 6; i++) { const x = 60 + i * 180; arch += `<rect x="${x}" y="150" width="26" height="${hor - 150}" fill="#1c1630"/><path d="M${x} 160 Q${x + 90} 70 ${x + 180} 160" stroke="#1c1630" stroke-width="22" fill="none"/>`; }
      o = defs(['#0d0a1c', '#241a3e', '#3e2e5a'], ['#2e2a3a', '#211e2c', '#141218']) + base(
        `<circle cx="820" cy="96" r="80" fill="#c8c0e8" opacity=".12"/><circle cx="820" cy="96" r="44" fill="#ece8f6"/><circle cx="804" cy="86" r="8" fill="#d8d2ea"/>${arch}<path d="M0 ${hor} L0 230 L60 220 L80 180 L100 220 L1000 236 L1000 ${hor}Z" fill="#151026"/>`,
        `${tombs}<g class="fog"><ellipse cx="300" cy="${hor + 40}" rx="320" ry="26" fill="#cfc8ea" opacity=".07"/><ellipse cx="760" cy="${hor + 90}" rx="300" ry="30" fill="#cfc8ea" opacity=".06"/></g>`);
    } else if (region === 2) { // Montanhas de Ferro
      o = defs(['#2c4864', '#6a8ca8', '#b8cad4'], ['#6e5e4c', '#4e4236', '#2e2620']) + base(
        `<path d="M0 ${hor} L120 120 L210 200 L330 70 L470 210 L560 130 L700 230 L820 90 L1000 220 L1000 ${hor}Z" fill="#6c7e94"/><path d="M120 120 L95 150 L140 148Z M330 70 L295 115 L362 110Z M820 90 L790 130 L850 126Z M560 130 L540 155 L582 154Z" fill="#eef2f6"/><path d="M0 ${hor} L80 210 L190 250 L300 190 L420 246 L560 200 L700 252 L840 196 L1000 248 L1000 ${hor}Z" fill="#4a5a6a"/>`,
        `${Array.from({ length: 7 }, (_, i) => { const x = 60 + i * 150 + r() * 40, y = hor + 30 + r() * 60, w = 30 + r() * 40; return `<path d="M${x} ${y} l${w * 0.3} -${w * 0.6} l${w * 0.5} ${w * 0.1} l${w * 0.3} ${w * 0.5}Z" fill="#5a5048" stroke="#3a322c"/>`; }).join('')}`);
    } else if (region === 4) { // Pântano das Brumas
      let deadTrees = ''; for (let i = 0; i < 6; i++) { const x = 60 + i * 175 + r() * 40, h = 90 + r() * 70; deadTrees += `<path d="M${x} ${hor + 4} L${x + 4} ${hor - h} M${x + 3} ${hor - h * 0.6} L${x + 26} ${hor - h * 0.85} M${x + 2} ${hor - h * 0.4} L${x - 22} ${hor - h * 0.62}" stroke="#1a2418" stroke-width="7" stroke-linecap="round"/>`; }
      let pools = ''; for (let i = 0; i < 5; i++) pools += `<ellipse cx="${(80 + i * 210 + r() * 60).toFixed(0)}" cy="${(hor + 40 + r() * 180).toFixed(0)}" rx="${(60 + r() * 50).toFixed(0)}" ry="${(10 + r() * 8).toFixed(0)}" fill="#2a4a3a" opacity=".8"/>`;
      let ff = ''; for (let i = 0; i < 14; i++) ff += `<circle class="ff" style="animation-delay:${(r() * 4).toFixed(2)}s" cx="${(r() * W).toFixed(0)}" cy="${(hor - 60 + r() * 240).toFixed(0)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="#a8ff8a"/>`;
      o = defs(['#141e1a', '#2a3a2c', '#5a6a44'], ['#34402a', '#26301e', '#141a10']) + base(
        `<circle cx="300" cy="190" r="60" fill="#d8e8a8" opacity=".2"/><path d="M0 ${hor} Q200 220 420 246 T1000 236 L1000 ${hor + 10} L0 ${hor + 10}Z" fill="#1e2a20"/>${deadTrees}`,
        `${pools}<g class="fog"><ellipse cx="260" cy="${hor + 30}" rx="360" ry="34" fill="#c8e8c8" opacity=".09"/><ellipse cx="760" cy="${hor + 120}" rx="320" ry="30" fill="#c8e8c8" opacity=".07"/></g>${ff}`);
    } else if (region === 5) { // Deserto de Âmbar
      o = defs(['#4a7ab0', '#e0a860', '#f6d08a'], ['#e0b06a', '#c8904a', '#8a5a2a']) + base(
        `<circle cx="760" cy="150" r="56" fill="#fff2c8"/><circle cx="760" cy="150" r="110" fill="#fff2c8" opacity=".18"/><path d="M120 ${hor} L230 150 L340 ${hor}Z" fill="#b8804a"/><path d="M230 150 L340 ${hor} L280 ${hor}Z" fill="#94643a"/><path d="M380 ${hor} L450 196 L520 ${hor}Z" fill="#a8743e"/><path d="M0 ${hor} Q250 226 520 252 T1000 240 L1000 ${hor + 10} L0 ${hor + 10}Z" fill="#d89e5a"/>`,
        `<path d="M0 ${hor + 120} Q300 ${hor + 70} 620 ${hor + 130} T1000 ${hor + 110} L1000 ${H} L0 ${H}Z" fill="#c88c48" opacity=".55"/><path d="M60 ${hor + 60} v-50 M60 ${hor + 30} h-14 v-16 M60 ${hor + 22} h12 v-14" stroke="#4a6a3a" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M930 ${hor + 90} v-46 M930 ${hor + 62} h12 v-14" stroke="#4a6a3a" stroke-width="7" stroke-linecap="round" fill="none"/>`);
    } else if (region === 6) { // Geleira Eterna
      let spikes = ''; for (let i = 0; i < 12; i++) { const x = i * 90 + r() * 40, h = 40 + r() * 70; spikes += `<path d="M${x} ${hor + 4} L${x + 16} ${hor - h} L${x + 34} ${hor + 4}Z" fill="${i % 2 ? '#a8d0e8' : '#c8e4f4'}"/><path d="M${x + 16} ${hor - h} L${x + 34} ${hor + 4} L${x + 22} ${hor + 4}Z" fill="#88b0cc"/>`; }
      let snow = ''; for (let i = 0; i < 40; i++) snow += `<circle class="snow" style="animation-delay:-${(r() * 8).toFixed(2)}s" cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(1 + r() * 2.2).toFixed(1)}" fill="#fff" opacity=".8"/>`;
      o = defs(['#0e1a34', '#1e3a5a', '#5a8aa8'], ['#e8f2f8', '#c8dcea', '#9ab8cc']) + base(
        `<path d="M0 120 C200 60 400 160 600 90 S900 70 1000 110" stroke="#6affc8" stroke-width="40" fill="none" opacity=".18"/><path d="M0 150 C250 100 450 190 700 120 S950 110 1000 140" stroke="#8a6aff" stroke-width="26" fill="none" opacity=".14"/><path d="M0 ${hor} L140 150 L260 220 L380 130 L520 230 L660 160 L800 220 L940 140 L1000 180 L1000 ${hor}Z" fill="#8aa8c8"/><path d="M140 150 L118 176 L162 172Z M380 130 L356 160 L404 158Z M940 140 L918 168 L962 166Z" fill="#f4faff"/>${spikes}`,
        `<path d="M0 ${hor + 80} Q260 ${hor + 50} 520 ${hor + 90} T1000 ${hor + 70}" stroke="#ffffff" stroke-width="3" fill="none" opacity=".5"/>${snow}`);
    } else if (region === 7) { // Coração do Vulcão
      let embers = ''; for (let i = 0; i < 24; i++) embers += `<circle class="ember" style="animation-delay:-${(r() * 5).toFixed(2)}s" cx="${(r() * W).toFixed(0)}" cy="${(hor + r() * 260).toFixed(0)}" r="${(1.2 + r() * 2).toFixed(1)}" fill="#ffb04a"/>`;
      o = defs(['#120606', '#3a0e0a', '#8a2a14'], ['#3a2420', '#24140f', '#120a08']) + base(
        `<path d="M300 ${hor} L440 120 L480 110 L520 118 L660 ${hor}Z" fill="#2a1410"/><path d="M440 120 L480 110 L520 118 L500 140 L470 136Z" fill="#ff6a2a"/><circle cx="480" cy="100" r="70" fill="#ff6a2a" opacity=".22"/><path class="flame" d="M470 112 C460 80 480 60 482 40 C494 66 504 84 492 112Z" fill="#ffb04a"/><path d="M0 ${hor} L120 200 L220 240 L300 ${hor}Z M660 ${hor} L780 210 L880 236 L1000 200 L1000 ${hor}Z" fill="#1e0e0c"/><path d="M462 150 C450 200 470 230 440 ${hor} M500 150 C512 200 496 236 520 ${hor}" stroke="#ff7a2a" stroke-width="5" fill="none" opacity=".8"/>`,
        `<path d="M-20 ${hor + 70} C200 ${hor + 40} 340 ${hor + 120} 520 ${hor + 90} S820 ${hor + 30} 1020 ${hor + 80}" stroke="#ff6a2a" stroke-width="16" fill="none" opacity=".85"/><path d="M-20 ${hor + 70} C200 ${hor + 40} 340 ${hor + 120} 520 ${hor + 90} S820 ${hor + 30} 1020 ${hor + 80}" stroke="#ffd06a" stroke-width="5" fill="none"/><path d="M80 ${H} C180 ${hor + 200} 300 ${hor + 230} 360 ${H}" stroke="#ff5a1a" stroke-width="10" fill="none" opacity=".6"/>${embers}`);
    } else { // Templo Sombrio
      let cols = ''; for (let i = 0; i < 7; i++) { const x = 30 + i * 160; cols += `<rect x="${x}" y="110" width="40" height="${hor - 110}" fill="#2a1418"/><rect x="${x - 8}" y="100" width="56" height="16" fill="#3a1c22"/>`; }
      const brazier = (x) => `<rect x="${x - 6}" y="${hor - 40}" width="12" height="44" fill="#2a1a1a"/><path d="M${x - 20} ${hor - 44} h40 l-6 10 h-28Z" fill="#4a2a24"/><path class="flame" d="M${x} ${hor - 90} C${x + 16} ${hor - 66} ${x + 14} ${hor - 50} ${x} ${hor - 44} C${x - 14} ${hor - 50} ${x - 16} ${hor - 66} ${x} ${hor - 90}Z" fill="#ff8a3a"/><circle cx="${x}" cy="${hor - 60}" r="40" fill="#ff8a3a" opacity=".15"/>`;
      o = defs(['#1a0610', '#4a1426', '#9a3a34', '#e07040'], ['#3e2a2a', '#2a1c1e', '#160e10']) + base(
        `<circle cx="500" cy="250" r="120" fill="#ff9a5a" opacity=".25"/>${cols}${brazier(250)}${brazier(750)}`,
        `${Array.from({ length: 9 }, (_, i) => `<path d="M${i * 125} ${hor} L${-200 + i * 175} ${H}" stroke="#2a1a1c" stroke-width="2"/>`).join('')}<path d="M0 ${hor + 70} H${W} M0 ${hor + 170} H${W}" stroke="#2a1a1c" stroke-width="2"/>`);
    }
    return `<svg class="scene-bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${o}</svg>`;
  }

  G.ART = { heroSvg, enemySvg, enemyArt, petSvg, shade, sceneSvg };
})(typeof window !== 'undefined' ? window : globalThis);
