import { setup } from 'xstate'

/**
 * Agent lifecycle state machine for arena competitions.
 *
 * States:
 * - pending: Agent mentioned in Linear comment, waiting for PR
 * - submitted: PR created and linked
 * - accepted: Agent's PR was merged (winner)
 * - rejected: Another agent won OR PR closed without merge
 * - ignored: Issue closed before agent submitted PR
 *
 * This machine is used to track agent state through the competition lifecycle.
 */

type AgentContext = {
  agentName: string
  issueId: string
  prUrl?: string
}

type AgentEvents =
  | { type: 'PR_SUBMITTED'; prUrl: string }
  | { type: 'PR_MERGED' }
  | { type: 'OTHER_AGENT_WON' }
  | { type: 'PR_CLOSED' }
  | { type: 'ISSUE_CLOSED' }

export const agentMachine = setup({
  types: {} as {
    context: AgentContext
    events: AgentEvents
  },
}).createMachine({
  id: 'agent',
  initial: 'pending',
  context: {
    agentName: '',
    issueId: '',
  },
  states: {
    pending: {
      on: {
        PR_SUBMITTED: {
          target: 'submitted',
        },
        ISSUE_CLOSED: {
          target: 'ignored',
        },
      },
    },
    submitted: {
      on: {
        PR_MERGED: {
          target: 'accepted',
        },
        OTHER_AGENT_WON: {
          target: 'rejected',
        },
        PR_CLOSED: {
          target: 'rejected',
        },
      },
    },
    accepted: {
      type: 'final',
      description: 'Agent won the competition. Rating increased via OpenSkill Plackett-Luce model.',
    },
    rejected: {
      type: 'final',
      description: 'Agent lost or PR closed without merge. Rating updated based on ranking.',
    },
    ignored: {
      type: 'final',
    },
  },
})
