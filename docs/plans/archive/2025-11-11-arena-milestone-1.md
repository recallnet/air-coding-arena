# Arena Dashboard - Milestone 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a UI-first Arena dashboard showing agent performance metrics (Cursor, Engine, Cyrus) using seeded data from Linear export, running locally with Neon Postgres.

**Architecture:** Next.js 15 App Router with Drizzle ORM for type-safe Postgres access, shadcn/ui components, Server Components for data fetching, demo mode with realistic seeded data from Linear API export.

**Tech Stack:** Next.js 15, Drizzle ORM, Neon Postgres, shadcn/ui, Tailwind CSS, TypeScript (strict mode), Vitest

---

## Task 1: Install Dependencies & Configure Database

**Files:**
- Modify: `package.json`
- Create: `src/db/client.ts`
- Modify: `.env.local`
- Create: `drizzle.config.ts`

**Step 1: Install Drizzle ORM and dependencies**

Run:
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit @types/pg
```

Expected: Dependencies installed successfully

**Step 2: Update .env.local with all required variables**

Add to `.env.local`:
```bash
# Database (already present)
DATABASE_URL=postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-misty-poetry-a4ukdnof-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Linear API (already added)
LINEAR_API_KEY=REDACTED_REVOKE_BEFORE_USE

# Mode Configuration
ARENA_MODE=demo
NODE_ENV=development
ARENA_LABEL=arena:ready
ALLOWED_REPOS=org/frontend,org/api

# Seeding
ARENA_SEED_SOURCE=fixtures
SEED_DAYS=30
LINEAR_TEAM_KEYS=ENG,APP
```

**Step 3: Create database client singleton**

Create `src/db/client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

/**
 * Postgres client connection.
 * Uses connection pooling via Neon.
 */
const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

/**
 * Drizzle database instance.
 * Singleton pattern - only one instance created.
 */
export const db = drizzle(client)
```

**Step 4: Create Drizzle config**

Create `drizzle.config.ts`:
```typescript
import type { Config } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config
```

**Step 5: Add database scripts to package.json**

Add to `package.json` scripts section:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:push": "drizzle-kit push",
  "db:seed": "tsx scripts/seed.ts",
  "db:reset": "tsx scripts/reset-db.ts"
}
```

Also install tsx for running TypeScript scripts:
```bash
npm install -D tsx
```

**Step 6: Commit**

Run:
```bash
git add package.json package-lock.json .env.local src/db/client.ts drizzle.config.ts
git commit -m "chore: add Drizzle ORM and database configuration

- Install drizzle-orm, postgres, drizzle-kit
- Create database client singleton
- Add Drizzle config for Neon Postgres
- Add database management scripts

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Define Database Schema with Drizzle

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/types/database.ts`

**Step 1: Create Drizzle schema matching project-2.md DDL**

Create `src/db/schema.ts`:
```typescript
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
```

**Step 2: Create TypeScript types for database entities**

Create `src/types/database.ts`:
```typescript
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
```

**Step 3: Export database types from centralized types**

Add to `src/types/index.ts`:
```typescript
export type * from './database'
```

**Step 4: Generate migration**

Run:
```bash
npm run db:generate
```

Expected: Migration files created in `./drizzle` directory

**Step 5: Push schema to Neon database**

Run:
```bash
npm run db:push
```

Expected: Tables created in Neon Postgres

**Step 6: Commit**

Run:
```bash
git add src/db/schema.ts src/types/database.ts src/types/index.ts drizzle/
git commit -m "feat: add Drizzle database schema

- Define all tables: issues, attempts, issue_agents, ci_metrics, events
- Add relations for type-safe joins
- Export TypeScript types from schema
- Generate and apply initial migration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Create Agent Stats View in Database

**Files:**
- Create: `drizzle/manual-migrations/001-agent-stats-view.sql`
- Create: `scripts/run-manual-migration.ts`

**Step 1: Create manual migration for agent_stats view**

Create `drizzle/manual-migrations/001-agent-stats-view.sql`:
```sql
-- Agent stats materialized view for leaderboard
CREATE VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(*) AS attempts,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct
FROM attempts
GROUP BY agent_name;
```

**Step 2: Create script to run manual migrations**

Create `scripts/run-manual-migration.ts`:
```typescript
import { sql } from 'drizzle-orm'
import { db } from '../src/db/client'
import fs from 'fs'
import path from 'path'

/**
 * Run manual SQL migrations that Drizzle can't generate.
 * Used for views, functions, triggers, etc.
 */
async function runManualMigrations() {
  const migrationsDir = path.join(
    process.cwd(),
    'drizzle',
    'manual-migrations'
  )

  if (!fs.existsSync(migrationsDir)) {
    console.log('No manual migrations directory found')
    return
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    console.log(`Running manual migration: ${file}`)
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')

    try {
      await db.execute(sql.raw(content))
      console.log(`✓ ${file} completed`)
    } catch (error) {
      console.error(`✗ ${file} failed:`, error)
      throw error
    }
  }

  console.log('All manual migrations completed')
}

runManualMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
```

**Step 3: Add script to package.json**

Add to scripts:
```json
{
  "db:migrate:manual": "tsx scripts/run-manual-migration.ts"
}
```

**Step 4: Run manual migration**

Run:
```bash
npm run db:migrate:manual
```

Expected: View created successfully

**Step 5: Commit**

Run:
```bash
git add drizzle/manual-migrations/ scripts/run-manual-migration.ts package.json
git commit -m "feat: add agent_stats database view

- Create SQL view for agent leaderboard aggregations
- Add script to run manual migrations
- View calculates attempts, wins, acceptance %

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create Linear Export Script

**Files:**
- Create: `scripts/export-linear.ts`
- Create: `fixtures/.gitignore`

**Step 1: Install Linear SDK**

Run:
```bash
npm install @linear/sdk
```

**Step 2: Create Linear export script**

Create `scripts/export-linear.ts`:
```typescript
import { LinearClient } from '@linear/sdk'
import fs from 'fs'
import path from 'path'

if (!process.env.LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not set in environment')
  process.exit(1)
}

const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
})

/**
 * Export Linear issues to fixtures for seeding.
 * Fetches issues from specified teams in the last N days.
 */
async function exportLinearIssues() {
  console.log('🔍 Fetching Linear issues...')

  const teamKeys = (process.env.LINEAR_TEAM_KEYS || 'ENG').split(',')
  const days = parseInt(process.env.SEED_DAYS || '30', 10)
  const since = new Date()
  since.setDate(since.getDate() - days)

  const allIssues: any[] = []

  for (const teamKey of teamKeys) {
    console.log(`📋 Fetching team: ${teamKey}`)

    try {
      const team = await linear.team(teamKey)

      if (!team) {
        console.warn(`⚠️  Team ${teamKey} not found, skipping`)
        continue
      }

      const issues = await linear.issues({
        filter: {
          team: { key: { eq: teamKey } },
          createdAt: { gte: since },
        },
        includeArchived: false,
      })

      let count = 0
      for await (const issue of issues) {
        // Only include issues with some basic data
        if (issue.title && issue.identifier) {
          allIssues.push({
            linear_id: issue.id,
            linear_key: issue.identifier,
            title: issue.title,
            url: issue.url,
            repo: null, // Will be assigned during seeding
            status: issue.state?.name || 'Backlog',
            created_at: issue.createdAt,
            // Simulate arena:ready label (we'll mark ~30% as ready)
            arena_ready_labeled_at:
              Math.random() > 0.7 ? issue.createdAt : null,
          })
          count++
        }
      }

      console.log(`✓ Exported ${count} issues from ${teamKey}`)
    } catch (error) {
      console.error(`✗ Error fetching team ${teamKey}:`, error)
    }
  }

  // Sort by date
  allIssues.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Create fixtures directory
  const fixturesDir = path.join(process.cwd(), 'fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  // Write to file
  const outputPath = path.join(fixturesDir, 'linear-issues.json')
  fs.writeFileSync(outputPath, JSON.stringify(allIssues, null, 2))

  console.log(`\n✅ Exported ${allIssues.length} issues to ${outputPath}`)
  console.log(
    `   Issues with arena:ready: ${allIssues.filter((i) => i.arena_ready_labeled_at).length}`
  )
}

exportLinearIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Export failed:', error)
    process.exit(1)
  })
```

