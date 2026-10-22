// Rubik's Cube engine for the Opus 5.5 edition.
//
// The cube is 54 stickers. Each sticker has a home slot: a cubie position
// (x, y, z in -1..1) plus the outward normal of the face it sits on.
// A move is the rotation of one layer by 90° about that face's normal, and
// every permutation here is *derived from that geometry*, so the renderer
// (which rotates real 3D cubies the same way) and this model cannot disagree.
//
// State: pos[id] = the slot where sticker `id` currently sits. Solved means
// pos[id] === id for every sticker.

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const NORMAL = {
  U: [0, 1, 0], D: [0, -1, 0],
  R: [1, 0, 0], L: [-1, 0, 0],
  F: [0, 0, 1], B: [0, 0, -1],
};
export const COLOR_NAME = { U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Rotate integer vector v about unit axis k by quarter turns q (+1 = 90° CCW about k).
export function rotQ(v, k, q) {
  q = ((q % 4) + 4) % 4;
  let out = v;
  for (let i = 0; i < q; i++) {
    const kx = cross(k, out), kd = dot(k, out);
    out = [kx[0] + k[0] * kd, kx[1] + k[1] * kd, kx[2] + k[2] * kd];
  }
  return out;
}

// ---------- slots ----------
export const SLOTS = [];
const slotKey = (p, n) => `${p.join(',')}|${n.join(',')}`;
const SLOT_INDEX = new Map();
for (const f of FACES) {
  const n = NORMAL[f];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const p = n.map(c => (c !== 0 ? c : null));
    let k = 0;
    for (let i = 0; i < 3; i++) if (p[i] === null) p[i] = k++ === 0 ? a : b;
    const id = SLOTS.length;
    SLOTS.push({ id, p, n, face: f });
    SLOT_INDEX.set(slotKey(p, n), id);
  }
}
export const N = SLOTS.length; // 54

// Stickers grouped by cubie: the pieces.
const byCubie = new Map();
for (const s of SLOTS) {
  const k = s.p.join(',');
  if (!byCubie.has(k)) byCubie.set(k, []);
  byCubie.get(k).push(s.id);
}
export const PIECES = [...byCubie.entries()].map(([k, ids]) => ({
  name: ids.map(i => SLOTS[i].face).join(''),
  p: k.split(',').map(Number),
  ids,
}));
export const pieceAt = (...faces) => {
  const want = [0, 0, 0];
  for (const f of faces) for (let i = 0; i < 3; i++) want[i] += NORMAL[f][i];
  return PIECES.find(pc => pc.p.every((v, i) => v === want[i]));
};

// ---------- moves ----------
// Quarter turns about the face normal: clockwise seen from outside = -1.
const BASE = {};
for (const f of FACES) {
  const n = NORMAL[f];
  for (const [suffix, q] of [['', -1], ["'", 1], ['2', 2]]) {
    const perm = new Uint8Array(N);
    for (const s of SLOTS) {
      if (dot(s.p, n) === 1) {
        perm[s.id] = SLOT_INDEX.get(slotKey(rotQ(s.p, n, q), rotQ(s.n, n, q)));
      } else perm[s.id] = s.id;
    }
    BASE[f + suffix] = perm;
  }
}
export const MOVE_NAMES = Object.keys(BASE);
export const moveInfo = m => ({ face: m[0], normal: NORMAL[m[0]], quarter: m.endsWith('2') ? 2 : m.endsWith("'") ? 1 : -1 });

