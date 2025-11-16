/**
 * Display status types for frontend UI.
 *
 * These types derive from state machine types to provide user-friendly
 * display strings while maintaining type safety.
 *
 * @packageDocumentation
 */

import { AgentStatus, type AgentStatusType } from './state-machine'

/**
 * User-facing display representation of agent outcomes.
 *
 * Maps internal AgentStatus values to human-readable strings:
 * - WON: Agent's PR was merged (winner)
 * - LOST: Agent's PR was not merged (another agent won)
 * - DNF: Did not finish (agent was assigned but never submitted)
 * - SUBMITTED: Agent has submitted a PR for review
 * - PENDING: Agent has been assigned but not yet dispatched
 */
export const AgentOutcome = {
  /** Agent's PR was merged (winner) */
  WON: 'won',
  /** Agent's PR was not merged (another agent won) */
  LOST: 'lost',
  /** Did not finish - agent was assigned but never submitted PR */
  DNF: 'dnf',
  /** Agent has submitted a PR for review */
  SUBMITTED: 'submitted',
  /** Agent has been assigned but not yet dispatched */
  PENDING: 'pending',
} as const

/**
 * Type representing valid agent outcome display values
 */
export type AgentOutcomeType = (typeof AgentOutcome)[keyof typeof AgentOutcome]

/**
 * Type-safe mapping from database AgentStatus to display AgentOutcome.
 *
 * This provides a single source of truth for status-to-display conversion,
 * ensuring compile-time validation if state machine types change.
 *
 * @param status - The agent status from the database
 * @returns The user-facing display string
 *
 * @example
 * ```typescript
 * const displayText = getAgentOutcome(AgentStatus.ACCEPTED)
 * // displayText === 'won' (type: AgentOutcomeType)
 * ```
 */
export function getAgentOutcome(status: AgentStatusType): AgentOutcomeType {
  switch (status) {
    case AgentStatus.ACCEPTED:
      return AgentOutcome.WON
    case AgentStatus.REJECTED:
      return AgentOutcome.LOST
    case AgentStatus.IGNORED:
      return AgentOutcome.DNF
    case AgentStatus.SUBMITTED:
      return AgentOutcome.SUBMITTED
    case AgentStatus.PENDING:
      return AgentOutcome.PENDING
  }
}

/**
 * Inverse mapping: converts display outcome back to database status.
 *
 * Useful for filtering or querying by user-selected display values.
 *
 * @param outcome - The display outcome string
 * @returns The corresponding database AgentStatus value
 *
 * @example
 * ```typescript
 * const status = outcomeToStatus(AgentOutcome.WON)
 * // status === AgentStatus.ACCEPTED
 * ```
 */
export function outcomeToStatus(outcome: AgentOutcomeType): AgentStatusType {
  switch (outcome) {
    case AgentOutcome.WON:
      return AgentStatus.ACCEPTED
    case AgentOutcome.LOST:
      return AgentStatus.REJECTED
    case AgentOutcome.DNF:
      return AgentStatus.IGNORED
    case AgentOutcome.SUBMITTED:
      return AgentStatus.SUBMITTED
    case AgentOutcome.PENDING:
      return AgentStatus.PENDING
  }
}

/**
 * Type guard to check if a value is a valid AgentOutcome.
 *
 * @param value - The value to check
 * @returns True if value is a valid AgentOutcomeType
 *
 * @example
 * ```typescript
 * const input = 'won'
 * if (isAgentOutcome(input)) {
 *   // input is now typed as AgentOutcomeType
 *   const status = outcomeToStatus(input)
 * }
 * ```
 */
export function isAgentOutcome(value: string): value is AgentOutcomeType {
  return Object.values(AgentOutcome).includes(value as AgentOutcomeType)
}

/**
 * Attempt status display values.
 *
 * These are simpler than agent statuses since they directly correspond
 * to PR states in GitHub (open, merged, closed).
 */
export const AttemptStatusDisplay = {
  /** PR is open and being worked on */
  OPEN: 'open',
  /** PR has been merged */
  MERGED: 'merged',
  /** PR was closed without merging */
  CLOSED: 'closed',
} as const

/**
 * Type representing valid attempt status display values
 */
export type AttemptStatusDisplayType =
  (typeof AttemptStatusDisplay)[keyof typeof AttemptStatusDisplay]

/**
 * Type guard to check if a value is a valid AttemptStatusDisplay.
 *
 * @param value - The value to check
 * @returns True if value is a valid AttemptStatusDisplayType
 */
export function isAttemptStatusDisplay(
  value: string
): value is AttemptStatusDisplayType {
  return Object.values(AttemptStatusDisplay).includes(
    value as AttemptStatusDisplayType
  )
}
