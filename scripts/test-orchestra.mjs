import assert from 'node:assert/strict';
import { initialState, transition } from '../assets/orchestra-engine.mjs';
const advance = (state, count) => { for (let i = 0; i < count; i++) state = transition(state, 'advance'); return state; };
let state = initialState();
assert.equal(transition(state, 'accept'), state, 'Untested work cannot be accepted');
state = advance(state, 5);
assert.equal(state.phase, 'verify');
assert.equal(transition(state, 'accept'), state);
const failed = transition(state, 'fail');
assert.equal(failed.phase, 'proposal');
assert.equal(failed.revision, 2);
assert.equal(failed.evidence, null);
state = transition(state, 'pass');
assert.equal(state.phase, 'decision');
const accepted = transition(state, 'accept');
assert.equal(accepted.phase, 'accepted');
const reopened = transition(accepted, 'dissent');
assert.equal(reopened.phase, 'proposal');
assert.equal(reopened.revision, 2);
assert.equal(reopened.evidence, null);
assert.equal(transition(reopened, 'accept'), reopened, 'Old evidence cannot accept a new revision');
const fresh = transition(advance(reopened, 4), 'pass');
assert.equal(fresh.evidence, 2);
assert.equal(transition(fresh, 'accept').phase, 'accepted');
assert.equal(fresh.dissent.length, 1, 'Dissent survives acceptance');
assert.equal(accepted.dissent.length, 0, 'Transitions do not mutate previous states');
assert.equal(transition({ ...fresh, evidence: 1 }, 'accept').phase, 'decision', 'Stale evidence is rejected');
// Explore all event combinations to depth 9; every acceptance must be justified.
let frontier = [initialState()];
const seen = new Set();
for (let depth = 0; depth < 9; depth++) {
  const next = [];
  for (const current of frontier) for (const event of ['advance','pass','fail','dissent','accept']) {
    const result = transition(current, event);
    if (result.phase === 'accepted') assert.equal(result.evidence, result.revision);
    if (result.revision > current.revision) assert.equal(result.evidence, null);
    assert.ok(result.dissent.length >= current.dissent.length);
    const key = JSON.stringify([result.phase,result.revision,result.evidence,result.dissent.length]);
    if (!seen.has(key)) { seen.add(key); next.push(result); }
  }
  frontier = next;
}
console.log(`Orchestra rules passed, including ${seen.size} reachable states.`);
