/* Turing's reaction-diffusion mixture, with no DOM.
   Two chemicals, written as their distance from a resting level (as in the 1952 paper):

     du/dt = Du * lap(u) + a*u + b*v + q*u^2 - u^3      the activator
     dv/dt = Dv * lap(v) + c*u + d*v                    the inhibitor

   Drop the last two terms of the first line and this is the linear system the paper analyses.
   They are added here so the pattern stops growing instead of running off to infinity. */

export const KINETICS = Object.freeze({ a: 1, b: -1, c: 2, d: -1.5 });

export function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------- the paper's analysis: which ripple sizes grow? ---------- */

// Growth rate of a ripple with squared wavenumber k2 (the larger eigenvalue's real part).
export function growthRate(k2, Du, Dv, K = KINETICS) {
  const p = K.a - Du * k2, s = K.d - Dv * k2, tr = p + s, det = p * s - K.b * K.c, disc = tr * tr - 4 * det;
  return disc >= 0 ? (tr + Math.sqrt(disc)) / 2 : tr / 2;
}
// The inhibitor must spread at least this many times faster than the activator for any pattern to form.
export function criticalRatio(K = KINETICS) {
  const det = K.a * K.d - K.b * K.c, s = (Math.sqrt(det) + Math.sqrt(det - K.a * K.d)) / K.a;
  return s * s;
}
// The fastest-growing ripple in open space: { k, rate, wavelength }, rate <= 0 means nothing grows.
export function fastest(Du, Dv, K = KINETICS) {
  let best = { k: 0, rate: -Infinity };
  for (let i = 1; i <= 4000; i++) { const k = i * 0.001, r = growthRate(k * k, Du, Dv, K); if (r > best.rate) best = { k, rate: r }; }
  return { ...best, wavelength: 2 * Math.PI / best.k };
}
// On a ring of n cells only whole numbers of waves fit. Growth rate of the pattern with m lobes.
export const ringRate = (m, n, Du, Dv, K = KINETICS) => growthRate(2 - 2 * Math.cos(2 * Math.PI * m / n), Du, Dv, K);
export function ringPrediction(n, Du, Dv, K = KINETICS) {
  let best = { lobes: 0, rate: -Infinity };
  for (let m = 1; m <= Math.floor(n / 2); m++) { const r = ringRate(m, n, Du, Dv, K); if (r > best.rate) best = { lobes: m, rate: r }; }
  return best.rate > 0 ? best : { lobes: 0, rate: best.rate };
}

const react = (u, v, q, K) => [K.a * u + K.b * v + q * u * u - u * u * u, K.c * u + K.d * v];
export const diffusion = p => { const Du = p.Du ?? 0.5, Dv = p.equal ? Du : Du * (p.ratio ?? 20); return { Du, Dv }; };

/* ---------- a ring of cells, the case Turing worked by hand ---------- */
export class Ring {
  constructor(n, params = {}, seed = 1) { this.n = n; this.params = params; this.u = new Float32Array(n); this.v = new Float32Array(n); this.t = 0; this.rand = mulberry(seed); this.stir(); }
  stir(amount = 0.02) { for (let i = 0; i < this.n; i++) { this.u[i] = (this.rand() - 0.5) * amount; this.v[i] = (this.rand() - 0.5) * amount; } this.t = 0; }
  step(steps = 1) {
    const { n, params: p } = this, K = p.K ?? KINETICS, q = p.q ?? 0, { Du, Dv } = diffusion(p), dt = Math.min(0.05, 0.2 / Math.max(Du, Dv));
    let u = this.u, v = this.v, nu = new Float32Array(n), nv = new Float32Array(n);
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        const l = i ? i - 1 : n - 1, r = i + 1 < n ? i + 1 : 0, [f, g] = p.noReaction ? [0, 0] : react(u[i], v[i], q, K);
        nu[i] = u[i] + dt * (Du * (u[l] + u[r] - 2 * u[i]) + f); nv[i] = v[i] + dt * (Dv * (v[l] + v[r] - 2 * v[i]) + g);
      }
      [u, nu] = [nu, u]; [v, nv] = [nv, v]; this.t += dt;
    }
    this.u = u; this.v = v;
  }
  amplitude() { let m = 0; for (const x of this.u) m = Math.max(m, Math.abs(x)); return m; }
  // Count the lobes: places where the activator crosses its mean going upward.
  lobes() {
    const { u, n } = this; let mean = 0; for (const x of u) mean += x; mean /= n;
    if (this.amplitude() < 0.05) return 0;
    let c = 0; for (let i = 0; i < n; i++) if (u[i] - mean <= 0 && u[(i + 1) % n] - mean > 0) c++;
    return c;
  }
}

