// Rubik's Cube, Opus 5.5 edition: 3D view and controls.
// The engine (cube-engine.mjs) owns the state and the solver. This file draws
// 26 real cubies and turns them in layers, so what you see is what the engine holds.
import * as THREE from 'three';
import {
  NORMAL, SLOTS, facelets, solvedState, apply, isSolved, invertMove, randomScramble, solve, STAGE_LABELS,
} from './cube-engine.mjs';

const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const STICKER = {
  U: 0xf4f4ef, D: 0xffd23a, F: 0x1fa65a, B: 0x2a62d9, R: 0xd8312b, L: 0xff8a1f,
};
const FACE_OF_NORMAL = Object.fromEntries(Object.entries(NORMAL).map(([f, n]) => [n.join(','), f]));

// ---------- scene ----------
const host = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.setAttribute('aria-hidden', 'true');
host.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1a1c24, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(4, 7, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xb9c4ff, 0.8);
rim.position.set(-6, -2, -5);
scene.add(rim);

const root = new THREE.Group();
scene.add(root);
const pivot = new THREE.Group();
root.add(pivot);

function roundedRect(w, r) {
  const s = new THREE.Shape(), h = w / 2;
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return new THREE.ShapeGeometry(s, 6);
}

const bodyGeo = new THREE.BoxGeometry(0.97, 0.97, 0.97);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.55, metalness: 0.05 });
const stickerGeo = roundedRect(0.84, 0.12);
const stickerMats = Object.fromEntries(Object.entries(STICKER).map(([f, c]) => [f, new THREE.MeshStandardMaterial({
  color: c, roughness: 0.32, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1,
})]));

let cubies = [];
function build() {
  for (const c of cubies) root.remove(c);
  cubies = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    for (const [f, n] of Object.entries(NORMAL)) {
      if (n[0] * x + n[1] * y + n[2] * z !== 1) continue;
      const m = new THREE.Mesh(stickerGeo, stickerMats[f]);
      m.position.set(n[0] * 0.486, n[1] * 0.486, n[2] * 0.486);
      m.lookAt(n[0] * 2, n[1] * 2, n[2] * 2);
      m.userData.sticker = true;
      g.add(m);
    }
    root.add(g);
    cubies.push(g);
  }
}

// ---------- camera orbit ----------
const view = { theta: 0.62, phi: 0.98, dist: 11.2 };
const HOME = { ...view };
function placeCamera() {
  const { theta, phi, dist } = view;
  camera.position.set(dist * Math.sin(phi) * Math.sin(theta), dist * Math.cos(phi), dist * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(0, 0, 0);
}
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.setViewOffset(w, h, 0, h > w ? -h * 0.03 : 0, w, h);
  camera.fov = w < h ? 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(16)) / camera.aspect)) : 32;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);

// ---------- state + animation queue ----------
let state = solvedState();
let history = [];        // moves since the last reset, for Undo
let queue = [];          // {move, ms, onStart}
let anim = null;
let solving = null;      // {steps, flat:[{move, stage}], index}
let finished = false;    // keep the stage checklist ticked after a solve

const speedInput = $('#speed');
const turnMs = () => (reduceMotion.matches ? 0 : Number(speedInput.value));

function enqueue(move, { ms = turnMs(), record = true, onStart } = {}) {
  queue.push({ move, ms, record, onStart });
  syncUI();
}

function startNext() {
  const job = queue.shift();
  if (!job) return;
  const n = new THREE.Vector3(...NORMAL[job.move[0]]);
  const q = job.move.endsWith('2') ? 2 : job.move.endsWith("'") ? 1 : -1;
  pivot.rotation.set(0, 0, 0);
  pivot.updateMatrixWorld();
  for (const c of cubies) if (Math.round(c.position.dot(n)) === 1) pivot.attach(c);
  anim = { job, n, angle: (q * Math.PI) / 2, t0: performance.now() };
  if (job.onStart) job.onStart();
  if (!job.ms) finishTurn();
}