**Step 3: Create fixtures .gitignore**

Create `fixtures/.gitignore`:
```
# Ignore generated fixture data (may contain sensitive info)
*.json

# But keep the directory
!.gitignore
```

**Step 4: Add export script to package.json**

Add to scripts:
```json
{
  "linear:export": "tsx scripts/export-linear.ts"
}
```

**Step 5: Run export script**

Run:
```bash
npm run linear:export
```

Expected: `fixtures/linear-issues.json` created with real Linear data

**Step 6: Verify export**

Run:
```bash
cat fixtures/linear-issues.json | head -50
```

Expected: JSON with Linear issues displayed

**Step 7: Commit**

Run:
```bash
git add scripts/export-linear.ts fixtures/.gitignore package.json package-lock.json
git commit -m "feat: add Linear export script

- Create script to export issues from Linear API
- Fetch issues from last 30 days by team
- Simulate arena:ready label on 30% of issues
- Export to fixtures/linear-issues.json
- Add fixtures to .gitignore

⚠️  WARNING: fixtures/linear-issues.json is gitignored and must be regenerated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Create Database Seeding Logic

**Files:**
- Create: `src/lib/seed/generate-attempts.ts`
- Create: `src/lib/seed/generate-ci-metrics.ts`
- Create: `scripts/seed.ts`
- Create: `scripts/reset-db.ts`

**Step 1: Create attempt generation logic**

Create `src/lib/seed/generate-attempts.ts`:
```typescript
import type { NewAttempt, NewCiMetric, AgentName } from '@/types'

/**
 * Configuration for attempt generation.
 */
export type AttemptConfig = {
  issueId: string
  linearKey: string
  repo: string
  arenaReadyLabeledAt: Date
}

/**
 * Generate realistic attempts for an issue.
 * Creates 1-3 attempts (one per agent) with plausible timestamps and outcomes.
 */
export function generateAttempts(config: AttemptConfig): NewAttempt[] {
  const agents: AgentName[] = ['cursor', 'engine', 'cyrus']

  // Shuffle agents for randomness
  const shuffled = agents.sort(() => Math.random() - 0.5)

  // Randomly decide how many agents attempted (1-3)
  const numAttempts = Math.floor(Math.random() * 3) + 1
  const attemptingAgents = shuffled.slice(0, numAttempts)

  const attempts: NewAttempt[] = []
  let prNumberBase = Math.floor(Math.random() * 5000) + 1000

  for (let i = 0; i < attemptingAgents.length; i++) {
    const agent = attemptingAgents[i]!
    const prNumber = prNumberBase + i

    // First attempt opens 30min to 2 days after label
    // Subsequent attempts open progressively later
    const minDelay = 30 * 60 * 1000 + i * 12 * 60 * 60 * 1000 // 30min + (i * 12h)
    const maxDelay = 2 * 24 * 60 * 60 * 1000 + i * 24 * 60 * 60 * 1000 // 2d + (i * 1d)
    const delay = Math.random() * (maxDelay - minDelay) + minDelay

    const openedAt = new Date(
      config.arenaReadyLabeledAt.getTime() + delay
    )

    // Randomly decide if merged (50% chance for first attempt, 20% for others)
    const isMerged = i === 0 ? Math.random() > 0.5 : Math.random() > 0.8

    const status: 'open' | 'merged' | 'closed' = isMerged
      ? 'merged'
      : Math.random() > 0.3
        ? 'closed'
        : 'open'

    const commitCount = Math.floor(Math.random() * 7) + 1

    const slug = config.linearKey
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
    const branch = `${slug}--fix--agent-${agent}`

    const attempt: NewAttempt = {
      issueId: config.issueId,
      agentName: agent,
      repo: config.repo,
      prNumber,
      prUrl: `https://github.com/${config.repo}/pull/${prNumber}`,
      branch,
      openedAt,
      status,
      commitCount,
      lastCommitSha: `${Math.random().toString(36).substring(2, 10)}abcdef`,
    }

    if (status === 'merged') {
      // Merged 1-5 days after opening
      const mergeDelay = Math.random() * 4 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000
      attempt.mergedAt = new Date(openedAt.getTime() + mergeDelay)
    } else if (status === 'closed') {
      // Closed 1-7 days after opening
      const closeDelay = Math.random() * 6 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000
      attempt.closedAt = new Date(openedAt.getTime() + closeDelay)
    }

    attempts.push(attempt)
  }

  return attempts
}
```

**Step 2: Create CI metrics generation logic**

Create `src/lib/seed/generate-ci-metrics.ts`:
```typescript
import type { NewCiMetric } from '@/types'

/**
 * Generate realistic CI metrics for an attempt.
 * Creates plausible test, coverage, performance, and size data.
 */
export function generateCiMetrics(attemptId: string): NewCiMetric {
  const testsPassed = Math.floor(Math.random() * 800) + 200
  const testsFailed = Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0

  const coverageDelta = (Math.random() - 0.3) * 5 // -1.5 to +3.5
  const perfDeltaMs = (Math.random() - 0.6) * 20 // -12 to +8ms
  const lintErrors = Math.random() > 0.9 ? Math.floor(Math.random() * 3) : 0
  const sizeDeltaBytes = Math.floor((Math.random() - 0.4) * 5000) // -2000 to +3000

  return {
    attemptId,
    testsPassed,
    testsFailed,
    coverageDelta: Number(coverageDelta.toFixed(1)),
    perfDeltaMs: Number(perfDeltaMs.toFixed(1)),
    lintErrors,
    sizeDeltaBytes,
    jsonBlob: null,
  }
}
```

**Step 3: Create main seed script**

Create `scripts/seed.ts`:
```typescript
import { db } from '../src/db/client'
import { issues, attempts, issueAgents, ciMetrics } from '../src/db/schema'
import { generateAttempts } from '../src/lib/seed/generate-attempts'
import { generateCiMetrics } from '../src/lib/seed/generate-ci-metrics'
import fs from 'fs'
import path from 'path'
import { eq } from 'drizzle-orm'

/**
 * Seed database with realistic demo data.
 * Reads from fixtures/linear-issues.json and generates attempts/CI metrics.
 */
async function seed() {
  console.log('🌱 Seeding database...')

  // Read fixtures
  const fixturesPath = path.join(process.cwd(), 'fixtures', 'linear-issues.json')

  if (!fs.existsSync(fixturesPath)) {
    console.error('❌ fixtures/linear-issues.json not found')
    console.error('   Run: npm run linear:export')
    process.exit(1)
  }

  const linearIssues = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'))
  console.log(`📋 Found ${linearIssues.length} issues in fixtures`)

  // Assign repos (simple round-robin)
  const repos = (process.env.ALLOWED_REPOS || 'org/frontend,org/api').split(',')

  let issueCount = 0
  let attemptCount = 0
  let ciMetricCount = 0

  for (const linearIssue of linearIssues) {
    const repo = repos[issueCount % repos.length]!

    // Insert issue
    const [insertedIssue] = await db
      .insert(issues)
      .values({
        linearId: linearIssue.linear_id,
        linearKey: linearIssue.linear_key,
        title: linearIssue.title,
        url: linearIssue.url,
        repo,
        status: linearIssue.status,
        arenaReadyLabeledAt: linearIssue.arena_ready_labeled_at
          ? new Date(linearIssue.arena_ready_labeled_at)
          : null,
        createdAt: new Date(linearIssue.created_at),
      })
      .returning()

    issueCount++

    // Only generate attempts for issues with arena:ready label
    if (!insertedIssue?.arenaReadyLabeledAt) {
      continue
    }

    // Generate attempts
    const generatedAttempts = generateAttempts({
      issueId: insertedIssue.id,
      linearKey: insertedIssue.linearKey,
      repo,
      arenaReadyLabeledAt: insertedIssue.arenaReadyLabeledAt,
    })

    // Insert attempts
    const insertedAttempts = await db
      .insert(attempts)
      .values(generatedAttempts)
      .returning()

    attemptCount += insertedAttempts.length

    // Find winner (first merged attempt)
    const winner = insertedAttempts.find((a) => a.status === 'merged')

    if (winner) {
      await db
        .update(issues)
        .set({ winnerAttemptId: winner.id })
        .where(eq(issues.id, insertedIssue.id))
    }

    // Generate issue_agents rows for each unique agent
    const uniqueAgents = [
      ...new Set(generatedAttempts.map((a) => a.agentName)),
    ]

    await db.insert(issueAgents).values(
      uniqueAgents.map((agentName) => ({
        issueId: insertedIssue.id,
        agentName,
        status: 'triggered' as const,
        triggeredAt: insertedIssue.arenaReadyLabeledAt,
      }))
    )

    // Generate CI metrics (80% of attempts have metrics)
    for (const attempt of insertedAttempts) {
      if (Math.random() > 0.2) {
        await db.insert(ciMetrics).values(generateCiMetrics(attempt.id))
        ciMetricCount++
      }
    }
  }

  console.log(`\n✅ Seeding complete:`)
  console.log(`   ${issueCount} issues`)
  console.log(`   ${attemptCount} attempts`)
  console.log(`   ${ciMetricCount} CI metrics`)
  console.log(
    `\n⚠️  WARNING: This is DEMO data generated from fixtures/linear-issues.json`
  )
  console.log(
    `   PRs and branches are synthetic. Replace with live webhooks in M2/M3.`
  )
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error)
    process.exit(1)
  })
