/* ===== Dados do jogo: classes, habilidades, itens, inimigos ===== */
(function (G) {
  const DIFF = {
    mf: { id: 'mf', name: 'Muito fácil', xp: 10, color: 'var(--d-mf)' },
    f:  { id: 'f',  name: 'Fácil',       xp: 20, color: 'var(--d-f)' },
    m:  { id: 'm',  name: 'Médio',       xp: 35, color: 'var(--d-m)' },
    d:  { id: 'd',  name: 'Difícil',     xp: 60, color: 'var(--d-d)' },
  };
  const CARRY_BONUS = 0.5;       // +50% XP para tarefa acumulada de dias anteriores
  const MAX_HEROES = 5;
  // Dificuldade da guilda: multiplica vida e poder dos inimigos
  const LEVELS = {
    facil:   { name: 'Tranquila',  mul: 0.85, blurb: 'Vitórias frequentes. Bom para começar.' },
    normal:  { name: 'Normal',     mul: 1.0,  blurb: 'Uma família ativa vence a maioria, mas não todas.' },
    dificil: { name: 'Desafiadora', mul: 1.15, blurb: 'Derrotas são comuns. Cada tarefa pesa.' },
    epico:   { name: 'Épica',      mul: 1.3,  blurb: 'Só um grupo muito dedicado avança rápido.' },
  };
  const xpToNext = (lvl) => 80 + 40 * lvl;

  // Níveis mínimos por fileira da árvore
  const TIER_LVL = [1, 3, 6, 10, 15, 20, 26, 33, 41, 50];

  /* Tipos de efeito
     Passivas (p): hpPct, atkPct, defPct, spd, crit, critDmg, dodge, lifesteal, healPow,
                   thorns, regen, pierce, burnPct, poisonOnHit, partyDefPct, selfRevive
     Ativas (a):   strike, aoe, multi, execute, heal, healAll, shield, buffAtk, buffDodge,
                   taunt, selfBuff, revive, nature, miracle
  */
  const CLASSES = {
    gelo: {
      name: 'Mago de Gelo', role: 'Controle', color: '#8fd8f5', weapon: 'Cajado de Gelo', wkind: 'staffIce',
      blurb: 'Congela inimigos e protege o grupo com escudos de gelo.',
      hp: 72, hpG: 9, atk: 14, atkG: 3.1, def: 4, defG: 1.0, spd: 9, crit: 0.05, aggro: 1,
      skills: [
        { id: 'g1', col: 0, tier: 0, name: 'Lança de Gelo', type: 'a', act: 'strike', p: 1.6, cd: 2, chill: 2, desc: 'Dano alto em um alvo e reduz a velocidade dele.' },
        { id: 'g2', col: 2, tier: 0, name: 'Mente Gélida', type: 'p', max: 3, mod: { atkPct: 0.06 }, desc: '+6% de poder por nível.' },
        { id: 'g3', col: 0, tier: 1, req: ['g1'], name: 'Nevasca', type: 'a', act: 'aoe', p: 0.8, cd: 3, chill: 2, desc: 'Atinge todos os inimigos e reduz a velocidade deles.' },
        { id: 'g4', col: 2, tier: 1, req: ['g2'], name: 'Armadura de Gelo', type: 'a', act: 'shield', p: 0.45, cd: 4, desc: 'Escudo de gelo em todo o grupo.' },
        { id: 'g5', col: 0, tier: 2, req: ['g3'], name: 'Congelar', type: 'a', act: 'strike', p: 1.2, cd: 3, stun: 1, desc: 'Congela um inimigo, que perde o próximo turno.' },
        { id: 'g6', col: 1, tier: 2, req: ['g3', 'g4'], name: 'Frio Penetrante', type: 'p', max: 3, mod: { pierce: 0.1 }, desc: 'Ignora 10% da defesa inimiga por nível.' },
        { id: 'g7', col: 2, tier: 2, req: ['g4'], name: 'Pele de Geada', type: 'p', max: 3, mod: { defPct: 0.08, hpPct: 0.05 }, desc: '+8% de defesa e +5% de vida por nível.' },
        { id: 'g8', col: 0, tier: 3, req: ['g5'], name: 'Tempestade de Granizo', type: 'a', act: 'aoe', p: 1.4, cd: 4, stunChance: 0.25, desc: 'Grande dano em área, com chance de congelar.' },
        { id: 'g9', col: 2, tier: 3, req: ['g7'], name: 'Coração do Inverno', type: 'p', max: 3, mod: { crit: 0.05, critDmg: 0.1 }, desc: '+5% de chance crítica e +10% de dano crítico por nível.' },
        { id: 'g10', col: 1, tier: 4, reqAny: ['g8', 'g9'], name: 'Era do Gelo', type: 'a', act: 'aoe', p: 2.0, cd: 5, stun: 1, desc: 'Congela todos os inimigos e causa dano devastador.' },
      ],
    },
    fogo: {
      name: 'Mago de Fogo', role: 'Dano em área', color: '#ff8a4c', weapon: 'Cajado Flamejante', wkind: 'staffFire',
      blurb: 'Queima grupos inteiros de inimigos. Frágil, mas explosivo.',
      hp: 66, hpG: 8, atk: 16, atkG: 3.5, def: 3, defG: 0.8, spd: 10, crit: 0.06, aggro: 1,
      skills: [
        { id: 'f1', col: 0, tier: 0, name: 'Bola de Fogo', type: 'a', act: 'strike', p: 1.7, cd: 2, burn: 0.3, desc: 'Dano em um alvo e deixa ele queimando.' },
        { id: 'f2', col: 2, tier: 0, name: 'Chama Interior', type: 'p', max: 3, mod: { atkPct: 0.07 }, desc: '+7% de poder por nível.' },
        { id: 'f3', col: 0, tier: 1, req: ['f1'], name: 'Explosão Flamejante', type: 'a', act: 'aoe', p: 0.9, cd: 3, burn: 0.2, desc: 'Explosão que atinge e queima todos os inimigos.' },
        { id: 'f4', col: 2, tier: 1, req: ['f2'], name: 'Ignição', type: 'p', max: 3, mod: { burnPct: 0.3 }, desc: 'Queimaduras causam +30% de dano por nível.' },
        { id: 'f5', col: 0, tier: 2, req: ['f3'], name: 'Meteoro', type: 'a', act: 'strike', p: 2.6, cd: 4, desc: 'Um meteoro esmaga um inimigo.' },
        { id: 'f6', col: 1, tier: 2, req: ['f3', 'f4'], name: 'Combustão', type: 'p', max: 3, mod: { crit: 0.05 }, desc: '+5% de chance crítica por nível.' },
        { id: 'f7', col: 2, tier: 2, req: ['f4'], name: 'Fênix Interior', type: 'p', max: 1, mod: { selfRevive: 0.35 }, desc: 'Uma vez por batalha, renasce das cinzas com 35% de vida.' },
        { id: 'f8', col: 0, tier: 3, req: ['f5'], name: 'Mar de Chamas', type: 'a', act: 'aoe', p: 1.5, cd: 4, burn: 0.35, desc: 'Incendeia todo o campo de batalha.' },
        { id: 'f9', col: 2, tier: 3, req: ['f7'], name: 'Calor Abrasador', type: 'p', max: 3, mod: { critDmg: 0.15, atkPct: 0.03 }, desc: '+15% de dano crítico e +3% de poder por nível.' },
        { id: 'f10', col: 1, tier: 4, reqAny: ['f8', 'f9'], name: 'Chuva de Meteoros', type: 'a', act: 'multi', hits: 5, p: 1.0, cd: 5, burn: 0.25, desc: 'Cinco meteoros caem sobre inimigos aleatórios.' },
      ],
    },
    arqueiro: {
      name: 'Arqueiro', role: 'Dano preciso', color: '#a6d96a', weapon: 'Arco Longo', wkind: 'bow',
      blurb: 'Rápido e certeiro. Especialista em acertos críticos.',
      hp: 78, hpG: 10, atk: 15, atkG: 3.3, def: 5, defG: 1.2, spd: 13, crit: 0.12, aggro: 1.2,
      skills: [
        { id: 'a1', col: 0, tier: 0, name: 'Tiro Certeiro', type: 'a', act: 'strike', p: 1.8, cd: 2, desc: 'Uma flecha poderosa em um alvo.' },
        { id: 'a2', col: 2, tier: 0, name: 'Olho de Águia', type: 'p', max: 3, mod: { crit: 0.06 }, desc: '+6% de chance crítica por nível.' },
        { id: 'a3', col: 0, tier: 1, req: ['a1'], name: 'Chuva de Flechas', type: 'a', act: 'aoe', p: 0.85, cd: 3, desc: 'Flechas caem sobre todos os inimigos.' },
        { id: 'a4', col: 2, tier: 1, req: ['a2'], name: 'Passos Leves', type: 'p', max: 3, mod: { dodge: 0.05, spd: 1 }, desc: '+5% de esquiva e +1 de velocidade por nível.' },
        { id: 'a5', col: 0, tier: 2, req: ['a3'], name: 'Flecha Perfurante', type: 'a', act: 'strike', p: 2.0, cd: 3, pierce: 0.5, desc: 'Atravessa a armadura e ignora metade da defesa.' },
        { id: 'a6', col: 1, tier: 2, req: ['a3', 'a4'], name: 'Mira Mortal', type: 'p', max: 3, mod: { critDmg: 0.2 }, desc: '+20% de dano crítico por nível.' },
        { id: 'a7', col: 2, tier: 2, req: ['a4'], name: 'Rajada', type: 'a', act: 'multi', hits: 3, p: 0.85, cd: 3, desc: 'Três flechas rápidas em alvos aleatórios.' },
        { id: 'a8', col: 0, tier: 3, req: ['a5'], name: 'Tiro na Cabeça', type: 'a', act: 'execute', p: 2.2, cd: 4, desc: 'Dano dobrado em inimigos com pouca vida.' },
        { id: 'a9', col: 2, tier: 3, req: ['a7'], name: 'Ritmo de Caça', type: 'p', max: 3, mod: { spd: 2, atkPct: 0.04 }, desc: '+2 de velocidade e +4% de poder por nível.' },
        { id: 'a10', col: 1, tier: 4, reqAny: ['a8', 'a9'], name: 'Flecha Estelar', type: 'a', act: 'aoe', p: 2.3, cd: 5, pierce: 0.5, desc: 'Uma flecha de luz que atravessa todos os inimigos.' },
      ],
    },
    paladino: {
      name: 'Paladino', role: 'Tanque e suporte', color: '#f4d675', weapon: 'Martelo Sagrado', wkind: 'hammer',
      blurb: 'Protege os aliados, atrai inimigos e cura com luz sagrada.',
      hp: 112, hpG: 15, atk: 10, atkG: 2.2, def: 10, defG: 2.2, spd: 7, crit: 0.04, aggro: 2.5,
      skills: [
        { id: 'p1', col: 0, tier: 0, name: 'Golpe Sagrado', type: 'a', act: 'strike', p: 1.4, cd: 2, drain: 0.4, desc: 'Ataque que cura o paladino em 40% do dano causado.' },
        { id: 'p2', col: 2, tier: 0, name: 'Fé Inabalável', type: 'p', max: 3, mod: { defPct: 0.08 }, desc: '+8% de defesa por nível.' },
        { id: 'p3', col: 0, tier: 1, req: ['p1'], name: 'Provocação Divina', type: 'a', act: 'taunt', turns: 2, def: 0.35, cd: 4, desc: 'Atrai todos os ataques por 2 turnos e reforça a defesa.' },
        { id: 'p4', col: 2, tier: 1, req: ['p2'], name: 'Imposição de Mãos', type: 'a', act: 'heal', p: 2.2, cd: 3, desc: 'Cura bastante o aliado mais ferido.' },
        { id: 'p5', col: 0, tier: 2, req: ['p3'], name: 'Martelo da Justiça', type: 'a', act: 'strike', p: 1.8, cd: 4, stun: 1, desc: 'Atordoa um inimigo por um turno.' },
        { id: 'p6', col: 1, tier: 2, req: ['p3', 'p4'], name: 'Aura de Devoção', type: 'p', max: 3, mod: { partyDefPct: 0.05 }, desc: 'Todo o grupo ganha +5% de defesa por nível.' },
        { id: 'p7', col: 2, tier: 2, req: ['p4'], name: 'Bênção', type: 'a', act: 'healAll', p: 0.9, cd: 4, desc: 'Cura todo o grupo.' },
        { id: 'p8', col: 0, tier: 3, req: ['p5'], name: 'Escudo Sagrado', type: 'a', act: 'shield', p: 0.9, cd: 5, desc: 'Escudo de luz em todo o grupo.' },
        { id: 'p9', col: 2, tier: 3, req: ['p7'], name: 'Vigor Sagrado', type: 'p', max: 3, mod: { hpPct: 0.08 }, desc: '+8% de vida por nível.' },
        { id: 'p10', col: 1, tier: 4, reqAny: ['p8', 'p9'], name: 'Ressurreição', type: 'a', act: 'revive', p: 0.5, cd: 4, uses: 1, desc: 'Traz de volta um aliado caído com metade da vida.' },
      ],
    },
    guerreiro: {
      name: 'Guerreiro', role: 'Linha de frente', color: '#e0665f', weapon: 'Espada Larga', wkind: 'sword',
      blurb: 'Resistente e brutal. Aguenta pancada e devolve em dobro.',
      hp: 120, hpG: 16, atk: 12, atkG: 2.6, def: 9, defG: 2.0, spd: 8, crit: 0.06, aggro: 2.5,
      skills: [
        { id: 'w1', col: 0, tier: 0, name: 'Golpe Pesado', type: 'a', act: 'strike', p: 1.7, cd: 2, desc: 'Um golpe forte de espada.' },
        { id: 'w2', col: 2, tier: 0, name: 'Couro Duro', type: 'p', max: 3, mod: { hpPct: 0.08 }, desc: '+8% de vida por nível.' },
        { id: 'w3', col: 0, tier: 1, req: ['w1'], name: 'Redemoinho', type: 'a', act: 'aoe', p: 0.9, cd: 3, desc: 'Gira a espada e atinge todos os inimigos.' },
        { id: 'w4', col: 2, tier: 1, req: ['w2'], name: 'Grito de Guerra', type: 'a', act: 'buffAtk', v: 0.2, turns: 3, cd: 5, desc: 'O grupo ganha +20% de poder por 3 turnos.' },
        { id: 'w5', col: 0, tier: 2, req: ['w3'], name: 'Investida', type: 'a', act: 'strike', p: 1.6, cd: 3, stun: 1, desc: 'Avança e atordoa um inimigo.' },
        { id: 'w6', col: 1, tier: 2, req: ['w3', 'w4'], name: 'Sede de Sangue', type: 'p', max: 3, mod: { lifesteal: 0.06 }, desc: 'Recupera 6% do dano causado como vida, por nível.' },
        { id: 'w7', col: 2, tier: 2, req: ['w4'], name: 'Provocar', type: 'a', act: 'taunt', turns: 2, def: 0.4, cd: 4, desc: 'Atrai os ataques e reforça a defesa por 2 turnos.' },
        { id: 'w8', col: 0, tier: 3, req: ['w5'], name: 'Executar', type: 'a', act: 'execute', p: 2.1, cd: 3, desc: 'Golpe que dobra o dano em inimigos enfraquecidos.' },
        { id: 'w9', col: 2, tier: 3, req: ['w7'], name: 'Fúria', type: 'p', max: 3, mod: { atkPct: 0.07, defPct: 0.03 }, desc: '+7% de poder e +3% de defesa por nível.' },
        { id: 'w10', col: 1, tier: 4, reqAny: ['w8', 'w9'], name: 'Fúria do Titã', type: 'a', act: 'aoe', p: 2.3, cd: 5, drain: 0.25, desc: 'Golpe sísmico em todos os inimigos que também cura o guerreiro.' },
      ],
    },
    druida: {
      name: 'Druida da Natureza', role: 'Natureza e cura', color: '#63c784', weapon: 'Bastão de Carvalho', wkind: 'branch',
      blurb: 'Envenena inimigos, regenera aliados e vira urso quando precisa.',
      hp: 88, hpG: 11, atk: 12, atkG: 2.6, def: 6, defG: 1.4, spd: 9, crit: 0.05, aggro: 1.5,
      skills: [
        { id: 'd1', col: 0, tier: 0, name: 'Espinhos', type: 'a', act: 'strike', p: 1.3, cd: 2, poison: 0.3, desc: 'Espinhos que ferem e envenenam um alvo.' },
        { id: 'd2', col: 2, tier: 0, name: 'Raízes Profundas', type: 'p', max: 3, mod: { regen: 0.02 }, desc: 'Regenera 2% da vida por turno, por nível.' },
        { id: 'd3', col: 0, tier: 1, req: ['d1'], name: 'Enxame', type: 'a', act: 'aoe', p: 0.7, cd: 3, poison: 0.2, desc: 'Insetos atacam e envenenam todos os inimigos.' },
        { id: 'd4', col: 2, tier: 1, req: ['d2'], name: 'Rejuvenescer', type: 'a', act: 'healAll', p: 0.6, cd: 3, desc: 'Cura todo o grupo com a força da floresta.' },
        { id: 'd5', col: 0, tier: 2, req: ['d3'], name: 'Forma de Urso', type: 'a', act: 'selfBuff', atk: 0.35, def: 0.5, turns: 3, taunt: 1, cd: 5, desc: 'Vira urso: mais poder e defesa, e atrai ataques.' },
        { id: 'd6', col: 1, tier: 2, req: ['d3', 'd4'], name: 'Casca de Carvalho', type: 'p', max: 3, mod: { defPct: 0.07, thorns: 0.08 }, desc: '+7% de defesa e devolve 8% do dano sofrido, por nível.' },
        { id: 'd7', col: 2, tier: 2, req: ['d4'], name: 'Florescer', type: 'a', act: 'heal', p: 2.2, cd: 3, desc: 'Cura bastante o aliado mais ferido.' },
        { id: 'd8', col: 0, tier: 3, req: ['d5'], name: 'Fúria da Floresta', type: 'a', act: 'aoe', p: 1.4, cd: 4, poison: 0.3, desc: 'Raízes e vinhas esmagam todos os inimigos.' },
        { id: 'd9', col: 2, tier: 3, req: ['d7'], name: 'Dádiva da Terra', type: 'p', max: 3, mod: { healPow: 0.12 }, desc: 'Curas ficam 12% mais fortes por nível.' },
        { id: 'd10', col: 1, tier: 4, reqAny: ['d8', 'd9'], name: 'Despertar da Natureza', type: 'a', act: 'nature', p: 1.4, cd: 5, desc: 'Fere todos os inimigos e cura todos os aliados.' },
      ],
    },
    curandeiro: {
      name: 'Curandeiro', role: 'Cura', color: '#e9c8ff', weapon: 'Cetro de Luz', wkind: 'scepter',
      blurb: 'Mantém todo mundo de pé. Sem cura, o grupo não aguenta.',
      hp: 72, hpG: 9, atk: 9, atkG: 2.0, def: 5, defG: 1.2, spd: 10, crit: 0.04, aggro: 1,
      skills: [
        { id: 'c1', col: 0, tier: 0, name: 'Toque Curativo', type: 'a', act: 'heal', p: 2.4, cd: 2, desc: 'Cura o aliado mais ferido.' },
        { id: 'c2', col: 2, tier: 0, name: 'Graça', type: 'p', max: 3, mod: { healPow: 0.1 }, desc: 'Curas ficam 10% mais fortes por nível.' },
        { id: 'c3', col: 0, tier: 1, req: ['c1'], name: 'Círculo de Cura', type: 'a', act: 'healAll', p: 1.0, cd: 3, desc: 'Cura todo o grupo.' },
        { id: 'c4', col: 2, tier: 1, req: ['c2'], name: 'Luz Punitiva', type: 'a', act: 'strike', p: 1.6, cd: 2, desc: 'Um raio de luz que fere um inimigo.' },
        { id: 'c5', col: 0, tier: 2, req: ['c3'], name: 'Barreira de Luz', type: 'a', act: 'shield', p: 0.8, cd: 4, desc: 'Escudo de luz em todo o grupo.' },
        { id: 'c6', col: 1, tier: 2, req: ['c3', 'c4'], name: 'Serenidade', type: 'p', max: 3, mod: { hpPct: 0.06, defPct: 0.05 }, desc: '+6% de vida e +5% de defesa por nível.' },
        { id: 'c7', col: 2, tier: 2, req: ['c4'], name: 'Raio Sagrado', type: 'a', act: 'aoe', p: 0.9, cd: 3, desc: 'Luz que atinge todos os inimigos.' },
        { id: 'c8', col: 0, tier: 3, req: ['c5'], name: 'Renascer', type: 'a', act: 'revive', p: 0.6, cd: 4, uses: 1, desc: 'Traz um aliado caído de volta com 60% da vida.' },
        { id: 'c9', col: 2, tier: 3, req: ['c7'], name: 'Bênção da Força', type: 'a', act: 'buffAtk', v: 0.25, turns: 3, cd: 5, desc: 'O grupo ganha +25% de poder por 3 turnos.' },
        { id: 'c10', col: 1, tier: 4, reqAny: ['c8', 'c9'], name: 'Milagre', type: 'a', act: 'miracle', p: 2.4, cd: 6, desc: 'Cura completa no grupo, remove venenos e dá escudo.' },
      ],
    },
    ladino: {
      name: 'Ladino', role: 'Golpes críticos', color: '#b997f2', weapon: 'Adagas Gêmeas', wkind: 'daggers',
      blurb: 'Ágil, esquivo e letal. Acerta onde dói mais.',
      hp: 76, hpG: 10, atk: 15, atkG: 3.3, def: 5, defG: 1.1, spd: 14, crit: 0.15, aggro: 1.1,
      skills: [
        { id: 'l1', col: 0, tier: 0, name: 'Punhalada', type: 'a', act: 'strike', p: 1.6, cd: 2, critBonus: 0.3, desc: 'Golpe com +30% de chance crítica.' },
        { id: 'l2', col: 2, tier: 0, name: 'Sombras', type: 'p', max: 3, mod: { dodge: 0.06 }, desc: '+6% de esquiva por nível.' },
        { id: 'l3', col: 0, tier: 1, req: ['l1'], name: 'Leque de Facas', type: 'a', act: 'aoe', p: 0.8, cd: 3, desc: 'Arremessa facas em todos os inimigos.' },
        { id: 'l4', col: 2, tier: 1, req: ['l2'], name: 'Lâminas Envenenadas', type: 'p', max: 3, mod: { poisonOnHit: 0.12 }, desc: 'Ataques envenenam o alvo (mais forte a cada nível).' },
        { id: 'l5', col: 0, tier: 2, req: ['l3'], name: 'Golpe pelas Costas', type: 'a', act: 'strike', p: 2.2, cd: 3, pierce: 0.4, desc: 'Ignora boa parte da defesa do alvo.' },
        { id: 'l6', col: 1, tier: 2, req: ['l3', 'l4'], name: 'Agilidade', type: 'p', max: 3, mod: { spd: 2, crit: 0.03 }, desc: '+2 de velocidade e +3% de chance crítica por nível.' },
        { id: 'l7', col: 2, tier: 2, req: ['l4'], name: 'Bomba de Fumaça', type: 'a', act: 'buffDodge', v: 0.25, turns: 2, cd: 5, desc: 'O grupo ganha +25% de esquiva por 2 turnos.' },
        { id: 'l8', col: 0, tier: 3, req: ['l5'], name: 'Assassinar', type: 'a', act: 'execute', p: 2.5, cd: 4, desc: 'Dano dobrado em inimigos enfraquecidos.' },
        { id: 'l9', col: 2, tier: 3, req: ['l7'], name: 'Instinto Letal', type: 'p', max: 3, mod: { critDmg: 0.2 }, desc: '+20% de dano crítico por nível.' },
        { id: 'l10', col: 1, tier: 4, reqAny: ['l8', 'l9'], name: 'Dança das Lâminas', type: 'a', act: 'multi', hits: 6, p: 0.9, cd: 5, desc: 'Seis golpes velozes em inimigos aleatórios.' },
      ],
    },
    guardiao: {
      name: 'Guardião', role: 'Proteção', color: '#6fa3d8', weapon: 'Lança e Escudo', wkind: 'shieldSpear',
      blurb: 'Ergue o escudo na frente da família: atrai os ataques, protege e devolve o golpe.',
      hp: 118, hpG: 16, atk: 10, atkG: 2.2, def: 11, defG: 2.4, spd: 8, crit: 0.04, aggro: 2.8,
      skills: [
        { id: 'gd1', col: 0, tier: 0, name: 'Golpe de Escudo', type: 'a', act: 'strike', p: 1.4, cd: 2, stunChance: 0.25, stunK: 'atordoado', desc: 'Uma pancada com o escudo que pode atordoar.' },
        { id: 'gd2', col: 2, tier: 0, name: 'Pele de Aço', type: 'p', max: 3, mod: { defPct: 0.08, hpPct: 0.03 }, desc: '+8% de defesa e +3% de vida por nível.' },
        { id: 'gd3', col: 0, tier: 1, req: ['gd1'], name: 'Muralha de Escudos', type: 'a', act: 'taunt', turns: 2, def: 0.45, cd: 4, desc: 'Atrai todos os ataques por 2 turnos com +45% de defesa.' },
        { id: 'gd4', col: 2, tier: 1, req: ['gd2'], name: 'Proteger Aliados', type: 'a', act: 'shield', p: 0.6, cd: 4, desc: 'Escudos em todo o grupo.' },
        { id: 'gd5', col: 0, tier: 2, req: ['gd3'], name: 'Investida do Escudo', type: 'a', act: 'aoe', p: 0.75, cd: 3, stunChance: 0.2, stunK: 'atordoado', desc: 'Avança contra todos os inimigos, com chance de atordoar.' },
        { id: 'gd6', col: 1, tier: 2, req: ['gd3', 'gd4'], name: 'Formação', type: 'p', max: 3, mod: { partyDefPct: 0.05 }, desc: 'Todo o grupo ganha +5% de defesa por nível.' },
        { id: 'gd7', col: 2, tier: 2, req: ['gd4'], name: 'Grito de Vigília', type: 'a', act: 'buff', buff: { def: 0.25 }, turns: 3, cd: 5, fxK: 'protegido', desc: 'O grupo ganha +25% de defesa por 3 turnos.' },
        { id: 'gd8', col: 0, tier: 3, req: ['gd5'], name: 'Lança Certeira', type: 'a', act: 'strike', p: 2.2, cd: 3, pierce: 0.3, desc: 'Um golpe de lança que atravessa parte da armadura.' },
        { id: 'gd9', col: 2, tier: 3, req: ['gd7'], name: 'Bastião Vivo', type: 'p', max: 3, mod: { thorns: 0.08, defPct: 0.04 }, desc: 'Devolve 8% do dano sofrido e +4% de defesa, por nível.' },
        { id: 'gd10', col: 1, tier: 4, reqAny: ['gd8', 'gd9'], name: 'Fortaleza Inabalável', type: 'a', act: 'buff', heal: 0.4, buff: { def: 0.35 }, taunt: 3, turns: 3, cd: 5, fxK: 'protegido', desc: 'Cura o grupo, dá +35% de defesa a todos e atrai os ataques por 3 turnos.' },
      ],
    },
    bruxa: {
      name: 'Bruxa', role: 'Maldições', color: '#d36bc6', weapon: 'Cajado Retorcido', wkind: 'witchStaff',
      blurb: 'Amaldiçoa, envenena e enfraquece os inimigos. Às vezes vira alguém em sapo.',
      hp: 70, hpG: 9, atk: 15, atkG: 3.3, def: 4, defG: 1.0, spd: 10, crit: 0.06, aggro: 1,
      skills: [
        { id: 'bx1', col: 0, tier: 0, name: 'Maldição Sombria', type: 'a', act: 'strike', p: 1.5, cd: 2, dot: { k: 'amaldiçoado', p: 0.25 }, desc: 'Dano em um alvo e uma maldição que fere por 3 turnos.' },
        { id: 'bx2', col: 2, tier: 0, name: 'Pacto Sombrio', type: 'p', max: 3, mod: { atkPct: 0.06 }, desc: '+6% de poder por nível.' },
        { id: 'bx3', col: 0, tier: 1, req: ['bx1'], name: 'Caldeirão Fervente', type: 'a', act: 'aoe', p: 0.75, cd: 3, poison: 0.25, desc: 'Respingos do caldeirão ferem e envenenam todos os inimigos.' },
        { id: 'bx4', col: 2, tier: 1, req: ['bx2'], name: 'Enfraquecer', type: 'a', act: 'debuff', all: true, debuff: { atk: -0.15 }, turns: 3, cd: 4, fxK: 'enfraquecido', desc: 'Todos os inimigos perdem 15% de poder por 3 turnos.' },
        { id: 'bx5', col: 0, tier: 2, req: ['bx3'], name: 'Virar Sapo', type: 'a', act: 'strike', p: 1.0, cd: 4, stun: 1, stunK: 'virou sapo', desc: 'Transforma um inimigo em sapo: ele perde o próximo turno.' },
        { id: 'bx6', col: 1, tier: 2, req: ['bx3', 'bx4'], name: 'Ervas Daninhas', type: 'p', max: 3, mod: { poisonOnHit: 0.1 }, desc: 'Ataques envenenam o alvo (mais forte a cada nível).' },
        { id: 'bx7', col: 2, tier: 2, req: ['bx4'], name: 'Mau-Olhado', type: 'a', act: 'debuff', all: true, p: 0.5, debuff: { def: -0.2 }, turns: 3, cd: 4, fxK: 'frágil', desc: 'Fere todos os inimigos e reduz a defesa deles em 20%.' },
        { id: 'bx8', col: 0, tier: 3, req: ['bx5'], name: 'Praga', type: 'a', act: 'aoe', p: 1.2, cd: 4, poison: 0.35, desc: 'Uma praga que atinge e envenena todos os inimigos.' },
        { id: 'bx9', col: 2, tier: 3, req: ['bx7'], name: 'Lua Negra', type: 'p', max: 3, mod: { crit: 0.04, critDmg: 0.12 }, desc: '+4% de chance crítica e +12% de dano crítico por nível.' },
        { id: 'bx10', col: 1, tier: 4, reqAny: ['bx8', 'bx9'], name: 'Grande Sabá', type: 'a', act: 'debuff', all: true, p: 1.6, debuff: { atk: -0.25, def: -0.25 }, turns: 3, cd: 5, fxK: 'amaldiçoado', desc: 'Fere todos os inimigos e os deixa mais fracos e mais frágeis.' },
      ],
    },
    bardo: {
      name: 'Bardo', role: 'Inspiração', color: '#ffb36b', weapon: 'Alaúde Encantado', wkind: 'lute',
      blurb: 'Toca músicas que fortalecem o grupo, curam feridas e atordoam inimigos.',
      hp: 80, hpG: 10, atk: 12, atkG: 2.6, def: 5, defG: 1.2, spd: 11, crit: 0.06, aggro: 1.1,
      skills: [
        { id: 'bd1', col: 0, tier: 0, name: 'Nota Dissonante', type: 'a', act: 'strike', p: 1.5, cd: 2, stunChance: 0.2, stunK: 'atordoado', desc: 'Uma nota tão alta que fere e pode atordoar.' },
        { id: 'bd2', col: 2, tier: 0, name: 'Carisma', type: 'p', max: 3, mod: { atkPct: 0.04, dodge: 0.02 }, desc: '+4% de poder e +2% de esquiva por nível.' },
        { id: 'bd3', col: 0, tier: 1, req: ['bd1'], name: 'Acorde Estrondoso', type: 'a', act: 'aoe', p: 0.8, cd: 3, desc: 'Um acorde que atinge todos os inimigos.' },
        { id: 'bd4', col: 2, tier: 1, req: ['bd2'], name: 'Canção de Coragem', type: 'a', act: 'buff', buff: { atk: 0.2 }, turns: 3, cd: 5, fxK: 'inspirado', desc: 'O grupo ganha +20% de poder por 3 turnos.' },
        { id: 'bd5', col: 0, tier: 2, req: ['bd3'], name: 'Balada Hipnótica', type: 'a', act: 'aoe', p: 0.6, cd: 4, stunChance: 0.35, stunK: 'hipnotizado', desc: 'Atinge todos os inimigos, com chance de hipnotizar cada um.' },
        { id: 'bd6', col: 1, tier: 2, req: ['bd3', 'bd4'], name: 'Plateia Fiel', type: 'p', max: 3, mod: { partyDefPct: 0.04 }, desc: 'Todo o grupo ganha +4% de defesa por nível.' },
        { id: 'bd7', col: 2, tier: 2, req: ['bd4'], name: 'Canção de Ninar', type: 'a', act: 'healAll', p: 0.8, cd: 3, desc: 'Uma melodia calma que cura todo o grupo.' },
        { id: 'bd8', col: 0, tier: 3, req: ['bd5'], name: 'Solo Épico', type: 'a', act: 'multi', hits: 4, p: 0.9, cd: 4, desc: 'Quatro notas poderosas em inimigos aleatórios.' },
        { id: 'bd9', col: 2, tier: 3, req: ['bd7'], name: 'Hino da Pressa', type: 'a', act: 'buff', buff: { spd: 3, dodge: 0.1 }, turns: 3, cd: 5, fxK: 'apressado', desc: 'O grupo ganha +3 de velocidade e +10% de esquiva por 3 turnos.' },
        { id: 'bd10', col: 1, tier: 4, reqAny: ['bd8', 'bd9'], name: 'Grande Final', type: 'a', act: 'buff', heal: 1.0, buff: { atk: 0.3, crit: 0.1 }, turns: 3, cd: 6, fxK: 'ovacionado', desc: 'Cura o grupo e dá +30% de poder e +10% de crítico por 3 turnos.' },
      ],
    },
    xama: {
      name: 'Xamã', role: 'Espíritos e elementos', color: '#4fc1c1', weapon: 'Cajado-Totem', wkind: 'totem',
      blurb: 'Chama raios e lobos espirituais, ergue totens de cura e faz a terra tremer.',
      hp: 90, hpG: 11, atk: 13, atkG: 2.8, def: 6, defG: 1.4, spd: 9, crit: 0.05, aggro: 1.4,
      skills: [
        { id: 'xm1', col: 0, tier: 0, name: 'Raio', type: 'a', act: 'strike', p: 1.5, cd: 2, dot: { k: 'eletrocutado', p: 0.2 }, desc: 'Um raio que fere e eletrocuta o alvo.' },
        { id: 'xm2', col: 2, tier: 0, name: 'Elo Espiritual', type: 'p', max: 3, mod: { hpPct: 0.05, healPow: 0.05 }, desc: '+5% de vida e +5% de cura por nível.' },
        { id: 'xm3', col: 0, tier: 1, req: ['xm1'], name: 'Cadeia de Relâmpagos', type: 'a', act: 'multi', hits: 3, p: 0.9, cd: 3, desc: 'Um relâmpago salta entre três inimigos.' },
        { id: 'xm4', col: 2, tier: 1, req: ['xm2'], name: 'Totem de Cura', type: 'a', act: 'buff', buff: { regen: 0.05 }, turns: 3, cd: 4, fxK: 'totem', desc: 'O grupo regenera 5% da vida por turno, por 3 turnos.' },
        { id: 'xm5', col: 0, tier: 2, req: ['xm3'], name: 'Terremoto', type: 'a', act: 'aoe', p: 0.9, cd: 4, stunChance: 0.2, stunK: 'atordoado', desc: 'A terra treme sob todos os inimigos, com chance de atordoar.' },
        { id: 'xm6', col: 1, tier: 2, req: ['xm3', 'xm4'], name: 'Pele de Pedra', type: 'p', max: 3, mod: { defPct: 0.06, thorns: 0.05 }, desc: '+6% de defesa e devolve 5% do dano sofrido, por nível.' },
        { id: 'xm7', col: 2, tier: 2, req: ['xm4'], name: 'Onda Curativa', type: 'a', act: 'healAll', p: 0.8, cd: 3, desc: 'Uma onda de água que cura todo o grupo.' },
        { id: 'xm8', col: 0, tier: 3, req: ['xm5'], name: 'Lobos Espirituais', type: 'a', act: 'multi', hits: 4, p: 1.0, cd: 4, desc: 'Quatro lobos espirituais atacam inimigos aleatórios.' },
        { id: 'xm9', col: 2, tier: 3, req: ['xm7'], name: 'Ancestrais', type: 'p', max: 3, mod: { regen: 0.015, atkPct: 0.03 }, desc: 'Regenera 1,5% da vida por turno e +3% de poder, por nível.' },
        { id: 'xm10', col: 1, tier: 4, reqAny: ['xm8', 'xm9'], name: 'Fúria dos Elementos', type: 'a', act: 'nature', p: 1.5, cd: 5, desc: 'Raio, fogo e água: fere todos os inimigos e cura todos os aliados.' },
      ],
    },
    monge: {
      name: 'Monge', role: 'Artes marciais', color: '#d9a35e', weapon: 'Bastão Bo', wkind: 'bo',
      blurb: 'Rápido e disciplinado. Esquiva de tudo e golpeia em sequência.',
      hp: 98, hpG: 12, atk: 13, atkG: 2.9, def: 7, defG: 1.6, spd: 13, crit: 0.1, aggro: 2,
      skills: [
        { id: 'mg1', col: 0, tier: 0, name: 'Palma Veloz', type: 'a', act: 'strike', p: 1.5, cd: 2, critBonus: 0.15, desc: 'Golpe rápido com +15% de chance crítica.' },
        { id: 'mg2', col: 2, tier: 0, name: 'Disciplina', type: 'p', max: 3, mod: { dodge: 0.04, spd: 1 }, desc: '+4% de esquiva e +1 de velocidade por nível.' },
        { id: 'mg3', col: 0, tier: 1, req: ['mg1'], name: 'Chute Giratório', type: 'a', act: 'aoe', p: 0.85, cd: 3, desc: 'Um chute em giro que atinge todos os inimigos.' },
        { id: 'mg4', col: 2, tier: 1, req: ['mg2'], name: 'Meditação', type: 'a', act: 'selfBuff', atk: 0.1, def: 0.4, turns: 2, taunt: 1, cd: 4, fxK: 'concentrado', desc: 'Concentra-se: +40% de defesa, +10% de poder e atrai os ataques.' },
        { id: 'mg5', col: 0, tier: 2, req: ['mg3'], name: 'Golpe de Pressão', type: 'a', act: 'strike', p: 1.6, cd: 3, stun: 1, stunK: 'atordoado', desc: 'Acerta um ponto de pressão e atordoa o inimigo.' },
        { id: 'mg6', col: 1, tier: 2, req: ['mg3', 'mg4'], name: 'Corpo de Ferro', type: 'p', max: 3, mod: { hpPct: 0.06, defPct: 0.05 }, desc: '+6% de vida e +5% de defesa por nível.' },
        { id: 'mg7', col: 2, tier: 2, req: ['mg4'], name: 'Esquiva Perfeita', type: 'a', act: 'buff', self: true, buff: { dodge: 0.35 }, turns: 2, cd: 4, fxK: 'esquivo', desc: '+35% de esquiva por 2 turnos.' },
        { id: 'mg8', col: 0, tier: 3, req: ['mg5'], name: 'Rajada de Socos', type: 'a', act: 'multi', hits: 5, p: 0.7, cd: 4, desc: 'Cinco socos velozes em inimigos aleatórios.' },
        { id: 'mg9', col: 2, tier: 3, req: ['mg7'], name: 'Chi Interior', type: 'p', max: 3, mod: { crit: 0.04, lifesteal: 0.03 }, desc: '+4% de chance crítica e recupera 3% do dano como vida, por nível.' },
        { id: 'mg10', col: 1, tier: 4, reqAny: ['mg8', 'mg9'], name: 'Punho do Dragão', type: 'a', act: 'strike', p: 3.2, cd: 5, pierce: 0.5, stun: 1, stunK: 'atordoado', desc: 'Golpe lendário que ignora metade da defesa e atordoa.' },
      ],
    },
    inventor: {
      name: 'Inventor', role: 'Engenhocas', color: '#c9a36b', weapon: 'Chave Engenhosa', wkind: 'wrench',
      blurb: 'Monta torretas, joga bombas e conserta o grupo no meio da batalha.',
      hp: 78, hpG: 10, atk: 14, atkG: 3.1, def: 6, defG: 1.3, spd: 10, crit: 0.06, aggro: 1.2,
      skills: [
        { id: 'iv1', col: 0, tier: 0, name: 'Dardo Elétrico', type: 'a', act: 'strike', p: 1.5, cd: 2, dot: { k: 'eletrocutado', p: 0.2 }, desc: 'Um dardo que fere e eletrocuta o alvo.' },
        { id: 'iv2', col: 2, tier: 0, name: 'Ajustes Finos', type: 'p', max: 3, mod: { atkPct: 0.04, crit: 0.02 }, desc: '+4% de poder e +2% de chance crítica por nível.' },
        { id: 'iv3', col: 0, tier: 1, req: ['iv1'], name: 'Bomba', type: 'a', act: 'aoe', p: 0.85, cd: 3, burn: 0.2, desc: 'Uma bomba que atinge e queima todos os inimigos.' },
        { id: 'iv4', col: 2, tier: 1, req: ['iv2'], name: 'Escudo de Engrenagens', type: 'a', act: 'shield', p: 0.6, cd: 4, desc: 'Escudos mecânicos em todo o grupo.' },
        { id: 'iv5', col: 0, tier: 2, req: ['iv3'], name: 'Torreta', type: 'a', act: 'aoe', p: 0.5, cd: 4, dot: { k: 'eletrocutado', p: 0.35 }, desc: 'Monta uma torreta que dispara em todos e eletrocuta por 3 turnos.' },
        { id: 'iv6', col: 1, tier: 2, req: ['iv3', 'iv4'], name: 'Blindagem', type: 'p', max: 3, mod: { defPct: 0.07, hpPct: 0.04 }, desc: '+7% de defesa e +4% de vida por nível.' },
        { id: 'iv7', col: 2, tier: 2, req: ['iv4'], name: 'Kit de Reparos', type: 'a', act: 'heal', p: 2.0, cd: 3, desc: 'Conserta o aliado mais ferido.' },
        { id: 'iv8', col: 0, tier: 3, req: ['iv5'], name: 'Míssil Teleguiado', type: 'a', act: 'execute', p: 2.4, cd: 4, desc: 'Dano dobrado em inimigos enfraquecidos.' },
        { id: 'iv9', col: 2, tier: 3, req: ['iv7'], name: 'Engenharia Avançada', type: 'p', max: 3, mod: { pierce: 0.08, critDmg: 0.1 }, desc: 'Ignora 8% da defesa e +10% de dano crítico, por nível.' },
        { id: 'iv10', col: 1, tier: 4, reqAny: ['iv8', 'iv9'], name: 'Robô Gigante', type: 'a', act: 'multi', hits: 6, p: 0.95, cd: 5, burn: 0.15, desc: 'Um robô gigante dispara seis rajadas em fogo.' },
      ],
    },
    princesa: {
      name: 'Princesa', role: 'Magia Estelar', color: '#ff8fc8', weapon: 'Varinha Estelar', wkind: 'wand',
      blurb: 'Comanda estrelas, arco-íris e unicórnios para encantar inimigos e proteger quem ama.',
      hp: 76, hpG: 10, atk: 12, atkG: 2.5, def: 5, defG: 1.2, spd: 10, crit: 0.05, aggro: 1,
      skills: [
        { id: 'pr1', col: 0, tier: 0, name: 'Raio de Estrela', type: 'a', act: 'strike', p: 1.5, cd: 2, desc: 'Uma estrela brilhante voa da varinha e atinge um inimigo.' },
        { id: 'pr2', col: 2, tier: 0, name: 'Brilho Estelar', type: 'p', max: 3, mod: { healPow: 0.06, defPct: 0.04 }, desc: '+6% de cura e +4% de defesa por nível.' },
        { id: 'pr3', col: 0, tier: 1, req: ['pr1'], name: 'Chuva de Estrelas', type: 'a', act: 'aoe', p: 0.75, cd: 3, desc: 'Estrelinhas caem do céu sobre todos os inimigos.' },
        { id: 'pr4', col: 2, tier: 1, req: ['pr2'], name: 'Arco-Íris da Coragem', type: 'a', act: 'buff', buff: { atk: 0.15, def: 0.1 }, turns: 3, cd: 5, fxK: 'colorido', desc: 'Um arco-íris sobre o grupo dá +15% de poder e +10% de defesa por 3 turnos.' },
        { id: 'pr5', col: 0, tier: 2, req: ['pr3'], name: 'Olhar do Unicórnio', type: 'a', act: 'strike', p: 0.9, cd: 4, stun: 2, stunK: 'encantado', desc: 'Um unicórnio encara o inimigo, que fica encantado e perde dois turnos.' },
        { id: 'pr6', col: 1, tier: 2, req: ['pr3', 'pr4'], name: 'Crina Encantada', type: 'p', max: 3, mod: { hpPct: 0.05, atkPct: 0.03 }, desc: '+5% de vida e +3% de poder por nível.' },
        { id: 'pr7', col: 2, tier: 2, req: ['pr4'], name: 'Lágrima de Unicórnio', type: 'a', act: 'heal', p: 2.3, cd: 3, desc: 'Uma lágrima mágica cura bastante o aliado mais ferido.' },
        { id: 'pr8', col: 0, tier: 3, req: ['pr5'], name: 'Escudo Arco-Íris', type: 'a', act: 'shield', p: 0.8, cd: 5, desc: 'Bolhas de arco-íris protegem todo o grupo.' },
        { id: 'pr9', col: 2, tier: 3, req: ['pr7'], name: 'Coração Bondoso', type: 'p', max: 3, mod: { healPow: 0.1, regen: 0.01 }, desc: '+10% de cura e regenera 1% da vida por turno, por nível.' },
        { id: 'pr10', col: 1, tier: 4, reqAny: ['pr8', 'pr9'], name: 'Desfile dos Unicórnios', type: 'a', act: 'buff', heal: 0.8, buff: { atk: 0.25, def: 0.25, crit: 0.08 }, turns: 3, cd: 6, fxK: 'radiante', desc: 'Unicórnios galopam sobre um arco-íris: curam o grupo e dão +25% de poder e defesa e +8% de crítico por 3 turnos.' },
      ],
    },
  };

  /* ----- Segunda metade das árvores (níveis 20 a 50): mais de um ano de progresso -----
     Ordem fixa: [t5 col0 ativa, t5 col2 passiva x3, t6 col0 passiva x3, t6 col1 ativa, t6 col2 passiva x3,
                  t7 col0 ativa, t7 col2 ativa, t8 col0 passiva x5, t8 col1 passiva x5, t8 col2 passiva x5, t9 col1 ativa suprema] */
  const EXT_SLOTS = [[5, 0, 1], [5, 2, 3], [6, 0, 3], [6, 1, 1], [6, 2, 3], [7, 0, 1], [7, 2, 1], [8, 0, 5], [8, 1, 5], [8, 2, 5], [9, 1, 1]];
  const EXT_REQ = (p) => [{ req: [p + 10] }, { req: [p + 10] }, { req: [p + 11] }, { reqAny: [p + 11, p + 12] }, { req: [p + 12] }, { req: [p + 13] }, { req: [p + 15] }, { req: [p + 16] }, { reqAny: [p + 16, p + 17] }, { req: [p + 17] }, { reqAny: [p + 18, p + 19, p + 20] }];
  const P = (name, mod, desc) => ({ name, type: 'p', mod, desc });
  const EXT = {
    gelo: [
      { name: 'Lança Glacial', type: 'a', act: 'strike', p: 2.6, cd: 3, chill: 2, pierce: 0.2, desc: 'Lança enorme que atravessa a armadura e deixa o alvo lento.' },
      P('Inverno Eterno', { atkPct: 0.05, defPct: 0.03 }, '+5% de poder e +3% de defesa por nível.'),
      P('Gelo Afiado', { crit: 0.03, critDmg: 0.08 }, '+3% de chance crítica e +8% de dano crítico por nível.'),
      { name: 'Prisão de Gelo', type: 'a', act: 'aoe', p: 0.9, cd: 5, stun: 1, desc: 'Congela todos os inimigos por um turno.' },
      P('Escudo Polar', { hpPct: 0.05, partyDefPct: 0.02 }, '+5% de vida e +2% de defesa para o grupo, por nível.'),
      { name: 'Cometa de Gelo', type: 'a', act: 'strike', p: 3.3, cd: 4, chill: 2, desc: 'Um cometa congelado esmaga um inimigo.' },
      { name: 'Barreira Ártica', type: 'a', act: 'shield', p: 1.1, cd: 5, desc: 'Escudo de gelo muito forte em todo o grupo.' },
      P('Zero Absoluto', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Alma Polar', { hpPct: 0.03, defPct: 0.02 }, '+3% de vida e +2% de defesa por nível.'),
      P('Cristais Eternos', { crit: 0.015, critDmg: 0.04 }, '+1,5% de chance crítica e +4% de dano crítico por nível.'),
      { name: 'Avalanche', type: 'a', act: 'aoe', p: 2.7, cd: 5, stun: 1, chill: 2, desc: 'Uma avalanche soterra todos os inimigos e os congela.' },
    ],
    fogo: [
      { name: 'Lança de Magma', type: 'a', act: 'strike', p: 2.8, cd: 3, burn: 0.4, desc: 'Magma derretido atinge um inimigo e queima forte.' },
      P('Coração Vulcânico', { atkPct: 0.06 }, '+6% de poder por nível.'),
      P('Brasas Vivas', { burnPct: 0.25, crit: 0.02 }, 'Queimaduras +25% mais fortes e +2% de crítico por nível.'),
      { name: 'Muralha de Fogo', type: 'a', act: 'aoe', p: 1.3, cd: 4, burn: 0.3, desc: 'Uma muralha de chamas atravessa o campo.' },
      P('Pele de Cinzas', { hpPct: 0.05, defPct: 0.04 }, '+5% de vida e +4% de defesa por nível.'),
      { name: 'Supernova', type: 'a', act: 'strike', p: 3.6, cd: 4, desc: 'Uma explosão estelar contra um único inimigo.' },
      { name: 'Asas de Fênix', type: 'a', act: 'healAll', p: 0.9, cd: 4, desc: 'Asas de fogo cuidadoso curam todo o grupo.' },
      P('Fornalha', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Combustão Eterna', { critDmg: 0.05, burnPct: 0.1 }, '+5% de dano crítico e queimaduras +10% mais fortes por nível.'),
      P('Brasa Protetora', { hpPct: 0.03, defPct: 0.02 }, '+3% de vida e +2% de defesa por nível.'),
      { name: 'Apocalipse Solar', type: 'a', act: 'multi', hits: 7, p: 1.25, cd: 5, burn: 0.3, desc: 'Sete explosões solares caem sobre os inimigos.' },
    ],
    arqueiro: [
      { name: 'Flecha Explosiva', type: 'a', act: 'strike', p: 2.7, cd: 3, burn: 0.25, desc: 'Uma flecha que explode no alvo e deixa fogo.' },
      P('Treino de Elite', { atkPct: 0.05, spd: 1 }, '+5% de poder e +1 de velocidade por nível.'),
      P('Pontaria Fria', { crit: 0.03, critDmg: 0.1 }, '+3% de chance crítica e +10% de dano crítico por nível.'),
      { name: 'Saraivada', type: 'a', act: 'aoe', p: 1.3, cd: 4, desc: 'Centenas de flechas cobrem o céu e caem em todos.' },
      P('Camuflagem', { dodge: 0.03, hpPct: 0.04 }, '+3% de esquiva e +4% de vida por nível.'),
      { name: 'Flecha do Caçador', type: 'a', act: 'execute', p: 3.2, cd: 4, pierce: 0.4, desc: 'Ignora a armadura e dobra o dano em alvos fracos.' },
      { name: 'Armadilhas', type: 'a', act: 'debuff', all: true, p: 0.6, debuff: { def: -0.2 }, turns: 3, cd: 5, fxK: 'preso', desc: 'Armadilhas ferem todos e reduzem a defesa deles em 20%.' },
      P('Olhar de Falcão', { crit: 0.015 }, '+1,5% de chance crítica por nível.'),
      P('Vento a Favor', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Pés Ligeiros', { dodge: 0.015, hpPct: 0.02 }, '+1,5% de esquiva e +2% de vida por nível.'),
      { name: 'Chuva Celestial', type: 'a', act: 'multi', hits: 8, p: 1.1, cd: 5, pierce: 0.3, desc: 'Oito flechas de luz que atravessam a armadura.' },
    ],
    paladino: [
      { name: 'Julgamento', type: 'a', act: 'strike', p: 2.3, cd: 3, drain: 0.5, stun: 1, stunK: 'atordoado', desc: 'Golpe sagrado que atordoa e cura o paladino.' },
      P('Égide', { defPct: 0.06, hpPct: 0.03 }, '+6% de defesa e +3% de vida por nível.'),
      P('Fervor', { atkPct: 0.05, healPow: 0.04 }, '+5% de poder e +4% de cura por nível.'),
      { name: 'Consagração', type: 'a', act: 'nature', p: 1.0, cd: 4, desc: 'O chão sagrado fere os inimigos e cura os aliados.' },
      P('Muralha da Fé', { partyDefPct: 0.03 }, 'Todo o grupo ganha +3% de defesa por nível.'),
      { name: 'Martelo dos Céus', type: 'a', act: 'aoe', p: 1.6, cd: 4, stunChance: 0.3, stunK: 'atordoado', desc: 'Martelos de luz caem sobre todos, com chance de atordoar.' },
      { name: 'Guardião Divino', type: 'a', act: 'taunt', turns: 3, def: 0.6, cd: 5, desc: 'Atrai todos os ataques por 3 turnos com +60% de defesa.' },
      P('Bastião', { defPct: 0.03 }, '+3% de defesa por nível.'),
      P('Luz Eterna', { hpPct: 0.03, healPow: 0.03 }, '+3% de vida e +3% de cura por nível.'),
      P('Coração Leal', { hpPct: 0.03, regen: 0.004 }, '+3% de vida e regeneração por nível.'),
      { name: 'Intervenção Divina', type: 'a', act: 'miracle', p: 2.6, cd: 6, desc: 'Cura completa do grupo, remove venenos e dá escudo.' },
    ],
    guerreiro: [
      { name: 'Decapitar', type: 'a', act: 'execute', p: 2.8, cd: 3, desc: 'Golpe brutal que dobra o dano em inimigos fracos.' },
      P('Músculos de Aço', { hpPct: 0.06, atkPct: 0.03 }, '+6% de vida e +3% de poder por nível.'),
      P('Veterano', { atkPct: 0.05, crit: 0.02 }, '+5% de poder e +2% de chance crítica por nível.'),
      { name: 'Grito Aterrador', type: 'a', act: 'debuff', all: true, debuff: { atk: -0.2 }, turns: 3, cd: 5, fxK: 'assustado', desc: 'Um grito que tira 20% do poder de todos os inimigos.' },
      P('Escudo Erguido', { defPct: 0.06, thorns: 0.04 }, '+6% de defesa e devolve 4% do dano por nível.'),
      { name: 'Terremoto de Aço', type: 'a', act: 'aoe', p: 1.7, cd: 4, stunChance: 0.25, stunK: 'atordoado', desc: 'Golpe no chão que atinge todos, com chance de atordoar.' },
      { name: 'Última Defesa', type: 'a', act: 'taunt', turns: 3, def: 0.7, cd: 5, desc: 'Atrai todos os ataques por 3 turnos com +70% de defesa.' },
      P('Lâmina Afiada', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Sangue de Guerreiro', { lifesteal: 0.015, hpPct: 0.02 }, 'Recupera 1,5% do dano como vida e +2% de vida por nível.'),
      P('Pele de Pedra', { defPct: 0.03 }, '+3% de defesa por nível.'),
      { name: 'Lâmina do Destino', type: 'a', act: 'aoe', p: 2.9, cd: 5, drain: 0.3, desc: 'Um golpe lendário em todos os inimigos que também cura o guerreiro.' },
    ],
    druida: [
      { name: 'Vinhas Estranguladoras', type: 'a', act: 'strike', p: 2.4, cd: 3, stun: 1, stunK: 'enraizado', poison: 0.3, desc: 'Vinhas prendem um inimigo, que perde o turno.' },
      P('Seiva Antiga', { regen: 0.012, hpPct: 0.04 }, 'Regenera 1,2% por turno e +4% de vida por nível.'),
      P('Toxinas', { poisonOnHit: 0.06, atkPct: 0.03 }, 'Ataques envenenam mais e +3% de poder por nível.'),
      { name: 'Forma de Lobo', type: 'a', act: 'selfBuff', atk: 0.5, buff: { crit: 0.15, spd: 3 }, turns: 3, cd: 5, fxK: 'transforma', desc: 'Vira lobo: +50% de poder, +15% de crítico e +3 de velocidade.' },
      P('Bosque Sagrado', { healPow: 0.06, defPct: 0.03 }, '+6% de cura e +3% de defesa por nível.'),
      { name: 'Tempestade de Espinhos', type: 'a', act: 'aoe', p: 1.6, cd: 4, poison: 0.35, desc: 'Espinhos voam em todos os inimigos e envenenam.' },
      { name: 'Árvore da Vida', type: 'a', act: 'buff', heal: 0.7, buff: { regen: 0.05 }, turns: 3, cd: 5, fxK: 'florescendo', desc: 'Cura o grupo e faz todos regenerarem 5% por turno.' },
      P('Raízes de Ferro', { defPct: 0.03 }, '+3% de defesa por nível.'),
      P('Ciclo da Vida', { regen: 0.004, healPow: 0.03 }, 'Regeneração e +3% de cura por nível.'),
      P('Fera Interior', { atkPct: 0.03 }, '+3% de poder por nível.'),
      { name: 'Ira de Gaia', type: 'a', act: 'nature', p: 2.4, cd: 5, desc: 'A própria terra fere todos os inimigos e cura todos os aliados.' },
    ],
    curandeiro: [
      { name: 'Lança de Luz', type: 'a', act: 'strike', p: 2.4, cd: 3, stunChance: 0.3, stunK: 'ofuscado', desc: 'Uma lança de luz que pode ofuscar o alvo.' },
      P('Fonte de Vida', { healPow: 0.06, hpPct: 0.03 }, '+6% de cura e +3% de vida por nível.'),
      P('Calma Interior', { defPct: 0.05, regen: 0.008 }, '+5% de defesa e regeneração por nível.'),
      { name: 'Santuário', type: 'a', act: 'buff', heal: 0.6, buff: { def: 0.25, regen: 0.03 }, turns: 3, cd: 5, fxK: 'protegido', desc: 'Cura o grupo e dá +25% de defesa e regeneração por 3 turnos.' },
      P('Esperança', { partyDefPct: 0.03 }, 'Todo o grupo ganha +3% de defesa por nível.'),
      { name: 'Coro de Anjos', type: 'a', act: 'healAll', p: 1.4, cd: 4, desc: 'Uma cura muito forte em todo o grupo.' },
      { name: 'Luz Purificadora', type: 'a', act: 'aoe', p: 1.4, cd: 4, desc: 'Uma luz intensa que fere todos os inimigos.' },
      P('Mãos Benditas', { healPow: 0.03 }, '+3% de cura por nível.'),
      P('Aura Serena', { hpPct: 0.03, defPct: 0.02 }, '+3% de vida e +2% de defesa por nível.'),
      P('Fé Ardente', { atkPct: 0.03 }, '+3% de poder por nível.'),
      { name: 'Ressurreição em Massa', type: 'a', act: 'miracle', p: 3.0, cd: 6, desc: 'O maior milagre: cura completa, remove venenos e dá escudo forte.' },
    ],
    ladino: [
      { name: 'Corte Fatal', type: 'a', act: 'execute', p: 2.8, cd: 3, critBonus: 0.3, desc: 'Dano dobrado em alvos fracos, com +30% de crítico.' },
      P('Mãos Rápidas', { spd: 1, atkPct: 0.04 }, '+1 de velocidade e +4% de poder por nível.'),
      P('Veneno Mortal', { poisonOnHit: 0.06, critDmg: 0.06 }, 'Venenos mais fortes e +6% de dano crítico por nível.'),
      { name: 'Sumir nas Sombras', type: 'a', act: 'buff', self: true, buff: { dodge: 0.4, crit: 0.2 }, turns: 2, cd: 5, fxK: 'oculto', desc: '+40% de esquiva e +20% de crítico por 2 turnos.' },
      P('Reflexos', { dodge: 0.03, hpPct: 0.03 }, '+3% de esquiva e +3% de vida por nível.'),
      { name: 'Tempestade de Lâminas', type: 'a', act: 'aoe', p: 1.6, cd: 4, poison: 0.25, desc: 'Lâminas giram e atingem todos os inimigos.' },
      { name: 'Truque Sujo', type: 'a', act: 'debuff', all: true, p: 0.5, debuff: { atk: -0.15, def: -0.15 }, turns: 3, cd: 5, fxK: 'cego', desc: 'Areia nos olhos: todos os inimigos ficam mais fracos e frágeis.' },
      P('Golpe Preciso', { crit: 0.015, critDmg: 0.03 }, '+1,5% de crítico e +3% de dano crítico por nível.'),
      P('Fantasma', { dodge: 0.012, hpPct: 0.01 }, '+1,2% de esquiva e +1% de vida por nível.'),
      P('Lâminas Gêmeas', { atkPct: 0.03 }, '+3% de poder por nível.'),
      { name: 'Mil Cortes', type: 'a', act: 'multi', hits: 10, p: 0.85, cd: 5, desc: 'Dez golpes num piscar de olhos.' },
    ],
    bruxa: [
      { name: 'Maldição Profunda', type: 'a', act: 'strike', p: 2.6, cd: 3, dot: { k: 'amaldiçoado', p: 0.45 }, desc: 'Uma maldição pesada que fere muito por 3 turnos.' },
      P('Grimório', { atkPct: 0.05, crit: 0.02 }, '+5% de poder e +2% de crítico por nível.'),
      P('Poções Tóxicas', { poisonOnHit: 0.06, atkPct: 0.02 }, 'Venenos mais fortes e +2% de poder por nível.'),
      { name: 'Nuvem de Corvos', type: 'a', act: 'multi', hits: 6, p: 0.8, cd: 4, desc: 'Seis corvos bicam inimigos aleatórios.' },
      P('Amuleto de Osso', { hpPct: 0.05, defPct: 0.04 }, '+5% de vida e +4% de defesa por nível.'),
      { name: 'Sapos para Todos', type: 'a', act: 'aoe', p: 0.8, cd: 5, stun: 1, stunK: 'virou sapo', desc: 'Todos os inimigos viram sapos por um turno.' },
      { name: 'Drenar Vida', type: 'a', act: 'strike', p: 2.4, cd: 3, drain: 0.6, desc: 'Rouba a vida de um inimigo e cura a bruxa.' },
      P('Olhos de Gato', { crit: 0.015, critDmg: 0.04 }, '+1,5% de crítico e +4% de dano crítico por nível.'),
      P('Caldeirão Antigo', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Pele de Sombra', { hpPct: 0.03, dodge: 0.01 }, '+3% de vida e +1% de esquiva por nível.'),
      { name: 'Noite das Bruxas', type: 'a', act: 'debuff', all: true, p: 2.6, debuff: { atk: -0.3, def: -0.3 }, turns: 3, cd: 5, fxK: 'amaldiçoado', desc: 'Fere todos os inimigos e corta 30% do poder e da defesa deles.' },
    ],
    bardo: [
      { name: 'Grito do Rock', type: 'a', act: 'aoe', p: 1.3, cd: 3, stunChance: 0.2, stunK: 'atordoado', desc: 'Um acorde tão alto que atinge todos e pode atordoar.' },
      P('Virtuoso', { atkPct: 0.05, crit: 0.02 }, '+5% de poder e +2% de crítico por nível.'),
      P('Voz Encantadora', { healPow: 0.05, dodge: 0.02 }, '+5% de cura e +2% de esquiva por nível.'),
      { name: 'Marcha Triunfal', type: 'a', act: 'buff', buff: { atk: 0.25, def: 0.15 }, turns: 3, cd: 5, fxK: 'inspirado', desc: 'O grupo ganha +25% de poder e +15% de defesa por 3 turnos.' },
      P('Fã-Clube', { partyDefPct: 0.03 }, 'Todo o grupo ganha +3% de defesa por nível.'),
      { name: 'Dueto Mortal', type: 'a', act: 'multi', hits: 6, p: 0.95, cd: 4, desc: 'Seis notas cortantes em inimigos aleatórios.' },
      { name: 'Serenata', type: 'a', act: 'healAll', p: 1.2, cd: 4, desc: 'Uma serenata que cura bem todo o grupo.' },
      P('Ritmo Perfeito', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Bis!', { crit: 0.012, atkPct: 0.01 }, '+1,2% de crítico e +1% de poder por nível.'),
      P('Plateia Lotada', { hpPct: 0.03, defPct: 0.02 }, '+3% de vida e +2% de defesa por nível.'),
      { name: 'Sinfonia Lendária', type: 'a', act: 'buff', heal: 1.4, buff: { atk: 0.4, crit: 0.15, spd: 3 }, turns: 3, cd: 6, fxK: 'ovacionado', desc: 'Cura o grupo e dá +40% de poder, +15% de crítico e velocidade.' },
    ],
    xama: [
      { name: 'Tempestade de Raios', type: 'a', act: 'multi', hits: 5, p: 1.0, cd: 3, dot: { k: 'eletrocutado', p: 0.15 }, desc: 'Cinco raios em inimigos aleatórios.' },
      P('Sabedoria Tribal', { atkPct: 0.05, healPow: 0.03 }, '+5% de poder e +3% de cura por nível.'),
      P('Escudo de Terra', { defPct: 0.05, hpPct: 0.03 }, '+5% de defesa e +3% de vida por nível.'),
      { name: 'Totem de Fúria', type: 'a', act: 'buff', buff: { atk: 0.25, crit: 0.08 }, turns: 3, cd: 5, fxK: 'totem', desc: 'O grupo ganha +25% de poder e +8% de crítico por 3 turnos.' },
      P('Água Viva', { regen: 0.01, healPow: 0.04 }, 'Regenera 1% por turno e +4% de cura por nível.'),
      { name: 'Vulcão', type: 'a', act: 'aoe', p: 1.6, cd: 4, burn: 0.3, desc: 'Um vulcão brota do chão e queima todos os inimigos.' },
      { name: 'Chuva Sagrada', type: 'a', act: 'buff', heal: 0.9, buff: { regen: 0.04 }, turns: 3, cd: 5, fxK: 'totem', desc: 'Cura o grupo e faz todos regenerarem 4% por turno.' },
      P('Espírito do Raio', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Espírito da Terra', { defPct: 0.02, hpPct: 0.02 }, '+2% de defesa e +2% de vida por nível.'),
      P('Espírito da Água', { healPow: 0.03, regen: 0.003 }, '+3% de cura e regeneração por nível.'),
      { name: 'Avatar da Tempestade', type: 'a', act: 'nature', p: 2.5, cd: 5, desc: 'O xamã vira tempestade: fere todos os inimigos e cura todos os aliados.' },
    ],
    monge: [
      { name: 'Joelhada Voadora', type: 'a', act: 'strike', p: 2.7, cd: 3, stun: 1, stunK: 'atordoado', desc: 'Um salto com joelhada que atordoa.' },
      P('Caminho do Punho', { atkPct: 0.05, crit: 0.02 }, '+5% de poder e +2% de crítico por nível.'),
      P('Caminho da Água', { dodge: 0.03, spd: 1 }, '+3% de esquiva e +1 de velocidade por nível.'),
      { name: 'Postura da Montanha', type: 'a', act: 'selfBuff', atk: 0.2, def: 0.7, turns: 3, taunt: 2, cd: 5, fxK: 'concentrado', desc: '+70% de defesa e +20% de poder, atraindo os ataques.' },
      P('Caminho da Pedra', { hpPct: 0.05, defPct: 0.04 }, '+5% de vida e +4% de defesa por nível.'),
      { name: 'Furacão de Chutes', type: 'a', act: 'aoe', p: 1.6, cd: 4, desc: 'Chutes em giro que atingem todos os inimigos.' },
      { name: 'Respiração Curativa', type: 'a', act: 'buff', self: true, heal: 2.0, buff: { regen: 0.05 }, turns: 3, cd: 4, fxK: 'concentrado', desc: 'Cura a si mesmo e regenera 5% por turno.' },
      P('Punhos de Pedra', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Mente Vazia', { dodge: 0.012, crit: 0.01 }, '+1,2% de esquiva e +1% de crítico por nível.'),
      P('Corpo Inquebrável', { hpPct: 0.03, defPct: 0.02 }, '+3% de vida e +2% de defesa por nível.'),
      { name: 'Cem Punhos', type: 'a', act: 'multi', hits: 10, p: 0.85, cd: 5, critBonus: 0.15, desc: 'Dez golpes relâmpago com +15% de crítico.' },
    ],
    inventor: [
      { name: 'Canhão de Raios', type: 'a', act: 'strike', p: 2.7, cd: 3, dot: { k: 'eletrocutado', p: 0.3 }, desc: 'Um canhão que dispara um raio concentrado.' },
      P('Protótipos', { atkPct: 0.05, crit: 0.02 }, '+5% de poder e +2% de crítico por nível.'),
      P('Liga Metálica', { defPct: 0.05, hpPct: 0.03 }, '+5% de defesa e +3% de vida por nível.'),
      { name: 'Campo de Força', type: 'a', act: 'shield', p: 1.0, cd: 5, desc: 'Um campo de força protege todo o grupo.' },
      P('Oficina de Campo', { healPow: 0.06, regen: 0.006 }, '+6% de cura e regeneração por nível.'),
      { name: 'Chuva de Bombas', type: 'a', act: 'aoe', p: 1.6, cd: 4, burn: 0.3, desc: 'Um dirigível solta bombas em todos os inimigos.' },
      { name: 'Drones de Reparo', type: 'a', act: 'healAll', p: 1.0, cd: 4, desc: 'Drones consertam todo o grupo.' },
      P('Engrenagens de Ouro', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Mira Laser', { crit: 0.012, pierce: 0.015 }, '+1,2% de crítico e ignora mais defesa por nível.'),
      P('Placas Reforçadas', { defPct: 0.03 }, '+3% de defesa por nível.'),
      { name: 'Exército de Robôs', type: 'a', act: 'multi', hits: 9, p: 1.05, cd: 5, dot: { k: 'eletrocutado', p: 0.2 }, desc: 'Nove robôs atacam inimigos aleatórios e eletrocutam.' },
    ],
    princesa: [
      { name: 'Estrela Cadente', type: 'a', act: 'strike', p: 2.6, cd: 3, stunChance: 0.3, stunK: 'encantado', desc: 'Uma estrela cadente gigante que pode encantar o alvo.' },
      P('Constelação', { atkPct: 0.05, healPow: 0.03 }, '+5% de poder e +3% de cura por nível.'),
      P('Vestido de Arco-Íris', { defPct: 0.05, dodge: 0.02 }, '+5% de defesa e +2% de esquiva por nível.'),
      { name: 'Arco-Íris Ofuscante', type: 'a', act: 'aoe', p: 0.9, cd: 5, stun: 1, stunK: 'encantado', desc: 'Um arco-íris ofuscante encanta todos os inimigos, que perdem um turno.' },
      P('Chifre de Cristal', { healPow: 0.06, hpPct: 0.03 }, '+6% de cura e +3% de vida por nível.'),
      { name: 'Manada de Unicórnios', type: 'a', act: 'multi', hits: 6, p: 1.0, cd: 4, desc: 'Seis unicórnios galopam contra inimigos aleatórios.' },
      { name: 'Garoa de Arco-Íris', type: 'a', act: 'healAll', p: 1.2, cd: 4, desc: 'Uma garoa colorida cura bem todo o grupo.' },
      P('Desejo às Estrelas', { atkPct: 0.03 }, '+3% de poder por nível.'),
      P('Tiara Estelar', { crit: 0.012, healPow: 0.02 }, '+1,2% de crítico e +2% de cura por nível.'),
      P('Amigos Unicórnios', { hpPct: 0.03, defPct: 0.02 }, '+3% de vida e +2% de defesa por nível.'),
      { name: 'Reino do Arco-Íris', type: 'a', act: 'buff', heal: 1.4, buff: { atk: 0.35, def: 0.35, crit: 0.1 }, turns: 3, cd: 6, fxK: 'radiante', desc: 'Estrelas, arco-íris e unicórnios enchem o céu: curam o grupo e dão +35% de poder e defesa e +10% de crítico.' },
    ],
  };
  EXT.guardiao = [
    { name: 'Golpe Retumbante', type: 'a', act: 'strike', p: 2.5, cd: 3, stun: 1, stunK: 'atordoado', desc: 'Um golpe que faz o chão tremer e atordoa o alvo.' },
    P('Couraça Reforçada', { defPct: 0.06, hpPct: 0.03 }, '+6% de defesa e +3% de vida por nível.'),
    P('Força do Escudo', { atkPct: 0.05, thorns: 0.03 }, '+5% de poder e devolve 3% do dano por nível.'),
    { name: 'Escudo de Luz', type: 'a', act: 'shield', p: 1.0, cd: 5, desc: 'Escudos fortes em todo o grupo.' },
    P('Vigilância', { partyDefPct: 0.03 }, 'Todo o grupo ganha +3% de defesa por nível.'),
    { name: 'Varredura', type: 'a', act: 'aoe', p: 1.5, cd: 4, stunChance: 0.25, stunK: 'atordoado', desc: 'Um giro de lança que atinge todos, com chance de atordoar.' },
    { name: 'Juramento do Guardião', type: 'a', act: 'buff', heal: 0.6, buff: { def: 0.3, regen: 0.02 }, taunt: 2, turns: 3, cd: 5, fxK: 'protegido', desc: 'Cura o grupo, dá defesa e regeneração, e atrai os ataques.' },
    P('Braços de Ferro', { atkPct: 0.03 }, '+3% de poder por nível.'),
    P('Sentinela', { defPct: 0.03 }, '+3% de defesa por nível.'),
    P('Coração de Pedra', { hpPct: 0.03, thorns: 0.01 }, '+3% de vida e devolve 1% do dano por nível.'),
    { name: 'Égide Eterna', type: 'a', act: 'buff', heal: 1.2, buff: { def: 0.5, atk: 0.2 }, taunt: 3, turns: 3, cd: 6, fxK: 'protegido', desc: 'Cura o grupo, dá +50% de defesa e +20% de poder a todos e atrai os ataques.' },
  ];
  const PREFIX = { guardiao: 'gd', gelo: 'g', fogo: 'f', arqueiro: 'a', paladino: 'p', guerreiro: 'w', druida: 'd', curandeiro: 'c', ladino: 'l', bruxa: 'bx', bardo: 'bd', xama: 'xm', monge: 'mg', inventor: 'iv', princesa: 'pr' };
  for (const [cid, list] of Object.entries(EXT)) {
    const pre = PREFIX[cid]; const ids = (n) => pre + n;
    const reqs = EXT_REQ(0).map((o) => { const k = Object.keys(o)[0]; return { [k]: o[k].map(ids) }; });
    list.forEach((s, i) => { const [tier, col, max] = EXT_SLOTS[i]; Object.assign(s, { id: ids(i + 11), tier, col, max }, reqs[i]); CLASSES[cid].skills.push(s); });
  }

  for (const [cid, c] of Object.entries(CLASSES)) {
    c.id = cid;
    c.skillMap = {};
    for (const s of c.skills) { s.minLevel = TIER_LVL[s.tier]; s.max = s.max || 1; c.skillMap[s.id] = s; }
  }


  /* ===== Motivação ===== */
  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const PUNCTUAL_BONUS = 0.25;   // +25% se feita até o horário
  const DUO_SHARE = 0.6;         // cada herói da dupla ganha 60% (juntos, 120%)
  const STREAK_STEP = 0.02, STREAK_MAX = 0.2; // +2% de XP por dia seguido, até +20%
  const KUDOS_XP = 10, KUDOS_PER_DAY = 3;
  // Conquistas: test recebe o herói e um contexto { party, guild }
  const ACH = [
    { id: 'first', name: 'Primeiro passo', desc: 'Cumprir a primeira tarefa', gold: 10, test: (h) => (h.stats.done || 0) >= 1 },
    { id: 't10', name: 'Mão na massa', desc: 'Cumprir 10 tarefas', gold: 20, test: (h) => (h.stats.done || 0) >= 10 },
    { id: 't50', name: 'Braço direito da casa', desc: 'Cumprir 50 tarefas', gold: 50, test: (h) => (h.stats.done || 0) >= 50 },
    { id: 't150', name: 'Lenda do lar', desc: 'Cumprir 150 tarefas', gold: 120, test: (h) => (h.stats.done || 0) >= 150 },
    { id: 't400', name: 'Mito da guilda', desc: 'Cumprir 400 tarefas', gold: 300, test: (h) => (h.stats.done || 0) >= 400 },
    { id: 'hard10', name: 'Sem medo do difícil', desc: 'Cumprir 10 tarefas difíceis', gold: 40, test: (h) => ((h.stats.byDiff || {}).d || 0) >= 10 },
    { id: 'lvl5', name: 'Aventureiro', desc: 'Chegar ao nível 5', gold: 25, test: (h) => h.level >= 5 },
    { id: 'lvl10', name: 'Veterano', desc: 'Chegar ao nível 10', gold: 60, test: (h) => h.level >= 10 },
    { id: 'lvl20', name: 'Herói lendário', desc: 'Chegar ao nível 20', gold: 200, test: (h) => h.level >= 20 },
    { id: 's3', name: 'Pegando o ritmo', desc: 'Sequência de 3 dias', gold: 15, test: (h) => ((h.streak && h.streak.best) || 0) >= 3 },
    { id: 's7', name: 'Semana impecável', desc: 'Sequência de 7 dias', gold: 50, test: (h) => ((h.streak && h.streak.best) || 0) >= 7 },
    { id: 's30', name: 'Disciplina de aço', desc: 'Sequência de 30 dias', gold: 250, test: (h) => ((h.streak && h.streak.best) || 0) >= 30 },
    { id: 'punct10', name: 'Pontualidade britânica', desc: 'Cumprir 10 tarefas antes do horário', gold: 40, test: (h) => (h.stats.punctual || 0) >= 10 },
    { id: 'board10', name: 'Quadro em dia', desc: 'Cumprir 10 missões da guilda', gold: 40, test: (h) => (h.stats.board || 0) >= 10 },
    { id: 'duo5', name: 'Melhor dupla', desc: 'Fazer 5 tarefas em dupla', gold: 40, test: (h) => (h.stats.duo || 0) >= 5 },
    { id: 'kudos5', name: 'Coração de ouro', desc: 'Dar 5 elogios', gold: 20, test: (h) => (h.stats.kudosGiven || 0) >= 5 },
    { id: 'loved10', name: 'Querido da guilda', desc: 'Receber 10 elogios', gold: 40, test: (h) => (h.stats.kudosGot || 0) >= 10 },
    { id: 'chest7', name: 'Caçador de baús', desc: 'Abrir 7 baús diários', gold: 40, test: (h) => (h.stats.chests || 0) >= 7 },
    { id: 'redeem', name: 'Merecido!', desc: 'Resgatar uma recompensa da vida real', gold: 15, test: (h) => (h.stats.redeemed || 0) >= 1 },
    { id: 'shop', name: 'Bem equipado', desc: 'Comprar um equipamento na loja', gold: 10, test: (h) => Object.keys(h.gear || {}).length >= 1 },
    { id: 'relic', name: 'Colecionador', desc: 'Guardar 5 relíquias', gold: 40, test: (h) => (h.stats.relics || 0) >= 5 },
    { id: 'boss', name: 'Matador de chefes', desc: 'Vencer um chefe com a guilda', gold: 30, test: (h, c) => !!(c.party && c.party.bossWins) },
    { id: 'tree', name: 'Mestre da classe', desc: 'Aprender a habilidade suprema do nível 15', gold: 100, test: (h) => Object.keys(h.skills || {}).some((k) => /\D10$/.test(k)) },
    { id: 'lvl30', name: 'Campeão do reino', desc: 'Chegar ao nível 30', gold: 400, test: (h) => h.level >= 30 },
    { id: 'lvl50', name: 'Lenda viva', desc: 'Chegar ao nível 50', gold: 1000, test: (h) => h.level >= 50 },
    { id: 'tree2', name: 'Grão-mestre', desc: 'Aprender a habilidade suprema do nível 50', gold: 800, test: (h) => Object.keys(h.skills || {}).some((k) => /\D21$/.test(k)) },
    { id: 'weekend', name: 'Guerreiro de fim de semana', desc: 'Cumprir tarefas num sábado e num domingo seguidos', gold: 30, test: (h) => !!(h.stats.weekend) },
  ];
  const PET_BONUS = {
    pet_cat: { mod: { crit: 0.04 }, txt: '+4% de chance crítica' },
    pet_owl: { mod: { healPow: 0.08 }, txt: '+8% de cura' },
    pet_slime: { mod: { hpPct: 0.06 }, txt: '+6% de vida' },
    pet_fox: { mod: { dodge: 0.05 }, txt: '+5% de esquiva' },
    pet_dragon: { mod: { atkPct: 0.06, crit: 0.02 }, txt: '+6% de poder e +2% de crítico' },
    pet_bunny: { mod: { spd: 1, dodge: 0.02 }, txt: '+1 de velocidade e +2% de esquiva' },
    pet_turtle: { mod: { defPct: 0.06 }, txt: '+6% de defesa' },
    pet_raven: { mod: { critDmg: 0.12 }, txt: '+12% de dano crítico' },
    pet_golem: { mod: { hpPct: 0.05, defPct: 0.04 }, txt: '+5% de vida e +4% de defesa' },
    pet_unicorn: { mod: { healPow: 0.08, hpPct: 0.05 }, txt: '+8% de cura e +5% de vida' },
  };


  /* ===== Relíquias (saque) ===== */
  const RELIC_PART = { slime: 'Geleia', goblin: 'Brinco', wolf: 'Presa', bat: 'Asa', boar: 'Presa', mushroom: 'Esporo', skull: 'Crânio', ghost: 'Véu', spider: 'Seda', rat: 'Cauda', zombie: 'Atadura', imp: 'Chifre', golem: 'Núcleo', bird: 'Pena', bear: 'Garra', kobold: 'Lanterna', cultist: 'Talismã', eye: 'Lente', knight: 'Emblema', serpent: 'Escama', mimic: 'Dente', frog: 'Pérola', worm: 'Anel', witch: 'Amuleto', wisp: 'Chama', croc: 'Dente', insect: 'Ferrão', treant: 'Semente', scorpion: 'Ferrão', mummy: 'Atadura', elemental: 'Fragmento', bandit: 'Moeda', penguin: 'Medalha', walrus: 'Presa', mammoth: 'Presa', dragon: 'Escama', hydra: 'Escama', sphinx: 'Enigma' };
  const RELIC_MODS = [
    { k: 'atkPct', lo: 0.04, hi: 0.08, txt: (v) => `+${Math.round(v * 100)}% de poder` },
    { k: 'hpPct', lo: 0.05, hi: 0.10, txt: (v) => `+${Math.round(v * 100)}% de vida` },
    { k: 'defPct', lo: 0.05, hi: 0.10, txt: (v) => `+${Math.round(v * 100)}% de defesa` },
    { k: 'crit', lo: 0.03, hi: 0.06, txt: (v) => `+${Math.round(v * 100)}% de crítico` },
    { k: 'spd', lo: 1, hi: 2, int: true, txt: (v) => `+${v} de velocidade` },
    { k: 'dodge', lo: 0.03, hi: 0.05, txt: (v) => `+${Math.round(v * 100)}% de esquiva` },
    { k: 'lifesteal', lo: 0.03, hi: 0.05, txt: (v) => `+${Math.round(v * 100)}% de roubo de vida` },
    { k: 'healPow', lo: 0.05, hi: 0.10, txt: (v) => `+${Math.round(v * 100)}% de cura` },
  ];
  const RARITY = {
    rara: { name: 'Rara', mods: 1, mul: 1, color: '#7ab8ff', sell: 30 },
    epica: { name: 'Épica', mods: 2, mul: 1.35, color: '#c890ff', sell: 70 },
    lendaria: { name: 'Lendária', mods: 2, mul: 2, color: '#ffb84a', sell: 160 },
  };
  const MAX_RELICS = 12, RELIC_SLOTS = 2;


  /* ===== Eventos de fim de semana (20, sorteados sem repetir até todos passarem) =====
     fx: xp (todas as tarefas), xpHard (difíceis), board (quadro), chest (baú), kudos (elogios), gold (ouro das vitórias),
         loot (chance de saque), punctual (bônus extra de pontualidade), enemy (força dos inimigos), gear/cos (desconto na loja)
     goal: meta coletiva de tarefas no fim de semana · merchant: relíquias à venda · extra: batalha especial na noite de domingo · respec: refazer habilidades */
  const EVENTS = [
    { id: 'colheita', name: 'Festival da Colheita', place: 'Vila Trigal', blurb: 'A vila celebra a colheita e toda tarefa rende mais.', fx: { xp: 0.3 } },
    { id: 'mercador', name: 'Mercador Errante', place: 'Estrada do Norte', blurb: 'Um mercador misterioso vende relíquias raras só neste fim de semana.', merchant: true },
    { id: 'arena', name: 'Torneio da Arena', place: 'Cidadela de Bronze', blurb: 'No domingo à noite, a guilda enfrenta o campeão da arena. Vencer dá prêmio triplo.', extra: { boss: 'ogro', title: 'Campeão da Arena', tierUp: 1, mul: 1.05, gold: 3, relic: 'epica' } },
    { id: 'apuros', name: 'Vilarejo em Apuros', place: 'Vila do Riacho', blurb: 'A enchente atingiu o vilarejo. Se a guilda cumprir a meta de tarefas, todos ganham recompensa.', goal: { tasks: 16, gold: 80, xp: 60 } },
    { id: 'estrelas', name: 'Chuva de Estrelas', place: 'Colinas do Observatório', blurb: 'Estrelas cadentes abençoam quem encara o difícil: tarefas difíceis valem o dobro.', fx: { xpHard: 1 } },
    { id: 'sabios', name: 'Feira dos Sábios', place: 'Torre do Conhecimento', blurb: 'Os sábios ensinam de graça: redistribua seus pontos de habilidade como quiser.', respec: true, fx: { xp: 0.1 } },
    { id: 'lua', name: 'Lua de Sangue', place: 'Todas as regiões', blurb: 'Os inimigos ficam mais fortes, mas o ouro e o saque das vitórias dobram.', fx: { enemy: 0.2, gold: 1, loot: 1 } },
    { id: 'caravana', name: 'Caravana de Ouro', place: 'Rota das Especiarias', blurb: 'A caravana paga bem a quem protege a estrada: ouro das vitórias em dobro.', fx: { gold: 1 } },
    { id: 'amizade', name: 'Festa da Amizade', place: 'Praça das Fitas', blurb: 'Elogios valem o triplo e as missões do quadro rendem mais.', fx: { kudos: 2, board: 0.3 } },
    { id: 'faxina', name: 'Grande Faxina Real', place: 'Castelo de Alvorada', blurb: 'O rei vem visitar! Missões do quadro da guilda rendem 60% a mais.', fx: { board: 0.6 } },
    { id: 'bau', name: 'Baú do Rei', place: 'Tesouraria Real', blurb: 'O baú diário vale o dobro e esconde mais relíquias.', fx: { chest: 1 } },
    { id: 'fantasias', name: 'Mercado de Fantasias', place: 'Feira de Lumen', blurb: 'Itens de estilo pela metade do preço na loja.', fx: { cos: 0.5 } },
    { id: 'dragao', name: 'Caçada ao Dragão', place: 'Pico Carmesim', blurb: 'No domingo à noite, a guilda caça um dragão ancestral. Vitória garante relíquia lendária.', extra: { boss: 'dragao', title: 'Dragão Ancestral', tierUp: 2, mul: 1.15, gold: 4, relic: 'lendaria' } },
    { id: 'fadas', name: 'Romaria das Fadas', place: 'Bosque Cintilante', blurb: 'As fadas espalham sorte: +20% de XP e baú diário mais generoso.', fx: { xp: 0.2, chest: 0.5 } },
    { id: 'lanternas', name: 'Noite das Lanternas', place: 'Vilarejo de Lumen', blurb: 'Quem cumpre no horário ganha bônus em dobro, e a vila pede uma meta coletiva.', fx: { punctual: 0.25 }, goal: { tasks: 12, gold: 60, xp: 40 } },
    { id: 'goblins', name: 'Invasão Goblin', place: 'Muralha Leste', blurb: 'Uma horda goblin ataca no domingo à noite. Vencer rende ouro em dobro.', extra: { boss: 'reiGoblin', title: 'General Goblin', tierUp: 0, mul: 0.95, gold: 2, relic: 'rara' } },
    { id: 'templo', name: 'Peregrinação ao Templo', place: 'Templo das Mil Velas', blurb: '+25% de XP nas tarefas e mais chance de saque nas vitórias.', fx: { xp: 0.25, loot: 0.5 } },
    { id: 'ponte', name: 'Mutirão da Ponte', place: 'Vila Pedregosa', blurb: 'A ponte caiu! Uma meta grande de tarefas da guilda paga um prêmio grande.', goal: { tasks: 24, gold: 140, xp: 100 } },
    { id: 'ferreiro', name: 'Feira do Ferreiro', place: 'Forja de Ferro Velho', blurb: 'Armas, armaduras e amuletos com 30% de desconto.', fx: { gear: 0.3 } },
    { id: 'hidra', name: 'Despertar da Hidra', place: 'Pântano das Brumas', blurb: 'Uma hidra antiga desperta no domingo à noite. Prêmio em dobro e relíquia épica.', extra: { boss: 'hidra', title: 'Hidra Ancestral', tierUp: 1, mul: 1.1, gold: 2, relic: 'epica' } },
  ];

  /* ===== Equipamentos (stats) ===== */
  const GEAR_TIERS = [
    { n: 'Bronze',   lvl: 1,  price: 60,   w: 0.08, a: 0.08, crit: 0.03, spd: 1 },
    { n: 'Ferro',    lvl: 4,  price: 180,  w: 0.16, a: 0.15, crit: 0.05, spd: 2 },
    { n: 'Aço',      lvl: 8,  price: 420,  w: 0.26, a: 0.24, crit: 0.08, spd: 3 },
    { n: 'Mithril',  lvl: 12, price: 900,  w: 0.38, a: 0.34, crit: 0.11, spd: 4 },
    { n: 'Rúnico',   lvl: 16, price: 1800, w: 0.52, a: 0.46, crit: 0.14, spd: 5 },
    { n: 'Lendário', lvl: 20, price: 3500, w: 0.70, a: 0.60, crit: 0.18, spd: 6 },
    { n: 'Adamante', lvl: 26, price: 6500, w: 0.88, a: 0.74, crit: 0.20, spd: 7 },
    { n: 'Celestial', lvl: 33, price: 11000, w: 1.08, a: 0.90, crit: 0.22, spd: 8 },
    { n: 'Dracônico', lvl: 41, price: 17000, w: 1.30, a: 1.08, crit: 0.24, spd: 9 },
    { n: 'Astral', lvl: 50, price: 26000, w: 1.55, a: 1.28, crit: 0.26, spd: 10 },
    { n: 'Primordial', lvl: 60, price: 38000, w: 1.82, a: 1.50, crit: 0.28, spd: 11 },
  ];
  const GEAR_SLOTS = {
    weapon: { name: 'Arma', stat: (t) => `+${Math.round(t.w * 100)}% de poder` },
    armor:  { name: 'Armadura', stat: (t) => `+${Math.round(t.a * 100)}% de vida e defesa` },
    amulet: { name: 'Amuleto', stat: (t) => `+${Math.round(t.crit * 100)}% crítico, +${t.spd} velocidade` },
  };
  const ARMOR_NAME = { gelo: 'Manto', fogo: 'Manto', arqueiro: 'Gibão', paladino: 'Placas', guerreiro: 'Cota', druida: 'Veste', curandeiro: 'Túnica', ladino: 'Couro', guardiao: 'Couraça', bruxa: 'Manto', bardo: 'Gibão', xama: 'Veste', monge: 'Quimono', inventor: 'Macacão', princesa: 'Vestido' };

  /* ===== Cosméticos ===== */
  const COSMETICS = [
    // chapéus
    { id: 'hat_wizard', slot: 'hat', name: 'Chapéu de Mago', price: 80 },
    { id: 'hat_hood', slot: 'hat', name: 'Capuz', price: 60 },
    { id: 'hat_helm', slot: 'hat', name: 'Elmo de Cavaleiro', price: 140 },
    { id: 'hat_hunter', slot: 'hat', name: 'Chapéu de Caçador', price: 90 },
    { id: 'hat_flowers', slot: 'hat', name: 'Coroa de Flores', price: 70 },
    { id: 'hat_horns', slot: 'hat', name: 'Elmo de Chifres', price: 200 },
    { id: 'hat_crown', slot: 'hat', name: 'Coroa Real', price: 500 },
    { id: 'hat_party', slot: 'hat', name: 'Chapéu de Aniversário', price: 0, gift: true },
    { id: 'hat_bandana', slot: 'hat', name: 'Bandana', price: 50 },
    { id: 'hat_straw', slot: 'hat', name: 'Chapéu de Palha', price: 60 },
    { id: 'hat_beanie', slot: 'hat', name: 'Gorro de Inverno', price: 70 },
    { id: 'hat_bunny', slot: 'hat', name: 'Orelhas de Coelho', price: 90 },
    { id: 'hat_witch', slot: 'hat', name: 'Chapéu de Bruxa', price: 120 },
    { id: 'hat_tophat', slot: 'hat', name: 'Cartola', price: 130 },
    { id: 'hat_antlers', slot: 'hat', name: 'Galhada de Cervo', price: 140 },
    { id: 'hat_pirate', slot: 'hat', name: 'Chapéu de Pirata', price: 150 },
    { id: 'hat_tiara', slot: 'hat', name: 'Tiara', price: 160 },
    { id: 'hat_halo', slot: 'hat', name: 'Auréola', price: 220 },
    // capas
    { id: 'cape_red', slot: 'cape', name: 'Capa Escarlate', price: 70, color: '#b8332f' },
    { id: 'cape_blue', slot: 'cape', name: 'Capa Real Azul', price: 70, color: '#2f5bb8' },
    { id: 'cape_green', slot: 'cape', name: 'Capa da Floresta', price: 70, color: '#2f8a4c' },
    { id: 'cape_purple', slot: 'cape', name: 'Capa Arcana', price: 110, color: '#6b3fb0' },
    { id: 'cape_black', slot: 'cape', name: 'Capa das Sombras', price: 110, color: '#22222c' },
    { id: 'cape_gold', slot: 'cape', name: 'Capa Dourada', price: 300, color: '#d6a531' },
    { id: 'cape_ice', slot: 'cape', name: 'Capa de Gelo', price: 200, color: '#6ab8de', pattern: 'frost' },
    { id: 'cape_stars', slot: 'cape', name: 'Capa Estrelada', price: 220, color: '#1e2a5a', pattern: 'stars' },
    { id: 'cape_feather', slot: 'cape', name: 'Capa de Penas', price: 240, color: '#3a6aa8', pattern: 'feathers' },
    { id: 'cape_dragon', slot: 'cape', name: 'Manto do Dragão', price: 380, color: '#7a1a1a', pattern: 'scales' },
    { id: 'cape_royal', slot: 'cape', name: 'Manto Real', price: 420, color: '#6a1a8a', pattern: 'ermine' },
    // auras
    { id: 'aura_frost', slot: 'aura', name: 'Aura Glacial', price: 250, color: '#8fd8f5' },
    { id: 'aura_fire', slot: 'aura', name: 'Aura Ígnea', price: 250, color: '#ff8a4c' },
    { id: 'aura_nature', slot: 'aura', name: 'Aura Verdejante', price: 250, color: '#63c784' },
    { id: 'aura_shadow', slot: 'aura', name: 'Aura Sombria', price: 300, color: '#9a6cf0' },
    { id: 'aura_light', slot: 'aura', name: 'Aura Celestial', price: 400, color: '#ffe48a' },
    { id: 'aura_storm', slot: 'aura', name: 'Aura do Trovão', price: 320, color: '#7adfff' },
    { id: 'aura_love', slot: 'aura', name: 'Aura do Carinho', price: 280, color: '#ff7aa8' },
    { id: 'aura_ocean', slot: 'aura', name: 'Aura das Marés', price: 300, color: '#3a8ad8' },
    { id: 'aura_blood', slot: 'aura', name: 'Aura Carmesim', price: 360, color: '#d83a4a' },
    // mascotes
    { id: 'pet_cat', slot: 'pet', name: 'Gato Malhado', price: 150 },
    { id: 'pet_owl', slot: 'pet', name: 'Coruja Sábia', price: 180 },
    { id: 'pet_slime', slot: 'pet', name: 'Slime Amigo', price: 120 },
    { id: 'pet_fox', slot: 'pet', name: 'Raposinha', price: 200 },
    { id: 'pet_dragon', slot: 'pet', name: 'Dragãozinho', price: 600 },
    { id: 'pet_bunny', slot: 'pet', name: 'Coelhinho', price: 150 },
    { id: 'pet_turtle', slot: 'pet', name: 'Tartaruguinha', price: 160 },
    { id: 'pet_raven', slot: 'pet', name: 'Corvo', price: 220 },
    { id: 'pet_golem', slot: 'pet', name: 'Golem de Bolso', price: 300 },
    { id: 'pet_unicorn', slot: 'pet', name: 'Unicórnio', price: 650 },
    // armaduras (visual por cima da roupa)
    { id: 'arm_leather', slot: 'armor', name: 'Peitoral de Couro', price: 120 },
    { id: 'arm_chain', slot: 'armor', name: 'Cota de Malha', price: 160 },
    { id: 'arm_iron', slot: 'armor', name: 'Peitoral de Ferro', price: 180 },
    { id: 'arm_bark', slot: 'armor', name: 'Casca de Árvore', price: 200 },
    { id: 'arm_spikes', slot: 'armor', name: 'Ombreiras Espinhadas', price: 220 },
    { id: 'arm_scale', slot: 'armor', name: 'Couraça de Escamas', price: 300 },
    { id: 'arm_shadow', slot: 'armor', name: 'Armadura Sombria', price: 380 },
    { id: 'arm_samurai', slot: 'armor', name: 'Armadura Samurai', price: 400 },
    { id: 'arm_crystal', slot: 'armor', name: 'Armadura de Cristal', price: 420 },
    { id: 'arm_gold', slot: 'armor', name: 'Armadura Dourada', price: 450 },
    // rosto
    { id: 'face_star', slot: 'face', name: 'Adesivo de Estrela', price: 50 },
    { id: 'face_glasses', slot: 'face', name: 'Óculos Redondos', price: 60 },
    { id: 'face_mustache', slot: 'face', name: 'Bigode Elegante', price: 70 },
    { id: 'face_patch', slot: 'face', name: 'Tapa-olho', price: 80 },
    { id: 'face_shades', slot: 'face', name: 'Óculos Escuros', price: 90 },
    { id: 'face_paint', slot: 'face', name: 'Pintura de Guerra', price: 90 },
    { id: 'face_monocle', slot: 'face', name: 'Monóculo', price: 110 },
    { id: 'face_mask', slot: 'face', name: 'Máscara de Herói', price: 120 },
    // pescoço
    { id: 'neck_bow', slot: 'neck', name: 'Gravata-borboleta', price: 60 },
    { id: 'neck_bandana', slot: 'neck', name: 'Lenço de Aventureiro', price: 60 },
    { id: 'neck_scarf', slot: 'neck', name: 'Cachecol', price: 70 },
    { id: 'neck_fang', slot: 'neck', name: 'Colar de Presas', price: 110 },
    { id: 'neck_pearls', slot: 'neck', name: 'Colar de Pérolas', price: 140 },
    { id: 'neck_medal', slot: 'neck', name: 'Medalhão de Ouro', price: 160 },
    { id: 'neck_amulet', slot: 'neck', name: 'Amuleto de Cristal', price: 200 },
    // mão livre
    { id: 'off_flowers', slot: 'offhand', name: 'Buquê de Flores', price: 80 },
    { id: 'off_potion', slot: 'offhand', name: 'Frasco de Poção', price: 90 },
    { id: 'off_teddy', slot: 'offhand', name: 'Ursinho de Pelúcia', price: 100 },
    { id: 'off_lantern', slot: 'offhand', name: 'Lanterna', price: 110 },
    { id: 'off_shield', slot: 'offhand', name: 'Escudo Redondo', price: 140 },
    { id: 'off_book', slot: 'offhand', name: 'Livro de Feitiços', price: 150 },
    { id: 'off_kite', slot: 'offhand', name: 'Escudo de Cavaleiro', price: 260 },
    { id: 'off_orb', slot: 'offhand', name: 'Orbe Flutuante', price: 280 },
  ];
  // variações de cor e efeito das armas (valem para a arma de qualquer classe)
  const WEAPON_SKINS = [
    { id: 'wpn_candy', slot: 'weapon', name: 'Doce de Festa', price: 200, pal: { wood: '#ffffff', metal: '#ff9ecf', metalDk: '#d85a9a', gem: '#7ad8ff', accent: '#ffe48a' }, fx: 'hearts' },
    { id: 'wpn_bone', slot: 'weapon', name: 'Osso Ancestral', price: 220, pal: { wood: '#d8c8a8', metal: '#f0e6d0', metalDk: '#a8987a', gem: '#d84a4a', accent: '#d84a4a' } },
    { id: 'wpn_nature', slot: 'weapon', name: 'Abraço da Floresta', price: 240, pal: { wood: '#4a6a2a', metal: '#a8d88a', metalDk: '#4a8a4a', gem: '#7bd36b', accent: '#63c784' }, glow: '#63c784', fx: 'leaves' },
    { id: 'wpn_gold', slot: 'weapon', name: 'Banho de Ouro', price: 260, pal: { wood: '#8a5a1a', metal: '#f4c84a', metalDk: '#b8862a', gem: '#fff1a8', accent: '#f4c84a' }, glow: '#ffd36b' },
    { id: 'wpn_crystal', slot: 'weapon', name: 'Cristal Glacial', price: 280, pal: { wood: '#9ad0e8', metal: '#d8f6ff', metalDk: '#6ab8de', gem: '#e8fbff', accent: '#8fd8f5' }, glow: '#8fd8f5', fx: 'stars' },
    { id: 'wpn_shadow', slot: 'weapon', name: 'Lâmina Sombria', price: 300, pal: { wood: '#2a2030', metal: '#5a4a6e', metalDk: '#2a1f35', gem: '#b06aff', accent: '#9a5aff' }, glow: '#9a5aff' },
    { id: 'wpn_flame', slot: 'weapon', name: 'Chama Eterna', price: 320, pal: { wood: '#4a2216', metal: '#ff9a5a', metalDk: '#c8412f', gem: '#ffd36b', accent: '#ff6a2a' }, glow: '#ff6a2a', fx: 'flame' },
    { id: 'wpn_storm', slot: 'weapon', name: 'Fúria do Trovão', price: 340, pal: { wood: '#3a4a6a', metal: '#bfe8ff', metalDk: '#4a7ab8', gem: '#7adfff', accent: '#7adfff' }, glow: '#7adfff', fx: 'sparks' },
    { id: 'wpn_royal', slot: 'weapon', name: 'Relíquia Real', price: 450, pal: { wood: '#5a2a7a', metal: '#f4c84a', metalDk: '#8a5a1a', gem: '#d84a5a', accent: '#7a3ab8' }, glow: '#c890ff', fx: 'stars' },
    { id: 'wpn_star', slot: 'weapon', name: 'Poeira Estelar', price: 500, pal: { wood: '#2a2a5a', metal: '#e8e8ff', metalDk: '#7a7ad8', gem: '#fff6c8', accent: '#b8b8ff' }, glow: '#b8b8ff', fx: 'stars' },
  ];
  COSMETICS.push(...WEAPON_SKINS);
  const COSMETIC_SLOTS = { hat: 'Chapéus', face: 'Rosto', neck: 'Pescoço', armor: 'Armaduras', cape: 'Capas', weapon: 'Armas', offhand: 'Mão livre', aura: 'Auras', pet: 'Mascotes' };
  // poções: valem só para a batalha da noite em que foram bebidas
  const POTIONS = [
    { id: 'pot_str', name: 'Poção de Força', mod: { atkPct: 0.15 }, txt: '+15% de poder' },
    { id: 'pot_stone', name: 'Poção de Pedra', mod: { defPct: 0.25 }, txt: '+25% de defesa' },
    { id: 'pot_life', name: 'Poção de Vida', mod: { hpPct: 0.2 }, txt: '+20% de vida' },
    { id: 'pot_luck', name: 'Poção da Sorte', mod: { crit: 0.08, dodge: 0.05 }, txt: '+8% de crítico e +5% de esquiva' },
  ];
  const potionPrice = (lvl) => 30 + 6 * (lvl || 1);


  /* ===== Ancestralidades (referência: Daggerheart; Troll inspirado em WoW) ===== */
  const HUMAN_SKIN = ['#fbe0c8', '#f1c49b', '#d9a174', '#b97a4c', '#8c5530', '#5e3a22'];
  const ANCESTRIES = {
    humano:   { name: 'Humano',   ears: 'round',  perk: '+3% de vida, poder e defesa', blurb: 'Versáteis e teimosos, cabem em qualquer guilda.', mod: { hpPct: 0.03, atkPct: 0.03, defPct: 0.03 } },
    clank:    { name: 'Clank',    ears: 'bolt',   perk: '+10% de defesa', blurb: 'Seres mecânicos com uma centelha de vida.', mod: { defPct: 0.10 }, skins: ['#c8a060', '#a0a8b0', '#b87a4a', '#6a7a8a', '#d8c090'], extras: ['bald', 'metalHead', 'antenna', 'rivets', 'lenses', 'grill'] },
    drakona:  { name: 'Drakona',  ears: 'fin',    perk: '+6% de poder', blurb: 'Descendentes de dragões, de escamas e sopro forte.', mod: { atkPct: 0.06 }, skins: ['#4a9a6a', '#c8a03a', '#a8433a', '#3a6ab0', '#8a8a9a', '#3a3440'], extras: ['bald', 'snout', 'crest', 'backHorns', 'scales', 'tailScaly'], eyeC: '#c8541a' },
    anao:     { name: 'Anão',     ears: 'round',  perk: '+8% de vida, +4% de defesa', blurb: 'Baixos, robustos e difíceis de derrubar.', mod: { hpPct: 0.08, defPct: 0.04 }, extras: ['dwarfBeard', 'bigNose'], scale: [1.1, 0.88] },
    elfo:     { name: 'Elfo',     ears: 'pointy', perk: '+2 de velocidade, +3% de crítico', blurb: 'Graciosos, atentos e de vida longa.', mod: { spd: 2, crit: 0.03 }, scale: [0.94, 1.04] },
    fada:     { name: 'Fada',     ears: 'pointy', perk: '+8% de esquiva', blurb: 'Pequenas criaturas aladas e cheias de magia.', mod: { dodge: 0.08 }, skins: HUMAN_SKIN.concat(['#d8c8f0', '#c8e8d8']), extras: ['wings', 'sparkles'], scale: 0.9 },
    fauno:    { name: 'Fauno',    ears: 'pointy', perk: '+1 de velocidade, +4% de esquiva', blurb: 'Metade bode, todo coração. Saltam como ninguém.', mod: { spd: 1, dodge: 0.04 }, extras: ['goatHorns', 'goatLegs', 'tailGoat'] },
    firbolg:  { name: 'Firbolg',  ears: 'droop',  perk: '+10% de vida', blurb: 'Gentis gigantes da floresta, de nariz rosado.', mod: { hpPct: 0.10 }, skins: ['#8aa0b8', '#a0b08a', '#b8a08a', '#7a8aa0', '#c8b0a0'], extras: ['bovineNose', 'cowHorns'], scale: [1.12, 1.04] },
    fungril:  { name: 'Fungril',  ears: 'none',   perk: 'Regenera 1,5% da vida por turno', blurb: 'Gente-cogumelo ligada por raízes à terra.', mod: { regen: 0.015 }, skins: ['#e2d4bc', '#c8b4d8', '#b4ccac', '#e8bcac', '#b0b8c8'], extras: ['mushroomCap', 'sporeSpots'] },
    galapa:   { name: 'Galapa',   ears: 'none',   perk: '+12% de defesa', blurb: 'Povo-tartaruga, paciente e protegido pelo casco.', mod: { defPct: 0.12, spd: -1 }, skins: ['#8aa05a', '#6a8a4a', '#a0905a', '#5a7a6a'], extras: ['bald', 'shell', 'turtleHead', 'beak'], scale: [1.06, 0.95] },
    gigante:  { name: 'Gigante',  ears: 'round',  perk: '+12% de vida', blurb: 'Enormes e fortes, sempre os primeiros na fila.', mod: { hpPct: 0.12, spd: -1 }, extras: ['thirdEye', 'heavyBrow'], scale: [1.14, 1.08] },
    goblin:   { name: 'Goblin',   ears: 'goblin', perk: '+5% de esquiva, +1 de velocidade', blurb: 'Pequenos, espertos e de orelhas enormes.', mod: { dodge: 0.05, spd: 1 }, skins: ['#8fbf5a', '#6fa04a', '#a8c96a', '#7a9a8a', '#c8b45a'], extras: ['longNose'], scale: 0.86 },
    halfling: { name: 'Halfling', ears: 'round',  perk: '+6% de esquiva, +2% de crítico', blurb: 'Pequenos, sortudos e amantes de uma boa comida.', mod: { dodge: 0.06, crit: 0.02 }, extras: ['bareFeet', 'rosy'], scale: 0.86 },
    infernis: { name: 'Infernis', ears: 'pointy', perk: '+4% de poder, +10% de dano crítico', blurb: 'Marcados por um sangue infernal, chifres e cauda.', mod: { atkPct: 0.04, critDmg: 0.1 }, skins: ['#c8453a', '#a83a5a', '#8a4ab0', '#d86a4a', '#5a3a6a'].concat(HUMAN_SKIN.slice(1, 4)), extras: ['devilHorns', 'tailDevil'], eyeC: '#b8141a' },
    katari:   { name: 'Katari',   ears: 'none',   perk: '+5% de crítico, +1 de velocidade', blurb: 'Povo felino, curioso e de reflexos rápidos.', mod: { crit: 0.05, spd: 1 }, skins: ['#e0a050', '#c88a50', '#9a9a9a', '#4a3a30', '#f0e0c8', '#d0702a'], extras: ['catEars', 'catFace', 'catStripes', 'tailCat'] },
    orc:      { name: 'Orc',      ears: 'pointySmall', perk: '+6% de poder, +3% de vida', blurb: 'Fortes, leais e de presas à mostra.', mod: { atkPct: 0.06, hpPct: 0.03 }, skins: ['#7fa05a', '#5f8a4a', '#8a9a7a', '#a08a6a', '#6a7a6a'].concat(HUMAN_SKIN.slice(2, 5)), extras: ['tusksSmall', 'heavyBrow'], scale: [1.06, 1.02] },
    ribbet:   { name: 'Ribbet',   ears: 'none',   perk: '+1 de velocidade, +4% de esquiva', blurb: 'Povo-sapo que pula alto e coaxa melhor ainda.', mod: { spd: 1, dodge: 0.04 }, skins: ['#6ab85a', '#4aa08a', '#c8b84a', '#5a8ab8', '#b85a5a'], extras: ['bald', 'frogEyes', 'frogHead', 'frogMouth'], scale: [1.04, 0.94] },
    simiah:   { name: 'Simiah',   ears: 'monkey', perk: '+2 de velocidade, +3% de esquiva', blurb: 'Povo-macaco, ágil nas árvores e nas ideias.', mod: { spd: 2, dodge: 0.03 }, skins: ['#8a5a3a', '#6a4a30', '#b08a60', '#4a3a30', '#c8a070'], extras: ['monkeyMask', 'muzzle', 'tailMonkey'] },
    troll:    { name: 'Troll',    ears: 'troll',  perk: 'Regenera 2,5% da vida por turno, +4% de vida', blurb: 'Altos, de presas enormes e corpos que se curam sozinhos.', mod: { regen: 0.025, hpPct: 0.04 }, skins: ['#5a9ab8', '#4a8a8a', '#6aa07a', '#7a8ab8', '#8a6a9a'], extras: ['tusksBig', 'longNose'], scale: [1.02, 1.08] },
  };
  for (const [id, a] of Object.entries(ANCESTRIES)) { a.id = id; a.skins = a.skins || HUMAN_SKIN; a.extras = a.extras || []; a.scale = a.scale || 1; a.eyeC = a.eyeC || null; }

  /* ===== Visual do personagem ===== */
  const LOOK = {
    gender: [{ id: 'm', name: 'Masculino' }, { id: 'f', name: 'Feminino' }],
    skin: ['#fbe0c8', '#f1c49b', '#d9a174', '#b97a4c', '#8c5530', '#5e3a22'],
    face: [
      { id: 'alegre', name: 'Alegre' }, { id: 'firme', name: 'Determinado' }, { id: 'sereno', name: 'Sereno' },
      { id: 'travesso', name: 'Travesso' }, { id: 'sabio', name: 'Sábio (barba)' }, { id: 'sardas', name: 'Sardento' },
    ],
    hairStyle: [
      { id: 'curto', name: 'Curto' }, { id: 'espetado', name: 'Espetado' }, { id: 'longo', name: 'Longo' },
      { id: 'rabo', name: 'Rabo de cavalo' }, { id: 'coque', name: 'Coque' }, { id: 'trancas', name: 'Tranças' },
      { id: 'cacheado', name: 'Cacheado' }, { id: 'moicano', name: 'Moicano' }, { id: 'careca', name: 'Careca' },
    ],
    hairColor: ['#2a1c14', '#6b3e20', '#b0702f', '#e3c06a', '#c9452f', '#e8e4dc', '#5b7fd6', '#d66fa8'],
    outfit: [
      { id: 'tunica', name: 'Túnica' }, { id: 'manto', name: 'Manto longo' }, { id: 'armadura', name: 'Armadura' },
      { id: 'gibao', name: 'Gibão com cinto' }, { id: 'vestido', name: 'Vestido de batalha' },
    ],
    outfitColor: ['#3d5a99', '#a33b36', '#3f7d4f', '#6a4a9c', '#2b2b33', '#b98a3a', '#e6e0d2', '#2f8a8a'],
  };

  /* ===== Bestiário: 50 espécies em 8 regiões + 8 chefes =====
     g: gênero (m/f) para concordar os títulos; group: nome do bando (se a espécie anda em grupo) */
  const SP = (id, name, plural, g, group, shape, color, hp, atk, def, spd, extra) => Object.assign({ id, name, plural, g, group, shape, color, hp, atk, def, spd }, extra || {});
  const SPECIES = [
    // 0 · Floresta Sussurrante
    SP('slime', 'Slime', 'Slimes', 'm', 'Poça', 'slime', '#7bd36b', 1.15, 0.75, 0.8, 0.7),
    SP('goblin', 'Goblin', 'Goblins', 'm', 'Bando', 'goblin', '#79a83d', 0.85, 1.0, 0.7, 1.2),
    SP('lobo', 'Lobo', 'Lobos', 'm', 'Matilha', 'wolf', '#6a6f84', 0.9, 1.1, 0.7, 1.4),
    SP('morcego', 'Morcego Vampiro', 'Morcegos Vampiros', 'm', 'Revoada', 'bat', '#6b4a7a', 0.6, 0.9, 0.5, 1.6, { drain: 0.3 }),
    SP('javali', 'Javali', 'Javalis', 'm', 'Manada', 'boar', '#8a5a3a', 1.2, 1.1, 1.0, 0.9),
    SP('cogumelo', 'Cogumelo Saltitante', 'Cogumelos Saltitantes', 'm', 'Colônia', 'mushroom', '#c8453a', 0.9, 0.8, 0.8, 1.0, { poison: 0.2 }),
    // 1 · Cripta Esquecida
    SP('esqueleto', 'Esqueleto', 'Esqueletos', 'm', 'Legião', 'skull', '#e8e2cf', 0.9, 1.0, 1.15, 0.9),
    SP('fantasma', 'Fantasma', 'Fantasmas', 'm', null, 'ghost', '#bfe3ef', 0.8, 1.15, 0.6, 1.1, { dodge: 0.15 }),
    SP('aranha', 'Aranha Gigante', 'Aranhas Gigantes', 'f', 'Ninho', 'spider', '#6a5476', 0.9, 1.0, 0.8, 1.1, { poison: 0.25 }),
    SP('ratazana', 'Ratazana', 'Ratazanas', 'f', 'Ninhada', 'rat', '#8a7a6a', 0.6, 0.85, 0.5, 1.5),
    SP('zumbi', 'Zumbi', 'Zumbis', 'm', 'Horda', 'zombie', '#8aa07a', 1.3, 0.95, 0.8, 0.6),
    SP('gargula', 'Gárgula', 'Gárgulas', 'f', null, 'imp', '#8a8a92', 1.1, 1.0, 1.5, 0.9, { wings: true }),
    // 2 · Montanhas de Ferro
    SP('orc', 'Orc', 'Orcs', 'm', 'Bando', 'goblin', '#5f8a4a', 1.3, 1.2, 1.1, 0.8, { big: true }),
    SP('troll', 'Troll', 'Trolls', 'm', null, 'goblin', '#7d8a8a', 1.6, 1.25, 1.0, 0.7, { big: true, regen: 0.04 }),
    SP('golem', 'Golem de Pedra', 'Golens de Pedra', 'm', null, 'golem', '#9a8a74', 1.8, 0.95, 1.6, 0.5),
    SP('harpia', 'Harpia', 'Harpias', 'f', 'Revoada', 'bird', '#b8865a', 0.75, 1.05, 0.6, 1.5),
    SP('urso', 'Urso', 'Ursos', 'm', null, 'bear', '#6a4a32', 1.5, 1.2, 1.0, 0.8),
    SP('kobold', 'Kobold', 'Kobolds', 'm', 'Bando', 'kobold', '#c87a3a', 0.7, 0.9, 0.7, 1.3),
    // 3 · Templo Sombrio
    SP('cultista', 'Cultista', 'Cultistas', 'm', 'Círculo', 'cultist', '#7a2f4a', 0.8, 1.25, 0.7, 1.0, { aoe: 0.55 }),
    SP('diabrete', 'Diabrete', 'Diabretes', 'm', 'Bando', 'imp', '#c8453a', 0.65, 1.0, 0.6, 1.5),
    SP('olho', 'Olho Flutuante', 'Olhos Flutuantes', 'm', null, 'eye', '#c8a0d8', 0.8, 1.3, 0.6, 1.1),
    SP('cavaleiro', 'Cavaleiro Caído', 'Cavaleiros Caídos', 'm', null, 'knight', '#4a4a5a', 1.3, 1.15, 1.6, 0.8),
    SP('serpente', 'Serpente', 'Serpentes', 'f', null, 'serpent', '#4a8a5a', 1.0, 1.1, 0.8, 1.2, { poison: 0.3 }),
    SP('mimico', 'Mímico', 'Mímicos', 'm', null, 'mimic', '#a8743a', 1.3, 1.3, 1.3, 0.7),
    // 4 · Pântano das Brumas
    SP('sapo', 'Sapo Gigante', 'Sapos Gigantes', 'm', 'Coro', 'frog', '#5a8a3a', 1.1, 0.95, 0.8, 1.0),
    SP('sanguessuga', 'Sanguessuga', 'Sanguessugas', 'f', 'Ninho', 'worm', '#6a3a4a', 0.8, 0.9, 0.6, 1.0, { drain: 0.4 }),
    SP('bruxa', 'Bruxa do Pântano', 'Bruxas do Pântano', 'f', null, 'witch', '#4a6a3a', 0.8, 1.3, 0.7, 1.0, { aoe: 0.5 }),
    SP('fogofatuo', 'Fogo-Fátuo', 'Fogos-Fátuos', 'm', 'Enxame', 'wisp', '#8affc8', 0.5, 1.0, 0.4, 1.6, { dodge: 0.2 }),
    SP('crocodilo', 'Crocodilo', 'Crocodilos', 'm', null, 'croc', '#4a6a3a', 1.5, 1.25, 1.2, 0.7),
    SP('mosquito', 'Mosquito Gigante', 'Mosquitos Gigantes', 'm', 'Enxame', 'insect', '#7a6a4a', 0.45, 0.8, 0.4, 1.8, { drain: 0.2 }),
    SP('arvore', 'Árvore Podre', 'Árvores Podres', 'f', null, 'treant', '#5a4a30', 1.9, 1.0, 1.3, 0.5, { regen: 0.03 }),
    // 5 · Deserto de Âmbar
    SP('escorpiao', 'Escorpião', 'Escorpiões', 'm', 'Ninho', 'scorpion', '#c8963a', 0.9, 1.15, 1.2, 1.1, { poison: 0.3 }),
    SP('mumia', 'Múmia', 'Múmias', 'f', null, 'mummy', '#d8caa0', 1.4, 1.05, 1.0, 0.7),
    SP('verme', 'Verme da Areia', 'Vermes da Areia', 'm', null, 'worm', '#c8a060', 1.7, 1.2, 1.0, 0.7, { big: true }),
    SP('abutre', 'Abutre', 'Abutres', 'm', 'Revoada', 'bird', '#5a4a4a', 0.7, 1.0, 0.6, 1.5, { drain: 0.2 }),
    SP('elemAreia', 'Elemental de Areia', 'Elementais de Areia', 'm', null, 'elemental', '#e0b060', 1.2, 1.1, 1.1, 1.0),
    SP('saqueador', 'Saqueador', 'Saqueadores', 'm', 'Bando', 'bandit', '#8a5a3a', 0.85, 1.15, 0.8, 1.2),
    // 6 · Geleira Eterna
    SP('yeti', 'Yeti', 'Yetis', 'm', null, 'bear', '#e8f0f8', 1.6, 1.2, 1.0, 0.8, { horns: true }),
    SP('elemGelo', 'Elemental de Gelo', 'Elementais de Gelo', 'm', null, 'elemental', '#8fd8f5', 1.1, 1.1, 1.4, 0.8),
    SP('pinguim', 'Pinguim Guerreiro', 'Pinguins Guerreiros', 'm', 'Pelotão', 'penguin', '#2a3a4a', 0.7, 0.9, 0.8, 1.2),
    SP('morsa', 'Morsa', 'Morsas', 'f', null, 'walrus', '#8a6a5a', 1.6, 1.1, 1.2, 0.6),
    SP('espirito', 'Espírito da Nevasca', 'Espíritos da Nevasca', 'm', null, 'ghost', '#d8f0ff', 0.8, 1.2, 0.6, 1.2, { dodge: 0.15 }),
    SP('mamute', 'Mamute', 'Mamutes', 'm', null, 'mammoth', '#7a5a42', 2.0, 1.15, 1.2, 0.5),
    SP('loboGelo', 'Lobo do Gelo', 'Lobos do Gelo', 'm', 'Matilha', 'wolf', '#b8d8e8', 0.9, 1.1, 0.8, 1.4),
    // 7 · Coração do Vulcão
    SP('salamandra', 'Salamandra', 'Salamandras', 'f', 'Ninho', 'croc', '#e86a2a', 0.8, 1.1, 0.8, 1.3, { small: true }),
    SP('elemFogo', 'Elemental de Fogo', 'Elementais de Fogo', 'm', null, 'elemental', '#ff7a3a', 1.0, 1.3, 0.8, 1.1, { aoe: 0.5 }),
    SP('golemMagma', 'Golem de Magma', 'Golens de Magma', 'm', null, 'golem', '#5a3a3a', 1.8, 1.05, 1.5, 0.5, { lava: true }),
    SP('fenix', 'Fênix', 'Fênix', 'f', null, 'bird', '#ff9a3a', 0.9, 1.2, 0.7, 1.4, { regen: 0.03 }),
    SP('caoInfernal', 'Cão Infernal', 'Cães Infernais', 'm', 'Matilha', 'wolf', '#8a2a2a', 0.9, 1.2, 0.8, 1.4, { horns: true }),
    SP('demonio', 'Demônio', 'Demônios', 'm', null, 'imp', '#8a1a2a', 1.4, 1.35, 1.1, 0.9, { big: true, wings: true }),
  ];
  const BOSSES = {
    reiGoblin: SP('reiGoblin', 'Rei Goblin', '', 'm', null, 'goblin', '#9bbf3d', 3.2, 1.35, 1.1, 1.0, { boss: true, crown: true, aoe: 0.6 }),
    lich: SP('lich', 'Lich Rei', '', 'm', null, 'skull', '#b6f0d8', 3.0, 1.5, 1.0, 1.0, { boss: true, crown: true, aoe: 0.65 }),
    ogro: SP('ogro', 'Ogro Senhor da Guerra', '', 'm', null, 'goblin', '#b58a5a', 3.8, 1.45, 1.3, 0.8, { boss: true, big: true, aoe: 0.6 }),
    dragao: SP('dragao', 'Dragão Carmesim', '', 'm', null, 'dragon', '#c8412f', 4.2, 1.6, 1.4, 1.0, { boss: true, aoe: 0.7 }),
    hidra: SP('hidra', 'Hidra do Pântano', '', 'f', null, 'hydra', '#4a8a4a', 3.8, 1.45, 1.1, 0.9, { boss: true, aoe: 0.6, regen: 0.03 }),
    esfinge: SP('esfinge', 'Esfinge de Âmbar', '', 'f', null, 'sphinx', '#d8a84a', 3.4, 1.5, 1.3, 1.0, { boss: true, aoe: 0.65 }),
    wyrm: SP('wyrm', 'Wyrm Glacial', '', 'm', null, 'dragon', '#6ab8e0', 4.0, 1.55, 1.4, 0.9, { boss: true, aoe: 0.7 }),
    tita: SP('tita', 'Titã de Magma', '', 'm', null, 'golem', '#4a2a2a', 4.4, 1.6, 1.6, 0.7, { boss: true, lava: true, crown: true, aoe: 0.7 }),
  };
  const SPECIES_MAP = Object.fromEntries(SPECIES.map((x) => [x.id, x]));
  const REGIONS = [
    { name: 'Floresta Sussurrante', pool: ['slime', 'goblin', 'lobo', 'morcego', 'javali', 'cogumelo'], boss: 'reiGoblin' },
    { name: 'Cripta Esquecida', pool: ['esqueleto', 'fantasma', 'aranha', 'ratazana', 'zumbi', 'gargula'], boss: 'lich' },
    { name: 'Montanhas de Ferro', pool: ['orc', 'troll', 'golem', 'harpia', 'urso', 'kobold'], boss: 'ogro' },
    { name: 'Templo Sombrio', pool: ['cultista', 'diabrete', 'olho', 'cavaleiro', 'serpente', 'mimico'], boss: 'dragao' },
    { name: 'Pântano das Brumas', pool: ['sapo', 'sanguessuga', 'bruxa', 'fogofatuo', 'crocodilo', 'mosquito', 'arvore'], boss: 'hidra' },
    { name: 'Deserto de Âmbar', pool: ['escorpiao', 'mumia', 'verme', 'abutre', 'elemAreia', 'saqueador'], boss: 'esfinge' },
    { name: 'Geleira Eterna', pool: ['yeti', 'elemGelo', 'pinguim', 'morsa', 'espirito', 'mamute', 'loboGelo'], boss: 'wyrm' },
    { name: 'Coração do Vulcão', pool: ['salamandra', 'elemFogo', 'golemMagma', 'fenix', 'caoInfernal', 'demonio'], boss: 'tita' },
  ];
  // Evolução: cada nível muda título e cor (e deixa o inimigo mais forte quando aparece como elite)
  const TIERS = [
    { m: '', f: '', mp: '', fp: '', tint: null, glow: null },
    { m: 'Feroz', f: 'Feroz', mp: 'Ferozes', fp: 'Ferozes', tint: '#3a1a10', amt: 0.22, glow: null },
    { m: 'Sombrio', f: 'Sombria', mp: 'Sombrios', fp: 'Sombrias', tint: '#4a2a7a', amt: 0.4, glow: '#9a6cf0' },
    { m: 'Ancestral', f: 'Ancestral', mp: 'Ancestrais', fp: 'Ancestrais', tint: '#d8b04a', amt: 0.35, glow: '#ffd98a' },
    { m: 'Corrompido', f: 'Corrompida', mp: 'Corrompidos', fp: 'Corrompidas', tint: '#8a1a2a', amt: 0.45, glow: '#ff4a5a' },
    { m: 'Abissal', f: 'Abissal', mp: 'Abissais', fp: 'Abissais', tint: '#120a2a', amt: 0.55, glow: '#7a5aff' },
  ];

  /* ===== Aniversário ===== */
  // presente do dia do aniversário: bênção (XP e força na batalha da noite) + moedas de festa (só para itens visuais)
  const BDAY = { coins: 300, xpPct: 0.5, mod: { atkPct: 0.15, hpPct: 0.15, defPct: 0.1 }, hat: 'hat_party' };
  G.DATA = { WEAPON_SKINS, POTIONS, potionPrice, BDAY, EVENTS, RELIC_PART, RELIC_MODS, RARITY, MAX_RELICS, RELIC_SLOTS, WEEKDAYS, PUNCTUAL_BONUS, DUO_SHARE, STREAK_STEP, STREAK_MAX, KUDOS_XP, KUDOS_PER_DAY, ACH, PET_BONUS, ANCESTRIES, LEVELS, DIFF, CARRY_BONUS, MAX_HEROES, xpToNext, TIER_LVL, CLASSES, GEAR_TIERS, GEAR_SLOTS, ARMOR_NAME, COSMETICS, COSMETIC_SLOTS, LOOK, SPECIES, SPECIES_MAP, BOSSES, REGIONS, TIERS };
})(typeof window !== 'undefined' ? window : globalThis);
