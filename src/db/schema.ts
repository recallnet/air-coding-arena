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
  /** The unique database identifier for this issue */
  id: uuid('id').primaryKey().defaultRandom(),
  /** The unique Linear issue ID */
  linearId: text('linear_id').notNull().unique(),
  /** The human-readable Linear issue key (e.g., 'ENG-123') */
  linearKey: text('linear_key').notNull(),
  /** The issue title */
  title: text('title').notNull(),
  /** URL to view the issue in Linear */
  url: text('url').notNull(),
  /** The GitHub repository associated with this issue */
  repo: text('repo'),
  /** The current status of the issue in the arena */
  status: text('status'),

  // Metadata fields
  /** The issue description text */
  description: text('description'),
  /** The issue description in markdown format */
  descriptionMarkdown: text('description_markdown'),
  /** Estimated story points or time for the issue */
  estimate: integer('estimate'),
  /** Priority level from Linear (0-4) */
  priority: integer('priority'),
  /** JSON array of labels attached to the issue */
  labelsJson: jsonb('labels_json'),
  /** Linear ID of the assigned user */
  assigneeId: text('assignee_id'),
  /** Name of the assigned user */
  assigneeName: text('assignee_name'),
  /** Email of the assigned user */
  assigneeEmail: text('assignee_email'),
  /** Linear ID of the user who created the issue */
  creatorId: text('creator_id'),
  /** Name of the user who created the issue */
  creatorName: text('creator_name'),
  /** Email of the user who created the issue */
  creatorEmail: text('creator_email'),
  /** Linear ID of the project this issue belongs to */
  projectId: text('project_id'),
  /** Name of the project this issue belongs to */
  projectName: text('project_name'),
  /** Linear ID of the cycle/sprint this issue is in */
  cycleId: text('cycle_id'),
  /** Name of the cycle/sprint this issue is in */
  cycleName: text('cycle_name'),
  /** Sequential number of the cycle/sprint */
  cycleNumber: integer('cycle_number'),
  /** The due date for this issue */
  dueDate: timestamp('due_date', { withTimezone: true }),
  /** When the issue was created in Linear */
  linearCreatedAt: timestamp('linear_created_at', { withTimezone: true }),
  /** When the issue was last updated in Linear */
  linearUpdatedAt: timestamp('linear_updated_at', { withTimezone: true }),
  /** Linear ID of the parent issue if this is a sub-issue */
  parentId: text('parent_id'),

  // Original fields
  /** When the arena:ready label was added to the issue */
  arenaReadyLabeledAt: timestamp('arena_ready_labeled_at', {
    withTimezone: true,
  }),
  /** The ID of the winning attempt/PR for this issue */
  winnerAttemptId: uuid('winner_attempt_id'),
  /** When this record was created in the database */
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
    /** The unique database identifier for this attempt */
    id: uuid('id').primaryKey().defaultRandom(),
    /** Foreign key to the issue this attempt is for */
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    /** The name of the agent who made this attempt */
    agentName: text('agent_name').notNull(),
    /** The GitHub repository where the PR was created */
    repo: text('repo').notNull(),
    /** The GitHub pull request number */
    prNumber: integer('pr_number').notNull(),
    /** Full URL to the pull request on GitHub */
    prUrl: text('pr_url').notNull(),
    /** The git branch name for this PR */
    branch: text('branch'),
    /** When the PR was opened on GitHub */
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    /** When the PR was merged on GitHub */
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    /** When the PR was closed on GitHub */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** The current status of the PR (open, merged, or closed) */
    status: text('status').notNull(),
    /** Number of commits in the PR */
    commitCount: integer('commit_count').notNull().default(1),
    /** SHA hash of the most recent commit */
    lastCommitSha: text('last_commit_sha'),

    // CI Status tracking fields
    /** The current CI check status: pending, success, failure, error, or null */
    ciStatus: text('ci_status'),
    /** When the CI status was last updated */
    ciLastCheckedAt: timestamp('ci_last_checked_at', { withTimezone: true }),

    /** Linear attachment ID that linked this PR to the issue */
    sourceAttachmentId: text('source_attachment_id'),
    /** URL of the Linear attachment */
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
    /** The unique database identifier for this issue-agent relationship */
    id: uuid('id').primaryKey().defaultRandom(),
    /** Foreign key to the issue */
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    /** The name of the agent participating in this issue */
    agentName: text('agent_name').notNull(),
    /** The agent's status: pending, submitted, accepted, rejected, ignored, or dispatch_failed */
    status: text('status').notNull().default('pending'),
    /** External job/dispatch ID if agent was dispatched via external system */
    externalJobId: text('external_job_id'),
    /** When the agent was triggered/dispatched to work on this issue */
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
  /** The unique database identifier for this CI metrics record */
  id: uuid('id').primaryKey().defaultRandom(),
  /** Foreign key to the attempt this CI data is for */
  attemptId: uuid('attempt_id')
    .notNull()
    .references(() => attempts.id, { onDelete: 'cascade' }),
  /** Number of tests that passed in CI */
  testsPassed: integer('tests_passed'),
  /** Number of tests that failed in CI */
  testsFailed: integer('tests_failed'),
  /** Change in code coverage percentage compared to base branch */
  coverageDelta: real('coverage_delta'),
  /** Change in performance metrics in milliseconds */
  perfDeltaMs: real('perf_delta_ms'),
  /** Number of linting errors detected */
  lintErrors: integer('lint_errors'),
  /** Change in bundle/build size in bytes */
  sizeDeltaBytes: integer('size_delta_bytes'),
  /** Additional CI data stored as JSON */
  jsonBlob: jsonb('json_blob'),
})

