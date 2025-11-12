import { setup } from 'xstate';

/**
 * Issue lifecycle state machine for arena competitions.
 *
 * States:
 * - open: Issue has arena:ready label, may or may not have agents
 * - in_progress: At least one agent has submitted a PR
 * - completed: Winner selected, PR merged
 * - cancelled: arena:ready label removed OR issue closed
 */

type IssueContext = {
  issueId: string;
  winnerAgentName?: string;
  agentCount: number;
};

type IssueEvents =
  | { type: 'FIRST_PR_SUBMITTED' }
  | { type: 'PR_MERGED'; agentName: string }
  | { type: 'LABEL_REMOVED' }
  | { type: 'ISSUE_CLOSED' };

export const issueMachine = setup({
  types: {
    context: {} as IssueContext,
    events: {} as IssueEvents,
  },
}).createMachine({
  id: 'issue',
  initial: 'open',
  context: {
    issueId: '',
    agentCount: 0,
  },
  states: {
    open: {
      on: {
        FIRST_PR_SUBMITTED: {
          target: 'in_progress',
        },
        LABEL_REMOVED: {
          target: 'cancelled',
        },
        ISSUE_CLOSED: {
          target: 'cancelled',
        },
      },
    },
    in_progress: {
      on: {
        PR_MERGED: {
          target: 'completed',
        },
        LABEL_REMOVED: {
          target: 'cancelled',
        },
        ISSUE_CLOSED: {
          target: 'cancelled',
        },
      },
    },
    completed: {
      type: 'final',
    },
    cancelled: {
      type: 'final',
    },
  },
});