```

**Step 4: Create database reset script**

Create `scripts/reset-db.ts`:
```typescript
import { sql } from 'drizzle-orm'
import { db } from '../src/db/client'

/**
 * Reset database by dropping and recreating all tables.
 * USE WITH CAUTION - destroys all data.
 */
async function resetDatabase() {
  console.log('⚠️  Resetting database (dropping all tables)...')

  const tables = [
    'ci_metrics',
    'issue_agents',
    'attempts',
    'issues',
    'events',
    'agent_stats',
  ]

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`))
      console.log(`✓ Dropped ${table}`)
    } catch (error) {
      // Ignore errors for views
      if (table === 'agent_stats') {
        await db.execute(sql.raw(`DROP VIEW IF EXISTS ${table} CASCADE`))
        console.log(`✓ Dropped view ${table}`)
      } else {
        console.error(`✗ Error dropping ${table}:`, error)
      }
    }
  }

  console.log('\n✅ Database reset complete')
  console.log('   Run: npm run db:push && npm run db:migrate:manual && npm run db:seed')
}

resetDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Reset failed:', error)
    process.exit(1)
  })
```

**Step 5: Test the full reset and seed flow**

Run:
```bash
npm run db:reset
npm run db:push
npm run db:migrate:manual
npm run db:seed
```

Expected: Database reset, schema created, view added, data seeded

**Step 6: Commit**

Run:
```bash
git add src/lib/seed/ scripts/seed.ts scripts/reset-db.ts
git commit -m "feat: add database seeding logic

- Generate realistic attempts (1-3 per issue)
- Generate plausible CI metrics
- Main seed script reads from fixtures
- Reset script for clean database state
- Assigns repos, winners, timestamps

⚠️  WARNING: All PR URLs and branches are SYNTHETIC DEMO DATA
    Replace with live GitHub webhooks in Milestone 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Install and Configure shadcn/ui

**Files:**
- Modify: `package.json`
- Create: `components.json`
- Modify: `tailwind.config.ts`
- Create: `src/lib/utils.ts`

**Step 1: Initialize shadcn/ui**

Run:
```bash
npx shadcn@latest init
```

When prompted, choose:
- TypeScript: Yes
- Style: Default
- Base color: Slate
- CSS variables: Yes
- Tailwind config: tailwind.config.ts
- Components: src/components
- Utils: src/lib/utils.ts
- React Server Components: Yes
- Write config: Yes

**Step 2: Install initial components**

Run:
```bash
npx shadcn@latest add button card table badge separator
```

Expected: Components added to `src/components/ui/`

**Step 3: Verify utils were created**

Check that `src/lib/utils.ts` exists with `cn` helper

**Step 4: Commit**

Run:
```bash
git add components.json src/components/ui/ src/lib/utils.ts tailwind.config.ts package.json package-lock.json
git commit -m "feat: add shadcn/ui component library

- Initialize shadcn/ui with default config
- Add button, card, table, badge, separator components
- Configure Tailwind with CSS variables
- Add cn utility for className merging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Create Database Query Functions

**Files:**
- Create: `src/db/queries/agents.ts`
- Create: `src/db/queries/issues.ts`
- Create: `src/db/queries/stats.ts`
- Create: `src/types/queries.ts`

**Step 1: Create agent query functions**

Create `src/db/queries/agents.ts`:
```typescript
import { db } from '../client'
import { sql, and, gte, lte, inArray } from 'drizzle-orm'
import { attempts } from '../schema'
import type { AgentName } from '@/types'

/**
 * Agent statistics from database view.
 */
export type AgentStats = {
  agentName: AgentName
  attempts: number
  wins: number
  acceptancePct: number
}

/**
 * Get agent leaderboard stats.
 * Reads from agent_stats view with optional filters.
 */
export async function getAgentStats(filters?: {
  from?: Date
  to?: Date
  repo?: string
}): Promise<AgentStats[]> {
  const conditions = []

  if (filters?.from) {
    conditions.push(gte(attempts.openedAt, filters.from))
  }

  if (filters?.to) {
    conditions.push(lte(attempts.openedAt, filters.to))
  }

  if (filters?.repo) {
    conditions.push(sql`${attempts.repo} = ${filters.repo}`)
  }

  // If filters applied, calculate from attempts table
  // Otherwise use pre-computed view
  if (conditions.length > 0) {
    const results = await db
      .select({
        agentName: attempts.agentName,
        attempts: sql<number>`COUNT(*)::int`,
        wins: sql<number>`COUNT(*) FILTER (WHERE status='merged')::int`,
        acceptancePct: sql<number>`ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1)`,
      })
      .from(attempts)
      .where(and(...conditions))
      .groupBy(attempts.agentName)

    return results.map((r) => ({
      agentName: r.agentName as AgentName,
      attempts: r.attempts,
      wins: r.wins,
      acceptancePct: Number(r.acceptancePct),
    }))
  }

  // Use view for unfiltered query
  const results = await db.execute<AgentStats>(
    sql`SELECT agent_name as "agentName", attempts, wins, acceptance_pct as "acceptancePct" FROM agent_stats`
  )

  return results.rows
}

/**
 * Get average time-to-PR for an agent.
 * Time from arena:ready label to first PR opened.
 */
export async function getAvgTimeToPR(
  agentName: AgentName,
  filters?: { from?: Date; to?: Date }
): Promise<number | null> {
  const conditions = [sql`${attempts.agentName} = ${agentName}`]

  if (filters?.from) {
    conditions.push(gte(attempts.openedAt, filters.from))
  }

  if (filters?.to) {
    conditions.push(lte(attempts.openedAt, filters.to))
  }

  const result = await db
    .select({
      avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${attempts.openedAt} - issues.arena_ready_labeled_at)) / 60)`,
    })
    .from(attempts)
    .innerJoin(sql`issues`, sql`attempts.issue_id = issues.id`)
    .where(and(...conditions))

  return result[0]?.avgMinutes ?? null
}

/**
 * Get average time-to-merge for an agent.
 * Time from PR opened to merged (only for merged PRs).
 */
export async function getAvgTimeToMerge(
  agentName: AgentName,
  filters?: { from?: Date; to?: Date }
): Promise<number | null> {
  const conditions = [
    sql`${attempts.agentName} = ${agentName}`,
    sql`${attempts.status} = 'merged'`,
  ]

  if (filters?.from) {
    conditions.push(gte(attempts.openedAt, filters.from))
  }

  if (filters?.to) {
    conditions.push(lte(attempts.openedAt, filters.to))
  }

  const result = await db
    .select({
      avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${attempts.mergedAt} - ${attempts.openedAt})) / 60)`,
    })
    .from(attempts)
    .where(and(...conditions))

  return result[0]?.avgMinutes ?? null
}
```

**Step 2: Create issue query functions**

