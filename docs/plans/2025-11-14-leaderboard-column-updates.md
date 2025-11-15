# Leaderboard Column Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update leaderboard columns from (Games, Attempts, Wins, Acceptance Rate) to (Issues, PRs, Wins, DNF) with accurate calculations based on agent attempt data.

**Architecture:** Modify the agent_stats database view to calculate new metrics (distinct issues, PRs submitted, DNFs), update TypeScript types and query functions, and refresh frontend table headers and data bindings. Remove Acceptance Rate column entirely.

**Tech Stack:** PostgreSQL views, Drizzle ORM, TypeScript, Next.js 15 App Router, React Server Components

---

## Understanding Current vs New Metrics

**Current Columns:**
- Games = agent_scores.games_played (rated competitions participated in)
- Attempts = COUNT(*) from attempts (all PRs submitted)
- Wins = COUNT(*) FILTER (WHERE status='merged')
- Acceptance Rate = (wins / attempts) * 100

**New Columns:**
- Issues = COUNT(DISTINCT issue_id) - number of unique issues attempted
- PRs = COUNT(*) - number of PRs actually submitted (same as current "Attempts")
- Wins = COUNT(*) FILTER (WHERE status='merged') - unchanged
- DNF = COUNT(*) FILTER (WHERE status='closed') - Did Not Finish (closed without merging)

**Key Insight:** The attempts table has prNumber as NOT NULL, meaning every attempt row represents a submitted PR. Therefore PRs = current "Attempts".

---

## Task 1: Update Database View for New Metrics

**Files:**
- Modify: `drizzle/manual-migrations/001-agent-stats-view.sql`

### Step 1: Write test to verify new columns exist

**File:** `src/lib/queries.test.ts`

Find the existing test for `getAgentStats()` and add new assertions:

```typescript
it('should return agent stats with new column structure', async () => {
  const stats = await getAgentStats()

  if (stats.length > 0) {
    const firstStat = stats[0]

    // New columns must exist
    expect(firstStat).toHaveProperty('issues')
    expect(firstStat).toHaveProperty('prs')
    expect(firstStat).toHaveProperty('dnf')

    // Verify types
    expect(typeof firstStat.issues).toBe('number')
    expect(typeof firstStat.prs).toBe('number')
    expect(typeof firstStat.dnf).toBe('number')

    // PRs should equal or exceed issues (can't submit more issues than PRs)
    expect(firstStat.prs).toBeGreaterThanOrEqual(firstStat.issues)

    // DNF + Wins should be <= PRs
    expect(firstStat.dnf + firstStat.wins).toBeLessThanOrEqual(firstStat.prs)
  }
})
```

### Step 2: Run test to verify it fails

Run: `pnpm test src/lib/queries.test.ts`

Expected: FAIL - `toHaveProperty('issues')` fails because field doesn't exist yet

### Step 3: Update SQL view with new columns

**File:** `drizzle/manual-migrations/001-agent-stats-view.sql`

Replace entire file content with:

```sql
-- Agent stats view for leaderboard
-- This view aggregates attempt data to show each agent's performance metrics
-- IMPORTANT: This is a VIEW, not a materialized view, so it always reflects current data

CREATE OR REPLACE VIEW agent_stats AS
SELECT
  agent_name,
  COUNT(DISTINCT issue_id) AS issues,
  COUNT(*) AS prs,
  COUNT(*) FILTER (WHERE status='merged') AS wins,
  COUNT(*) FILTER (WHERE status='closed') AS dnf,
  COUNT(*) AS attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status='merged') / NULLIF(COUNT(*),0), 1) AS acceptance_pct
FROM attempts
GROUP BY agent_name;
```

**Note:** We keep `attempts` and `acceptance_pct` in the view for backward compatibility, but won't display them in the UI.

### Step 4: Apply the migration to database

Run: `pnpm db:migrate:manual`

Expected: Migration succeeds, view recreated

**Alternative if manual command doesn't exist:**

```bash
# Connect to database and run SQL directly
psql $DATABASE_URL -f drizzle/manual-migrations/001-agent-stats-view.sql
```