function finishTurn() {
  const { job, n, angle } = anim;
  pivot.setRotationFromAxisAngle(n, angle);
  pivot.updateMatrixWorld();
  for (const c of [...pivot.children]) {
    root.attach(c);
    c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
    const e = new THREE.Euler().setFromQuaternion(c.quaternion);
    const snap = v => Math.round(v / (Math.PI / 2)) * (Math.PI / 2);
    c.rotation.set(snap(e.x), snap(e.y), snap(e.z));
  }
  pivot.rotation.set(0, 0, 0);
  state = apply(state, [job.move]);
  if (job.record) history.push(job.move);
  anim = null;
  syncUI();
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function frame(now) {
  if (!anim && queue.length) startNext();
  if (anim) {
    const t = Math.min(1, (now - anim.t0) / anim.job.ms);
    pivot.setRotationFromAxisAngle(anim.n, anim.angle * easeInOut(t));
    if (t >= 1) finishTurn();
  }
  placeCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- UI ----------
const els = {
  moves: $('#moveCount'), status: $('#status'), stages: $('#stages'), ledger: $('#ledger'),
  scramble: $('#scramble'), solve: $('#solve'), undo: $('#undo'), reset: $('#reset'), home: $('#home'),
  pad: $('#pad'), note: $('#note'),
};

STAGE_LABELS.forEach(label => {
  const li = document.createElement('li');
  li.textContent = label;
  li.dataset.stage = label;
  els.stages.append(li);
});

for (const f of ['U', 'D', 'L', 'R', 'F', 'B']) for (const s of ['', "'", '2']) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = f + s;
  b.addEventListener('click', () => userMove(f + s));
  els.pad.append(b);
}

const busy = () => !!anim || queue.length > 0;

function syncUI() {
  const solved = isSolved(state) && !busy();
  els.moves.textContent = solving ? `${solving.index} / ${solving.flat.length}` : history.length;
  els.status.textContent = solving ? 'Solving' : busy() ? 'Turning' : isSolved(state) ? 'Solved' : 'Mixed';
  els.status.dataset.state = solving ? 'solving' : solved ? 'solved' : 'mixed';
  const locked = !!solving;
  els.scramble.disabled = locked;
  els.solve.disabled = locked || isSolved(state);
  els.undo.disabled = locked || !history.length;
  els.reset.disabled = locked;
  els.pad.querySelectorAll('button').forEach(b => { b.disabled = locked; });
  if (!solving && !finished) {
    els.stages.querySelectorAll('li').forEach(li => { li.className = ''; });
  }
}

function userMove(m) {
  if (solving) return;
  clearLedger();
  enqueue(m);
}

function clearLedger() {
  finished = false;
  if (els.ledger.dataset.kind === 'solution') {
    els.ledger.replaceChildren();
    els.ledger.dataset.kind = '';
    els.note.textContent = 'Turn it yourself, scramble it, then ask it to solve. It works from any position.';
  }
}

els.scramble.addEventListener('click', () => {
  if (solving) return;
  clearLedger();
  const seq = randomScramble(25);
  const ms = reduceMotion.matches ? 0 : Math.min(110, turnMs());
  seq.forEach(m => enqueue(m, { ms }));
  els.note.textContent = `Scrambled with ${seq.join(' ')}`;
});

els.undo.addEventListener('click', () => {
  if (solving || busy() || !history.length) return;
  const m = history.pop();
  enqueue(invertMove(m), { record: false });
});

els.reset.addEventListener('click', () => {
  if (solving) return;
  queue = [];
  if (anim) finishTurn();
  build();
  state = solvedState();
  history = [];
  clearLedger();
  syncUI();
});

els.home.addEventListener('click', () => Object.assign(view, HOME));

els.solve.addEventListener('click', () => {
  if (solving || isSolved(state)) return;
  // Let any turns in flight land first, then plan from the true state.
  const plan = () => {
    if (busy()) { requestAnimationFrame(plan); return; }
    const steps = solve(state);
    renderSolution(steps);
    const flat = steps.flatMap(s => s.moves.map((move, i) => ({ move, stage: s.stage, i })));
    solving = { steps, flat, index: 0 };
    els.note.textContent = `Found a ${flat.length}-move solution in ${steps.length} stages, layer by layer.`;
    syncUI();
    flat.forEach((step, k) => enqueue(step.move, {
      record: true,
      onStart: () => highlight(k, step.stage),
    }));
    const done = () => {
      if (busy()) { requestAnimationFrame(done); return; }
      els.stages.querySelectorAll('li').forEach(li => { li.className = 'done'; });
      els.ledger.querySelectorAll('.mv').forEach(x => x.classList.remove('now'));
      const n = solving.flat.length;
      solving = null;
      finished = true;
      history = [];
      syncUI();
      els.note.textContent = `Solved in ${n} moves. Scramble it again, or mix it up by hand.`;
    };
    requestAnimationFrame(done);
  };
  plan();
});

function renderSolution(steps) {
  els.ledger.replaceChildren();
  els.ledger.dataset.kind = 'solution';
  let k = 0;
  for (const s of steps) {
    const row = document.createElement('div');
    row.className = 'row';
    const h = document.createElement('p');
    h.className = 'row-stage';
    h.textContent = `${s.stage} · ${s.moves.length}`;
    const moves = document.createElement('p');
    moves.className = 'row-moves';
    for (const m of s.moves) {
      const span = document.createElement('span');
      span.className = 'mv';
      span.dataset.k = k++;
      span.textContent = m;
      moves.append(span, ' ');
    }
    row.append(h, moves);
    els.ledger.append(row);
  }
}

function highlight(k, stage) {
  if (solving) solving.index = k + 1;
  const lis = [...els.stages.querySelectorAll('li')];
  const at = lis.findIndex(li => li.dataset.stage === stage);
  lis.forEach((li, i) => { li.className = i < at ? 'done' : i === at ? 'now' : ''; });
  els.ledger.querySelectorAll('.mv.now').forEach(x => x.classList.remove('now'));
  const cur = els.ledger.querySelector(`.mv[data-k="${k}"]`);
  if (cur) {
    cur.classList.add('now');
    const box = els.ledger, r = cur.offsetTop - box.offsetTop;
    if (r < box.scrollTop || r > box.scrollTop + box.clientHeight - 30) box.scrollTop = r - 40;
  }
}

// ---------- pointer: drag a sticker to turn, drag space to orbit ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;

function hit(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(cubies, true);
  if (!hits.length) return null;
  const h = hits[0];
  const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
  const axisN = [Math.round(n.x), Math.round(n.y), Math.round(n.z)];
  if (Math.abs(axisN[0]) + Math.abs(axisN[1]) + Math.abs(axisN[2]) !== 1) return null;
  return { point: h.point.clone(), normal: new THREE.Vector3(...axisN) };
}

function toScreen(v) {
  const p = v.clone().project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2((p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height);
}

host.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('button')) return;
  const h = hit(e);
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, hit: h, done: false };
  host.setPointerCapture(e.pointerId);
  host.classList.add(h ? 'grab-face' : 'grab-space');
});