Create `src/db/queries/issues.ts`:
```typescript
import { db } from '../client'
import { sql, and, gte, lte, eq, desc } from 'drizzle-orm'
import { issues, attempts, ciMetrics } from '../schema'
import type { Issue, Attempt, CiMetric } from '@/types'

/**
 * Issue with attempts and winner info.
 */
export type IssueWithDetails = Issue & {
  attempts: (Attempt & { ciMetrics: CiMetric | null })[]
  winnerAttempt: Attempt | null
}

/**
 * Get paginated issues list with filters.
 */
export async function getIssues(filters?: {
  from?: Date
  to?: Date
  repo?: string
  status?: string
  hasWinner?: boolean
  limit?: number
  offset?: number
}): Promise<Issue[]> {
  const conditions = []

  if (filters?.from) {
    conditions.push(gte(issues.createdAt, filters.from))
  }

  if (filters?.to) {
    conditions.push(lte(issues.createdAt, filters.to))
  }

  if (filters?.repo) {
    conditions.push(eq(issues.repo, filters.repo))
  }

  if (filters?.status) {
    conditions.push(eq(issues.status, filters.status))
  }

  if (filters?.hasWinner !== undefined) {
    if (filters.hasWinner) {
      conditions.push(sql`${issues.winnerAttemptId} IS NOT NULL`)
    } else {
      conditions.push(sql`${issues.winnerAttemptId} IS NULL`)
    }
  }

  const query = db
    .select()
    .from(issues)
    .where(and(...conditions))
    .orderBy(desc(issues.createdAt))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0)

  return await query
}

/**
 * Get issue detail with all attempts and CI metrics.
 */
export async function getIssueDetail(
  linearKey: string
): Promise<IssueWithDetails | null> {
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.linearKey, linearKey))
    .limit(1)

  if (!issue) return null

  const issueAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issue.id))
    .orderBy(attempts.openedAt)

  const attemptsWithMetrics = await Promise.all(
    issueAttempts.map(async (attempt) => {
      const [metrics] = await db
        .select()
        .from(ciMetrics)
        .where(eq(ciMetrics.attemptId, attempt.id))
        .limit(1)

      return {
        ...attempt,
        ciMetrics: metrics ?? null,
      }
    })
  )

  let winnerAttempt = null
  if (issue.winnerAttemptId) {
    const [winner] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, issue.winnerAttemptId))
      .limit(1)

    winnerAttempt = winner ?? null
  }

  return {
    ...issue,
    attempts: attemptsWithMetrics,
    winnerAttempt,
  }
}
```

**Step 3: Create stats query functions**

Create `src/db/queries/stats.ts`:
```typescript
import { db } from '../client'
import { sql, and, gte, lte } from 'drizzle-orm'
import { attempts, issues } from '../schema'

/**
 * Overall dashboard KPIs.
 */
export type DashboardStats = {
  totalIssues: number
  totalAttempts: number
  totalMerged: number
  avgTimeToPR: number | null
  avgTimeToMerge: number | null
}

/**
 * Get overall dashboard statistics.
 */
export async function getDashboardStats(filters?: {
  from?: Date
  to?: Date
}): Promise<DashboardStats> {
  const conditions = []

  if (filters?.from) {
    conditions.push(gte(issues.createdAt, filters.from))
  }

  if (filters?.to) {
    conditions.push(lte(issues.createdAt, filters.to))
  }

  const [statsResult] = await db
    .select({
      totalIssues: sql<number>`COUNT(DISTINCT ${issues.id})::int`,
      totalAttempts: sql<number>`COUNT(${attempts.id})::int`,
      totalMerged: sql<number>`COUNT(*) FILTER (WHERE ${attempts.status}='merged')::int`,
    })
    .from(issues)
    .leftJoin(attempts, eq(attempts.issueId, issues.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  // Calculate time-to-PR
  const [timeToPRResult] = await db
    .select({
      avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${attempts.openedAt} - ${issues.arenaReadyLabeledAt})) / 60)`,
    })
    .from(attempts)
    .innerJoin(issues, eq(attempts.issueId, issues.id))
    .where(
      and(
        sql`${issues.arenaReadyLabeledAt} IS NOT NULL`,
        ...(conditions.length > 0 ? conditions : [])
      )
    )

  // Calculate time-to-merge
  const [timeToMergeResult] = await db
    .select({
      avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${attempts.mergedAt} - ${attempts.openedAt})) / 60)`,
    })
    .from(attempts)
    .where(
      and(
        eq(attempts.status, 'merged'),
        ...(conditions.length > 0 ? conditions : [])
      )
    )

  return {
    totalIssues: statsResult?.totalIssues ?? 0,
    totalAttempts: statsResult?.totalAttempts ?? 0,
    totalMerged: statsResult?.totalMerged ?? 0,
    avgTimeToPR: timeToPRResult?.avgMinutes ?? null,
    avgTimeToMerge: timeToMergeResult?.avgMinutes ?? null,
  }
}
```

**Step 4: Create query result types**

Create `src/types/queries.ts`:
```typescript
/**
 * Query result types.
 *
 * @packageDocumentation
 */

export type { AgentStats } from '@/db/queries/agents'
export type { IssueWithDetails } from '@/db/queries/issues'
export type { DashboardStats } from '@/db/queries/stats'
```

Add to `src/types/index.ts`:
```typescript
export type * from './queries'
```

**Step 5: Commit**

Run:
```bash
git add src/db/queries/ src/types/queries.ts src/types/index.ts
git commit -m "feat: add database query functions

- Agent stats with filtering (from view or computed)
- Issue list with pagination and filters
- Issue detail with attempts and CI metrics
- Dashboard KPI aggregations
- Time-to-PR and time-to-merge calculations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Create Dashboard Home Page (Leaderboard)

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/AgentLeaderboard.tsx`
- Create: `src/components/DashboardKPIs.tsx`

**Step 1: Create KPI cards component**

Create `src/components/DashboardKPIs.tsx`:
```typescript
import { Card } from '@/components/ui/card'
import type { DashboardStats } from '@/types'

/**
 * Dashboard KPI card props.
 */
type DashboardKPIsProps = {
  /** Statistics to display */
  stats: DashboardStats
}

/**
 * Format minutes to human-readable time.
 */
function formatTime(minutes: number | null): string {
  if (minutes === null) return 'N/A'

  if (minutes < 60) {
    return `${Math.round(minutes)}m`
  }

  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)

  if (hours < 24) {
    return `${hours}h ${mins}m`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return `${days}d ${remainingHours}h`
}

/**
 * Display dashboard KPI cards.
 * Shows overall statistics for the filtered time range.
 *
 * @param props - Component props
 * @returns KPI cards
 */
export function DashboardKPIs({ stats }: DashboardKPIsProps): React.JSX.Element {
  const acceptanceRate =
    stats.totalAttempts > 0
      ? Math.round((stats.totalMerged / stats.totalAttempts) * 100)
      : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Total Issues
        </div>
        <div className="text-3xl font-bold">{stats.totalIssues}</div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Total Attempts
        </div>
        <div className="text-3xl font-bold">{stats.totalAttempts}</div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Merged PRs
        </div>
        <div className="text-3xl font-bold">{stats.totalMerged}</div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Avg Time to PR
        </div>
        <div className="text-3xl font-bold">
          {formatTime(stats.avgTimeToPR)}
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Avg Time to Merge
        </div>
        <div className="text-3xl font-bold">
          {formatTime(stats.avgTimeToMerge)}
        </div>
      </Card>
    </div>
  )
}
```

**Step 2: Create agent leaderboard component**

Create `src/components/AgentLeaderboard.tsx`:
```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { AgentStats } from '@/types'
import Link from 'next/link'

/**
 * Agent leaderboard props.
 */
type AgentLeaderboardProps = {
  /** Agent statistics */
  stats: AgentStats[]
}

/**
 * Agent badge with color coding.
 */
function AgentBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    cursor: 'bg-blue-500',
    engine: 'bg-purple-500',
    cyrus: 'bg-green-500',
  }

  const color = colors[name.toLowerCase()] ?? 'bg-gray-500'

  return (
    <Badge className={`${color} text-white hover:${color}`}>
      {name.charAt(0).toUpperCase() + name.slice(1)}
    </Badge>
  )
}

/**
 * Display agent leaderboard table.
 * Shows attempts, wins, and acceptance rate per agent.
 *
 * @param props - Component props
 * @returns Leaderboard table
 */
export function AgentLeaderboard({
  stats,
}: AgentLeaderboardProps): React.JSX.Element {
  // Sort by acceptance rate descending
  const sorted = [...stats].sort((a, b) => b.acceptancePct - a.acceptancePct)

  if (stats.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No agent data available for this time range.
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            <TableHead className="text-right">Wins</TableHead>
            <TableHead className="text-right">Acceptance %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((agent) => (
            <TableRow key={agent.agentName}>
              <TableCell>
                <Link
                  href={`/agents/${agent.agentName}`}
                  className="hover:underline"
                >
                  <AgentBadge name={agent.agentName} />
                </Link>
              </TableCell>
              <TableCell className="text-right">{agent.attempts}</TableCell>
              <TableCell className="text-right">{agent.wins}</TableCell>
              <TableCell className="text-right font-semibold">
                {agent.acceptancePct}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 3: Update home page to use dashboard components**

Replace `src/app/page.tsx`:
```typescript
import { getDashboardStats } from '@/db/queries/stats'
import { getAgentStats } from '@/db/queries/agents'
import { DashboardKPIs } from '@/components/DashboardKPIs'
import { AgentLeaderboard } from '@/components/AgentLeaderboard'

