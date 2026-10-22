import assert from 'node:assert/strict';
import {
  N, SLOTS, PIECES, MOVE_NAMES, ALGS, solvedState, apply, isSolved, facelets,
  invertSeq, parse, randomScramble, simplify, solve,
} from '../assets/cube-engine.mjs';

// Geometry
assert.equal(N, 54);
assert.equal(PIECES.length, 26);
assert.equal(PIECES.filter(p => p.ids.length === 3).length, 8);
assert.equal(PIECES.filter(p => p.ids.length === 2).length, 12);

// Every move has order 4, and X X' is identity.
for (const m of MOVE_NAMES.filter(m => m.length === 1)) {
  assert.ok(isSolved(apply(solvedState(), [m, m, m, m])), `${m}^4`);
  assert.ok(isSolved(apply(solvedState(), [m, m + "'"])), `${m} ${m}'`);
  assert.ok(isSolved(apply(solvedState(), [m + '2', m + '2'])), `${m}2 ${m}2`);
  assert.ok(!isSolved(apply(solvedState(), [m])), `${m} changes the cube`);
}

// Known identities: (R U R' U')^6 = id, sexy move order; superflip-free sanity.
assert.ok(isSolved(apply(solvedState(), parse("R U R' U' ".repeat(6)))), 'sexy move has order 6');
assert.ok(!isSolved(apply(solvedState(), parse("R U R' U' ".repeat(3)))));
assert.ok(isSolved(apply(solvedState(), parse("R U ".repeat(105)))), '(R U) has order 105');

// Clockwise direction check: U moves the F face's top row to L (seen from above, clockwise).
{
  const at = facelets(apply(solvedState(), ['U']));
  const leftTop = SLOTS.filter(s => s.face === 'L' && s.p[1] === 1);
  assert.ok(leftTop.every(s => at[s.id] === 'F'), 'U sends front top row to the left face');
  const at2 = facelets(apply(solvedState(), ['R']));
  const upRight = SLOTS.filter(s => s.face === 'U' && s.p[0] === 1);
  assert.ok(upRight.every(s => at2[s.id] === 'F'), 'R sends front right column up');
}

// Last-layer algorithms keep the first two layers intact.
const f2l = PIECES.filter(pc => pc.p[1] < 1);
for (const [name, seq] of Object.entries(ALGS)) {
  const p = apply(solvedState(), parse(seq));
  assert.ok(f2l.every(pc => pc.ids.every(i => p[i] === i)), `${name} preserves F2L`);
  assert.ok(!isSolved(p), `${name} does something`);
}

// Seeded random so failures reproduce.
let seed = 20261022;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

assert.deepEqual(simplify(['R', 'R', 'U', "U'", 'F2', 'F']), ["R2", "F'"]);

const runs = Number(process.env.CUBE_RUNS || 300);
let total = 0, longest = 0;
const t0 = Date.now();
for (let i = 0; i < runs; i++) {
  const scramble = randomScramble(25, rnd);
  const start = apply(solvedState(), scramble);
  const steps = solve(start);
  const moves = steps.flatMap(s => s.moves);
  assert.ok(isSolved(apply(start, moves)), `solve ${i}: ${scramble.join(' ')}`);
  total += moves.length; longest = Math.max(longest, moves.length);
  // Undoing the scramble also solves it.
  assert.ok(isSolved(apply(start, invertSeq(scramble))));
}
const ms = Date.now() - t0;
console.log(`Cube: move algebra, last-layer algorithms, and ${runs} random solves passed ` +
  `(avg ${(total / runs).toFixed(0)} moves, longest ${longest}, ${(ms / runs).toFixed(0)} ms each).`);