host.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.hit) {
    view.theta -= dx * 0.008;
    view.phi = THREE.MathUtils.clamp(view.phi - dy * 0.008, 0.25, Math.PI - 0.25);
    drag.x = e.clientX; drag.y = e.clientY;
    return;
  }
  if (drag.done || Math.hypot(dx, dy) < 14) return;
  drag.done = true;
  if (solving) return;
  const { point, normal } = drag.hit;
  const dragV = new THREE.Vector2(dx, dy).normalize();
  const p0 = toScreen(point);
  let best = null;
  for (const a of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]) {
    if (Math.abs(a.dot(normal)) > 0.5) continue;
    const motion = new THREE.Vector3().crossVectors(a, point); // direction of a +90° turn about a
    const s = toScreen(point.clone().addScaledVector(motion, 0.25)).sub(p0);
    if (s.length() < 1e-3) continue;
    const c = s.normalize().dot(dragV);
    if (!best || Math.abs(c) > Math.abs(best.c)) best = { a, c };
  }
  if (!best) return;
  const L = Math.max(-1, Math.min(1, Math.round(point.dot(best.a))));
  if (L === 0) { els.note.textContent = 'The middle layer stays put here. Turn an outer layer instead.'; return; }
  const faceN = best.a.clone().multiplyScalar(L);
  const face = FACE_OF_NORMAL[[faceN.x, faceN.y, faceN.z].map(Math.round).join(',')];
  const qAboutAxis = Math.sign(best.c);          // +1 = counter-clockwise about +axis
  const qAboutFace = qAboutAxis * L;             // relative to the face's outward normal
  userMove(face + (qAboutFace > 0 ? "'" : ''));
});

const endDrag = e => {
  if (!drag || drag.id !== e.pointerId) return;
  drag = null;
  host.classList.remove('grab-face', 'grab-space');
};
host.addEventListener('pointerup', endDrag);
host.addEventListener('pointercancel', endDrag);
host.addEventListener('wheel', e => {
  e.preventDefault();
  view.dist = THREE.MathUtils.clamp(view.dist + e.deltaY * 0.004, 6.5, 16);
}, { passive: false });

// ---------- keyboard ----------
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toUpperCase();
  if ('UDLRFB'.includes(k) && k.length === 1) { e.preventDefault(); userMove(k + (e.shiftKey ? "'" : '')); }
  else if (e.key === 'Backspace') { e.preventDefault(); els.undo.click(); }
});

// Test hook: read every sticker's color off the 3D model and compare with the engine.
function renderedMatchesEngine() {
  const want = facelets(state);
  const colorFace = new Map(Object.entries(stickerMats).map(([f, m]) => [m, f]));
  const got = {};
  root.updateMatrixWorld(true);
  const q = new THREE.Quaternion(), wp = new THREE.Vector3();
  for (const c of cubies) for (const m of c.children) {
    if (!m.userData.sticker) continue;
    m.getWorldQuaternion(q);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    c.getWorldPosition(wp);
    const key = [wp.x, wp.y, wp.z].map(Math.round).join(',') + '|' + [n.x, n.y, n.z].map(Math.round).join(',');
    got[key] = colorFace.get(m.material);
  }
  return SLOTS.every(s => got[s.p.join(',') + '|' + s.n.join(',')] === want[s.id]);
}
window.__cube = {
  renderedMatchesEngine,
  state: () => state, isSolved: () => isSolved(state), busy, solving: () => !!solving,
  move: m => userMove(m), last: () => history[history.length - 1],
  screenOf: (x, y, z) => { const v = toScreen(new THREE.Vector3(x, y, z)); const r = renderer.domElement.getBoundingClientRect(); return [v.x + r.left, v.y + r.top]; }, scramble: () => els.scramble.click(), solve: () => els.solve.click(),
};

build();
resize();
syncUI();
requestAnimationFrame(frame);
