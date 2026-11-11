import assert from 'node:assert/strict';
import { Dish, Ring, KINETICS, criticalRatio, fastest, growthRate, ringPrediction, diffusion } from '../assets/turing-engine.mjs';

const settle = (dish, time) => { const { Dv, Du } = diffusion(dish.params), dt = Math.min(0.05, 0.2 / Math.max(Du, Dv)); dish.step(Math.round(time / dt)); return dish; };
const sum = d => { let s = 0; for (const i of d.cells) s += d.u[i]; return s; };

// The paper's condition. Without diffusion the even state is stable; with it, only above a ratio of 4.5.
assert.ok(KINETICS.a + KINETICS.d < 0 && KINETICS.a * KINETICS.d - KINETICS.b * KINETICS.c > 0, 'stable when stirred');
assert.ok(Math.abs(criticalRatio() - 4.5) < 1e-9, 'critical ratio is 4.5');
assert.ok(fastest(1, 4.4).rate < 0, 'no ripple grows just below the threshold');
assert.ok(fastest(1, 4.6).rate > 0, 'some ripple grows just above the threshold');
assert.ok(growthRate(0, 1, 20) < 0 && growthRate(25, 1, 20) < 0, 'very broad and very fine ripples fade');
assert.ok(fastest(1, 1).rate < 0 && fastest(3, 3).rate < 0, 'equal speeds: nothing grows');

// The dish agrees with the algebra.
const below = settle(new Dish(96, { Du: 1, ratio: 4, q: 0 }, 11), 150);
assert.ok(below.stats().contrast < 1e-3, 'below the threshold the stirred dish goes flat');
const above = settle(new Dish(96, { Du: 1, ratio: 6.5, q: 0 }, 11), 150);
assert.ok(above.stats().contrast > 0.5, 'above the threshold a pattern appears');
assert.ok(above.stats().max < 2 && above.stats().min > -2, 'and stays bounded');

// Taking parts away.
above.params.equal = true; settle(above, 120);
assert.ok(above.stats().contrast < 0.01, 'same speed for both: the pattern melts');
const still = new Dish(64, { Du: 1, ratio: 6.5, q: 1.1 }, 3); still.wipe(); still.step(2000);
assert.equal(still.stats().contrast, 0, 'a perfectly even dish never moves');
still.poke(32, 32); settle(still, 200);
assert.ok(still.stats().contrast > 0.5, 'one touch is enough to start a pattern');
const inert = new Dish(64, { Du: 1, ratio: 6.5, q: 0, noReaction: true }, 5); inert.poke(20, 30, 4, 1);
const before = sum(inert), c0 = inert.stats().contrast; inert.step(4000);
assert.ok(Math.abs(sum(inert) - before) < 1e-2 * Math.abs(before), 'the wall is closed: diffusion alone conserves the total');
assert.ok(inert.stats().contrast < c0 / 20, 'diffusion alone only smooths');

// Bias chooses the kind of pattern.
const cover = q => settle(new Dish(128, { Du: 1.5, ratio: q ? 6.5 : 9, q }, 21), 400).coverage();
const spots = cover(1.1), stripes = cover(0), net = cover(-1.1);
assert.ok(spots < 0.45, `spots cover under half the dish (${spots.toFixed(2)})`);
assert.ok(Math.abs(stripes - 0.5) < 0.08, `stripes cover about half (${stripes.toFixed(2)})`);
assert.ok(net > 0.55, `a net covers over half (${net.toFixed(2)})`);

// Turing's ring: the simulated lobe count against the calculation, for every even size from 12 to 96 cells.
let agree = 0, total = 0, worst = 0;
for (let n = 12; n <= 96; n += 2) {
  const p = { Du: 0.5, ratio: 6, q: 0 }, { Du, Dv } = diffusion(p), pred = ringPrediction(n, Du, Dv).lobes;
  const ring = new Ring(n, p, n * 7 + 1); ring.stir(1e-3); ring.step(30000);
  total++; if (ring.lobes() === pred) agree++; worst = Math.max(worst, Math.abs(ring.lobes() - pred));
}
assert.ok(agree >= 38 && worst <= 1, `ring matches the calculation in ${agree} of ${total} sizes, never off by more than ${worst}`);
assert.equal(ringPrediction(40, 0.5, 2).lobes, 0, 'below the threshold the ring predicts no lobes');

console.log(`turing: all checks passed (ring ${agree}/${total}; coverage spots ${spots.toFixed(2)}, stripes ${stripes.toFixed(2)}, net ${net.toFixed(2)})`);
