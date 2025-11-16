/**
 * State machine type definitions for Arena system
 * @packageDocumentation
 */

/**
 * Issue status states
 */
export const IssueStatus = {
  /** Issue is open and available for agents to work on */
  OPEN: 'open',
  /** Issue has at least one PR submitted and is being worked on */
  IN_PROGRESS: 'in_progress',
  /** Issue has been completed (PR merged and winner selected) */
  COMPLETED: 'completed',
  /** Issue was cancelled before completion */
  CANCELLED: 'cancelled',
} as const

/**
 * Type representing issue status values
 */
export type IssueStatusType = (typeof IssueStatus)[keyof typeof IssueStatus]

/**
 * Agent status states
 */
export const AgentStatus = {
  /** Agent has been assigned but not yet dispatched or submitted a PR */
  PENDING: 'pending',
  /** Agent has submitted a PR for review */
  SUBMITTED: 'submitted',
  /** Agent's PR was merged (winner) */
  ACCEPTED: 'accepted',
  /** Agent's PR was not merged (another agent won) */
  REJECTED: 'rejected',
  /** Agent was assigned but never submitted a PR (did not finish) */
  IGNORED: 'ignored',
} as const

/**
 * Type representing agent status values
 */
export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus]

/**
 * Valid issue state transitions
 */
const VALID_ISSUE_TRANSITIONS: Record<IssueStatusType, IssueStatusType[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/**
 * Valid agent state transitions
 */
const VALID_AGENT_TRANSITIONS: Record<AgentStatusType, AgentStatusType[]> = {
  pending: ['submitted', 'ignored'],
  submitted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  ignored: [],
}

/**
 * Checks if an issue state transition is valid
 * @param from - Current state
 * @param to - Target state
 * @returns True if transition is allowed
 * @throws Error if from state is invalid
 */
export function isValidIssueTransition(
  from: IssueStatusType,
  to: IssueStatusType
): boolean {
  const validTransitions = VALID_ISSUE_TRANSITIONS[from]
  if (!validTransitions) {
    throw new Error(
      `Invalid issue state: ${from}. Expected one of: ${Object.keys(VALID_ISSUE_TRANSITIONS).join(', ')}`
    )
  }
  return validTransitions.includes(to)
}

/**
 * Checks if an agent state transition is valid
 * @param from - Current state
 * @param to - Target state
 * @returns True if transition is allowed
 * @throws Error if from state is invalid
 */
export function isValidAgentTransition(
  from: AgentStatusType,
  to: AgentStatusType
): boolean {
  const validTransitions = VALID_AGENT_TRANSITIONS[from]
  if (!validTransitions) {
    throw new Error(
      `Invalid agent state: ${from}. Expected one of: ${Object.keys(VALID_AGENT_TRANSITIONS).join(', ')}`
    )
  }
  return validTransitions.includes(to)
}
