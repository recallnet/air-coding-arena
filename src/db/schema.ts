import { relations } from 'drizzle-orm'
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
  arenaReadyLabeledAt: timestamp('arena_ready_labeled_at', {
    withTimezone: true,
  }),
  winnerAttemptId: uuid('winner_attempt_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Attempts table - Each PR opened by an agent for an issue.
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
  },
  (table) => ({
    uniqueAttempt: unique().on(table.issueId, table.agentName, table.prNumber),
  })
)

/**
 * Issue agents table - Dispatch bookkeeping.
 */
export const issueAgents = pgTable(
  'issue_agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    agentName: text('agent_name').notNull(),
    status: text('status').notNull(),
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
