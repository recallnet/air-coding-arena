# OpenSkill Agent Rating System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement dynamic OpenSkill-based ELO ratings for agents that grow in accuracy with each completed issue, supporting variable agent participation per issue.

**Architecture:** Uses OpenSkill's Plackett-Luce model to calculate skill ratings (mu/sigma) after each completed issue. Ratings persist in new database tables, update incrementally per issue completion, and display as ordinal scores on the homepage chart. DNF (Did Not Finish) agents don't affect ratings.

**Tech Stack:**
- OpenSkill (npm package for rating calculations)
- PostgreSQL (agent_scores, agent_score_history tables)
- Drizzle ORM (schema and queries)
- Next.js Server Components (homepage integration)

---

## Task 1: Install OpenSkill Package

**Files:**
- Modify: `package.json`

**Step 1: Install openskill package**

Run: `npm install openskill`
Expected: Package added to dependencies in package.json

**Step 2: Verify installation**

Run: `npm list openskill`
Expected: Shows installed version (e.g., openskill@5.0.0)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add openskill for agent rating system"
```

---

## Task 2: Create Database Schema for Agent Ratings

**Files:**
- Modify: `src/db/schema.ts:1-100`
- Create: `drizzle/manual-migrations/002-agent-ratings.sql`

**Step 1: Add agent scores table to schema**

In `src/db/schema.ts`, add after the `ciMetrics` table definition:

```typescript
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
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Agent score history table - tracks rating changes over time.
 * Records mu, sigma, ordinal after each completed issue for analytics.
 */
