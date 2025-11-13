import { relations, sql } from 'drizzle-orm'
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  jsonb,
  bigserial,
  unique,
  boolean,
  check,
  index,
} from 'drizzle-orm/pg-core'

/**
 * Issues table - Linear issues with arena:ready label.
 */
export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  linearId: text('linear_id').notNull().unique(),
  linearKey: text('linear_key').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  repo: text('repo'),
  status: text('status'),

  // Metadata fields
  description: text('description'),
  descriptionMarkdown: text('description_markdown'),
  estimate: integer('estimate'),
  priority: integer('priority'),
  labelsJson: jsonb('labels_json'),
  assigneeId: text('assignee_id'),
  assigneeName: text('assignee_name'),
  assigneeEmail: text('assignee_email'),
  creatorId: text('creator_id'),
  creatorName: text('creator_name'),
  creatorEmail: text('creator_email'),
  projectId: text('project_id'),
  projectName: text('project_name'),
  cycleId: text('cycle_id'),
  cycleName: text('cycle_name'),
  cycleNumber: integer('cycle_number'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  linearCreatedAt: timestamp('linear_created_at', { withTimezone: true }),
  linearUpdatedAt: timestamp('linear_updated_at', { withTimezone: true }),
  parentId: text('parent_id'),

  // Original fields
  arenaReadyLabeledAt: timestamp('arena_ready_labeled_at', {
    withTimezone: true,
  }),
  winnerAttemptId: uuid('winner_attempt_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Attempts table - Tracks individual PR submissions and their lifecycle.
 *
 * Each record represents one PR submission for an issue by an agent.
 * Contains detailed PR metrics including commit counts, CI status, and merge outcomes.
 *
 * Created by: Linear webhook when PR attachment added to issue
 * Updated by: GitHub webhook on PR events (synchronized, check_suite, closed)
 *
 * Relationship with issueAgents:
 * - Multiple attempts can exist for one issueAgent (PR resubmissions)
 * - attempt.status reflects outcome of that specific PR ('open' | 'merged' | 'closed')
 * - issueAgent.status is derived from attempt outcomes
 *
 * Data flow:
 * 1. Linear webhook receives attachment.create -> creates attempt with 'open' status
 * 2. GitHub webhook receives pull_request.synchronized -> updates commitCount
 * 3. GitHub webhook receives check_suite.completed -> updates ciStatus
 * 4. GitHub webhook receives pull_request.closed -> updates status to 'merged'/'closed'
 */
export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
    repo: text('repo').notNull(),
    prNumber: integer('pr_number').notNull(),
    prUrl: text('pr_url').notNull(),
    branch: text('branch'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    status: text('status').notNull(),
    commitCount: integer('commit_count').notNull().default(1),
    lastCommitSha: text('last_commit_sha'),

    // CI Status tracking fields
    ciStatus: text('ci_status'), // 'pending' | 'success' | 'failure' | 'error' | null
    ciLastCheckedAt: timestamp('ci_last_checked_at', { withTimezone: true }),

    sourceAttachmentId: text('source_attachment_id'),
    sourceAttachmentUrl: text('source_attachment_url'),
  },
  (table) => ({
    uniqueAttempt: unique().on(table.issueId, table.agentName, table.prNumber),
  })
)

/**
 * Issue Agents table - Tracks agent participation and dispatch on issues.
 *
 * Represents which agents were mentioned/dispatched for each issue.
 * This is the primary table for tracking agent involvement and final outcomes.
 *
 * Created by: Linear webhook when agent mentioned in issue comment
 * Updated by: updateAgentStatusOnPR() when PR is created/closed
 *
 * Relationship with attempts:
 * - One issueAgent record per (issue, agent) pair (enforced by unique constraint)
 * - Zero or more attempts per issueAgent (agent may not submit PR, or resubmit)
 * - issueAgent.status reflects final outcome for the agent on this issue
 * - attempts table contains detailed PR metrics and lifecycle events
 *
 * Status lifecycle:
 * - 'pending': Agent mentioned but no PR opened yet
 * - 'submitted': Agent has open PR (updated when first PR created)
 * - 'accepted': Agent's PR was merged (winner)
 * - 'rejected': Agent's PR(s) closed without merge
 * - 'ignored': Issue closed without agent submitting PR
 * - 'dispatch_failed': Failed to dispatch agent to issue
 *
 * Single source of truth for:
 * - Which agents were involved in an issue
 * - Overall win/loss outcome per agent per issue
 * - Agent dispatch timing and status
 */
export const issueAgents = pgTable(
  'issue_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
    status: text('status').notNull().default('pending'),
    externalJobId: text('external_job_id'),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueIssueAgent: unique().on(table.issueId, table.agentName),
  })
)

/**
 * CI metrics table - Optional CI data per attempt.
 */
