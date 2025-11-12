import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';

import { issueMachine } from './issueMachine';

describe('issueMachine', () => {
  it('starts in open state', () => {
    const actor = createActor(issueMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('open');
  });

  it('transitions from open to in_progress on FIRST_PR_SUBMITTED', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'FIRST_PR_SUBMITTED' });

    expect(actor.getSnapshot().value).toBe('in_progress');
  });

  it('transitions from open to cancelled on LABEL_REMOVED', () => {
    const actor = createActor(issueMachine);
    actor.start();

    actor.send({ type: 'LABEL_REMOVED' });

    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('transitions from in_progress to completed on PR_MERGED', () => {
    const actor = createActor(issueMachine);
    actor.start();

    // Transition to in_progress first
    actor.send({ type: 'FIRST_PR_SUBMITTED' });
    expect(actor.getSnapshot().value).toBe('in_progress');

    actor.send({ type: 'PR_MERGED', agentName: 'agent1' });

    expect(actor.getSnapshot().value).toBe('completed');
  });

  it('transitions from in_progress to cancelled on ISSUE_CLOSED', () => {
    const actor = createActor(issueMachine);
    actor.start();

    // Transition to in_progress first
    actor.send({ type: 'FIRST_PR_SUBMITTED' });
    expect(actor.getSnapshot().value).toBe('in_progress');

    actor.send({ type: 'ISSUE_CLOSED' });

    expect(actor.getSnapshot().value).toBe('cancelled');
  });
});