/* ---------- a round dish with a wall: nothing diffuses out ---------- */
export class Dish {
  constructor(size = 128, params = {}, seed = 1) {
    this.size = size; this.params = params; this.rand = mulberry(seed); this.t = 0;
    const N = size, R = N / 2 - 1, cx = (N - 1) / 2, inside = new Uint8Array(N * N), cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cx) ** 2 <= R * R) { inside[y * N + x] = 1; cells.push(y * N + x); }
    this.inside = inside; this.cells = Int32Array.from(cells);
    // Eight neighbours per cell. A neighbour outside the wall is replaced by the cell itself (no flow through the wall).
    const off = [-N, N, 1, -1, -N + 1, -N - 1, N + 1, N - 1]; this.nb = new Int32Array(cells.length * 8);
    cells.forEach((i, c) => off.forEach((o, j) => { const k = i + o; this.nb[c * 8 + j] = inside[k] ? k : i; }));
    this.u = new Float32Array(N * N); this.v = new Float32Array(N * N); this.nu = new Float32Array(N * N); this.nv = new Float32Array(N * N);
    this.stir();
  }
  wipe() { this.u.fill(0); this.v.fill(0); this.t = 0; }                       // perfectly even: a resting state
  stir(amount = 0.02) { this.wipe(); for (const i of this.cells) { this.u[i] = (this.rand() - 0.5) * amount; this.v[i] = (this.rand() - 0.5) * amount; } }
  // Add activator in a soft blob centred on grid position (x, y).
  poke(x, y, radius = 4, amount = 0.6) {
    const N = this.size, r = Math.ceil(radius * 2);
    for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(N - 1, Math.ceil(y + r)); yy++) for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(N - 1, Math.ceil(x + r)); xx++) {
      const i = yy * N + xx; if (this.inside[i]) this.u[i] += amount * Math.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (radius * radius));
    }
  }
  step(steps = 1) {
    const { cells, nb, params: p } = this, K = p.K ?? KINETICS, q = p.q ?? 0, { Du, Dv } = diffusion(p), dt = Math.min(0.05, 0.2 / Math.max(Du, Dv));
    const { a, b, c, d } = K, on = p.noReaction ? 0 : 1, n = cells.length;
    let u = this.u, v = this.v, nu = this.nu, nv = this.nv;
    for (let s = 0; s < steps; s++) {
      for (let k = 0, j = 0; k < n; k++, j += 8) {
        const i = cells[k], ui = u[i], vi = v[i];
        const lu = (4 * (u[nb[j]] + u[nb[j + 1]] + u[nb[j + 2]] + u[nb[j + 3]]) + u[nb[j + 4]] + u[nb[j + 5]] + u[nb[j + 6]] + u[nb[j + 7]] - 20 * ui) / 6;
        const lv = (4 * (v[nb[j]] + v[nb[j + 1]] + v[nb[j + 2]] + v[nb[j + 3]]) + v[nb[j + 4]] + v[nb[j + 5]] + v[nb[j + 6]] + v[nb[j + 7]] - 20 * vi) / 6;
        nu[i] = ui + dt * (Du * lu + on * (a * ui + b * vi + q * ui * ui - ui * ui * ui));
        nv[i] = vi + dt * (Dv * lv + on * (c * ui + d * vi));
      }
      [u, nu] = [nu, u]; [v, nv] = [nv, v]; this.t += dt;
    }
    this.u = u; this.v = v; this.nu = nu; this.nv = nv;
  }
  // { min, max, contrast } of the activator inside the dish
  stats() {
    let mn = Infinity, mx = -Infinity; for (const i of this.cells) { const x = this.u[i]; if (x < mn) mn = x; if (x > mx) mx = x; }
    return { min: mn, max: mx, contrast: mx - mn };
  }
  // Fraction of the dish where the activator is above the midpoint of its range: low for spots, about half for stripes, high for a net.
  coverage() { const { min, max } = this.stats(), mid = (min + max) / 2; let c = 0; for (const i of this.cells) if (this.u[i] > mid) c++; return c / this.cells.length; }
}
