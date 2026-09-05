// A deliberately small teaching model. Passing evidence belongs to one revision.
export function initialState() {
  return { phase: 'intent', revision: 1, evidence: null, dissent: [], history: ['A human opens the question.'], edge: 'intentPath' };
}
export function transition(state, event) {
  const next = { ...state, dissent: [...state.dissent], history: [...state.history] };
  const log = message => next.history.push(message);
  const reopen = reason => {
    next.dissent.push({ revision: state.revision, reason });
    next.revision++;
    next.evidence = null;
    next.phase = 'proposal';
    next.edge = 'judgeLeg';
    log(`${reason} Revision ${state.revision} reopened; revision ${next.revision} needs fresh evidence.`);
  };
  if (event === 'dissent' && ['review', 'decision', 'accepted'].includes(state.phase)) {
    reopen('A dissenting review challenges the assumptions.');
  } else if (event === 'fail' && state.phase === 'verify') {
    reopen('The runtime check fails.');
  } else if (event === 'pass' && state.phase === 'verify') {
    next.evidence = state.revision;
    next.phase = 'decision';
    next.edge = 'acceptPath';
    log(`The check passes for revision ${state.revision}. Human acceptance is still pending.`);
  } else if (event === 'accept' && state.phase === 'decision' && state.evidence === state.revision) {
    next.phase = 'accepted';
    next.edge = 'acceptPath';
    log(`The human accepts revision ${state.revision}, provisionally. Dissent remains in the record.`);
  } else if (event === 'advance') {
    const route = {
      intent: ['proposal', 'legPath', 'The human asks for a bounded proposal.'],
      proposal: ['build', 'legExec', `The builder implements revision ${state.revision}.`],
      build: ['review', 'execJudge', 'Independent review examines the implementation.'],
      review: ['observe', 'runtimePath', 'The implementation meets runtime conditions.'],
      observe: ['verify', 'evidencePath', 'Review compares the observed result with the claim.'],
    }[state.phase];
    if (!route) return state;
    [next.phase, next.edge] = route;
    log(route[2]);
  } else return state;
  return next;
}
