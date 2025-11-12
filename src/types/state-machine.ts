/**
 * State machine type definitions for Arena system
 * @packageDocumentation
 */

/**
 * Issue status states
 */
export const IssueStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
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
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
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
 */
export function isValidIssueTransition(
  from: IssueStatusType,
  to: IssueStatusType
): boolean {
  return VALID_ISSUE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Checks if an agent state transition is valid
 * @param from - Current state
 * @param to - Target state
 * @returns True if transition is allowed
 */
export function isValidAgentTransition(
  from: AgentStatusType,
  to: AgentStatusType
): boolean {
  return VALID_AGENT_TRANSITIONS[from]?.includes(to) ?? false
}