### Step 5: Commit database view changes

```bash
git add drizzle/manual-migrations/001-agent-stats-view.sql
git commit -m "feat(db): add issues, prs, dnf columns to agent_stats view

Updates agent_stats view to calculate:
- issues: COUNT(DISTINCT issue_id)
- prs: COUNT(*) of all submitted PRs
- dnf: COUNT(*) FILTER (WHERE status='closed')

Keeps attempts and acceptance_pct for backward compatibility."
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

### Step 1: Add test for new AgentStats fields

**File:** `src/lib/queries.test.ts`

Add type-checking test (this might already pass if types are correct):

```typescript
it('should have correct TypeScript types for AgentStats', () => {
  // This is a compile-time test - if it compiles, types are correct
  const mockStat: AgentStats = {
    agentName: 'test',
    issues: 5,
    prs: 10,
    wins: 3,
    dnf: 2,
    attempts: 10,
    acceptancePct: 30.0,
    ordinal: 1500,
    gamesPlayed: 3,
    avatarUrl: null,
    displayName: null,
  }

  expect(mockStat.issues).toBe(5)
  expect(mockStat.prs).toBe(10)
  expect(mockStat.dnf).toBe(2)
})
```

### Step 2: Run test to see if it compiles

Run: `pnpm type-check`

Expected: FAIL - Type errors because AgentStats doesn't have issues, prs, dnf fields

### Step 3: Update AgentStats interface

**File:** `src/types/database.ts`

Find the AgentStats interface and update it:

```typescript
export interface AgentStats {
  agentName: string
  issues: number          // NEW: distinct issues attempted
  prs: number            // NEW: PRs submitted (replaces attempts in UI)
  wins: number
  dnf: number            // NEW: Did Not Finish count
  attempts: number       // KEEP for backward compatibility
  acceptancePct: number  // KEEP for backward compatibility
  ordinal: number
  gamesPlayed: number
  avatarUrl: string | null
  displayName: string | null
}
```

### Step 4: Verify types compile

Run: `pnpm type-check`

Expected: PASS - all types valid

### Step 5: Commit type changes

```bash
git add src/types/database.ts src/lib/queries.test.ts
git commit -m "feat(types): add issues, prs, dnf fields to AgentStats interface

Adds new fields to AgentStats:
- issues: number of distinct issues attempted
- prs: number of PRs submitted
- dnf: Did Not Finish count

