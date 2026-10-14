/**
 * Database entity types.
 * Exported from centralized types location.
 *
 * @packageDocumentation
 */

import type {
  issues,
  attempts,
  issueAgents,
  ciMetrics,
  agentScores,
  agentScoreHistory,
} from '@/db/schema'

/**
 * Issue entity from database.
 */
export type Issue = typeof issues.$inferSelect

/**
 * New issue to insert.
 */
export type NewIssue = typeof issues.$inferInsert

/**
 * Attempt entity from database.
 */
export type Attempt = typeof attempts.$inferSelect

/**
 * New attempt to insert.
 */
export type NewAttempt = typeof attempts.$inferInsert

/**
 * Issue agent entity from database.
 */
export type IssueAgent = typeof issueAgents.$inferSelect

/**
 * New issue agent to insert.
 */
export type NewIssueAgent = typeof issueAgents.$inferInsert

/**
 * CI metrics entity from database.
 */
export type CiMetric = typeof ciMetrics.$inferSelect

/**
 * New CI metric to insert.
 */
export type NewCiMetric = typeof ciMetrics.$inferInsert

/**
 * Agent names enum.
 */
export type AgentName = 'cursor' | 'engine' | 'cyrus'

/**
 * Linear issue status values (from Linear workflow states).
 *
 * These are distinct from IssueStatusType in state-machine.ts.
 * Linear statuses represent the Linear workflow (Backlog, Todo, etc.),
 * while state machine statuses represent arena competition states (open, in_progress, etc.).
 */
export type LinearIssueStatus =
  'Backlog' | 'Todo' | 'In Progress' | 'In Review' | 'Done' | 'Canceled'

/**
 * Attempt status values.
 */
export type AttemptStatus = 'open' | 'merged' | 'closed'

/**
 * Issue agent status values.
 *
 * Extends AgentStatusType from state machine with additional database-specific state.
 * Most values come from the canonical state machine; 'dispatch_failed' is database-only.
 */
export type IssueAgentStatus =
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'ignored'
  | 'dispatch_failed' // Database-specific: agent dispatch operation failed

/**
 * Agent stats from the agent_stats view.
 * Aggregates performance metrics per agent.
 */
export type AgentStats = {
  /** The unique name identifier for the agent */
  agentName: string
  /** Total number of issues the agent has worked on */
  issues: number
  /** Total number of PRs submitted by the agent */
  prs: number
  /** Number of PRs that were accepted/merged */
  wins: number
  /** Number of issues where the agent did not finish (no PR submitted) */
  dnf: number
  /** Total number of attempts made by the agent */
  attempts: number
  /** Percentage of PRs accepted (wins / prs * 100) */
  acceptancePct: number
  /** OpenSkill rating ordinal score for the agent */
  ordinal: number
  /** Total number of completed games/issues the agent participated in */
  gamesPlayed: number
  /** URL to the agent's avatar image */
  avatarUrl?: string | null
  /** The agent's display name */
  displayName?: string | null
}

/**
 * Issue with aggregated attempt data and winner information.
 * Used by the issues list page to display summary data.
 */
export type IssueWithAttemptData = Issue & {
  /** The total number of PR attempts submitted for this issue */
  attemptCount: number
  /** The name of the agent whose PR was accepted as the winner, or null if no winner yet */
  winnerAgentName: string | null
}

/**
 * Agent score from database.
 */
export type AgentScore = typeof agentScores.$inferSelect

/**
 * New agent score for insertion.
 */
export type NewAgentScore = typeof agentScores.$inferInsert

/**
 * Agent score history entry from database.
 */
export type AgentScoreHistory = typeof agentScoreHistory.$inferSelect

/**
 * New agent score history entry for insertion.
 */
export type NewAgentScoreHistory = typeof agentScoreHistory.$inferInsert