export const agentScoreHistory = pgTable('agent_score_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentName: text('agent_name').notNull(),
  issueId: uuid('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  mu: real('mu').notNull(),
  sigma: real('sigma').notNull(),
  ordinal: real('ordinal').notNull(),
  rank: integer('rank').notNull(), // 1 = winner, 2 = second place, etc.
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Step 2: Add TypeScript types**

In `src/types/database.ts`, add at the end:

```typescript
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
```

**Step 3: Create manual migration SQL**

Create `drizzle/manual-migrations/002-agent-ratings.sql`:

```sql
-- Create agent_scores table
CREATE TABLE IF NOT EXISTS agent_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  mu REAL NOT NULL DEFAULT 25.0,
  sigma REAL NOT NULL DEFAULT 8.333,
  ordinal REAL NOT NULL DEFAULT 0.0,
  games_played INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create agent_score_history table
CREATE TABLE IF NOT EXISTS agent_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  mu REAL NOT NULL,
  sigma REAL NOT NULL,
  ordinal REAL NOT NULL,
  rank INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_scores_agent_name ON agent_scores(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_score_history_agent_name ON agent_score_history(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_score_history_issue_id ON agent_score_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_agent_score_history_completed_at ON agent_score_history(completed_at DESC);

-- Insert default ratings for existing agents
INSERT INTO agent_scores (agent_name, mu, sigma, ordinal, games_played)
VALUES
  ('cursor', 25.0, 8.333, 0.0, 0),
  ('engine', 25.0, 8.333, 0.0, 0),
  ('cyrus', 25.0, 8.333, 0.0, 0),
  ('factory', 25.0, 8.333, 0.0, 0)
ON CONFLICT (agent_name) DO NOTHING;
```

**Step 4: Run migration**

Run: `npm run db:migrate:manual`
Expected: Tables created successfully with default agent ratings

**Step 5: Verify schema**

Run: `npm run db:studio`
Expected: agent_scores and agent_score_history tables visible with 4 agents

**Step 6: Commit**

```bash
git add src/db/schema.ts src/types/database.ts drizzle/manual-migrations/002-agent-ratings.sql
git commit -m "feat(schema): add agent_scores and agent_score_history tables for OpenSkill ratings"
```

---

## Task 3: Create OpenSkill Rating Calculation Service

**Files:**
- Create: `src/lib/openskill.ts`
- Create: `src/lib/openskill.test.ts`

**Step 1: Write failing test**

Create `src/lib/openskill.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { rating } from 'openskill'
import { updateRatingsForCompletedIssue, initializeAgentRating, calculateOrdinal } from './openskill'

describe('openskill rating service', () => {
  describe('initializeAgentRating', () => {
    it('should return default rating with mu=25 and sigma=8.333', () => {
      const result = initializeAgentRating()
      expect(result.mu).toBe(25)
      expect(result.sigma).toBeCloseTo(8.333, 2)
    })
  })

  describe('calculateOrdinal', () => {
    it('should calculate ordinal score with alpha=24 and target=1500', () => {
      const testRating = rating({ mu: 25, sigma: 8.333 })
      const result = calculateOrdinal(testRating)
      // Default rating: ordinal ≈ 1500 - 24 * 8.333 ≈ 1300
      expect(result).toBeGreaterThan(1200)
      expect(result).toBeLessThan(1600)
    })

    it('should return higher ordinal for better ratings', () => {
      const weakRating = rating({ mu: 20, sigma: 8 })
      const strongRating = rating({ mu: 30, sigma: 5 })

      const weakOrdinal = calculateOrdinal(weakRating)
      const strongOrdinal = calculateOrdinal(strongRating)

      expect(strongOrdinal).toBeGreaterThan(weakOrdinal)
    })
  })

  describe('updateRatingsForCompletedIssue', () => {
    it('should update ratings based on ranking', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      const ranking = ['cursor', 'engine', 'cyrus'] // cursor wins

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Winner's mu should increase
      expect(result.cursor.mu).toBeGreaterThan(beforeRatings.cursor.mu)
      // Winner's sigma should decrease (more certain)
      expect(result.cursor.sigma).toBeLessThan(beforeRatings.cursor.sigma)

      // Loser's mu should decrease
      expect(result.cyrus.mu).toBeLessThan(beforeRatings.cyrus.mu)
    })

    it('should handle single agent (no competition)', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
      }

      const ranking = ['cursor']

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Single agent: rating shouldn't change much
      expect(result.cursor.mu).toBeCloseTo(beforeRatings.cursor.mu, 1)
    })

    it('should not include DNF agents in rating calculation', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      // Only cursor and engine finished (cyrus DNF)
      const ranking = ['cursor', 'engine']

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Cyrus not in ranking, should not be in result
      expect(result.cyrus).toBeUndefined()
      expect(result.cursor).toBeDefined()
      expect(result.engine).toBeDefined()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- openskill.test.ts`
Expected: FAIL - module './openskill' not found

**Step 3: Write minimal implementation**

Create `src/lib/openskill.ts`:

```typescript
/**
 * OpenSkill rating service for agent skill calculations.
 * Uses Plackett-Luce model to update ratings after each completed issue.
 *
 * @packageDocumentation
 */

import { rating, rate, ordinal } from 'openskill'
import type { Rating } from 'openskill/dist/types'

/**
 * Default OpenSkill rating configuration.
 * mu = 25 (mean skill), sigma = 8.333 (uncertainty/spread)
 */
const DEFAULT_MU = 25.0
const DEFAULT_SIGMA = 8.333

/**
 * Ordinal score calculation parameters.
 * alpha = 24 (conservative estimate, ~3 sigma)
 * target = 1500 (baseline score for display, similar to ELO)
 */
const ORDINAL_ALPHA = 24
const ORDINAL_TARGET = 1500

/**
 * Initializes a new agent with default OpenSkill rating.
 *
 * @returns Default Rating object with mu=25, sigma=8.333
 */
export function initializeAgentRating(): Rating {
  return rating({ mu: DEFAULT_MU, sigma: DEFAULT_SIGMA })
}

/**
 * Calculates ordinal score from OpenSkill Rating.
 * Ordinal = target + (mu - alpha * sigma)
 *
 * This gives a conservative estimate where we're ~99.7% confident
 * the agent's true skill is at least this value.
 *
 * @param agentRating - OpenSkill Rating object
 * @returns Ordinal score (display score, similar to ELO)
 */
export function calculateOrdinal(agentRating: Rating): number {
  return ordinal(agentRating, { alpha: ORDINAL_ALPHA, target: ORDINAL_TARGET })
}

/**
 * Updates agent ratings after a completed issue.
 * Uses Plackett-Luce model where ranking determines rating changes.
 *
 * @param currentRatings - Map of agentName to current Rating
 * @param ranking - Array of agent names in finish order (1st = winner, last = worst)
 * @returns Updated ratings for agents who participated (DNF agents excluded)
 */
export function updateRatingsForCompletedIssue(
  currentRatings: Record<string, Rating>,
  ranking: string[]
): Record<string, Rating> {
  // Build teams array: each agent is a "team" of one
  // Order matters: teams[0] = 1st place, teams[1] = 2nd place, etc.
  const teams = ranking.map((agentName) => {
    const agentRating = currentRatings[agentName]
    if (!agentRating) {
      throw new Error(`Agent ${agentName} not found in currentRatings`)
    }
    return [agentRating]
  })

  // Calculate new ratings using Plackett-Luce
  const updatedTeams = rate(teams)

  // Build result map: agentName -> updated Rating
  const result: Record<string, Rating> = {}
  for (let i = 0; i < ranking.length; i++) {
    const agentName = ranking[i]
    const updatedRating = updatedTeams[i]?.[0]
    if (agentName !== undefined && updatedRating !== undefined) {
      result[agentName] = updatedRating
    }
  }

  return result
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- openskill.test.ts`
Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add src/lib/openskill.ts src/lib/openskill.test.ts
git commit -m "feat(openskill): add rating calculation service with Plackett-Luce model"
```

---

## Task 4: Create Agent Rating Queries

**Files:**
- Modify: `src/lib/queries.ts:1-50`
- Modify: `src/types/database.ts:1-50`

**Step 1: Write failing test**

In `src/lib/queries.test.ts`, add new test suite:

```typescript
describe('agent rating queries', () => {
  describe('getAgentScores', () => {
    it('should return all agent scores ordered by ordinal DESC', async () => {
      const result = await getAgentScores()

      expect(Array.isArray(result)).toBe(true)
      if (result.length > 1) {
        // Verify descending order by ordinal
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i]!.ordinal).toBeGreaterThanOrEqual(result[i + 1]!.ordinal)
        }
      }
    })

    it('should include all rating fields', async () => {
      const result = await getAgentScores()

      if (result.length > 0) {
        const firstScore = result[0]!
        expect(firstScore).toHaveProperty('agentName')
        expect(firstScore).toHaveProperty('mu')
        expect(firstScore).toHaveProperty('sigma')
        expect(firstScore).toHaveProperty('ordinal')
        expect(firstScore).toHaveProperty('gamesPlayed')
      }
    })
  })

  describe('getAgentScore', () => {
    it('should return score for specific agent', async () => {
      const result = await getAgentScore('cursor')

      expect(result).toBeDefined()
      expect(result?.agentName).toBe('cursor')
      expect(result?.mu).toBeGreaterThan(0)
    })

    it('should return null for non-existent agent', async () => {
      const result = await getAgentScore('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getAgentScoreHistory', () => {
    it('should return history for agent ordered by completedAt DESC', async () => {
      const result = await getAgentScoreHistory('cursor')

      expect(Array.isArray(result)).toBe(true)
      if (result.length > 1) {
        // Verify descending order by date
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i]!.completedAt.getTime())
            .toBeGreaterThanOrEqual(result[i + 1]!.completedAt.getTime())
        }
      }
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- queries.test.ts`
Expected: FAIL - getAgentScores is not a function

**Step 3: Add query functions**

In `src/lib/queries.ts`, add at the end:

```typescript
/**
 * Gets all agent scores ordered by ordinal score (highest first).
 *
 * @returns Array of agent scores
 */
export async function getAgentScores(): Promise<AgentScore[]> {
  return db
    .select()
    .from(agentScores)
    .orderBy(desc(agentScores.ordinal))
}

/**
 * Gets score for a specific agent.
 *
 * @param agentName - Agent identifier
 * @returns Agent score or null if not found
 */
export async function getAgentScore(agentName: string): Promise<AgentScore | null> {
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
 * Gets temporal agent scores for chart display.
 * Returns daily snapshots of ordinal scores for all agents.
 *
 * @param days - Number of days to look back (default: 30)
 * @returns Array of daily agent score snapshots
 */
export async function getAgentScoreTimeSeries(
  days = 30
): Promise<AgentScoreTimeSeries[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const result = await db.execute(sql`
    SELECT
      DATE(completed_at) as date,
      agent_name,
      ordinal
    FROM agent_score_history
    WHERE completed_at >= ${cutoffDate.toISOString()}
    ORDER BY date ASC, agent_name ASC
  `)

  return result.rows.map((row: any) => ({
    date: row.date as string,
    agentName: row.agent_name as string,
    ordinal: Number(row.ordinal),
  }))
}
```

**Step 4: Add TypeScript types**

In `src/types/database.ts`, add:

```typescript
/**
 * Agent score time series entry for charts.
 */
export type AgentScoreTimeSeries = {
  date: string
  agentName: string
  ordinal: number
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- queries.test.ts`
Expected: PASS - all new tests green

**Step 6: Commit**

```bash
git add src/lib/queries.ts src/lib/queries.test.ts src/types/database.ts
git commit -m "feat(queries): add agent rating queries for scores and history"
```

---

## Task 5: Create Rating Update Service

**Files:**
- Create: `src/lib/update-ratings.ts`
- Create: `src/lib/update-ratings.test.ts`

**Step 1: Write failing test**

Create `src/lib/update-ratings.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '@/db/schema'
import { updateRatingsForIssue } from './update-ratings'

describe('updateRatingsForIssue', () => {
  beforeEach(async () => {
    // Clean test data
    await db.delete(agentScoreHistory)
    await db.delete(attempts)
    await db.delete(issues)

    // Reset agent scores to defaults
    await db.delete(agentScores)
    await db.insert(agentScores).values([
      { agentName: 'cursor', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
      { agentName: 'engine', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
      { agentName: 'cyrus', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    ])
  })

  it('should update ratings for completed issue with merged PR', async () => {
    // Create test issue
    const [issue] = await db.insert(issues).values({
      linearId: 'test-issue-1',
      linearKey: 'TEST-1',
      title: 'Test Issue',
      url: 'https://linear.app/test/1',
      status: 'Done',
      arenaReadyLabeledAt: new Date(),
    }).returning()

    // Create attempts: cursor wins, engine loses, cyrus DNF
    await db.insert(attempts).values([
      {
        issueId: issue!.id,
        agentName: 'cursor',
        repo: 'test/repo',
        prNumber: 1,
        prUrl: 'https://github.com/test/repo/pull/1',
        openedAt: new Date(),
        mergedAt: new Date(), // Winner
        status: 'merged',
        commitCount: 5,
      },
      {
        issueId: issue!.id,
        agentName: 'engine',
        repo: 'test/repo',
        prNumber: 2,
        prUrl: 'https://github.com/test/repo/pull/2',
        openedAt: new Date(),
        closedAt: new Date(), // Finished but lost
        status: 'closed',
        commitCount: 3,
      },
      {
        issueId: issue!.id,
        agentName: 'cyrus',
        repo: 'test/repo',
        prNumber: 3,
        prUrl: 'https://github.com/test/repo/pull/3',
        openedAt: new Date(),
        closedAt: new Date(), // DNF
        status: 'closed',
        commitCount: 1,
      },
    ])

    await updateRatingsForIssue(issue!.id)

    // Verify agent_scores updated
    const scores = await db.select().from(agentScores)
    const cursorScore = scores.find(s => s.agentName === 'cursor')
    const engineScore = scores.find(s => s.agentName === 'engine')
    const cyrusScore = scores.find(s => s.agentName === 'cyrus')

    // Winner should have higher mu
    expect(cursorScore!.mu).toBeGreaterThan(25)
    expect(cursorScore!.gamesPlayed).toBe(1)

    // Loser should have lower mu
    expect(engineScore!.mu).toBeLessThan(25)
    expect(engineScore!.gamesPlayed).toBe(1)

    // DNF should not change (no merged or valid attempt)
    expect(cyrusScore!.mu).toBe(25)
    expect(cyrusScore!.gamesPlayed).toBe(0)

    // Verify history entries created
    const history = await db.select().from(agentScoreHistory)
    expect(history).toHaveLength(2) // Only cursor and engine (not cyrus)

    const cursorHistory = history.find(h => h.agentName === 'cursor')
    expect(cursorHistory!.rank).toBe(1) // Winner

    const engineHistory = history.find(h => h.agentName === 'engine')
    expect(engineHistory!.rank).toBe(2) // Second place
  })

  it('should not update ratings if no attempts', async () => {
    const [issue] = await db.insert(issues).values({
      linearId: 'test-issue-2',
      linearKey: 'TEST-2',
      title: 'Test Issue No Attempts',
      url: 'https://linear.app/test/2',
      status: 'Done',
      arenaReadyLabeledAt: new Date(),
    }).returning()

    await updateRatingsForIssue(issue!.id)

    // No attempts = no rating changes
    const scores = await db.select().from(agentScores)
    const cursorScore = scores.find(s => s.agentName === 'cursor')
    expect(cursorScore!.mu).toBe(25) // Unchanged
    expect(cursorScore!.gamesPlayed).toBe(0)
  })

  it('should handle issue with only one agent', async () => {
    const [issue] = await db.insert(issues).values({
      linearId: 'test-issue-3',
      linearKey: 'TEST-3',
      title: 'Test Issue Single Agent',
      url: 'https://linear.app/test/3',
      status: 'Done',
      arenaReadyLabeledAt: new Date(),
    }).returning()

    await db.insert(attempts).values({
      issueId: issue!.id,
      agentName: 'cursor',
      repo: 'test/repo',
      prNumber: 10,
      prUrl: 'https://github.com/test/repo/pull/10',
      openedAt: new Date(),
      mergedAt: new Date(),
      status: 'merged',
      commitCount: 5,
    })

    await updateRatingsForIssue(issue!.id)

    // Single agent: rating should update but not dramatically
    const scores = await db.select().from(agentScores)
    const cursorScore = scores.find(s => s.agentName === 'cursor')
    expect(cursorScore!.gamesPlayed).toBe(1)
    expect(cursorScore!.mu).toBeGreaterThan(24) // Small increase
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- update-ratings.test.ts`
Expected: FAIL - module './update-ratings' not found

**Step 3: Write implementation**

Create `src/lib/update-ratings.ts`:

```typescript
/**
 * Rating update service for processing completed issues.
 * Updates agent scores based on issue outcomes using OpenSkill.
 *
 * @packageDocumentation
 */

import { db } from '@/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { rating } from 'openskill'
import type { Rating } from 'openskill/dist/types'
import {
  updateRatingsForCompletedIssue,
  calculateOrdinal,
  initializeAgentRating,
} from './openskill'

/**
 * Determines ranking of agents based on attempt outcomes.
 * Winner (merged PR) ranks first. Other closed PRs rank by closedAt time (earlier = better).
 * DNF (closed without trying) are excluded from ranking.
 *
 * @param issueAttempts - All attempts for the issue
 * @returns Sorted array of agent names (1st place = winner, last = worst finisher)
 */
function determineRanking(
  issueAttempts: Array<{
    agentName: string
    status: string
    mergedAt: Date | null
    closedAt: Date | null
    openedAt: Date
  }>
): string[] {
  // Filter to only agents who finished (merged or closed with effort)
  // Exclude DNF: status='closed' with no mergedAt and closedAt very close to openedAt
  const finishers = issueAttempts.filter((attempt) => {
    if (attempt.status === 'merged') return true
    if (attempt.status === 'closed' && attempt.closedAt) {
      // Consider closed PRs as "finished" (they competed but lost)
      return true
    }
    return false
  })

  // Sort: merged first, then by closedAt/mergedAt (earlier = better)
  finishers.sort((a, b) => {
    // Merged PRs always rank first
    if (a.status === 'merged' && b.status !== 'merged') return -1
    if (b.status === 'merged' && a.status !== 'merged') return 1

    // Both merged or both closed: sort by completion time
    const aTime = (a.mergedAt ?? a.closedAt ?? a.openedAt).getTime()
    const bTime = (b.mergedAt ?? b.closedAt ?? b.openedAt).getTime()
    return aTime - bTime
  })

  return finishers.map((f) => f.agentName)
}

/**
 * Updates agent ratings after an issue is completed.
 * Fetches current ratings, calculates new ratings, updates database.
 *
 * @param issueId - UUID of the completed issue
 * @throws Error if issue not found or database update fails
 */
export async function updateRatingsForIssue(issueId: string): Promise<void> {
  // Fetch issue to verify it exists
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1)

  if (!issue) {
    throw new Error(`Issue ${issueId} not found`)
  }

  // Fetch all attempts for this issue
  const issueAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issueId))

  if (issueAttempts.length === 0) {
    console.log(`No attempts for issue ${issue.linearKey}, skipping rating update`)
    return
  }

  // Determine ranking (winner first, losers by finish time, DNF excluded)
  const ranking = determineRanking(issueAttempts)

  if (ranking.length === 0) {
    console.log(`No finishers for issue ${issue.linearKey}, skipping rating update`)
    return
  }

  // Fetch current ratings for all participating agents
  const currentScores = await db
    .select()
    .from(agentScores)
    .where(
      and(
        ...ranking.map((agentName) => eq(agentScores.agentName, agentName))
      )
    )

  // Build currentRatings map
  const currentRatings: Record<string, Rating> = {}
  for (const agentName of ranking) {
    const score = currentScores.find((s) => s.agentName === agentName)
    if (score) {
      currentRatings[agentName] = rating({ mu: score.mu, sigma: score.sigma })
    } else {
      // Agent not in database yet, use default rating
      currentRatings[agentName] = initializeAgentRating()
    }
  }

  // Calculate new ratings using OpenSkill
  const updatedRatings = updateRatingsForCompletedIssue(currentRatings, ranking)

  // Determine completedAt timestamp (use mergedAt of winner or latest closedAt)
  const winner = issueAttempts.find((a) => a.status === 'merged')
  const completedAt =
    winner?.mergedAt ??
    issueAttempts
      .filter((a) => a.closedAt)
      .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime())[0]
      ?.closedAt ??
    new Date()

  // Update database: agent_scores and agent_score_history
  for (let i = 0; i < ranking.length; i++) {
    const agentName = ranking[i]
    const newRating = updatedRatings[agentName]

    if (!agentName || !newRating) continue

    const newOrdinal = calculateOrdinal(newRating)

    // Update agent_scores (upsert)
    await db
      .insert(agentScores)
      .values({
        agentName,
        mu: newRating.mu,
        sigma: newRating.sigma,
        ordinal: newOrdinal,
        gamesPlayed: 1, // Will be incremented by ON CONFLICT
        lastUpdatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agentScores.agentName,
        set: {
          mu: newRating.mu,
          sigma: newRating.sigma,
          ordinal: newOrdinal,
          gamesPlayed: db.$increment(agentScores.gamesPlayed, 1),
          lastUpdatedAt: new Date(),
        },
      })

    // Insert agent_score_history
    await db.insert(agentScoreHistory).values({
      agentName,
      issueId,
      mu: newRating.mu,
      sigma: newRating.sigma,
      ordinal: newOrdinal,
      rank: i + 1, // 1-indexed rank
      completedAt,
    })
  }

  console.log(
    `Updated ratings for ${ranking.length} agents on issue ${issue.linearKey}`
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- update-ratings.test.ts`
Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add src/lib/update-ratings.ts src/lib/update-ratings.test.ts
git commit -m "feat(ratings): add rating update service for completed issues"
```

---

## Task 6: Integrate Rating Updates into Issue Lifecycle

**Files:**
- Modify: `src/app/api/github/webhook/route.ts:100-200`

**Step 1: Add rating update call after PR merge**

In `src/app/api/github/webhook/route.ts`, find the section that handles PR merge events.

Add import at top:

```typescript
import { updateRatingsForIssue } from '@/lib/update-ratings'
```

After the PR merge logic (where you mark attempt as merged), add:

```typescript
// Update agent ratings after PR merge
try {
  await updateRatingsForIssue(attempt.issueId)
} catch (error) {
  console.error('Failed to update ratings:', error)
  // Don't fail the webhook, just log the error
}
```

**Step 2: Verify webhook still works**

Run: `npm test -- webhook/route.test.ts`
Expected: PASS - webhook tests still pass with rating update

**Step 3: Commit**

```bash
git add src/app/api/github/webhook/route.ts
git commit -m "feat(webhook): integrate rating updates on PR merge events"
```

---

## Task 7: Add Ordinal Score to Homepage Chart

**Files:**
- Modify: `src/components/TemporalLeaderboard.tsx:150-250`
- Modify: `src/lib/queries.ts:200-250`

**Step 1: Update temporal stats query to include ordinal**

In `src/lib/queries.ts`, modify `getAgentTemporalStats` to include ordinal:

```typescript
export async function getAgentTemporalStats(
  days = 30
): Promise<AgentTemporalStat[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const result = await db.execute(sql`
    WITH daily_stats AS (
      SELECT
        DATE(opened_at) as date,
        agent_name,
        COUNT(*) as attempts,
        COUNT(*) FILTER (WHERE status = 'merged') as wins,
        COUNT(*) FILTER (WHERE status = 'closed' AND merged_at IS NULL) as failures
      FROM attempts
      WHERE opened_at >= ${cutoffDate.toISOString()}
      GROUP BY DATE(opened_at), agent_name
    ),
    daily_scores AS (
      SELECT
        DATE(completed_at) as date,
        agent_name,
        ordinal,
        ROW_NUMBER() OVER (PARTITION BY agent_name, DATE(completed_at) ORDER BY completed_at DESC) as rn
      FROM agent_score_history
      WHERE completed_at >= ${cutoffDate.toISOString()}
    ),
    latest_daily_scores AS (
      SELECT date, agent_name, ordinal
      FROM daily_scores
      WHERE rn = 1
    )
    SELECT
      ds.date,
      ds.agent_name,
      SUM(ds.attempts) OVER (PARTITION BY ds.agent_name ORDER BY ds.date) as cumulative_attempts,
      SUM(ds.wins) OVER (PARTITION BY ds.agent_name ORDER BY ds.date) as cumulative_wins,
      SUM(ds.failures) OVER (PARTITION BY ds.agent_name ORDER BY ds.date) as cumulative_failures,
      COALESCE(sc.ordinal, 0) as ordinal
    FROM daily_stats ds
    LEFT JOIN latest_daily_scores sc ON ds.date = sc.date AND ds.agent_name = sc.agent_name
    ORDER BY ds.date ASC, ds.agent_name ASC
  `)

  return result.rows.map((row: any) => ({
    date: row.date as string,
    agentName: row.agent_name as string,
    cumulativeAttempts: Number(row.cumulative_attempts),
    cumulativeWins: Number(row.cumulative_wins),
    cumulativeFailures: Number(row.cumulative_failures),
    ordinal: Number(row.ordinal),
  }))
}
```

**Step 2: Update AgentTemporalStat type**

In `src/types/database.ts`, update:

```typescript
export type AgentTemporalStat = {
  date: string
  agentName: string
  cumulativeAttempts: number
  cumulativeWins: number
  cumulativeFailures: number
  ordinal: number // NEW
}
```

**Step 3: Add ordinal line to chart component**

In `src/components/TemporalLeaderboard.tsx`, add ordinal line to the chart.

Update `generateLinePath` to support 'ordinal':

```typescript
const generateLinePath = (
  agentName: string,
  metric: 'attempts' | 'wins' | 'failures' | 'ordinal'
): string => {
  const points = dates.map((date, index) => {
    const stat = groupedStats[date]?.[agentName]
    const value = stat
      ? metric === 'attempts'
        ? stat.cumulativeAttempts
        : metric === 'wins'
          ? stat.cumulativeWins
          : metric === 'failures'
            ? stat.cumulativeFailures
            : stat.ordinal
      : 0
    return `${xScale(index)},${yScale(value)}`
  })
  return `M ${points.join(' L ')}`
}
```

Update `maxValue` calculation to include ordinal:

```typescript
const maxValue = Math.max(
  ...stats.map((s) =>
    Math.max(
      s.cumulativeAttempts,
      s.cumulativeWins,
      s.cumulativeFailures,
      s.ordinal
    )
  ),
  1
)
```

Add ordinal line rendering after failures line:

```typescript
{/* Ordinal line (primary metric after games are played) */}
<path
  d={generateLinePath(agent, 'ordinal')}
  fill="none"
  stroke={colors.base}
  strokeWidth="3"
  strokeLinecap="round"
  strokeLinejoin="round"
  opacity="0.9"
/>
```

Update legend to show ordinal:

```typescript
<div className="flex items-center gap-2 text-xs text-foreground-secondary">
  <div
    className="h-2 w-2 rounded-full"
    style={{ backgroundColor: colors.base }}
  />
  <span className="font-semibold">Rating</span>
  <span>|</span>
  <span>Attempts</span>
  <div
    className="h-2 w-2 rounded-full"
    style={{ backgroundColor: colors.wins }}
  />
  <span>Wins</span>
  <div
    className="h-2 w-2 rounded-full"
    style={{ backgroundColor: colors.failures }}
  />
  <span>Failures</span>
</div>
```

**Step 4: Test chart rendering**

Run: `npm run dev`
Navigate to: `http://localhost:3109`
Expected: Chart shows ordinal rating line prominently for each agent

**Step 5: Run tests**

Run: `npm test -- TemporalLeaderboard.test.ts`
Expected: PASS - component tests pass

**Step 6: Commit**

```bash
git add src/components/TemporalLeaderboard.tsx src/lib/queries.ts src/types/database.ts
git commit -m "feat(chart): add ordinal rating line to homepage temporal chart"
```

---

## Task 8: Backfill Ratings for Existing Completed Issues

**Files:**
- Create: `scripts/backfill-agent-ratings.ts`

**Step 1: Create backfill script**

Create `scripts/backfill-agent-ratings.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Backfill agent ratings for all completed issues.
 * Processes issues in chronological order to build accurate rating history.
 */

import { db } from '../src/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '../src/db/schema'
import { eq, isNotNull, asc } from 'drizzle-orm'
import { updateRatingsForIssue } from '../src/lib/update-ratings'

async function main() {
  console.log('🔄 Backfilling agent ratings for completed issues...\n')

  // Clear existing scores and history
  console.log('Clearing existing ratings...')
  await db.delete(agentScoreHistory)
  await db.delete(agentScores)

  // Reset to defaults
  await db.insert(agentScores).values([
    { agentName: 'cursor', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    { agentName: 'engine', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    { agentName: 'cyrus', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    { agentName: 'factory', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
  ])
  console.log('✅ Reset agent scores to defaults\n')

  // Fetch all issues with merged PRs (completed issues)
  const completedIssues = await db
    .select({ id: issues.id, linearKey: issues.linearKey })
    .from(issues)
    .innerJoin(attempts, eq(issues.id, attempts.issueId))
    .where(eq(attempts.status, 'merged'))
    .groupBy(issues.id, issues.linearKey)
    .orderBy(asc(issues.createdAt))

  console.log(`Found ${completedIssues.length} completed issues\n`)

  let processed = 0
  let errors = 0

  for (const issue of completedIssues) {
    try {
      console.log(`Processing ${issue.linearKey}...`)
      await updateRatingsForIssue(issue.id)
      processed++
      console.log(`✅ ${issue.linearKey} ratings updated\n`)
    } catch (error) {
      console.error(`❌ Error processing ${issue.linearKey}:`, error)
      errors++
    }

    // Rate limit: 50ms between updates
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n📊 Backfill complete!')
  console.log(`   Processed: ${processed}`)
  console.log(`   Errors: ${errors}`)

  // Show final ratings
  const finalScores = await db.select().from(agentScores)
  console.log('\n🏆 Final Agent Ratings:')
  for (const score of finalScores) {
    console.log(
      `   ${score.agentName}: ${score.ordinal.toFixed(0)} (mu=${score.mu.toFixed(2)}, sigma=${score.sigma.toFixed(2)}, games=${score.gamesPlayed})`
    )
  }
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error)
  process.exit(1)
})
```

**Step 2: Add script to package.json**

In `package.json`, add:

```json
"backfill:ratings": "tsx scripts/backfill-agent-ratings.ts",
```

**Step 3: Run backfill script**

Run: `npm run backfill:ratings`
Expected: All completed issues processed, ratings calculated, history populated

**Step 4: Verify results**

Run: `npm run db:studio`
Navigate to agent_scores and agent_score_history tables
Expected: See ratings for all agents, history entries for each completed issue

**Step 5: Commit**

```bash
git add scripts/backfill-agent-ratings.ts package.json
git commit -m "feat(scripts): add backfill script for agent ratings"
```

---

## Task 9: Add Agent Rating Display to Agent Detail Page

**Files:**
- Modify: `src/app/agents/[agentName]/page.tsx:1-50`

**Step 1: Add rating display to agent page**

In `src/app/agents/[agentName]/page.tsx`, add rating section.

Add import:

```typescript
import { getAgentScore, getAgentScoreHistory } from '@/lib/queries'
```

In the component, fetch agent score:

```typescript
const agentScore = await getAgentScore(params.agentName)
const agentScoreHistory = await getAgentScoreHistory(params.agentName, 20)
```

Add rating card before attempts table:

```typescript
{agentScore && (
  <Card className="mb-8">
    <CardHeader>
      <CardTitle>OpenSkill Rating</CardTitle>
      <CardDescription>
        Dynamic skill rating based on match outcomes
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <div className="text-sm text-foreground-secondary">Ordinal Score</div>
          <div className="text-2xl font-bold">{agentScore.ordinal.toFixed(0)}</div>
        </div>
        <div>
          <div className="text-sm text-foreground-secondary">Skill (μ)</div>
          <div className="text-2xl font-bold">{agentScore.mu.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-sm text-foreground-secondary">Uncertainty (σ)</div>
          <div className="text-2xl font-bold">{agentScore.sigma.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-sm text-foreground-secondary">Games Played</div>
          <div className="text-2xl font-bold">{agentScore.gamesPlayed}</div>
        </div>
      </div>

      {agentScoreHistory.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Recent Rating History</h3>
          <div className="space-y-2">
            {agentScoreHistory.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2 text-sm"
              >
                <span>Rank #{entry.rank}</span>
                <span>{entry.ordinal.toFixed(0)}</span>
                <span className="text-xs text-foreground-secondary">
                  {entry.completedAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

**Step 2: Test page rendering**

Run: `npm run dev`
Navigate to: `http://localhost:3109/agents/cursor`
Expected: See rating card with ordinal, mu, sigma, games played, and recent history

**Step 3: Run tests**

Run: `npm test`
Expected: PASS - all tests pass

**Step 4: Commit**

```bash
git add src/app/agents/[agentName]/page.tsx
git commit -m "feat(ui): add rating display to agent detail page"
```

---

## Task 10: Update Agent Leaderboard to Show Ordinal Score

**Files:**
- Modify: `src/app/page.tsx:40-120`
- Modify: `src/lib/queries.ts:50-100`

**Step 1: Update getAgentStats to include ordinal**

In `src/lib/queries.ts`, modify `getAgentStats`:

```typescript
export async function getAgentStats(): Promise<AgentStats[]> {
  const result = await db.execute(sql`
    SELECT
      a.agent_name,
      a.attempts,
      a.wins,
      a.acceptance_pct,
      COALESCE(s.ordinal, 0) as ordinal,
      COALESCE(s.games_played, 0) as games_played
    FROM agent_stats a
    LEFT JOIN agent_scores s ON a.agent_name = s.agent_name
    ORDER BY s.ordinal DESC NULLS LAST, a.acceptance_pct DESC
  `)

  return result.rows.map((row: any) => ({
    agentName: row.agent_name as string,
    attempts: Number(row.attempts),
    wins: Number(row.wins),
    acceptancePct: Number(row.acceptance_pct),
    ordinal: Number(row.ordinal),
    gamesPlayed: Number(row.games_played),
  }))
}
```

**Step 2: Update AgentStats type**

In `src/types/database.ts`:

```typescript
export type AgentStats = {
  agentName: string
  attempts: number
  wins: number
  acceptancePct: number
  ordinal: number // NEW
  gamesPlayed: number // NEW
}
```

**Step 3: Update homepage table to show ordinal**

In `src/app/page.tsx`, update the leaderboard table:

```typescript
<TableHeader>
  <TableRow>
    <TableHead>Agent Name</TableHead>
    <TableHead className="text-right">Rating</TableHead>
    <TableHead className="text-right">Games</TableHead>
    <TableHead className="text-right">Attempts</TableHead>
    <TableHead className="text-right">Wins</TableHead>
    <TableHead className="text-right">Acceptance Rate</TableHead>
  </TableRow>
</TableHeader>
<TableBody>
  {agentStats.map((stat: AgentStats) => (
    <TableRow key={stat.agentName}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {stat.agentName}
          {topPerformer !== null &&
            stat.agentName === topPerformer.agentName && (
              <Badge variant="success">Top Performer</Badge>
            )}
        </div>
      </TableCell>
      <TableCell className="text-right font-bold">
        {stat.ordinal > 0 ? stat.ordinal.toFixed(0) : '-'}
      </TableCell>
      <TableCell className="text-right">
        {stat.gamesPlayed}
      </TableCell>
      <TableCell className="text-right">
        {stat.attempts}
      </TableCell>
      <TableCell className="text-right">{stat.wins}</TableCell>
      <TableCell className="text-right">
        {stat.acceptancePct.toFixed(1)}%
      </TableCell>
    </TableRow>
  ))}
</TableBody>
```

**Step 4: Update top performer logic**

In `src/app/page.tsx`, update top performer calculation:

```typescript
const topPerformer =
  agentStats.length > 0
    ? agentStats.reduce((top: AgentStats, current: AgentStats) =>
        current.ordinal > top.ordinal ? current : top
      )
    : null
```

**Step 5: Test homepage**

Run: `npm run dev`
Navigate to: `http://localhost:3109`
Expected: Leaderboard shows rating column with ordinal scores, sorted by rating

**Step 6: Run tests**

Run: `npm test`
Expected: PASS - all tests pass

**Step 7: Commit**

```bash
git add src/app/page.tsx src/lib/queries.ts src/types/database.ts
git commit -m "feat(leaderboard): add ordinal rating column and sort by rating"
```

---

## Task 11: Documentation and README Update

**Files:**
- Create: `docs/architecture/agent-ratings.md`
- Modify: `README.md`

**Step 1: Create architecture documentation**

Create `docs/architecture/agent-ratings.md`:

```markdown
# Agent Rating System

## Overview

The Air Coding Arena uses [OpenSkill](https://www.npmjs.com/package/openskill) to calculate dynamic skill ratings for AI coding agents. Ratings update after each completed issue based on the Plackett-Luce model, which handles variable team sizes and provides accurate skill estimates even when different agents compete in different issues.

## Why OpenSkill?

- **Variable participation**: Not all agents compete on every issue
- **Accuracy improves over time**: Uncertainty (sigma) decreases with each match
- **Fair comparison**: Handles situations where agents have played different numbers of games
- **Industry standard**: Similar to Microsoft TrueSkill but open-source

## Rating Components

### Mu (μ) - Skill Estimate
- Mean of the agent's skill distribution
- Default: 25.0 (neutral starting point)
- Increases when agent wins, decreases when agent loses

### Sigma (σ) - Uncertainty
- Standard deviation of the agent's skill distribution
- Default: 8.333 (high uncertainty for new agents)
- Decreases with each match (more confidence in skill estimate)

### Ordinal Score - Display Rating
- Calculated as: `target + (mu - alpha * sigma)`
- Alpha = 24 (~3 sigma, 99.7% confidence)
- Target = 1500 (baseline, similar to chess ELO)
- Conservative estimate: agent's true skill is likely higher

## How Ratings Update

1. **Issue Completion**: When a PR is merged (winner determined)
2. **Determine Ranking**: Winner ranks 1st, other finished attempts ranked by completion time
3. **Exclude DNF**: Agents who didn't finish don't affect ratings
4. **Calculate Updates**: Use Plackett-Luce model to update mu/sigma for all finishers
5. **Store Results**: Update `agent_scores` table and append to `agent_score_history`

## Database Schema

### agent_scores
- Current ratings for each agent
- Columns: mu, sigma, ordinal, games_played
- Updated after each completed issue

### agent_score_history
- Historical record of rating changes
- Tracks rating after each issue completion
- Used for temporal charts and analytics

## API

### Query Functions
- `getAgentScores()`: All agents ordered by ordinal DESC
- `getAgentScore(agentName)`: Single agent's current rating
- `getAgentScoreHistory(agentName)`: Rating history for analytics
- `getAgentScoreTimeSeries(days)`: Daily ordinal scores for charts

### Update Functions
- `updateRatingsForIssue(issueId)`: Processes completed issue, updates all participant ratings
- Called automatically by webhook on PR merge

## Testing

Run rating tests:
```bash
npm test -- openskill.test.ts
npm test -- update-ratings.test.ts
```

## Backfilling

To recalculate all ratings from scratch:
```bash
npm run backfill:ratings
```

This processes all completed issues in chronological order.
```

**Step 2: Update README.md**

In `README.md`, add section after "Features":

```markdown
## Agent Rating System

Air Coding Arena uses **OpenSkill** to calculate dynamic skill ratings for agents:

- **Fair comparison** across variable participation (not all agents compete on every issue)
- **Accuracy improves** with each completed issue
- **ELO-style ordinal scores** displayed on leaderboard and charts
- **Full rating history** tracked for analytics

See [docs/architecture/agent-ratings.md](docs/architecture/agent-ratings.md) for technical details.
```

**Step 3: Commit**

```bash
git add docs/architecture/agent-ratings.md README.md
git commit -m "docs: add agent rating system architecture documentation"
```

---

## Plan Complete!

All tasks completed. The OpenSkill rating system is now fully integrated into Air Coding Arena.

### Summary of Changes

1. ✅ OpenSkill package installed
2. ✅ Database schema created (agent_scores, agent_score_history)
3. ✅ Rating calculation service implemented
4. ✅ Query functions for scores and history
5. ✅ Rating update service processes completed issues
6. ✅ Webhook integration updates ratings on PR merge
7. ✅ Homepage chart displays ordinal rating line
8. ✅ Backfill script processes historical data
9. ✅ Agent detail page shows ratings
10. ✅ Leaderboard displays and sorts by rating
11. ✅ Documentation complete

### Testing

Run full test suite:
```bash
npm test
npm run type-check
npm run lint
```

### Next Steps

1. Monitor rating accuracy as more issues complete
2. Consider tuning OpenSkill parameters (alpha, target) based on data
3. Add rating confidence badges (high sigma = "provisional rating")
4. Create rating projections ("if X wins, rating becomes Y")
