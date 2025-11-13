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
 * Issue status values.
 */
export type IssueStatus =
  | 'Backlog'
  | 'Todo'
  | 'In Progress'
  | 'In Review'
  | 'Done'
  | 'Canceled'

/**
 * Attempt status values.
 */
export type AttemptStatus = 'open' | 'merged' | 'closed'

/**
 * Issue agent status values.
 */
export type IssueAgentStatus =
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'ignored'
  | 'dispatch_failed'

/**
 * Agent stats from the agent_stats view.
 * Aggregates performance metrics per agent.
 */
export type AgentStats = {
  agentName: string
  attempts: number
  wins: number
  acceptancePct: number
  ordinal: number
  gamesPlayed: number
  avatarUrl?: string | null
  displayName?: string | null
}

/**
 * Issue with aggregated attempt data and winner information.
 * Used by the issues list page to display summary data.
 */
export type IssueWithAttemptData = Issue & {
  attemptCount: number
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
