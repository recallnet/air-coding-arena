/**
 * Database query functions for Arena Dashboard.
 * Server-side only - uses Drizzle ORM for type-safe queries.
 *
 * @packageDocumentation
 */

import { desc, eq, sql, and, or } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  attempts,
  issues,
  agentScores,
  agentScoreHistory,
  agents,
} from '@/db/schema'
import type {
  AgentStats,
  Attempt,
  Issue,
  IssueWithAttemptData,
  AgentScore,
  AgentScoreHistory,
} from '@/types/database'

/**
 * Fetches an agent by slug or name.
 * Accepts either slug format (hyphens) or name format (spaces).
 *
 * @param slugOrName - Agent slug (e.g., "github-copilot") or name (e.g., "github copilot")
 * @returns Promise resolving to agent record or null if not found
 *
 * @example
 * ```ts
 * const agent = await getAgentBySlugOrName('github-copilot')
 * const agent2 = await getAgentBySlugOrName('github copilot')
 * ```
 */
export async function getAgentBySlugOrName(slugOrName: string) {
  // Try to find by slug first, then by name (in case input is actually a name with spaces)
  const agent = await db.query.agents.findFirst({
    where: or(eq(agents.slug, slugOrName), eq(agents.name, slugOrName)),
  })

  return agent ?? null
}

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
    ordinal: number
    games_played: number
    avatar_url: string | null
    display_name: string | null
  }>(sql`
    SELECT
      a.agent_name,
      a.attempts,
      a.wins,
      a.acceptance_pct,
      COALESCE(s.ordinal, 0) as ordinal,
      COALESCE(s.games_played, 0) as games_played,
      ag.avatar_url,
      ag.display_name
    FROM agent_stats a
    LEFT JOIN agent_scores s ON a.agent_name = s.agent_name
    LEFT JOIN agents ag ON a.agent_name = ag.name
    ORDER BY s.ordinal DESC NULLS LAST, a.acceptance_pct DESC
  `)

  return result.map((row) => ({
    agentName: row.agent_name,
    attempts: Number(row.attempts),
    wins: Number(row.wins),
    acceptancePct: Number(row.acceptance_pct),
    ordinal: Number(row.ordinal),
    gamesPlayed: Number(row.games_played),
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
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
    description: string | null
    description_markdown: string | null
    estimate: number | null
    priority: number | null
    labels_json: unknown
    assignee_id: string | null
    assignee_name: string | null
    assignee_email: string | null
    creator_id: string | null
    creator_name: string | null
    creator_email: string | null
    project_id: string | null
    project_name: string | null
    cycle_id: string | null
    cycle_name: string | null
    cycle_number: number | null
    due_date: Date | null
    linear_created_at: Date | null
    linear_updated_at: Date | null
    parent_id: string | null
    arena_ready_labeled_at: Date | null
    winner_attempt_id: string | null
    created_at: Date
    attempt_count: number
    winner_agent_name: string | null
  }>(sql`
    SELECT
      i.*,
      COUNT(a.id)::int AS attempt_count,
      wa.agent_name AS winner_agent_name
    FROM issues i
    LEFT JOIN attempts a ON a.issue_id = i.id
    LEFT JOIN attempts wa ON wa.id = i.winner_attempt_id
    GROUP BY i.id, wa.agent_name
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
    description: row.description,
    descriptionMarkdown: row.description_markdown,
    estimate: row.estimate,
    priority: row.priority,
    labelsJson: row.labels_json,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    assigneeEmail: row.assignee_email,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    creatorEmail: row.creator_email,
    projectId: row.project_id,
    projectName: row.project_name,
    cycleId: row.cycle_id,
    cycleName: row.cycle_name,
    cycleNumber: row.cycle_number,
    dueDate: row.due_date,
    linearCreatedAt: row.linear_created_at,
    linearUpdatedAt: row.linear_updated_at,
    parentId: row.parent_id,
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
): Promise<(Issue & { attempts: Attempt[]; agents: IssueAgent[] }) | null> {
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

  const agentsResult = await db.execute<{
    agent_name: string
    status: string
    avatar_url: string | null
    display_name: string | null
    slug: string | null
  }>(sql`
    SELECT
      ia.agent_name,
      ia.status,
      ag.avatar_url,
      ag.display_name,
      ag.slug
    FROM issue_agents ia
    LEFT JOIN agents ag ON ia.agent_name = ag.name
    WHERE ia.issue_id = ${id}
  `)

  return {
    ...issue,
    attempts: issueAttempts,
    agents: agentsResult.map((agent) => {
      const status = agent.status as
        | 'pending'
        | 'submitted'
        | 'accepted'
        | 'rejected'
        | 'ignored'
      if (
        status !== 'pending' &&
        status !== 'submitted' &&
        status !== 'accepted' &&
        status !== 'rejected' &&
        status !== 'ignored'
      ) {
        throw new Error(`Invalid agent status: ${status}`)
      }
      return {
        agentName: agent.agent_name,
        status,
        avatarUrl: agent.avatar_url,
        displayName: agent.display_name,
        slug: agent.slug,
      }
    }),
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
    ci_status: string | null
    ci_last_checked_at: Date | null
    source_attachment_id: string | null
    source_attachment_url: string | null
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
      a.ci_status,
      a.ci_last_checked_at,
      a.source_attachment_id,
      a.source_attachment_url,
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
    ciStatus: row.ci_status,
    ciLastCheckedAt: row.ci_last_checked_at,
    sourceAttachmentId: row.source_attachment_id,
    sourceAttachmentUrl: row.source_attachment_url,
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
  ordinal: number
  avatarUrl?: string | null
  displayName?: string | null
}

/**
 * Fetches cumulative temporal statistics per agent.
 * Returns daily cumulative metrics for each agent's attempts, wins, failures, and ordinal rating.
 *
 * @param days - Number of days to include in the result (default: 30)
 * @returns Promise resolving to array of daily cumulative statistics per agent, ordered by date DESC
 *
 * @example
 * ```ts
 * const stats = await getAgentTemporalStats(30)
 * // [{ date: '2024-01-15', agentName: 'cursor', cumulativeAttempts: 10, cumulativeWins: 8, cumulativeFailures: 2, ordinal: 1500 }, ...]
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
    ordinal: number
    avatar_url: string | null
    display_name: string | null
  }>(sql`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - ${days - 1}::integer,
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    ),
    agent_names AS (
      SELECT DISTINCT agent_name
      FROM attempts
    ),
    agent_dates AS (
      SELECT ds.date, a.agent_name
      FROM date_series ds
      CROSS JOIN agent_names a
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
    daily_scores AS (
      SELECT
        DATE(completed_at) as date,
        agent_name,
        ordinal,
        ROW_NUMBER() OVER (PARTITION BY agent_name, DATE(completed_at) ORDER BY completed_at DESC) as rn
      FROM agent_score_history
      WHERE completed_at >= CURRENT_DATE - ${days - 1}::integer
    ),
    latest_daily_scores AS (
      SELECT date, agent_name, ordinal
      FROM daily_scores
      WHERE rn = 1
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
      TO_CHAR(cs.date, 'YYYY-MM-DD') AS date,
      cs.agent_name,
      cs.cumulative_attempts::int AS cumulative_attempts,
      cs.cumulative_wins::int AS cumulative_wins,
      cs.cumulative_failures::int AS cumulative_failures,
      COALESCE(sc.ordinal, 0) as ordinal,
      ag.avatar_url,
      ag.display_name
    FROM cumulative_stats cs
    LEFT JOIN latest_daily_scores sc ON cs.date = sc.date AND cs.agent_name = sc.agent_name
    LEFT JOIN agents ag ON cs.agent_name = ag.name
    ORDER BY cs.date DESC, cs.agent_name
  `)

  return result.map((row) => ({
    date: row.date,
    agentName: row.agent_name,
    cumulativeAttempts: Number(row.cumulative_attempts),
    cumulativeWins: Number(row.cumulative_wins),
    cumulativeFailures: Number(row.cumulative_failures),
    ordinal: Number(row.ordinal),
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
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
 * Agent information within an issue.
 */
export type IssueAgent = {
  agentName: string
  status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'ignored'
  avatarUrl?: string | null
  displayName?: string | null
  slug?: string | null
}

/**
 * Issue with associated agents and PR counts.
 */
export type IssueWithAgents = {
  id: string
  linearKey: string
  title: string
  status: string | null
  url: string
  arenaReadyLabeledAt: Date | null
  agents: IssueAgent[]
  lastActivityAt: Date
  openPRCount: number
  mergedPRCount: number
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

/**
 * Fetches issues grouped with their agents and PR counts.
 * Returns issues ordered by most recent activity (attempt or arena_ready_labeled_at).
 *
 * This query:
 * - Groups issues with all agents working on them from issue_agents table
 * - Includes agent status (pending, submitted, accepted, rejected, ignored)
 * - Counts open and merged PRs per issue
 * - Orders by most recent activity first
 *
 * Agent statuses are determined by:
 * - pending: Agent assigned in issue_agents but no PR opened yet
 * - submitted: Agent has open PR(s)
 * - accepted: Agent has merged PR (winner)
 * - rejected: Agent has closed PR(s) without merge
 * - ignored: Agent assigned but never opened PR (same as pending for now)
 *
 * @param limit - Maximum number of issues to return (default: 30)
 * @returns Promise resolving to array of issues with agents
 *
 * @example
 * ```ts
 * const issues = await getIssuesWithAgents(30)
 * // [{ id: 'uuid', linearKey: 'ISSUE-123', agents: [{ agentName: 'cursor', status: 'submitted' }], ... }, ...]
 * ```
 */
export async function getIssuesWithAgents(
  limit: number = 30
): Promise<IssueWithAgents[]> {
  const result = await db.execute<{
    id: string
    linear_key: string
    title: string
    status: string | null
    url: string
    arena_ready_labeled_at: Date | null
    last_activity_at: Date
    open_pr_count: number
    merged_pr_count: number
    agents: Array<{
      agent_name: string
      status: string
      avatar_url: string | null
      display_name: string | null
      slug: string | null
    }>
  }>(sql`
    WITH issue_pr_counts AS (
      SELECT
        a.issue_id,
        COUNT(*) FILTER (WHERE a.status = 'open') AS open_pr_count,
        COUNT(*) FILTER (WHERE a.status = 'merged') AS merged_pr_count,
        MAX(a.opened_at) AS max_attempt_time
      FROM attempts a
      GROUP BY a.issue_id
    ),
    issue_agent_status AS (
      SELECT
        ia.issue_id,
        ia.agent_name,
        CASE
          WHEN i.winner_attempt_id IS NOT NULL AND wa.agent_name = ia.agent_name THEN 'accepted'
          WHEN EXISTS (
            SELECT 1 FROM attempts a
            WHERE a.issue_id = ia.issue_id
              AND a.agent_name = ia.agent_name
              AND a.status = 'merged'
          ) THEN 'accepted'
          WHEN EXISTS (
            SELECT 1 FROM attempts a
            WHERE a.issue_id = ia.issue_id
              AND a.agent_name = ia.agent_name
              AND a.status = 'open'
          ) THEN 'submitted'
          WHEN EXISTS (
            SELECT 1 FROM attempts a
            WHERE a.issue_id = ia.issue_id
              AND a.agent_name = ia.agent_name
              AND a.status = 'closed'
          ) THEN 'rejected'
          ELSE 'pending'
        END AS status,
        ag.avatar_url,
        ag.display_name,
        ag.slug
      FROM issue_agents ia
      INNER JOIN issues i ON i.id = ia.issue_id
      LEFT JOIN attempts wa ON wa.id = i.winner_attempt_id
      LEFT JOIN agents ag ON ia.agent_name = ag.name
    ),
    issue_agents_agg AS (
      SELECT
        issue_id,
        jsonb_agg(
          jsonb_build_object(
            'agent_name', agent_name,
            'status', status,
            'avatar_url', avatar_url,
            'display_name', display_name,
            'slug', slug
          )
          ORDER BY
            CASE status
              WHEN 'accepted' THEN 1
              WHEN 'submitted' THEN 2
              WHEN 'rejected' THEN 3
              WHEN 'pending' THEN 4
              ELSE 5
            END,
            agent_name
        ) AS agents
      FROM issue_agent_status
      GROUP BY issue_id
    )
    SELECT
      i.id,
      i.linear_key,
      i.title,
      i.status,
      i.url,
      i.arena_ready_labeled_at,
      COALESCE(ipc.max_attempt_time, i.arena_ready_labeled_at, i.created_at) AS last_activity_at,
      COALESCE(ipc.open_pr_count, 0)::int AS open_pr_count,
      COALESCE(ipc.merged_pr_count, 0)::int AS merged_pr_count,
      COALESCE(iaa.agents, '[]'::jsonb) AS agents
    FROM issues i
    LEFT JOIN issue_pr_counts ipc ON ipc.issue_id = i.id
    LEFT JOIN issue_agents_agg iaa ON iaa.issue_id = i.id
    WHERE i.arena_ready_labeled_at IS NOT NULL
    ORDER BY last_activity_at DESC
    LIMIT ${limit}
  `)

  return result.map((row) => {
    const agents = Array.isArray(row.agents)
      ? row.agents.map(
          (agent: {
            agent_name: string
            status: string
            avatar_url: string | null
            display_name: string | null
            slug: string | null
          }): IssueAgent => {
            const agentStatus = agent.status
            if (
              agentStatus !== 'pending' &&
              agentStatus !== 'submitted' &&
              agentStatus !== 'accepted' &&
              agentStatus !== 'rejected' &&
              agentStatus !== 'ignored'
            ) {
              throw new Error(`Invalid agent status: ${agentStatus}`)
            }
            return {
              agentName: agent.agent_name,
              status: agentStatus,
              avatarUrl: agent.avatar_url,
              displayName: agent.display_name,
              slug: agent.slug,
            }
          }
        )
      : []

    return {
      id: row.id,
      linearKey: row.linear_key,
      title: row.title,
      status: row.status,
      url: row.url,
      arenaReadyLabeledAt:
        row.arena_ready_labeled_at instanceof Date
          ? row.arena_ready_labeled_at
          : row.arena_ready_labeled_at
            ? new Date(row.arena_ready_labeled_at)
            : null,
      lastActivityAt:
        row.last_activity_at instanceof Date
          ? row.last_activity_at
          : new Date(row.last_activity_at),
      openPRCount: Number(row.open_pr_count),
      mergedPRCount: Number(row.merged_pr_count),
      agents,
    }
  })
}

/**
 * Gets all agent scores ordered by ordinal score (highest first).
 *
 * @returns Array of agent scores
 */
export async function getAgentScores(): Promise<AgentScore[]> {
  return db.select().from(agentScores).orderBy(desc(agentScores.ordinal))
}

/**
 * Gets score for a specific agent.
 *
 * @param agentName - Agent identifier
 * @returns Agent score or null if not found
 */
export async function getAgentScore(
  agentName: string
): Promise<AgentScore | null> {
  const result = await db
    .select()
    .from(agentScores)
    .where(eq(agentScores.agentName, agentName))
    .limit(1)

  return result[0] ?? null
}

/**
 * Gets rating history for a specific agent.
 *
 * @param agentName - Agent identifier
 * @param limit - Maximum number of records (default: 100)
 * @returns Array of historical scores ordered by completion date (newest first)
 */
export async function getAgentScoreHistory(
  agentName: string,
  limit = 100
): Promise<AgentScoreHistory[]> {
  return db
    .select()
    .from(agentScoreHistory)
    .where(eq(agentScoreHistory.agentName, agentName))
    .orderBy(desc(agentScoreHistory.completedAt))
    .limit(limit)
}

/**
 * Issue participation record with latest attempt details.
 */
export type IssueParticipationRecord = {
  agentName: string
  status: string
  triggeredAt: Date | null
  latestPrUrl: string | null
  latestPrStatus: string | null
  commitCount: number | null
}

/**
 * Get agent participation summary for an issue.
 * Includes both issueAgents status and latest attempt details.
 *
 * This query joins issueAgents with attempts to provide a comprehensive view of:
 * - Which agents are participating (from issueAgents table)
 * - Their overall status (pending, submitted, accepted, rejected)
 * - Details of their most recent PR (from attempts table)
 *
 * Use this when you need to display agent participation on an issue detail page.
 *
 * @param issueId - UUID of the issue
 * @returns Array of agent participation records with latest PR info
 *
 * @example
 * ```ts
 * const participation = await getIssueParticipation('issue-uuid')
 * // [
 * //   { agentName: 'cursor', status: 'submitted', latestPrUrl: '...', ... },
 * //   { agentName: 'engine', status: 'pending', latestPrUrl: null, ... }
 * // ]
 * ```
 */
export async function getIssueParticipation(
  issueId: string
): Promise<IssueParticipationRecord[]> {
  const result = await db.execute<{
    agent_name: string
    status: string
    triggered_at: Date | null
    latest_pr_url: string | null
    latest_pr_status: string | null
    commit_count: number | null
  }>(sql`
    SELECT
      ia.agent_name,
      ia.status,
      ia.triggered_at,
      a.pr_url AS latest_pr_url,
      a.status AS latest_pr_status,
      a.commit_count
    FROM issue_agents ia
    LEFT JOIN LATERAL (
      SELECT pr_url, status, commit_count
      FROM attempts
      WHERE attempts.issue_id = ia.issue_id
        AND attempts.agent_name = ia.agent_name
      ORDER BY opened_at DESC
      LIMIT 1
    ) a ON true
    WHERE ia.issue_id = ${issueId}
    ORDER BY ia.triggered_at ASC
  `)

  return result.map((row) => ({
    agentName: row.agent_name,
    status: row.status,
    triggeredAt: row.triggered_at,
    latestPrUrl: row.latest_pr_url,
    latestPrStatus: row.latest_pr_status,
    commitCount: row.commit_count !== null ? Number(row.commit_count) : null,
  }))
}

/**
 * Get full PR history for an agent on an issue.
 * Returns all attempts ordered by most recent first.
 *
 * This query retrieves the complete history of PR submissions from a specific agent
 * for a specific issue. Useful for tracking resubmissions and PR iterations.
 *
 * Use this when you need to see all PRs an agent has submitted, not just the latest one.
 *
 * @param issueId - UUID of the issue
 * @param agentName - Name of the agent (e.g., 'cursor', 'engine', 'cyrus')
 * @returns Array of attempts ordered by openedAt DESC
 *
 * @example
 * ```ts
 * const attempts = await getAgentAttempts('issue-uuid', 'cursor')
 * // [
 * //   { id: '...', prNumber: 3, status: 'open', openedAt: Date(2024-01-03), ... },
 * //   { id: '...', prNumber: 2, status: 'closed', openedAt: Date(2024-01-02), ... },
 * //   { id: '...', prNumber: 1, status: 'closed', openedAt: Date(2024-01-01), ... }
 * // ]
 * ```
 */
export async function getAgentAttempts(
  issueId: string,
  agentName: string
): Promise<Attempt[]> {
  return db
    .select()
    .from(attempts)
    .where(
      and(eq(attempts.issueId, issueId), eq(attempts.agentName, agentName))
    )
    .orderBy(desc(attempts.openedAt))
}