Keeps attempts and acceptancePct for backward compatibility."
```

---

## Task 3: Update Query Function to Return New Fields

**Files:**
- Modify: `src/lib/queries.ts` (getAgentStats function, lines 38-100)

### Step 1: Test already written in Task 1

The test from Task 1 Step 1 will validate this change.

### Step 2: Run test to confirm it still fails

Run: `pnpm test src/lib/queries.test.ts`

Expected: FAIL - Database returns new fields but query function doesn't map them

### Step 3: Update getAgentStats() to select and map new fields

**File:** `src/lib/queries.ts`

Find the `getAgentStats()` function (around line 38) and update the SQL query and mapping:

```typescript
export async function getAgentStats(): Promise<AgentStats[]> {
  const result = await db.execute<{
    agent_name: string
    issues: number          // NEW
    prs: number            // NEW
    wins: number
    dnf: number            // NEW
    attempts: number
    acceptance_pct: number
    ordinal: number
    games_played: number
    avatar_url: string | null
    display_name: string | null
  }>(sql`
    SELECT
      a.agent_name,
      a.issues,
      a.prs,
      a.wins,
      a.dnf,
      a.attempts,
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
    issues: Number(row.issues),
    prs: Number(row.prs),
    wins: Number(row.wins),
    dnf: Number(row.dnf),
    attempts: Number(row.attempts),
    acceptancePct: Number(row.acceptance_pct),
    ordinal: Number(row.ordinal),
    gamesPlayed: Number(row.games_played),
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
  }))
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test src/lib/queries.test.ts`

Expected: PASS - Query returns new fields correctly

### Step 5: Commit query function changes

```bash
git add src/lib/queries.ts
git commit -m "feat(queries): add issues, prs, dnf fields to getAgentStats query

Updates getAgentStats() to:
- SELECT new columns from agent_stats view
- Map issues, prs, dnf to return type
- Maintain backward compatibility with attempts/acceptance_pct"
```

---

## Task 4: Update Frontend Table Headers and Data

**Files:**
- Modify: `src/app/page.tsx` (lines 84-128)
- Modify: `src/app/page.test.tsx`

### Step 1: Write test for new table headers

**File:** `src/app/page.test.tsx`

Find existing leaderboard tests and add:

```typescript
it('should display new column headers in leaderboard', async () => {
  render(await Home())

  // New headers should exist
  expect(screen.getByText('Issues')).toBeInTheDocument()
  expect(screen.getByText('PRs')).toBeInTheDocument()
  expect(screen.getByText('DNF')).toBeInTheDocument()

  // Old header should NOT exist
  expect(screen.queryByText('Acceptance Rate')).not.toBeInTheDocument()
  expect(screen.queryByText('Attempts')).not.toBeInTheDocument()

  // These should still exist
  expect(screen.getByText('Rating')).toBeInTheDocument()
  expect(screen.getByText('Wins')).toBeInTheDocument()
})

it('should display agent data in new columns', async () => {
  // This test assumes mock data returns at least one agent
  render(await Home())

  const table = screen.getByRole('table')
  expect(table).toBeInTheDocument()

  // Verify we have the correct number of columns (7 total)
  // Agent Name | Rating | Issues | PRs | Wins | DNF
  const headers = screen.getAllByRole('columnheader')
  expect(headers).toHaveLength(6)
})
```

### Step 2: Run test to verify it fails

Run: `pnpm test src/app/page.test.tsx`

Expected: FAIL - "Issues" header not found, "Acceptance Rate" still exists

### Step 3: Update table headers in page.tsx

**File:** `src/app/page.tsx`

Find the TableHeader section (lines 84-94) and replace with:

```typescript
<TableHeader>
  <TableRow>
    <TableHead>Agent Name</TableHead>
    <TableHead className="text-right">Rating</TableHead>
    <TableHead className="text-right">Issues</TableHead>
    <TableHead className="text-right">PRs</TableHead>
    <TableHead className="text-right">Wins</TableHead>
    <TableHead className="text-right">DNF</TableHead>
  </TableRow>
</TableHeader>
```

### Step 4: Update table data cells

**File:** `src/app/page.tsx`

Find the TableBody section (lines 96-129) and update the data cells:

```typescript
<TableBody>
  {agentStats.map((stat: AgentStats) => (
    <TableRow key={stat.agentName}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <AgentAvatar
            name={stat.agentName}
            status="accepted"
            size="sm"
            avatarUrl={stat.avatarUrl}
            displayName={stat.displayName}
          />
          {stat.displayName ?? stat.agentName}
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
        {stat.issues}
      </TableCell>
      <TableCell className="text-right">
        {stat.prs}
      </TableCell>
      <TableCell className="text-right">
        {stat.wins}
      </TableCell>
      <TableCell className="text-right">
        {stat.dnf}
      </TableCell>
    </TableRow>
  ))}
</TableBody>
```

### Step 5: Run tests to verify they pass

Run: `pnpm test src/app/page.test.tsx`

Expected: PASS - New headers displayed, old headers removed

### Step 6: Run full test suite

Run: `pnpm test`

Expected: All tests pass (no regressions)

### Step 7: Commit frontend changes

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat(ui): update leaderboard columns to Issues, PRs, Wins, DNF

Replaces leaderboard columns:
- Remove: Games, Attempts, Acceptance Rate
- Add: Issues, PRs, Wins, DNF

Column definitions:
- Issues: distinct issues agent attempted
- PRs: number of PRs submitted
- Wins: PRs merged (unchanged)
- DNF: PRs closed without merging"
```

---

## Task 5: Update Agent Detail Page (if exists)

**Files:**
- Check: `src/app/agents/[agentName]/page.tsx`

### Step 1: Check if agent detail page displays old columns

**File:** `src/app/agents/[agentName]/page.tsx`

Search for "Acceptance Rate", "Attempts", or "Games" text:

Run: `grep -n "Acceptance Rate\|Attempts\|Games" src/app/agents/[agentName]/page.tsx`

If matches found, proceed with steps below. If no matches, skip this task.

### Step 2: Write test for agent detail page (if needed)

**File:** `src/app/agents/[agentName]/page.test.tsx`

Similar to Task 4 Step 1, add tests for new column headers.

### Step 3: Update agent detail page UI (if needed)

Update any references to old columns with new columns, following same pattern as Task 4.

### Step 4: Commit changes (if any made)

```bash
git add src/app/agents/[agentName]/page.tsx src/app/agents/[agentName]/page.test.tsx
git commit -m "feat(ui): update agent detail page with new column structure"
```

---

## Task 6: Update Any Other References

**Files:**
- Search codebase for old column references

### Step 1: Search for references to old columns

Run: `grep -r "acceptancePct\|acceptance_pct\|Acceptance Rate" src/ --include="*.tsx" --include="*.ts" -n`

Expected: Should only find references in queries.ts (which we keep for backward compat) and possibly tests.

### Step 2: Review and update any UI references

If any UI components reference `acceptancePct`, update them to use new columns instead.

### Step 3: Update any relevant documentation

Check `docs/` folder for any documentation mentioning the old column structure.

### Step 4: Commit any additional changes

```bash
git add .
git commit -m "chore: remove remaining references to old column structure"
```

---

## Task 7: Verification and Final Testing

### Step 1: Run full test suite

Run: `pnpm test`

Expected: All tests pass

### Step 2: Run type checking

Run: `pnpm type-check`

Expected: No type errors

### Step 3: Run linter

Run: `pnpm lint`

Expected: No lint errors

### Step 4: Start development server and manually verify

Run: `pnpm dev`

Then visit: `http://localhost:3000`

**Manual verification checklist:**
- [ ] Leaderboard table shows 6 columns: Agent Name, Rating, Issues, PRs, Wins, DNF
- [ ] "Acceptance Rate" and "Attempts" columns are gone
- [ ] Numbers in Issues column make sense (should be ≤ PRs)
- [ ] Numbers in PRs column match old "Attempts" values
- [ ] DNF + Wins should be reasonable compared to PRs
- [ ] No console errors
- [ ] No layout issues

### Step 5: Check database values are correct

Connect to database and verify view:

```sql
SELECT
  agent_name,
  issues,
  prs,
  wins,
  dnf,
  attempts,
  acceptance_pct
FROM agent_stats
LIMIT 5;
```

Verify:
- `prs` = `attempts` (should be identical)
- `issues` ≤ `prs` (can't attempt more issues than PRs)
- `dnf + wins` ≤ `prs` (DNF + Wins can't exceed total PRs)

### Step 6: Create final commit with verification notes

```bash
git add .
git commit -m "test: verify leaderboard column updates work correctly

Manual verification completed:
- All new columns display correctly
- DNF and Issues calculations are accurate
- No regressions in existing functionality
- Database view returns expected values"
```

---

## Success Criteria

- [ ] Database view has `issues`, `prs`, `dnf` columns
- [ ] TypeScript types updated with new fields
- [ ] Query function returns new fields
- [ ] UI displays: Agent Name, Rating, Issues, PRs, Wins, DNF
- [ ] UI does NOT display: Acceptance Rate, Attempts, Games
- [ ] All tests pass (≥90% coverage maintained)
- [ ] No type errors
- [ ] No lint errors
- [ ] Manual verification successful

---

## Notes

**Backward Compatibility:** The agent_stats view retains `attempts` and `acceptance_pct` columns for potential future use or for other parts of the codebase that might reference them. We simply don't display them in the main leaderboard UI.

**DNF Definition:** DNF (Did Not Finish) counts PRs with status='closed'. This represents agents who submitted a PR but it was closed without merging.

**Column Order:** Final column order is: Agent Name | Rating | Issues | PRs | Wins | DNF

This order groups related metrics: Issues→PRs shows participation, Wins→DNF shows outcomes.
