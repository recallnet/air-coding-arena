/**
 * Database query functions for Arena Dashboard.
 * Server-side only - uses Drizzle ORM for type-safe queries.
 *
 * @packageDocumentation
 */

import { desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { attempts, issues } from '@/db/schema'
import type {
  AgentStats,
  Attempt,
  Issue,
  IssueWithAttemptData,
} from '@/types/database'

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
 * Fetches all issues with attempt counts and winner information.
 * Returns issues ordered by arena_ready_labeled_at (most recent first).
 *
 * Uses a SQL query with LEFT JOINs to:
 * - Count total attempts per issue
 * - Get winner agent name when a winner exists
 *
 * @returns Promise resolving to array of issues with attempt data
 *
 * @example
 * ```ts
 * const allIssues = await getIssues()
 * // [{ id: 'uuid', linearKey: 'ISSUE-123', attemptCount: 3, winnerAgentName: 'cursor', ... }, ...]
 * ```
 */
export async function getIssues(): Promise<IssueWithAttemptData[]> {
  const result = await db.execute<{
    id: string
    linear_id: string
    linear_key: string
    title: string
    url: string
    repo: string | null
    status: string | null
    arena_ready_labeled_at: Date | null
    winner_attempt_id: string | null
    created_at: Date
    attempt_count: number
    winner_agent_name: string | null
  }>(sql`
    SELECT
      i.id,
      i.linear_id,
      i.linear_key,
      i.title,
      i.url,
      i.repo,
      i.status,
      i.arena_ready_labeled_at,
      i.winner_attempt_id,
      i.created_at,
      COUNT(a.id)::int AS attempt_count,
      wa.agent_name AS winner_agent_name
    FROM issues i
    LEFT JOIN attempts a ON a.issue_id = i.id
    LEFT JOIN attempts wa ON wa.id = i.winner_attempt_id
    GROUP BY i.id, i.linear_id, i.linear_key, i.title, i.url, i.repo, i.status, i.arena_ready_labeled_at, i.winner_attempt_id, i.created_at, wa.agent_name
    ORDER BY i.arena_ready_labeled_at DESC
  `)

  return result.map((row) => ({
    id: row.id,
    linearId: row.linear_id,
    linearKey: row.linear_key,
    title: row.title,
    url: row.url,
    repo: row.repo,
    status: row.status,
    arenaReadyLabeledAt: row.arena_ready_labeled_at,
    winnerAttemptId: row.winner_attempt_id,
    createdAt: row.created_at,
    attemptCount: Number(row.attempt_count),
    winnerAgentName: row.winner_agent_name,
  }))
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
 * Attempt with issue information for agent detail page.
 */
export type AttemptWithIssue = Attempt & {
  issueLinearKey: string
}

/**
 * Fetches all attempts by a specific agent with issue linear keys.
 * Returns attempts ordered by opened_at (most recent first).
 *
 * @param agentName - Name of the agent (e.g., 'cursor', 'engine', 'cyrus')
 * @returns Promise resolving to array of attempts by the agent with issue linear keys
 *
 * @example
 * ```ts
 * const cursorAttempts = await getAttemptsByAgent('cursor')
 * // [{ id: 'uuid', issueId: 'issue-uuid', issueLinearKey: 'ISSUE-123', ... }, ...]
 * ```
 */
export async function getAttemptsByAgent(
  agentName: string
): Promise<AttemptWithIssue[]> {
  const result = await db.execute<{
    id: string
    issue_id: string
    agent_name: string
    repo: string
    pr_number: number
    pr_url: string
    branch: string | null
    opened_at: Date
    merged_at: Date | null
    closed_at: Date | null
    status: string
    commit_count: number
    last_commit_sha: string | null
    issue_linear_key: string
  }>(sql`
    SELECT
      a.id,
      a.issue_id,
      a.agent_name,
      a.repo,
      a.pr_number,
      a.pr_url,
      a.branch,
      a.opened_at,
      a.merged_at,
      a.closed_at,
      a.status,
      a.commit_count,
      a.last_commit_sha,
      i.linear_key AS issue_linear_key
    FROM attempts a
    INNER JOIN issues i ON i.id = a.issue_id
    WHERE a.agent_name = ${agentName}
    ORDER BY a.opened_at DESC
  `)

  return result.map((row) => ({
    id: row.id,
    issueId: row.issue_id,
    agentName: row.agent_name,
    repo: row.repo,
    prNumber: row.pr_number,
    prUrl: row.pr_url,
    branch: row.branch,
    openedAt: row.opened_at,
    mergedAt: row.merged_at,
    closedAt: row.closed_at,
    status: row.status,
    commitCount: row.commit_count,
    lastCommitSha: row.last_commit_sha,
    issueLinearKey: row.issue_linear_key,
  }))
}

/**
 * Temporal statistics for a single day.
 */
export type TemporalStat = {
  date: string
  attempts: number
  wins: number
  failures: number
}

/**
 * Fetches temporal statistics aggregated by day.
 * Returns daily metrics for attempts, wins (merged PRs), and failures (arena:ready issues with no attempts).
 *
 * @param days - Number of days to include in the result (default: 30)
 * @returns Promise resolving to array of daily statistics, ordered by date DESC
 *
 * @example
 * ```ts
 * const stats = await getTemporalStats(30)
 * // [{ date: '2024-01-15', attempts: 5, wins: 3, failures: 2 }, ...]
 * ```
 */
export async function getTemporalStats(
  days: number = 30
): Promise<TemporalStat[]> {
  const result = await db.execute<{
    date: string
    attempts: number
    wins: number
    failures: number
  }>(sql`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ${days - 1}::integer,
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    ),
    daily_attempts AS (
      SELECT
        DATE(opened_at) AS date,
        COUNT(*) AS attempts,
        COUNT(*) FILTER (WHERE status = 'merged') AS wins
      FROM attempts
      WHERE opened_at >= CURRENT_DATE - ${days - 1}::integer
      GROUP BY DATE(opened_at)
    ),
    daily_failures AS (
      SELECT
        DATE(arena_ready_labeled_at) AS date,
        COUNT(*) AS failures
      FROM issues
      WHERE arena_ready_labeled_at >= CURRENT_DATE - ${days - 1}::integer
        AND arena_ready_labeled_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM attempts a WHERE a.issue_id = issues.id
        )
      GROUP BY DATE(arena_ready_labeled_at)
    )
    SELECT
      TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
      COALESCE(da.attempts, 0)::int AS attempts,
      COALESCE(da.wins, 0)::int AS wins,
      COALESCE(df.failures, 0)::int AS failures
    FROM date_series ds
    LEFT JOIN daily_attempts da ON ds.date = da.date
    LEFT JOIN daily_failures df ON ds.date = df.date
    ORDER BY ds.date DESC
  `)

  return result.map((row) => ({
    date: row.date,
    attempts: Number(row.attempts),
    wins: Number(row.wins),
    failures: Number(row.failures),
  }))
}

/**
 * Temporal statistics for a single agent on a single day.
 */
export type AgentTemporalStat = {
  date: string
  agentName: string
  cumulativeAttempts: number
  cumulativeWins: number
  cumulativeFailures: number
}

/**
 * Fetches cumulative temporal statistics per agent.
 * Returns daily cumulative metrics for each agent's attempts, wins, and failures.
 *
 * @param days - Number of days to include in the result (default: 30)
 * @returns Promise resolving to array of daily cumulative statistics per agent, ordered by date DESC
 *
 * @example
 * ```ts
 * const stats = await getAgentTemporalStats(30)
 * // [{ date: '2024-01-15', agentName: 'cursor', cumulativeAttempts: 10, cumulativeWins: 8, cumulativeFailures: 2 }, ...]
 * ```
 */
export async function getAgentTemporalStats(
  days: number = 30
): Promise<AgentTemporalStat[]> {
  const result = await db.execute<{
    date: string
    agent_name: string
    cumulative_attempts: number
    cumulative_wins: number
    cumulative_failures: number
  }>(sql`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ${days - 1}::integer,
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    ),
    agents AS (
      SELECT DISTINCT agent_name
      FROM attempts
    ),
    agent_dates AS (
      SELECT ds.date, a.agent_name
      FROM date_series ds
      CROSS JOIN agents a
    ),
    daily_attempts AS (
      SELECT
        DATE(opened_at) AS date,
        agent_name,
        COUNT(*) AS attempts,
        COUNT(*) FILTER (WHERE status = 'merged') AS wins,
        COUNT(*) FILTER (WHERE status = 'closed' AND merged_at IS NULL) AS failures
      FROM attempts
      WHERE opened_at >= CURRENT_DATE - ${days - 1}::integer
      GROUP BY DATE(opened_at), agent_name
    ),
    cumulative_stats AS (
      SELECT
        ad.date,
        ad.agent_name,
        SUM(COALESCE(da.attempts, 0)) OVER (
          PARTITION BY ad.agent_name
          ORDER BY ad.date
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_attempts,
        SUM(COALESCE(da.wins, 0)) OVER (
          PARTITION BY ad.agent_name
          ORDER BY ad.date
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_wins,
        SUM(COALESCE(da.failures, 0)) OVER (
          PARTITION BY ad.agent_name
          ORDER BY ad.date
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_failures
      FROM agent_dates ad
      LEFT JOIN daily_attempts da ON ad.date = da.date AND ad.agent_name = da.agent_name
    )
    SELECT
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      agent_name,
      cumulative_attempts::int AS cumulative_attempts,
      cumulative_wins::int AS cumulative_wins,
      cumulative_failures::int AS cumulative_failures
    FROM cumulative_stats
    ORDER BY date DESC, agent_name
  `)

  return result.map((row) => ({
    date: row.date,
    agentName: row.agent_name,
    cumulativeAttempts: Number(row.cumulative_attempts),
    cumulativeWins: Number(row.cumulative_wins),
    cumulativeFailures: Number(row.cumulative_failures),
  }))
}

/**
 * Recent activity entry with issue details.
 */
export type RecentActivity = {
  id: string
  agentName: string
  issueId: string
  issueTitle: string
  issueLinearKey: string
  prUrl: string
  prNumber: number
  status: string
  openedAt: string
}

/**
 * Fetches recent PR activity with issue details.
 * Returns most recent attempts ordered by opened_at DESC.
 *
 * @param limit - Maximum number of entries to return (default: 30)
 * @returns Promise resolving to array of recent activity entries
 *
 * @example
 * ```ts
 * const activity = await getRecentActivity(30)
 * // [{ agentName: 'cursor', issueTitle: 'Fix bug', prUrl: '...', status: 'merged', openedAt: Date, ... }, ...]
 * ```
 */
export async function getRecentActivity(
  limit: number = 30
): Promise<RecentActivity[]> {
  const result = await db.execute<{
    id: string
    agent_name: string
    issue_id: string
    issue_title: string
    issue_linear_key: string
    pr_url: string
    pr_number: number
    status: string
    opened_at: Date
  }>(sql`
    SELECT
      a.id,
      a.agent_name,
      a.issue_id,
      i.title AS issue_title,
      i.linear_key AS issue_linear_key,
      a.pr_url,
      a.pr_number,
      a.status,
      a.opened_at
    FROM attempts a
    INNER JOIN issues i ON i.id = a.issue_id
    ORDER BY a.opened_at DESC
    LIMIT ${limit}
  `)

  return result.map((row) => ({
    id: row.id,
    agentName: row.agent_name,
    issueId: row.issue_id,
    issueTitle: row.issue_title,
    issueLinearKey: row.issue_linear_key,
    prUrl: row.pr_url,
    prNumber: Number(row.pr_number),
    status: row.status,
    openedAt:
      row.opened_at instanceof Date
        ? row.opened_at.toISOString()
        : row.opened_at,
  }))
}