export const ciMetrics = pgTable('ci_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' }),
  testsPassed: integer('tests_passed'),
  testsFailed: integer('tests_failed'),
  coverageDelta: real('coverage_delta'),
  perfDeltaMs: real('perf_delta_ms'),
  lintErrors: integer('lint_errors'),
  sizeDeltaBytes: integer('size_delta_bytes'),
  jsonBlob: jsonb('json_blob'),
})

/**
 * Agent scores table - stores current OpenSkill ratings per agent.
 * Contains the latest mu, sigma, and ordinal score for each agent.
 */
export const agentScores = pgTable('agent_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentName: text('agent_name').notNull().unique(),
  mu: real('mu').notNull().default(25.0),
  sigma: real('sigma').notNull().default(8.333),
  ordinal: real('ordinal').notNull().default(0.0),
  gamesPlayed: integer('games_played').notNull().default(0),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Agent score history table - tracks rating changes over time.
 * Records mu, sigma, ordinal after each completed issue for analytics.
 */
export const agentScoreHistory = pgTable('agent_score_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentName: text('agent_name').notNull(),
  issueId: uuid('issue_id')
    .notNull()
    .references(() => issues.id, { onDelete: 'cascade' }),
  mu: real('mu').notNull(),
  sigma: real('sigma').notNull(),
  ordinal: real('ordinal').notNull(),
  rank: integer('rank').notNull(), // 1 = winner, 2 = second place, etc.
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Events table - Idempotency and audit log.
 */
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    source: text('source').notNull(),
    key: text('key').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueEvent: unique().on(table.source, table.key),
  })
)

/**
 * Agents table - Discovered coding agents from Linear workspace.
 */
export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    displayName: text('display_name').notNull(),
    linearUserId: text('linear_user_id').notNull().unique(),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    isEnabled: boolean('is_enabled').notNull().default(true),
    discoveredAt: timestamp('discovered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    isEnabledIdx: index('idx_agents_enabled').on(table.isEnabled),
    isActiveIdx: index('idx_agents_active').on(table.isActive),
  })
)

/**
 * Agent config table - Singleton table for agent configuration.
 */
export const agentConfig = pgTable(
  'agent_config',
  {
    id: text('id')
      .primaryKey()
      .default(sql`'singleton'`),
    mode: text('mode').notNull().default('all'),
    maxAgents: integer('max_agents'),
    lastDiscoveryAt: timestamp('last_discovery_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    singletonCheck: check('single_row', sql`${table.id} = 'singleton'`),
    validModeCheck: check(
      'valid_mode',
      sql`${table.mode} IN ('all', 'max_n', 'manual')`
    ),
    validMaxAgentsCheck: check(
      'valid_max_agents',
      sql`${table.maxAgents} IS NULL OR ${table.maxAgents} >= 2`
    ),
  })
)

/**
 * GitHub App installations table - Tracks installed organizations.
 * One row per organization where the GitHub App is installed.
 */
export const githubAppInstallations = pgTable(
  'github_app_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installationId: text('installation_id').notNull().unique(), // GitHub's installation ID
    accountId: text('account_id').notNull(), // Organization/user ID
    accountLogin: text('account_login').notNull(), // Organization/user login name
    accountType: text('account_type').notNull(), // 'Organization' or 'User'
    isActive: boolean('is_active').notNull().default(true),
    installedAt: timestamp('installed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    installationIdIdx: index('idx_gh_installation_id').on(table.installationId),
    isActiveIdx: index('idx_gh_installation_active').on(table.isActive),
  })
)

/**
 * TypeScript types for GitHub App installations
 */
export type GitHubAppInstallation = typeof githubAppInstallations.$inferSelect

/**
 * TypeScript type for new GitHub App installation
 */
export type NewGitHubAppInstallation =
  typeof githubAppInstallations.$inferInsert

/**
 * Relations for type-safe joins.
 */
export const issuesRelations = relations(issues, ({ one, many }) => ({
  winnerAttempt: one(attempts, {
    fields: [issues.winnerAttemptId],
    references: [attempts.id],
  }),
  attempts: many(attempts),
  issueAgents: many(issueAgents),
}))

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  issue: one(issues, {
    fields: [attempts.issueId],
    references: [issues.id],
  }),
  ciMetrics: many(ciMetrics),
}))

export const issueAgentsRelations = relations(issueAgents, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAgents.issueId],
    references: [issues.id],
  }),
}))

export const ciMetricsRelations = relations(ciMetrics, ({ one }) => ({
  attempt: one(attempts, {
    fields: [ciMetrics.attemptId],
    references: [attempts.id],
  }),
}))

/**
 * TypeScript types for database tables
 */

/**
 * Agent type - represents a discovered coding agent from Linear
 */
export type Agent = typeof agents.$inferSelect

/**
 * NewAgent type - represents data needed to create a new agent
 */
export type NewAgent = typeof agents.$inferInsert

/**
 * AgentConfig type - represents agent configuration singleton
 */
export type AgentConfig = typeof agentConfig.$inferSelect

/**
 * NewAgentConfig type - represents data needed to create/update agent config
 */
export type NewAgentConfig = typeof agentConfig.$inferInsert