/**
 * Arena Dashboard home page.
 * Displays agent leaderboard and overall KPIs.
 *
 * @returns Home page
 */
export default async function Home(): Promise<React.JSX.Element> {
  const [stats, agentStats] = await Promise.all([
    getDashboardStats(),
    getAgentStats(),
  ])

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Arena Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          AI coding agent performance metrics
        </p>
        {process.env.ARENA_MODE === 'demo' && (
          <div className="mt-4 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            ⚠️ <strong>Demo Mode:</strong> Displaying seeded data from fixtures.
            No live webhooks active.
          </div>
        )}
      </div>

      <div className="space-y-8">
        <DashboardKPIs stats={stats} />

        <div>
          <h2 className="text-2xl font-semibold mb-4">Agent Leaderboard</h2>
          <AgentLeaderboard stats={agentStats} />
        </div>
      </div>
    </main>
  )
}
```

**Step 4: Test the dashboard**

Run:
```bash
npm run dev
```

Open http://localhost:3109 and verify:
- KPI cards display with correct numbers
- Agent leaderboard shows all agents
- Demo mode warning displays
- Links to agent detail pages (will create later)

**Step 5: Commit**

Run:
```bash
git add src/app/page.tsx src/components/DashboardKPIs.tsx src/components/AgentLeaderboard.tsx
git commit -m "feat: add dashboard home page with leaderboard

- Display overall KPIs (issues, attempts, merged, times)
- Agent leaderboard table with sorting
- Color-coded agent badges
- Demo mode warning banner
- Server Component with data fetching

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Create Issues List Page

**Files:**
- Create: `src/app/issues/page.tsx`
- Create: `src/components/IssuesList.tsx`
- Create: `src/components/IssuesFilters.tsx`

**Step 1: Create issues filters component**

Create `src/components/IssuesFilters.tsx`:
```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * Issues list filters.
 * Client component for URL state management.
 *
 * @returns Filter controls
 */
export function IssuesFilters(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleDateRange = (days: number) => {
    const params = new URLSearchParams(searchParams.toString())
    const from = new Date()
    from.setDate(from.getDate() - days)
    params.set('from', from.toISOString())
    params.delete('to')
    router.push(`/issues?${params.toString()}`)
  }

  const handleClearFilters = () => {
    router.push('/issues')
  }

  const activeDays = searchParams.get('from')
    ? Math.round(
        (Date.now() - new Date(searchParams.get('from')!).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={activeDays === 7 ? 'default' : 'outline'}
        onClick={() => handleDateRange(7)}
      >
        Last 7 days
      </Button>
      <Button
        variant={activeDays === 30 ? 'default' : 'outline'}
        onClick={() => handleDateRange(30)}
      >
        Last 30 days
      </Button>
      <Button
        variant={activeDays === 90 ? 'default' : 'outline'}
        onClick={() => handleDateRange(90)}
      >
        Last 90 days
      </Button>
      {searchParams.toString() && (
        <Button variant="ghost" onClick={handleClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  )
}
```

**Step 2: Create issues list component**

Create `src/components/IssuesList.tsx`:
```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Issue } from '@/types'
import Link from 'next/link'

/**
 * Issues list props.
 */
type IssuesListProps = {
  /** Issues to display */
  issues: Issue[]
}

/**
 * Status badge with color coding.
 */
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">Unknown</Badge>

  const colors: Record<string, string> = {
    Backlog: 'bg-gray-500',
    Todo: 'bg-blue-500',
    'In Progress': 'bg-yellow-500',
    'In Review': 'bg-purple-500',
    Done: 'bg-green-500',
    Canceled: 'bg-red-500',
  }

  const color = colors[status] ?? 'bg-gray-500'

  return <Badge className={`${color} text-white`}>{status}</Badge>
}

/**
 * Format date to relative time.
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'N/A'

  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/**
 * Display issues list table.
 * Filterable and links to issue detail pages.
 *
 * @param props - Component props
 * @returns Issues table
 */
export function IssuesList({ issues }: IssuesListProps): React.JSX.Element {
  if (issues.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">No issues found</h3>
        <p className="text-muted-foreground">
          Label any Linear issue with <code className="px-1 py-0.5 bg-muted rounded">arena:ready</code> to trigger agent attempts.
          This dashboard shows results once PRs are opened.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue Key</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Repo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.id}>
              <TableCell className="font-mono">
                <Link
                  href={`/issues/${issue.linearKey}`}
                  className="hover:underline"
                >
                  {issue.linearKey}
                </Link>
              </TableCell>
              <TableCell className="max-w-md truncate">
                {issue.title}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{issue.repo ?? 'N/A'}</Badge>
              </TableCell>
              <TableCell>
                <StatusBadge status={issue.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeTime(issue.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 3: Create issues page**

Create `src/app/issues/page.tsx`:
```typescript
import { getIssues } from '@/db/queries/issues'
import { IssuesList } from '@/components/IssuesList'
import { IssuesFilters } from '@/components/IssuesFilters'
import Link from 'next/link'

/**
 * Issues list page search params.
 */
type IssuesPageProps = {
  searchParams: Promise<{
    from?: string
    to?: string
    repo?: string
    status?: string
  }>
}

/**
 * Issues list page.
 * Displays all issues with filtering options.
 *
 * @param props - Page props with search params
 * @returns Issues page
 */
export default async function IssuesPage(
  props: IssuesPageProps
): Promise<React.JSX.Element> {
  const searchParams = await props.searchParams
  const filters = {
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(searchParams.to) : undefined,
    repo: searchParams.repo,
    status: searchParams.status,
  }

  const issues = await getIssues(filters)

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Issues</h1>
            <p className="text-muted-foreground mt-2">
              All issues labeled with arena:ready
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <IssuesFilters />
        <IssuesList issues={issues} />
      </div>
    </main>
  )
}
```

**Step 4: Test issues page**

Open http://localhost:3109/issues and verify:
- Issues list displays
- Filters work (last 7/30/90 days)
- Issue keys link to detail pages (will create next)
- Empty state shows if no issues

**Step 5: Commit**

Run:
```bash
git add src/app/issues/page.tsx src/components/IssuesList.tsx src/components/IssuesFilters.tsx
git commit -m "feat: add issues list page

- Display filterable issues table
- Date range filters (7/30/90 days)
- Status badges and relative timestamps
- Links to issue detail pages
- Empty state with instructions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Create Issue Detail Page

**Files:**
- Create: `src/app/issues/[key]/page.tsx`
- Create: `src/components/IssueDetail.tsx`
- Create: `src/components/AttemptsTimeline.tsx`

**Step 1: Create attempts timeline component**

