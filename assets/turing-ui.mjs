/* The figures for the playable edition of Turing (1952). The chemistry lives in turing-engine.mjs. */
import { Dish, Ring, criticalRatio, fastest, ringPrediction, ringRate, diffusion } from './turing-engine.mjs';

const $ = s => document.querySelector(s);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const svgEl = (tag, attrs = {}, text) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ACT = css('--act'), INH = css('--inh'), INK = css('--ink'), INK2 = css('--ink-2'), RULE = css('--rule'), PAPER = css('--paper');
const CRIT = +criticalRatio().toFixed(2);
const onResize = (node, fn) => { if ('ResizeObserver' in window) new ResizeObserver(fn).observe(node); else addEventListener('resize', fn); };
const watch = (node, fn) => { if ('IntersectionObserver' in window) new IntersectionObserver(es => fn(es[0].isIntersecting), { rootMargin: '120px' }).observe(node); else fn(true); };
const buttons = (box, items, current, pick) => {
  const all = items.map(([id, label]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', () => pick(id)); box.append(b); return [id, b]; });
  const mark = id => all.forEach(([k, b]) => b.setAttribute('aria-pressed', String(k === id)));
  mark(current); return mark;
};

/* ---------- Figure 1: the dish ---------- */
const dishFig = (() => {
  const N = 128, ZOOM = 64 / 62, p = { Du: 1.5, ratio: 6.5, q: 1.1, equal: false, noReaction: false };
  const dish = new Dish(N, p, (Date.now() % 100000) + 1);
  const cv = $('#dish'), ctx = cv.getContext('2d'), sl = $('#slice'), sctx = sl.getContext('2d');
  const off = document.createElement('canvas'); off.width = off.height = N; const octx = off.getContext('2d'), img = octx.createImageData(N, N);
  const A = hex(ACT), B = hex(INH), P = hex(PAPER);
  let view = 'both', running = !reduced, visible = true, steps = 12, dirty = true;

  function paint() {
    const { u, v, inside } = dish, d = img.data, showA = view !== 'inh', showB = view !== 'act';
    for (let i = 0, j = 0; i < N * N; i++, j += 4) {
      if (!inside[i]) { d[j + 3] = 0; continue; }
      const da = showA ? clamp(0.5 + u[i] * 0.8, 0, 1) : 0, db = showB ? clamp(0.5 + v[i] * 0.62, 0, 1) * (showA ? 0.85 : 1) : 0;
      // two inks printed one over the other: each lets through less light where it is denser
      d[j] = 255 * P[0] * (1 - da * (1 - A[0])) * (1 - db * (1 - B[0]));
      d[j + 1] = 255 * P[1] * (1 - da * (1 - A[1])) * (1 - db * (1 - B[1]));
      d[j + 2] = 255 * P[2] * (1 - da * (1 - A[2])) * (1 - db * (1 - B[2]));
      d[j + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const W = cv.width, pad = W * (ZOOM - 1) / 2; ctx.drawImage(off, -pad, -pad, W + 2 * pad, W + 2 * pad);   // slightly enlarged so the round frame hides the grid's stepped edge
    slice();
  }
  function slice() {
    const r = Math.min(2, devicePixelRatio || 1), W = sl.clientWidth, Ht = sl.clientHeight;
    if (sl.width !== Math.round(W * r)) { sl.width = Math.round(W * r); sl.height = Math.round(Ht * r); }
    sctx.setTransform(r, 0, 0, r, 0, 0); sctx.clearRect(0, 0, W, Ht);
    const row = (N >> 1) * N, x = i => (((i + .5) / N - 0.5) * ZOOM + 0.5) * W, y = val => Ht / 2 - clamp(val, -1.4, 1.4) / 1.4 * (Ht / 2 - 6);
    sctx.strokeStyle = RULE; sctx.lineWidth = 1; sctx.beginPath(); sctx.moveTo(0, Ht / 2); sctx.lineTo(W, Ht / 2); sctx.stroke();
    for (const [f, color, w] of [[dish.v, INH, 2], [dish.u, ACT, 2.5]]) {
      sctx.strokeStyle = color; sctx.lineWidth = w; sctx.lineJoin = 'round'; sctx.beginPath(); let pen = false;
      for (let i = 0; i < N; i++) { if (!dish.inside[row + i]) continue; pen ? sctx.lineTo(x(i), y(f[row + i])) : sctx.moveTo(x(i), y(f[row + i])); pen = true; }
      sctx.stroke();
    }
  }
  function verdict() {
    const { Du, Dv } = diffusion(p), el = $('#dish-verdict');
    if (p.noReaction) el.innerHTML = '<b>Reaction stopped.</b> Nothing is being made, so spreading does what it does to ink in water.';
    else if (p.equal) el.innerHTML = '<b>Same speed.</b> Every ripple shrinks, whatever its size, and the dish goes flat.';
    else if (p.ratio <= CRIT) el.innerHTML = `<b>Below the threshold of ${CRIT}×.</b> Every ripple shrinks and the dish goes flat.`;
    else el.innerHTML = `<b>Above the threshold of ${CRIT}×.</b> Ripples about ${Math.round(fastest(Du, Dv).wavelength)} cells apart grow fastest.`;
    $('#ratio-out').textContent = p.ratio + '×';
    $('#bias-out').textContent = p.q > 0.3 ? 'toward spots' : p.q < -0.3 ? 'toward a net' : 'none: stripes';
    $('#scale-out').textContent = p.Du.toFixed(1);
  }
  const sync = () => { $('#ratio').value = p.ratio; $('#bias').value = p.q; $('#scale').value = p.Du; verdict(); dirty = true; };

  const markView = buttons($('#views'), [['both', 'Both inks'], ['act', 'Activator'], ['inh', 'Inhibitor']], view, id => { view = id; markView(id); dirty = true; });
  const PRESETS = { spots: { ratio: 6.5, q: 1.1 }, stripes: { ratio: 9, q: 0 }, net: { ratio: 6.5, q: -1.1 } };
  const markPreset = buttons($('#presets'), [['spots', 'Spots'], ['stripes', 'Stripes'], ['net', 'Net']], 'spots', id => {
    Object.assign(p, PRESETS[id], { equal: false, noReaction: false }); toggles(); markPreset(id); dish.stir(); sync();
  });
  for (const [id, key] of [['ratio', 'ratio'], ['bias', 'q'], ['scale', 'Du']]) $('#' + id).addEventListener('input', e => { p[key] = +e.target.value; markPreset(null); verdict(); dirty = true; });
  const toggles = () => { $('#equal').setAttribute('aria-pressed', String(p.equal)); $('#noreact').setAttribute('aria-pressed', String(p.noReaction)); };
  $('#equal').addEventListener('click', () => { p.equal = !p.equal; toggles(); verdict(); });
  $('#noreact').addEventListener('click', () => { p.noReaction = !p.noReaction; toggles(); verdict(); });
  $('#stir').addEventListener('click', () => { dish.stir(); dirty = true; });
  $('#wipe').addEventListener('click', () => { dish.wipe(); dirty = true; });
  const pauseBtn = $('#pause'), setRun = on => { running = on; pauseBtn.textContent = on ? 'Pause' : 'Run'; pauseBtn.setAttribute('aria-pressed', String(!on)); };
  pauseBtn.addEventListener('click', () => setRun(!running));

  // Touch the dish: add activator under the pointer.
  let down = false;
  const grid = f => ((f - 0.5) / ZOOM + 0.5) * N;
  const at = e => { const b = cv.getBoundingClientRect(); dish.poke(grid((e.clientX - b.left) / b.width), grid((e.clientY - b.top) / b.height), 3, 0.45); dirty = true; };
  cv.addEventListener('pointerdown', e => { down = true; at(e); });
  cv.addEventListener('pointermove', e => { if (down) at(e); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, () => { down = false; });
  cv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dish.poke(N / 2, N / 2, 3, 0.6); dirty = true; } });

  function size() { const r = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * r); if (w && cv.width !== w) { cv.width = cv.height = w; dirty = true; } }
  onResize(cv, size); watch(cv, v => { visible = v; });
  function frame() {
    if (running && visible && !document.hidden) {
      const t0 = performance.now(); dish.step(steps);
      steps = clamp(Math.round(steps * 7 / Math.max(0.5, performance.now() - t0)), 4, 48); dirty = true;
    }
    if (dirty && visible) { paint(); dirty = false; }
  }
  // Open with the pattern already emerging; with reduced motion, open on a settled pattern and stay paused.
  dish.step(reduced ? 6000 : 700); setRun(!reduced); size(); sync();
  return { frame };
})();

/* ---------- Figure 2: the ring ---------- */
const ringFig = (() => {
  const p = { Du: 0.5, ratio: 6, q: 0 }, svg = $('#ring'), box = $('#rates'), HORIZON = 1500;
  let n = 40, ring, visible = true, settled = false;
  function restart() { ring = new Ring(n, p, (Date.now() % 100000) + n); ring.stir(1e-3); settled = false; chart(); verdict(); draw(); }
  function closed(pts) {                                   // smooth closed curve through the cell positions
    const m = pts.length, mid = i => [(pts[i][0] + pts[(i + 1) % m][0]) / 2, (pts[i][1] + pts[(i + 1) % m][1]) / 2];
    let d = `M${mid(m - 1).map(v => v.toFixed(1))}`;
    for (let i = 0; i < m; i++) d += ` Q${pts[i].map(v => v.toFixed(1))} ${mid(i).map(v => v.toFixed(1))}`;
    return d + 'Z';
  }
  function draw() {
    const R0 = 40 + n * 0.85, c = 160, pt = (i, r) => { const a = i / n * 2 * Math.PI - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    const outline = (f, gain) => closed(Array.from({ length: n }, (_, i) => pt(i, Math.max(8, R0 + gain * Math.tanh(f[i] * 2.2)))));
    svg.replaceChildren(
      svgEl('circle', { cx: c, cy: c, r: R0, fill: 'none', stroke: RULE, 'stroke-width': 1, 'stroke-dasharray': '3 4' }),
      svgEl('path', { d: outline(ring.v, 20), fill: 'none', stroke: INH, 'stroke-width': 2 }),
      svgEl('path', { d: outline(ring.u, 34), fill: ACT, 'fill-opacity': .1, stroke: ACT, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
      ...Array.from({ length: n }, (_, i) => { const [x, y] = pt(i, R0); return svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.4, fill: INK2 }); }),
      svgEl('text', { x: c, y: c + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-family': css('--serif'), fill: INK }, String(ring.lobes() || '')));
  }
  function chart() {
    const { Du, Dv } = diffusion(p), M = Math.min(Math.floor(n / 2), 16), W = box.clientWidth || 300, Ht = 150, m = { l: 6, r: 6, t: 14, b: 20 };
    const rates = Array.from({ length: M }, (_, i) => ringRate(i + 1, n, Du, Dv)), top = Math.max(0.05, ...rates), lo = -top * 0.9, best = ringPrediction(n, Du, Dv).lobes;
    const y = v => m.t + (top - clamp(v, lo, top)) / (top - lo) * (Ht - m.t - m.b), bw = (W - m.l - m.r) / M;
    const s = svgEl('svg', { viewBox: `0 0 ${W} ${Ht}`, height: Ht, role: 'img', 'aria-label': best ? `The calculation predicts ${best} lobes` : 'No lobe count grows' });
    rates.forEach((r, i) => {
      const x = m.l + i * bw + bw * .18, w = bw * .64, up = r > 0;
      s.append(svgEl('rect', { x, y: up ? y(r) : y(0), width: w, height: Math.max(1, Math.abs(y(r) - y(0))), fill: up ? ACT : 'none', 'fill-opacity': i + 1 === best ? 1 : .45, stroke: up ? 'none' : INK2, 'stroke-width': 1 }));
      if (M <= 12 || (i + 1) % 2 === 0 || i + 1 === best) s.append(svgEl('text', { x: x + w / 2, y: Ht - 5, 'text-anchor': 'middle', ...(i + 1 === best ? { fill: INK, 'font-weight': 600 } : {}) }, i + 1));
    });
    s.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: INK, 'stroke-width': 1 }));
    box.replaceChildren(s);
  }
  function verdict() {
    const { Du, Dv } = diffusion(p), pred = ringPrediction(n, Du, Dv).lobes, got = ring.lobes(), el = $('#ring-verdict');
    $('#ring-n-out').textContent = n; $('#ring-ratio-out').textContent = p.ratio + '×';
    if (!pred) el.innerHTML = '<b>No lobe count grows</b> at this ratio. The ring stays round.';
    else if (!settled) el.innerHTML = `The calculation says <b>${pred} lobes</b>. The ring is still settling.`;
    else if (got === pred) el.innerHTML = `The calculation says <b>${pred} lobes</b>. The ring settled on <b>${got}</b>.`;
    else el.innerHTML = `The calculation says <b>${pred} lobes</b>. The ring settled on <b>${got}</b>, its close rival.`;
  }
  $('#ring-n').addEventListener('input', e => { n = +e.target.value; restart(); });
  $('#ring-ratio').addEventListener('input', e => { p.ratio = +e.target.value; restart(); });
  $('#ring-stir').addEventListener('click', restart);
  $('#ring-n').value = n; $('#ring-ratio').value = p.ratio;
  onResize(box, chart); watch(svg, v => { visible = v; });
  restart();
  if (reduced) { ring.step(HORIZON * 20); settled = true; draw(); verdict(); }
  function frame() {
    if (settled || !visible || document.hidden) return;
    ring.step(400); if (ring.t >= HORIZON) settled = true;
    draw(); verdict();
  }
  return { frame };
})();

(function loop() { dishFig.frame(); ringFig.frame(); requestAnimationFrame(loop); })();
