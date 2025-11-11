/**
 * Database entity types.
 * Exported from centralized types location.
 *
 * @packageDocumentation
 */

import type { issues, attempts, issueAgents, ciMetrics } from '@/db/schema'

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
export type IssueAgentStatus = 'queued' | 'triggered' | 'failed' | 'skipped'