Create `src/components/AttemptsTimeline.tsx`:
```typescript
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { Attempt, CiMetric } from '@/types'

/**
 * Attempt with CI metrics.
 */
type AttemptWithMetrics = Attempt & {
  ciMetrics: CiMetric | null
}

/**
 * Attempts timeline props.
 */
type AttemptsTimelineProps = {
  /** Attempts to display */
  attempts: AttemptWithMetrics[]
}

/**
 * Agent badge helper.
 */
function AgentBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    cursor: 'bg-blue-500',
    engine: 'bg-purple-500',
    cyrus: 'bg-green-500',
  }

  const color = colors[name.toLowerCase()] ?? 'bg-gray-500'

  return (
    <Badge className={`${color} text-white`}>
      {name.charAt(0).toUpperCase() + name.slice(1)}
    </Badge>
  )
}

/**
 * Status badge helper.
 */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-500',
    merged: 'bg-green-500',
    closed: 'bg-gray-500',
  }

  const color = colors[status] ?? 'bg-gray-500'

  return <Badge className={`${color} text-white`}>{status}</Badge>
}

/**
 * Format date.
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Display attempts timeline for an issue.
 * Shows all PR attempts with metadata and CI metrics.
 *
 * @param props - Component props
 * @returns Attempts timeline
 */
export function AttemptsTimeline({
  attempts,
}: AttemptsTimelineProps): React.JSX.Element {
  if (attempts.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No attempts yet. Waiting for agents to open PRs.
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {attempts.map((attempt, index) => (
        <Card key={attempt.id} className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AgentBadge name={attempt.agentName} />
                  <StatusBadge status={attempt.status} />
                  {attempt.status === 'merged' && (
                    <Badge variant="outline" className="border-green-500 text-green-600">
                      Winner
                    </Badge>
                  )}
                </div>
                <a
                  href={attempt.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold hover:underline"
                >
                  PR #{attempt.prNumber}
                </a>
              </div>
            </div>

            <Separator />

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Branch:</span>
                <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">
                  {attempt.branch}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground">Commits:</span>
                <span className="ml-2 font-semibold">
                  {attempt.commitCount}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Opened:</span>
                <span className="ml-2">{formatDate(attempt.openedAt)}</span>
              </div>
              {attempt.mergedAt && (
                <div>
                  <span className="text-muted-foreground">Merged:</span>
                  <span className="ml-2">{formatDate(attempt.mergedAt)}</span>
                </div>
              )}
              {attempt.closedAt && !attempt.mergedAt && (
                <div>
                  <span className="text-muted-foreground">Closed:</span>
                  <span className="ml-2">{formatDate(attempt.closedAt)}</span>
                </div>
              )}
            </div>

            {/* CI Metrics */}
            {attempt.ciMetrics && (
              <>
                <Separator />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tests:</span>
                    <span className="ml-2">
                      <span className="text-green-600">
                        {attempt.ciMetrics.testsPassed} passed
                      </span>
                      {attempt.ciMetrics.testsFailed! > 0 && (
                        <>
                          {' / '}
                          <span className="text-red-600">
                            {attempt.ciMetrics.testsFailed} failed
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Coverage:</span>
                    <span
                      className={`ml-2 ${
                        attempt.ciMetrics.coverageDelta! > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {attempt.ciMetrics.coverageDelta! > 0 ? '+' : ''}
                      {attempt.ciMetrics.coverageDelta}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Perf:</span>
                    <span
                      className={`ml-2 ${
                        attempt.ciMetrics.perfDeltaMs! < 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {attempt.ciMetrics.perfDeltaMs! > 0 ? '+' : ''}
                      {attempt.ciMetrics.perfDeltaMs}ms
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
```

**Step 2: Create issue detail component**

Create `src/components/IssueDetail.tsx`:
```typescript
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { IssueWithDetails } from '@/types'

/**
 * Issue detail props.
 */
type IssueDetailProps = {
  /** Issue with attempts */
  issue: IssueWithDetails
}

/**
 * Format date.
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Display issue header details.
 *
 * @param props - Component props
 * @returns Issue detail header
 */
export function IssueDetail({ issue }: IssueDetailProps): React.JSX.Element {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {issue.linearKey}
              </span>
              {issue.repo && <Badge variant="outline">{issue.repo}</Badge>}
              {issue.status && <Badge>{issue.status}</Badge>}
            </div>
            <h1 className="text-2xl font-bold">{issue.title}</h1>
          </div>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View in Linear →
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Created:</span>
            <span className="ml-2">{formatDate(issue.createdAt)}</span>
          </div>
          {issue.arenaReadyLabeledAt && (
            <div>
              <span className="text-muted-foreground">Arena Ready:</span>
              <span className="ml-2">
                {formatDate(issue.arenaReadyLabeledAt)}
              </span>
            </div>
          )}
        </div>

        {issue.winnerAttempt && (
          <div className="pt-4 border-t">
            <span className="text-sm font-semibold text-green-600">
              ✓ Winner: {issue.winnerAttempt.agentName}
            </span>
            <a
              href={issue.winnerAttempt.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-sm text-blue-600 hover:underline"
            >
              PR #{issue.winnerAttempt.prNumber} →
            </a>
          </div>
        )}
      </div>
    </Card>
  )
}
```

**Step 3: Create issue detail page**

Create `src/app/issues/[key]/page.tsx`:
```typescript
import { getIssueDetail } from '@/db/queries/issues'
import { IssueDetail } from '@/components/IssueDetail'
import { AttemptsTimeline } from '@/components/AttemptsTimeline'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * Issue detail page props.
 */
type IssueDetailPageProps = {
  params: Promise<{
    key: string
  }>
}

/**
 * Issue detail page.
 * Displays full issue information with attempts timeline.
 *
 * @param props - Page props with issue key
 * @returns Issue detail page
 */
export default async function IssueDetailPage(
  props: IssueDetailPageProps
): Promise<React.JSX.Element> {
  const params = await props.params
  const issue = await getIssueDetail(params.key)

  if (!issue) {
    notFound()
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Link
          href="/issues"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Issues
        </Link>
      </div>

      <div className="space-y-8">
        <IssueDetail issue={issue} />

        <div>
          <h2 className="text-2xl font-semibold mb-4">
            Attempts ({issue.attempts.length})
          </h2>
          <AttemptsTimeline attempts={issue.attempts} />
        </div>
      </div>
    </main>
  )
}
```

**Step 4: Test issue detail page**

Open http://localhost:3109/issues and click an issue key, verify:
- Issue header displays correctly
- Attempts timeline shows all PRs
- CI metrics display
- Winner badge shows for merged attempts
- Links work

**Step 5: Commit**

Run:
```bash
git add src/app/issues/[key]/ src/components/IssueDetail.tsx src/components/AttemptsTimeline.tsx
git commit -m "feat: add issue detail page

- Display issue header with metadata
- Attempts timeline with PR info
- CI metrics visualization
- Winner indication
- Links to Linear and GitHub

⚠️  WARNING: PR URLs and branches are SYNTHETIC
    Generated during seeding, not real GitHub data

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Create Agent Detail Page

**Files:**
- Create: `src/app/agents/[name]/page.tsx`
- Create: `src/components/AgentDetail.tsx`
- Create: `src/components/AgentAttempts.tsx`

**Step 1: Create agent attempts table component**

Create `src/components/AgentAttempts.tsx`:
```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Attempt } from '@/types'
import Link from 'next/link'

/**
 * Agent attempts props.
 */
type AgentAttemptsProps = {
  /** Attempts by this agent */
  attempts: (Attempt & { issueKey: string })[]
}

/**
 * Status badge helper.
 */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-500',
    merged: 'bg-green-500',
    closed: 'bg-gray-500',
  }

  const color = colors[status] ?? 'bg-gray-500'

  return <Badge className={`${color} text-white`}>{status}</Badge>
}

/**
 * Format date.
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Display agent's recent attempts.
 *
 * @param props - Component props
 * @returns Attempts table
 */