export const parse = str => str.trim().split(/\s+/).filter(Boolean);
export const invertMove = m => (m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'");
export const invertSeq = seq => seq.slice().reverse().map(invertMove);

function compose(seq) {
  let perm = Uint8Array.from({ length: N }, (_, i) => i);
  for (const m of seq) {
    const b = BASE[m];
    if (!b) throw new Error(`Unknown move ${m}`);
    perm = perm.map(s => b[s]);
  }
  return perm;
}
const invertPerm = p => { const q = new Uint8Array(N); p.forEach((v, i) => { q[v] = i; }); return q; };

export const solvedState = () => Uint8Array.from({ length: N }, (_, i) => i);
const applyPerm = (pos, perm) => pos.map(s => perm[s]);
export function apply(pos, moves) {
  let out = pos;
  for (const m of (typeof moves === 'string' ? parse(moves) : moves)) out = applyPerm(out, BASE[m]);
  return out;
}
export const isSolved = pos => pos.every((v, i) => v === i);

// Color showing at each slot (by home face).
export function facelets(pos) {
  const at = new Array(N);
  pos.forEach((slot, id) => { at[slot] = SLOTS[id].face; });
  return at;
}

export function randomScramble(n = 25, rnd = Math.random) {
  const out = [];
  const axis = f => 'UDRLFB'.indexOf(f) >> 1;
  while (out.length < n) {
    const f = FACES[Math.floor(rnd() * 6)];
    const prev = out[out.length - 1], prev2 = out[out.length - 2];
    if (prev && prev[0] === f) continue;
    if (prev && prev2 && axis(prev[0]) === axis(f) && axis(prev2[0]) === axis(f)) continue;
    out.push(f + ['', "'", '2'][Math.floor(rnd() * 3)]);
  }
  return out;
}

// Merge adjacent turns of the same face: R R -> R2, R R' -> nothing.
export function simplify(seq) {
  const out = [];
  const q = m => (m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1);
  for (const m of seq) {
    const last = out[out.length - 1];
    if (last && last[0] === m[0]) {
      const t = (q(last) + q(m)) % 4;
      out.pop();
      if (t) out.push(m[0] + ['', '', '2', "'"][t]);
    } else out.push(m);
  }
  return out;
}

// ---------- solver ----------
// A layer-by-layer method, the way a person learns it, but each step is found
// by a small search instead of a lookup table: the solver tries short
// sequences of the step's allowed moves until the step's goal holds and
// nothing already solved is disturbed.

const macro = (name, seq) => ({ name, seq: parse(seq) });
const U_TURNS = ['U', "U'", 'U2'].map(m => macro(m, m));

// Frames: (front, right) going around the cube.
const FRAMES = [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']];
const leftOf = { F: 'L', R: 'F', B: 'R', L: 'B' };

const CORNER_TRIGGERS = FRAMES.flatMap(([f, r]) => [
  macro(`${r} U ${r}'`, `${r} U ${r}'`), macro(`${r} U' ${r}'`, `${r} U' ${r}'`), macro(`${r} U2 ${r}'`, `${r} U2 ${r}'`),
  macro(`${f}' U' ${f}`, `${f}' U' ${f}`), macro(`${f}' U ${f}`, `${f}' U ${f}`), macro(`${f}' U2 ${f}`, `${f}' U2 ${f}`),
]);
const EDGE_INSERTS = FRAMES.flatMap(([f, r]) => {
  const l = leftOf[f];
  return [
    macro(`right insert (${f})`, `U ${r} U' ${r}' U' ${f}' U ${f}`),
    macro(`left insert (${f})`, `U' ${l}' U ${l} U ${f} U' ${f}'`),
  ];
});
export const ALGS = {
  'F R U R\' U\' F\'': "F R U R' U' F'",
  'F U R U\' R\' F\'': "F U R U' R' F'",
  Sune: "R U R' U R U2 R'",
  Antisune: "R U2 R' U' R U' R'",
  Aa: "R' F R' B2 R F' R' B2 R2",
  Ab: "R2 B2 R F R' B2 R F' R",
  Ua: "R U' R U R U R U' R' U' R2",
  Ub: "R2 U R U R' U' R' U' R' U R'",
};
const A = k => macro(k, ALGS[k]);

const BASIC = MOVE_NAMES.map(m => macro(m, m));

const D_EDGES = ['F', 'R', 'B', 'L'].map(f => pieceAt('D', f));
const D_CORNERS = FRAMES.map(([f, r]) => pieceAt('D', f, r));
const MID_EDGES = FRAMES.map(([f, r]) => pieceAt(f, r));
const U_PIECES = PIECES.filter(pc => pc.p[1] === 1 && pc.ids.length > 1);
const U_EDGES = U_PIECES.filter(pc => pc.ids.length === 2);
const U_FACE_SLOTS = SLOTS.filter(s => s.face === 'U').map(s => s.id);
const U_EDGE_TOP_SLOTS = U_EDGES.map(pc => pc.ids.find(i => SLOTS[i].face === 'U'));

const solvedPiece = (pos, pc) => pc.ids.every(i => pos[i] === i);
const solvedAll = (pos, pcs) => pcs.every(pc => solvedPiece(pos, pc));
const topIsWhite = (pos, slots) => { const at = facelets(pos); return slots.every(s => at[s] === 'U'); };

// Per-piece distance tables (exact distance of one piece to home under a move
// set) give the search an admissible estimate, so it stays fast.
function pieceTable(pc, moves) {
  const [s0, s1] = pc.ids;
  const enc = (a, b) => a * N + b;
  const dist = new Int8Array(N * N).fill(-1);
  const inv = moves.map(mv => invertPerm(mv.perm));
  dist[enc(s0, s1)] = 0;
  let frontier = [[s0, s1]];
  for (let d = 0; frontier.length; d++) {
    const next = [];
    for (const [a, b] of frontier) for (const p of inv) {
      const k = enc(p[a], p[b]);
      if (dist[k] === -1) { dist[k] = d + 1; next.push([p[a], p[b]]); }
    }
    frontier = next;
  }
  return pos => dist[enc(pos[s0], pos[s1])];
}

function stage(label, moves, goal, track = []) {
  moves = moves.map(mv => ({ ...mv, perm: compose(mv.seq), isU: /^U/.test(mv.name) && mv.seq.length === 1 }));
  const tables = track.map(pc => pieceTable(pc, moves));
  const h = pos => { let m = 0; for (const t of tables) { const d = t(pos); if (d > m) m = d; } return m; };
  return { label, moves, goal, h };
}

const STAGES = [
  ...D_EDGES.map((pc, i) => stage('Bottom cross', BASIC, pos => solvedAll(pos, D_EDGES.slice(0, i + 1)), D_EDGES.slice(0, i + 1))),
  ...D_CORNERS.map((pc, i) => stage('Bottom corners', [...U_TURNS, ...CORNER_TRIGGERS],
    pos => solvedAll(pos, D_EDGES) && solvedAll(pos, D_CORNERS.slice(0, i + 1)), [...D_EDGES, ...D_CORNERS.slice(0, i + 1)])),
  ...MID_EDGES.map((pc, i) => stage('Middle layer', [...U_TURNS, ...EDGE_INSERTS],
    pos => solvedAll(pos, D_EDGES) && solvedAll(pos, D_CORNERS) && solvedAll(pos, MID_EDGES.slice(0, i + 1)),
    [...D_EDGES, ...D_CORNERS, ...MID_EDGES.slice(0, i + 1)])),
  stage('Top cross', [...U_TURNS, A('F R U R\' U\' F\''), A('F U R U\' R\' F\'')], pos => topIsWhite(pos, U_EDGE_TOP_SLOTS)),
  stage('Top face', [...U_TURNS, A('Sune'), A('Antisune')], pos => topIsWhite(pos, U_FACE_SLOTS)),
  stage('Top corners', [...U_TURNS, A('Aa'), A('Ab')], pos => topIsWhite(pos, U_FACE_SLOTS) && U_PIECES.filter(pc => pc.ids.length === 3).every(pc => solvedPiece(pos, pc))),
  stage('Top edges', [...U_TURNS, A('Ua'), A('Ub')], isSolved),
];

function searchStage(st, pos, maxDepth = 14) {
  const path = [];
  function dfs(p, depth, lastU) {
    const est = st.h(p);
    if (est > depth) return false;
    if (st.goal(p)) return true;
    if (depth === 0) return false;
    for (const mv of st.moves) {
      if (mv.isU && lastU) continue;
      path.push(mv);
      if (dfs(applyPerm(p, mv.perm), depth - 1, mv.isU)) return true;
      path.pop();
    }
    return false;
  }
  for (let d = 0; d <= maxDepth; d++) if (dfs(pos, d, false)) return path.slice();
  throw new Error(`No solution for stage "${st.label}" within ${maxDepth} steps`);
}

// Returns [{stage, moves}] with consecutive steps of the same stage merged.
export function solve(pos) {
  const steps = [];
  let p = pos;
  for (const st of STAGES) {
    const path = searchStage(st, p);
    const moves = path.flatMap(mv => mv.seq);
    p = apply(p, moves);
    const last = steps[steps.length - 1];
    if (last && last.stage === st.label) last.moves.push(...moves);
    else steps.push({ stage: st.label, moves });
  }
  for (const s of steps) s.moves = simplify(s.moves);
  if (!isSolved(p)) throw new Error('Solver finished without solving the cube');
  return steps.filter(s => s.moves.length);
}

export const STAGE_LABELS = [...new Set(STAGES.map(s => s.label))];
