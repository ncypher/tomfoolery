import { initialState, transition } from './orchestra-engine.mjs';
let state = initialState();
const $ = id => document.getElementById(id);
const descriptions = {
  intent: ['Intent', 'Set a purpose and boundaries. A human opens the question.', 'Propose a direction'],
  proposal: ['Proposal', 'Make the claim specific enough to build and challenge.', 'Build the proposal'],
  build: ['Implementation', 'The proposal now has behavior. Send it to an independent review.', 'Request review'],
  review: ['Independent review', 'Challenge an assumption, or take the implementation into runtime.', 'Observe the result'],
  observe: ['Runtime observation', 'Bring the observed behavior back to the claim. What actually happened?', 'Verify the evidence'],
  verify: ['Evidence check', 'Choose an illustrative outcome. A failure reopens the proposal; a pass applies only to this revision.'],
  decision: ['Human decision', 'The current revision has passing evidence. You can accept it or reopen the question.'],
  accepted: ['Accepted, for now', 'Acceptance is provisional. A new objection can still reopen the work.'],
};
function render() {
  const [title, detail, action] = descriptions[state.phase];
  $('phase-title').textContent = title;
  $('explanation').textContent = detail;
  $('revision').textContent = state.revision;
  $('evidence').textContent = state.evidence === null ? 'pending' : `revision ${state.evidence} passed`;
  $('dissent-count').textContent = state.dissent.length;
  $('advance').hidden = !action;
  $('advance').textContent = action || 'Advance';
  $('pass').hidden = $('fail').hidden = state.phase !== 'verify';
  $('dissent').hidden = !['review', 'decision', 'accepted'].includes(state.phase);
  $('accept').disabled = state.phase !== 'decision' || state.evidence !== state.revision;
  $('record').replaceChildren(...state.history.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('record').scrollTop = $('record').scrollHeight;
  const trace = $('active-edge');
  if (trace) trace.setAttribute('href', `#${state.edge}`);
}
for (const event of ['advance', 'pass', 'fail', 'dissent', 'accept', 'reset']) {
  $(event).addEventListener('click', () => {
    state = event === 'reset' ? initialState() : transition(state, event);
    render();
    // Keep keyboard focus on an available action when the previous one disappears.
    if ($(event).hidden || $(event).disabled) {
      const next = [...document.querySelectorAll('.controls button')].find(button => !button.hidden && !button.disabled);
      next?.focus();
    }
  });
}
render();
$('experiment').hidden = false;
try {
  const response = await fetch('assets/orchestra-map.svg');
  if (!response.ok) throw new Error(`Diagram HTTP ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  const svg = document.importNode(doc.documentElement, true);
  const trace = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  trace.id = 'active-edge';
  trace.setAttribute('class', 'trace');
  trace.setAttribute('fill', 'none');
  trace.setAttribute('stroke', '#fff3bb');
  trace.setAttribute('stroke-width', '3');
  svg.append(trace);
  $('diagram').replaceChildren(svg);
  render();
} catch (error) {
  // The embedded image and textual state remain usable if the map is unavailable.
  console.warn('Using the overview diagram.', error);
}