export function AgentAttempts({
  attempts,
}: AgentAttemptsProps): React.JSX.Element {
  if (attempts.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No attempts found for this agent in the selected time range.
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue</TableHead>
            <TableHead>PR</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Commits</TableHead>
            <TableHead>Opened</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attempts.map((attempt) => (
            <TableRow key={attempt.id}>
              <TableCell className="font-mono">
                <Link
                  href={`/issues/${attempt.issueKey}`}
                  className="hover:underline"
                >
                  {attempt.issueKey}
                </Link>
              </TableCell>
              <TableCell>
                <a
                  href={attempt.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-blue-600"
                >
                  #{attempt.prNumber}
                </a>
              </TableCell>
              <TableCell>
                <StatusBadge status={attempt.status} />
              </TableCell>
              <TableCell>{attempt.commitCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(attempt.openedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Create agent detail component**

Create `src/components/AgentDetail.tsx`:
```typescript
import { Card } from '@/components/ui/card'
import type { AgentStats } from '@/types'

/**
 * Agent detail props.
 */
type AgentDetailProps = {
  /** Agent name */
  name: string
  /** Agent statistics */
  stats: AgentStats
  /** Average time to PR (minutes) */
  avgTimeToPR: number | null
  /** Average time to merge (minutes) */
  avgTimeToMerge: number | null
}

/**
 * Format time in minutes to human-readable.
 */
function formatTime(minutes: number | null): string {
  if (minutes === null) return 'N/A'

  if (minutes < 60) {
    return `${Math.round(minutes)}m`
  }

  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)

  if (hours < 24) {
    return `${hours}h ${mins}m`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return `${days}d ${remainingHours}h`
}

/**
 * Display agent KPI cards.
 *
 * @param props - Component props
 * @returns Agent detail cards
 */
export function AgentDetail({
  name,
  stats,
  avgTimeToPR,
  avgTimeToMerge,
}: AgentDetailProps): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Total Attempts
        </div>
        <div className="text-3xl font-bold">{stats.attempts}</div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">Wins</div>
        <div className="text-3xl font-bold">{stats.wins}</div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Acceptance Rate
        </div>
        <div className="text-3xl font-bold">{stats.acceptancePct}%</div>
      </Card>

      <Card className="p-6">
        <div className="text-sm font-medium text-muted-foreground">
          Avg Time to PR
        </div>
        <div className="text-2xl font-bold">{formatTime(avgTimeToPR)}</div>
      </Card>
    </div>
  )
}
```

**Step 3: Create agent detail page**

Create `src/app/agents/[name]/page.tsx`:
```typescript
import { getAgentStats, getAvgTimeToPR, getAvgTimeToMerge } from '@/db/queries/agents'
import { db } from '@/db/client'
import { attempts, issues } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { AgentDetail } from '@/components/AgentDetail'
import { AgentAttempts } from '@/components/AgentAttempts'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { AgentName } from '@/types'

/**
 * Agent detail page props.
 */
type AgentDetailPageProps = {
  params: Promise<{
    name: string
  }>
}

/**
 * Validate agent name.
 */
function isValidAgent(name: string): name is AgentName {
  return ['cursor', 'engine', 'cyrus'].includes(name.toLowerCase())
}

/**
 * Agent detail page.
 * Displays agent statistics and recent attempts.
 *
 * @param props - Page props with agent name
 * @returns Agent detail page
 */
export default async function AgentDetailPage(
  props: AgentDetailPageProps
): Promise<React.JSX.Element> {
  const params = await props.params
  const agentName = params.name.toLowerCase()

  if (!isValidAgent(agentName)) {
    notFound()
  }

  const [allStats, avgTimeToPR, avgTimeToMerge] = await Promise.all([
    getAgentStats(),
    getAvgTimeToPR(agentName),
    getAvgTimeToMerge(agentName),
  ])

  const stats = allStats.find((s) => s.agentName === agentName)

  if (!stats) {
    notFound()
  }

  // Get recent attempts
  const agentAttempts = await db
    .select({
      id: attempts.id,
      issueId: attempts.issueId,
      agentName: attempts.agentName,
      repo: attempts.repo,
      prNumber: attempts.prNumber,
      prUrl: attempts.prUrl,
      branch: attempts.branch,
      openedAt: attempts.openedAt,
      mergedAt: attempts.mergedAt,
      closedAt: attempts.closedAt,
      status: attempts.status,
      commitCount: attempts.commitCount,
      lastCommitSha: attempts.lastCommitSha,
      issueKey: issues.linearKey,
    })
    .from(attempts)
    .innerJoin(issues, eq(attempts.issueId, issues.id))
    .where(eq(attempts.agentName, agentName))
    .orderBy(desc(attempts.openedAt))
    .limit(50)

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight capitalize">
              {agentName}
            </h1>
            <p className="text-muted-foreground mt-2">Agent performance metrics</p>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        <AgentDetail
          name={agentName}
          stats={stats}
          avgTimeToPR={avgTimeToPR}
          avgTimeToMerge={avgTimeToMerge}
        />

        <div>
          <h2 className="text-2xl font-semibold mb-4">Recent Attempts</h2>
          <AgentAttempts attempts={agentAttempts} />
        </div>
      </div>
    </main>
  )
}
```

**Step 4: Test agent detail page**

Open http://localhost:3109/agents/cursor and verify:
- Agent KPIs display correctly
- Recent attempts table shows
- Links to issues work
- PR links work

Test other agents: `/agents/engine`, `/agents/cyrus`

**Step 5: Commit**

Run:
```bash
git add src/app/agents/ src/components/AgentDetail.tsx src/components/AgentAttempts.tsx
git commit -m "feat: add agent detail page

- Display agent KPIs (attempts, wins, acceptance %, times)
- Recent attempts table
- Links to issues and PRs
- Validate agent names

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Add Navigation and Layout

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/Navigation.tsx`
- Create: `src/components/Footer.tsx`

**Step 1: Create navigation component**

Create `src/components/Navigation.tsx`:
```typescript
import Link from 'next/link'

/**
 * Main navigation component.
 * Displays site-wide navigation links.
 *
 * @returns Navigation bar
 */
export function Navigation(): React.JSX.Element {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Arena
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium hover:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/issues"
              className="text-sm font-medium hover:underline"
            >
              Issues
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
```

**Step 2: Create footer component**

Create `src/components/Footer.tsx`:
```typescript
/**
 * Site footer component.
 * Shows demo mode badge and attribution.
 *
 * @returns Footer
 */
export function Footer(): React.JSX.Element {
  const isDemoMode = process.env.ARENA_MODE === 'demo'

  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {isDemoMode && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                Demo Mode (seeded fixtures)
              </span>
            )}
          </div>
          <div>Arena Dashboard - Milestone 1</div>
        </div>
      </div>
    </footer>
  )
}
```

**Step 3: Update root layout**

Update `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Navigation } from '@/components/Navigation'
import { Footer } from '@/components/Footer'

import './globals.css'

const inter = Inter({ subsets: ['latin'] })

/**
 * Root layout metadata configuration.
 */
export const metadata: Metadata = {
  title: 'Arena Dashboard',
  description: 'AI coding agent performance tracking',
}

/**
 * Root layout component for the application.
 *
 * @param props - Component props
 * @param props.children - Child components to render
 * @returns The root layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  )
}
```

**Step 4: Test navigation**

Open http://localhost:3109 and verify:
- Navigation bar appears on all pages
- Links work correctly
- Footer shows demo mode badge
- Responsive layout works

**Step 5: Commit**

Run:
```bash
git add src/app/layout.tsx src/components/Navigation.tsx src/components/Footer.tsx
git commit -m "feat: add navigation and footer

- Site-wide navigation bar
- Footer with demo mode indicator
- Update root layout
- Responsive design

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Final Testing and Documentation

**Files:**
- Create: `docs/MILESTONE-1-COMPLETE.md`
- Modify: `README.md`

**Step 1: Run full validation**

Run:
```bash
npm run validate
```

Expected: All checks pass (type-check, lint, test, format)

**Step 2: Test all pages**

Manually test:
- http://localhost:3109 - Dashboard loads with data
- http://localhost:3109/issues - Issues list works
- http://localhost:3109/issues/[any-key] - Issue detail works
- http://localhost:3109/agents/cursor - Agent detail works
- http://localhost:3109/agents/engine - Agent detail works
- http://localhost:3109/agents/cyrus - Agent detail works

**Step 3: Create milestone completion document**

Create `docs/MILESTONE-1-COMPLETE.md`:
```markdown
# Milestone 1: UI-First Dashboard - COMPLETE ✅

**Completion Date:** 2025-11-11

## Implemented Features

### ✅ Database Layer
- Drizzle ORM with Neon Postgres
- All tables: issues, attempts, issue_agents, ci_metrics, events
- agent_stats view for leaderboard
- Type-safe queries with full TypeScript coverage

### ✅ Data Seeding
- Linear API export script (real data)
- Synthetic attempt generation (1-3 per issue)
- Realistic CI metrics
- Database reset and reseed commands

### ✅ UI Components
- shadcn/ui component library
- Dashboard home with KPIs and leaderboard
- Issues list with filtering
- Issue detail with attempts timeline
- Agent detail with statistics
- Navigation and footer

### ✅ Quality Gates
- 100% TypeScript type coverage
- Zero ESLint warnings
- All tests passing
- Formatted with Prettier
- Husky pre-commit hooks active

## Demo Data Warnings

⚠️ **The following data is SYNTHETIC and generated during seeding:**

1. **PR URLs**: All GitHub PR links are fabricated
   - Format: `https://github.com/{repo}/pull/{number}`
   - Numbers are random, PRs don't exist
   - Will be replaced with real PRs in Milestone 2

2. **Branch Names**: Generated from Linear keys
   - Format: `{key}--fix--agent-{name}`
   - Not real git branches
   - Will be created by agents in Milestone 3

3. **Commit Counts**: Random numbers (1-7)
   - Will be real counts from GitHub API in M2

4. **CI Metrics**: Random but plausible values
   - Will be real CI data from webhooks in M2

5. **Attempt Timestamps**: Synthetic relative to issue creation
   - Will be real PR opened/merged times in M2

## Console Warnings

During seeding and page loads, you will see:

```
⚠️ WARNING: This is DEMO data generated from fixtures/linear-issues.json
   PRs and branches are synthetic. Replace with live webhooks in M2/M3.
```

These are intentional reminders that this is demo mode.

## Verification Checklist

- [x] Database schema deployed to Neon
- [x] Linear export script works (fixtures/linear-issues.json)
- [x] Seed script populates database
- [x] Dashboard displays agent leaderboard
- [x] Issues list shows all issues
- [x] Issue detail shows attempts timeline
- [x] Agent detail shows statistics
- [x] All links work correctly
- [x] Demo mode warning displays
- [x] Type coverage 100%
- [x] ESLint zero warnings
- [x] All tests passing
- [x] Husky hooks active

## Next Steps: Milestone 2

To enable live PR tracking:

1. Implement GitHub webhook endpoint (`/api/github/webhook`)
2. Deploy to Vercel
3. Configure GitHub webhook in repo settings
4. Set `ARENA_MODE=live`
5. PRs will automatically populate `attempts` table
6. Dashboard will show real-time data

## Commands Reference

```bash
# Development
npm run dev                    # Start dev server (port 3109)

# Database
npm run db:push                # Push schema to Neon
npm run db:migrate:manual      # Run manual migrations (views)
npm run db:seed                # Seed with fixtures
npm run db:reset               # Drop all tables

# Linear
npm run linear:export          # Export issues from Linear API

# Quality
npm run validate               # Run all quality checks
npm run type-check             # TypeScript + type coverage
npm run lint                   # ESLint (zero warnings)
npm run test                   # Tests with 90% coverage
npm run format:check           # Prettier check
```

## Environment Variables

Required in `.env.local`:

```bash
DATABASE_URL=postgresql://...         # Neon connection string
LINEAR_API_KEY=lin_api_...           # Linear API key
ARENA_MODE=demo                       # Demo mode (no webhooks)
NODE_ENV=development                  # Development mode
ARENA_LABEL=arena:ready              # Label name (display only)
ALLOWED_REPOS=org/frontend,org/api   # Repo list (for seeding)
ARENA_SEED_SOURCE=fixtures           # Use fixtures for seeding
SEED_DAYS=30                         # Days to look back in export
LINEAR_TEAM_KEYS=ENG,APP             # Linear teams to export
```

## Files Structure

```
coding-arena/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Dashboard home
│   │   ├── issues/
│   │   │   ├── page.tsx       # Issues list
│   │   │   └── [key]/page.tsx # Issue detail
│   │   └── agents/
│   │       └── [name]/page.tsx # Agent detail
│   ├── components/             # React components
│   │   ├── ui/                # shadcn/ui
│   │   ├── Navigation.tsx
│   │   ├── Footer.tsx
│   │   ├── DashboardKPIs.tsx
│   │   ├── AgentLeaderboard.tsx
│   │   ├── IssuesList.tsx
│   │   ├── IssuesFilters.tsx
│   │   ├── IssueDetail.tsx
│   │   ├── AttemptsTimeline.tsx
│   │   ├── AgentDetail.tsx
│   │   └── AgentAttempts.tsx
│   ├── db/
│   │   ├── client.ts          # Database singleton
│   │   ├── schema.ts          # Drizzle schema
│   │   └── queries/           # Query functions
│   ├── lib/
│   │   ├── seed/              # Seeding logic
│   │   └── utils.ts           # Utilities
│   └── types/                 # TypeScript types
├── scripts/
│   ├── export-linear.ts       # Linear export
│   ├── seed.ts                # Database seeding
│   ├── reset-db.ts            # Database reset
│   └── run-manual-migration.ts # Manual migrations
├── fixtures/
│   └── linear-issues.json     # Exported Linear data (gitignored)
└── drizzle/
    ├── migrations/            # Auto-generated migrations
    └── manual-migrations/     # Manual SQL (views)
```

## Success Criteria Met

✅ All pages load with realistic data
✅ Filters work correctly
✅ Links navigate properly
✅ Demo mode clearly indicated
✅ No external API calls in demo mode
✅ 100% type coverage
✅ Zero ESLint warnings
✅ All tests passing
✅ Runs on localhost:3109

**Milestone 1 is production-ready for local development and demo purposes.**
```

**Step 4: Update main README**

Add to end of existing `README.md`:
```markdown

---

## Arena Dashboard (Milestone 1)

### What is Arena?

Arena tracks AI coding agent performance across Cursor, Engine, and Cyrus. See which agents win, acceptance rates, and time-to-merge metrics.

### Current Status: Milestone 1 Complete ✅

Running in **demo mode** with seeded data from Linear. See `docs/MILESTONE-1-COMPLETE.md` for details.

### Quick Start

```bash
# Start the dashboard
npm run dev

# Open http://localhost:3109
```

### Demo Data Warnings

⚠️ **All PR URLs, branches, and CI metrics are SYNTHETIC**

This is demo mode with realistic-looking but fake data. Milestone 2 will add live GitHub webhook integration.

### Pages

- **Dashboard** (/) - Agent leaderboard and KPIs
- **Issues** (/issues) - All arena:ready issues
- **Issue Detail** (/issues/[key]) - Attempts timeline
- **Agent Detail** (/agents/[name]) - Per-agent stats

### Database Commands

```bash
npm run linear:export  # Export from Linear API
npm run db:reset       # Drop all tables
npm run db:push        # Create schema
npm run db:migrate:manual  # Add views
npm run db:seed        # Populate with fixtures
```

See `docs/MILESTONE-1-COMPLETE.md` for full documentation.
```

**Step 5: Commit**

Run:
```bash
git add docs/MILESTONE-1-COMPLETE.md README.md
git commit -m "docs: complete Milestone 1 documentation

- Add completion document with verification checklist
- Document all demo data warnings
- Add commands reference
- Update main README with Arena section

✅ MILESTONE 1 COMPLETE
   UI-first dashboard with seeded data from Linear
   All pages functional, quality gates passing
   Ready for Milestone 2 (GitHub webhooks)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Acceptance Criteria Verification

Run through final checklist:

1. **Dashboard loads with data** ✅
   - Run: Open http://localhost:3109
   - Verify: KPIs display, leaderboard shows agents

2. **Issues list works** ✅
   - Run: Open http://localhost:3109/issues
   - Verify: Issues table displays, filters work

3. **Issue detail works** ✅
   - Run: Click any issue key
   - Verify: Detail page shows, attempts timeline displays

4. **Agent detail works** ✅
   - Run: Open http://localhost:3109/agents/cursor
   - Verify: KPIs show, recent attempts table displays

5. **Demo mode indicated** ✅
   - Verify: Warning banner on dashboard
   - Verify: Footer shows demo mode badge

6. **No external API calls** ✅
   - All data from Neon database (seeded)
   - No Linear/GitHub API calls during runtime

7. **Quality gates pass** ✅
   - Run: `npm run validate`
   - Verify: All checks pass

---

## Plan Summary

**Total Tasks:** 13
**Estimated Time:** 1-2 days for coding agent
**Deliverables:**
- Full UI-first dashboard
- Database with Drizzle ORM
- Seeding from Linear export
- All pages and components
- Complete documentation

**Next:** Use superpowers:subagent-driven-development to execute this plan task by task.
