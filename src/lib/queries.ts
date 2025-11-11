/**
 * Database query functions for Arena Dashboard.
 * Server-side only - uses Drizzle ORM for type-safe queries.
 *
 * @packageDocumentation
 */

import { desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { attempts, issues } from '@/db/schema'
import type { AgentStats, Attempt, Issue } from '@/types/database'

/**
 * Fetches aggregated statistics for all agents from the agent_stats view.
 * Returns leaderboard data ordered by acceptance percentage (highest first).
 *
 * The agent_stats view is a database view (not a Drizzle table), so we use
 * raw SQL query via db.execute().
 *
 * @returns Promise resolving to array of agent statistics, ordered by acceptance_pct DESC
 *
 * @example
 * ```ts
 * const stats = await getAgentStats()
 * // [{ agentName: 'cursor', attempts: 10, wins: 8, acceptancePct: 80.0 }, ...]
 * ```
 */
export async function getAgentStats(): Promise<AgentStats[]> {
  const result = await db.execute<{
    agent_name: string
    attempts: number
    wins: number
    acceptance_pct: number
  }>(sql`
    SELECT
      agent_name,
      attempts,
      wins,
      acceptance_pct
    FROM agent_stats
    ORDER BY acceptance_pct DESC
  `)

  return result.map((row) => ({
    agentName: row.agent_name,
    attempts: Number(row.attempts),
    wins: Number(row.wins),
    acceptancePct: Number(row.acceptance_pct),
  }))
}

/**
 * Fetches all issues with their winner attempt information.
 * Returns issues ordered by arena_ready_labeled_at (most recent first).
 *
 * @returns Promise resolving to array of issues
 *
 * @example
 * ```ts
 * const allIssues = await getIssues()
 * // [{ id: 'uuid', linearKey: 'ISSUE-123', ... }, ...]
 * ```
 */
export async function getIssues(): Promise<Issue[]> {
  const result = await db
    .select()
    .from(issues)
    .orderBy(desc(issues.arenaReadyLabeledAt))

  return result
}

/**
 * Fetches a single issue by ID with all its attempts.
 * Returns null if the issue is not found.
 *
 * @param id - UUID of the issue to fetch
 * @returns Promise resolving to issue with attempts array, or null if not found
 *
 * @example
 * ```ts
 * const issue = await getIssueById('uuid-here')
 * if (issue) {
 *   console.log(issue.attempts) // Array of attempts
 * }
 * ```
 */
export async function getIssueById(
  id: string
): Promise<(Issue & { attempts: Attempt[] }) | null> {
  const issueResult = await db.select().from(issues).where(eq(issues.id, id))

  if (issueResult.length === 0) {
    return null
  }

  const [issue] = issueResult

  if (!issue) {
    return null
  }

  const issueAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, id))
    .orderBy(desc(attempts.openedAt))

  return {
    id: issue.id,
    linearId: issue.linearId,
    linearKey: issue.linearKey,
    title: issue.title,
    url: issue.url,
    repo: issue.repo,
    status: issue.status,
    arenaReadyLabeledAt: issue.arenaReadyLabeledAt,
    winnerAttemptId: issue.winnerAttemptId,
    createdAt: issue.createdAt,
    attempts: issueAttempts,
  }
}

/**
 * Fetches all attempts for a specific issue.
 * Returns attempts ordered by opened_at (most recent first).
 *
 * @param issueId - UUID of the issue
 * @returns Promise resolving to array of attempts for the issue
 *
 * @example
 * ```ts
 * const attempts = await getAttemptsByIssue('issue-uuid')
 * // [{ id: 'uuid', agentName: 'cursor', ... }, ...]
 * ```
 */
export async function getAttemptsByIssue(issueId: string): Promise<Attempt[]> {
  const result = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issueId))
    .orderBy(desc(attempts.openedAt))

  return result
}

/**
 * Fetches all attempts by a specific agent.
 * Returns attempts ordered by opened_at (most recent first).
 *
 * @param agentName - Name of the agent (e.g., 'cursor', 'engine', 'cyrus')
 * @returns Promise resolving to array of attempts by the agent
 *
 * @example
 * ```ts
 * const cursorAttempts = await getAttemptsByAgent('cursor')
 * // [{ id: 'uuid', issueId: 'issue-uuid', ... }, ...]
 * ```
 */
export async function getAttemptsByAgent(
  agentName: string
): Promise<Attempt[]> {
  const result = await db
    .select()
    .from(attempts)
    .where(eq(attempts.agentName, agentName))
    .orderBy(desc(attempts.openedAt))

  return result
}
