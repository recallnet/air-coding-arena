import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { agentMachine } from './agentMachine';

describe('agentMachine', () => {
  it('transitions from pending to submitted on PR_SUBMITTED', () => {
    const actor = createActor(agentMachine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('pending');

    actor.send({ type: 'PR_SUBMITTED', prUrl: 'https://github.com/org/repo/pull/1' });

    expect(actor.getSnapshot().value).toBe('submitted');
  });

  it('transitions from pending to ignored on ISSUE_CLOSED', () => {
    const actor = createActor(agentMachine);
    actor.start();

    actor.send({ type: 'ISSUE_CLOSED' });

    expect(actor.getSnapshot().value).toBe('ignored');
  });

  it('transitions from submitted to accepted on PR_MERGED', () => {
    const actor = createActor(agentMachine);
    actor.start();

    // First transition to submitted state
    actor.send({ type: 'PR_SUBMITTED', prUrl: 'https://github.com/org/repo/pull/1' });
    expect(actor.getSnapshot().value).toBe('submitted');

    // Then test transition to accepted
    actor.send({ type: 'PR_MERGED' });

    expect(actor.getSnapshot().value).toBe('accepted');
  });

  it('transitions from submitted to rejected on OTHER_AGENT_WON', () => {
    const actor = createActor(agentMachine);
    actor.start();

    // First transition to submitted state
    actor.send({ type: 'PR_SUBMITTED', prUrl: 'https://github.com/org/repo/pull/1' });
    expect(actor.getSnapshot().value).toBe('submitted');

    // Then test transition to rejected
    actor.send({ type: 'OTHER_AGENT_WON' });

    expect(actor.getSnapshot().value).toBe('rejected');
  });
});