/**
 * Agent scores table - stores current OpenSkill ratings per agent.
 * Contains the latest mu, sigma, and ordinal score for each agent.
 */
export const agentScores = pgTable('agent_scores', {
  /** The unique database identifier for this score record */
  id: uuid('id').primaryKey().defaultRandom(),
  /** The unique name of the agent */
  agentName: text('agent_name').notNull().unique(),
  /** OpenSkill mu parameter representing agent's estimated skill level */
  mu: real('mu').notNull().default(25.0),
  /** OpenSkill sigma parameter representing uncertainty in skill estimate */
  sigma: real('sigma').notNull().default(8.333),
  /** OpenSkill ordinal score (mu - 3*sigma) used for ranking */
  ordinal: real('ordinal').notNull().default(0.0),
  /** Total number of completed games/issues the agent has participated in */
  gamesPlayed: integer('games_played').notNull().default(0),
  /** When the score was last updated */
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** When this score record was created */
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Agent score history table - tracks rating changes over time.
 * Records mu, sigma, ordinal after each completed issue for analytics.
 */
export const agentScoreHistory = pgTable(
  'agent_score_history',
  {
    /** The unique database identifier for this history record */
    id: uuid('id').primaryKey().defaultRandom(),
    /** The name of the agent this history record is for */
    agentName: text('agent_name').notNull(),
    /** Foreign key to the issue that caused this score update */
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    /** OpenSkill mu parameter at this point in time */
    mu: real('mu').notNull(),
    /** OpenSkill sigma parameter at this point in time */
    sigma: real('sigma').notNull(),
    /** OpenSkill ordinal score at this point in time */
    ordinal: real('ordinal').notNull(),
    /** The agent's final rank in this issue (1 = winner, 2 = second place, etc.) */
    rank: integer('rank').notNull(),
    /** When the issue was completed */
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    /** When this history record was created */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Prevent double-scoring: one score entry per agent per issue
    uniqueAgentIssueScore: unique().on(table.issueId, table.agentName),
  })
)

/**
 * Events table - Idempotency and audit log.
 */
export const events = pgTable(
  'events',
  {
    /** The unique auto-incrementing identifier for this event */
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** The source system that generated this event (e.g., 'linear', 'github') */
    source: text('source').notNull(),
    /** Unique key for this event within its source (used for idempotency) */
    key: text('key').notNull(),
    /** The full event payload data stored as JSON */
    payload: jsonb('payload').notNull(),
    /** When this event was recorded */
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
    /** The unique database identifier for this agent */
    id: uuid('id').primaryKey().defaultRandom(),
    /** The unique name identifier for the agent (lowercase, no spaces) */
    name: text('name').notNull().unique(),
    /** URL-friendly slug for the agent */
    slug: text('slug').notNull().unique(),
    /** The agent's human-readable display name */
    displayName: text('display_name').notNull(),
    /** The agent's unique user ID in Linear */
    linearUserId: text('linear_user_id').notNull().unique(),
    /** The agent's email address */
    email: text('email'),
    /** URL to the agent's avatar image */
    avatarUrl: text('avatar_url'),
    /** Whether the agent is currently active in Linear workspace */
    isActive: boolean('is_active').notNull().default(true),
    /** Whether the agent is enabled to participate in the arena */
    isEnabled: boolean('is_enabled').notNull().default(true),
    /** When this agent was first discovered */
    discoveredAt: timestamp('discovered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When this agent was last seen active in Linear */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When this record was created */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When this record was last updated */
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
    /** Primary key, always 'singleton' to enforce single row */
    id: text('id')
      .primaryKey()
      .default(sql`'singleton'`),
    /** Agent selection mode: 'all' (all enabled agents), 'max_n' (limit to N agents), or 'manual' (no auto-discovery) */
    mode: text('mode').notNull().default('all'),
    /** Maximum number of agents to use when mode is 'max_n' */
    maxAgents: integer('max_agents'),
    /** When the last agent discovery was run */
    lastDiscoveryAt: timestamp('last_discovery_at', { withTimezone: true }),
    /** When this config was created */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When this config was last updated */
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
    /** The unique database identifier for this installation */
    id: uuid('id').primaryKey().defaultRandom(),
    /** GitHub's installation ID for this app installation */
    installationId: text('installation_id').notNull().unique(),
    /** The GitHub organization or user account ID */
    accountId: text('account_id').notNull(),
    /** The GitHub organization or user login name */
    accountLogin: text('account_login').notNull(),
    /** The account type: 'Organization' or 'User' */
    accountType: text('account_type').notNull(),
    /** Whether this installation is currently active */
    isActive: boolean('is_active').notNull().default(true),
    /** When the GitHub App was installed */
    installedAt: timestamp('installed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the installation was suspended, if applicable */
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    /** When this record was created */
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When this record was last updated */
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
  /** The winning attempt/PR for this issue, if one has been selected */
  winnerAttempt: one(attempts, {
    fields: [issues.winnerAttemptId],
    references: [attempts.id],
  }),
  /** All PR attempts submitted for this issue */
  attempts: many(attempts),
  /** All agents that were dispatched/mentioned for this issue */
  issueAgents: many(issueAgents),
}))

/**
 * Drizzle ORM relations definition for attempts table.
 * Defines foreign key relationships to issues (parent) and ciMetrics (children).
 */
export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  /** The issue this attempt is for */
  issue: one(issues, {
    fields: [attempts.issueId],
    references: [issues.id],
  }),
  /** CI metrics data for this attempt */
  ciMetrics: many(ciMetrics),
}))

/**
 * Drizzle ORM relations definition for issueAgents table.
 * Defines foreign key relationship to issues (parent).
 */
export const issueAgentsRelations = relations(issueAgents, ({ one }) => ({
  /** The issue this agent was dispatched for */
  issue: one(issues, {
    fields: [issueAgents.issueId],
    references: [issues.id],
  }),
}))

/**
 * Drizzle ORM relations definition for ciMetrics table.
 * Defines foreign key relationship to attempts (parent).
 */
export const ciMetricsRelations = relations(ciMetrics, ({ one }) => ({
  /** The PR attempt these CI metrics are for */
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
