# Next.js 15 Cache Tags and Revalidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable automatic cache invalidation for database queries using Next.js 15's experimental `use cache` directive with cache tags and webhook-driven revalidation.

**Architecture:** Enable `dynamicIO` experimental feature, wrap all database query functions with `'use cache'` + `cacheTag()`, and add `revalidateTag()` calls to webhook handlers to automatically invalidate cached data when the database changes.

**Tech Stack:** Next.js 15.0.3, Drizzle ORM, Postgres, experimental dynamicIO

---

## Task 1: Enable dynamicIO in Next.js Config

**Files:**
- Modify: `next.config.ts`

**Step 1: Add experimental dynamicIO flag**

In `next.config.ts`, add the experimental flag:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    dynamicIO: true,
  },
  typescript: {
    // DO NOT MODIFY - TypeScript errors must be fixed, not ignored
    ignoreBuildErrors: false,
  },
  eslint: {
    // DO NOT MODIFY - ESLint errors must be fixed, not ignored
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'public.linear.app',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Suppress noisy Linear SDK warnings about missing 'encoding' module
    // The Linear SDK works fine without it - it's an optional dependency
    if (isServer) {
      config.ignoreWarnings = [{ module: /node_modules\/@linear\/sdk/ }]
    }
    return config
  },
}

export default nextConfig
```

**Step 2: Verify config syntax**

Run: `npm run build 2>&1 | head -20`
Expected: Build starts without config errors (may have other errors until we implement caching)

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable dynamicIO experimental feature for cache tags"
```

---

## Task 2: Add Cache Tags to Agent Stats Query

**Files:**
- Modify: `src/lib/queries.ts:36-72` (getAgentStats function)

**Step 1: Import cache functions**

At the top of `src/lib/queries.ts`, add:

```typescript
import { cacheTag } from 'next/cache'
```

**Step 2: Add use cache directive and cache tag to getAgentStats**

Modify the `getAgentStats` function (lines 36-72):

```typescript
export async function getAgentStats(): Promise<AgentStats[]> {
  'use cache'
  cacheTag('agent-stats')

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
```

**Step 3: Test that cache tag is applied**

Run: `npm run dev`
Visit: `http://localhost:3109`
Expected: Homepage loads without errors

**Step 4: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add cache tag to getAgentStats query"
```

---

## Task 3: Add Cache Tags to Issues Query

**Files:**
- Modify: `src/lib/queries.ts:90-166` (getIssues function)

**Step 1: Add use cache directive and cache tag to getIssues**

Modify the `getIssues` function (lines 90-166):

```typescript
export async function getIssues(): Promise<IssueWithAttemptData[]> {
  'use cache'
  cacheTag('issues')

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
    due_date: string | null
    linear_created_at: string | null
    linear_updated_at: string | null
    parent_id: string | null
    arena_ready_labeled_at: string | null
    winner_attempt_id: string | null
    created_at: string
    attempt_count: number
    winner_agent_name: string | null
  }>(sql`
    SELECT
      i.*,
      COALESCE(COUNT(DISTINCT a.id), 0)::integer AS attempt_count,
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
    dueDate: row.due_date ? new Date(row.due_date) : null,
    linearCreatedAt: row.linear_created_at ? new Date(row.linear_created_at) : null,
    linearUpdatedAt: row.linear_updated_at ? new Date(row.linear_updated_at) : null,
    parentId: row.parent_id,
    arenaReadyLabeledAt: row.arena_ready_labeled_at
      ? new Date(row.arena_ready_labeled_at)
      : null,
    winnerAttemptId: row.winner_attempt_id,
    createdAt: new Date(row.created_at),
    attemptCount: row.attempt_count,
    winnerAgentName: row.winner_agent_name,
  }))
}
```

**Step 2: Test homepage loads**

Run: `npm run dev`
Visit: `http://localhost:3109/issues`
Expected: Issues page loads without errors

**Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add cache tag to getIssues query"
```

---

## Task 4: Add Cache Tags to Remaining Query Functions

**Files:**
- Modify: `src/lib/queries.ts` (all remaining query functions)

**Step 1: Add cache tags to getIssueById**

Add `'use cache'` and `cacheTag('issue-detail')` at the start of `getIssueById` function (line ~190):

```typescript
export async function getIssueById(
  id: string
): Promise<IssueWithAgentData | null> {
  'use cache'
  cacheTag('issue-detail')

  // ... rest of function
}
```

**Step 2: Add cache tags to getAttemptsByIssueId**

Add `'use cache'` and `cacheTag('attempts')` at the start of `getAttemptsByIssueId` function (line ~270):

```typescript
export async function getAttemptsByIssueId(
  issueId: string
): Promise<Attempt[]> {
  'use cache'
  cacheTag('attempts')

  return db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issueId))
    .orderBy(desc(attempts.openedAt))
}
```

**Step 3: Add cache tags to getAgentAttempts**

Add `'use cache'` and `cacheTag('agent-attempts')` at the start of `getAgentAttempts` function (line ~339):

```typescript
export async function getAgentAttempts(
  agentName: string
): Promise<AttemptWithIssue[]> {
  'use cache'
  cacheTag('agent-attempts')

  // ... rest of function
}
```

**Step 4: Add cache tags to getAgentTemporalStats**

Add `'use cache'` and `cacheTag('agent-temporal-stats')` at the start of `getAgentTemporalStats` function (line ~497):

```typescript
export async function getAgentTemporalStats(
  days = 30
): Promise<AgentTemporalStat[]> {
  'use cache'
  cacheTag('agent-temporal-stats')

  // ... rest of function
}
```

**Step 5: Add cache tags to getGlobalTemporalStats**

Add `'use cache'` and `cacheTag('global-temporal-stats')` at the start of `getGlobalTemporalStats` function (line ~409):

```typescript
export async function getGlobalTemporalStats(
  days = 30
): Promise<TemporalStat[]> {
  'use cache'
  cacheTag('global-temporal-stats')

  // ... rest of function
}
```

**Step 6: Add cache tags to getAllAttempts**

Add `'use cache'` and `cacheTag('attempts')` at the start of `getAllAttempts` function (line ~654):

```typescript
export async function getAllAttempts(): Promise<AttemptWithIssue[]> {
  'use cache'
  cacheTag('attempts')

  // ... rest of function
}
```

**Step 7: Add cache tags to getIssuesWithAgents**

Add `'use cache'` and `cacheTag('issues-with-agents')` at the start of `getIssuesWithAgents` function (line ~724):

```typescript
export async function getIssuesWithAgents(): Promise<IssueWithAgents[]> {
  'use cache'
  cacheTag('issues-with-agents')

  // ... rest of function
}
```

**Step 8: Add cache tags to getAgentScore**

Add `'use cache'` and `cacheTag('agent-scores')` at the start of `getAgentScore` function (line ~878):

```typescript
export async function getAgentScore(
  agentName: string
): Promise<AgentScore | null> {
  'use cache'
  cacheTag('agent-scores')

  // ... rest of function
}
```

**Step 9: Add cache tags to getAgentScoreHistory**

Add `'use cache'` and `cacheTag('agent-score-history')` at the start of `getAgentScoreHistory` function (line ~898):

```typescript
export async function getAgentScoreHistory(
  agentName: string
): Promise<AgentScoreHistory[]> {
  'use cache'
  cacheTag('agent-score-history')

  // ... rest of function
}
```

**Step 10: Add cache tags to getIssueAgentDetails**

Add `'use cache'` and `cacheTag('issue-agent-details')` at the start of `getIssueAgentDetails` function (line ~957):

```typescript
export async function getIssueAgentDetails(
  issueId: string
): Promise<IssueAgentDetail[]> {
  'use cache'
  cacheTag('issue-agent-details')

  // ... rest of function
}
```

**Step 11: Add cache tags to getAgents**

Add `'use cache'` and `cacheTag('agents')` at the start of `getAgents` function (line ~1009):

```typescript
export async function getAgents(): Promise<Agent[]> {
  'use cache'
  cacheTag('agents')

  return db.select().from(agents).orderBy(agents.name)
}
```

**Step 12: Test all pages load**

Run: `npm run dev`
Test URLs:
- `http://localhost:3109` - Homepage
- `http://localhost:3109/issues` - Issues list
- `http://localhost:3109/admin/agents` - Agents admin

Expected: All pages load without errors

**Step 13: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add cache tags to all remaining query functions"
```

---

## Task 5: Add Revalidation to Linear Webhook

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts`

**Step 1: Import revalidateTag**

At the top of `src/app/api/linear/webhook/route.ts`, add:

```typescript
import { revalidateTag } from 'next/cache'
```

**Step 2: Find locations to add revalidation**

We need to revalidate after:
1. Creating/updating issues
2. Creating/updating attempts
3. Creating/updating issue agents

**Step 3: Add revalidation helper function**

Before the POST handler, add a helper:

```typescript
/**
 * Revalidate all cache tags affected by Linear webhook events
 */
function revalidateLinearData(): void {
  revalidateTag('issues')
  revalidateTag('issue-detail')
  revalidateTag('attempts')
  revalidateTag('agent-stats')
  revalidateTag('agent-temporal-stats')
  revalidateTag('global-temporal-stats')
  revalidateTag('issues-with-agents')
  revalidateTag('issue-agent-details')
  revalidateTag('agent-attempts')
}
```

**Step 4: Add revalidation calls**

Find all successful database operations in the POST handler and add `revalidateLinearData()` calls:

After issue creation/update (around line where `upsertIssue` or similar is called):
```typescript
// After database operation
await upsertIssue(...)
revalidateLinearData()
```

After attempt creation (around line where attempt is created):
```typescript
// After database operation
await createAttempt(...)
revalidateLinearData()
```

After agent dispatch (around line where issue agent is created):
```typescript
// After database operation
await createIssueAgent(...)
revalidateLinearData()
```

**Step 5: Test webhook with dev server**

Run: `npm run dev`
Trigger a Linear webhook (if possible in dev environment)
Visit: `http://localhost:3109`
Expected: Changes appear without manual refresh

**Step 6: Commit**

```bash
git add src/app/api/linear/webhook/route.ts
git commit -m "feat: add cache revalidation to Linear webhook handler"
```

---

## Task 6: Add Revalidation to GitHub Webhook

**Files:**
- Modify: `src/app/api/github/webhook/route.ts`

**Step 1: Import revalidateTag**

At the top of `src/app/api/github/webhook/route.ts`, add:

```typescript
import { revalidateTag } from 'next/cache'
```

**Step 2: Add revalidation helper function**

Before the POST handler, add:

```typescript
/**
 * Revalidate all cache tags affected by GitHub webhook events
 */
function revalidateGitHubData(): void {
  revalidateTag('attempts')
  revalidateTag('agent-stats')
  revalidateTag('agent-temporal-stats')
  revalidateTag('global-temporal-stats')
  revalidateTag('issues')
  revalidateTag('issue-detail')
  revalidateTag('issues-with-agents')
  revalidateTag('issue-agent-details')
  revalidateTag('agent-attempts')
  revalidateTag('agent-scores')
  revalidateTag('agent-score-history')
}
```

**Step 3: Add revalidation calls**

Find all successful database operations in the POST handler:

After PR update (around line where attempt is updated):
```typescript
// After database operation
await updateAttempt(...)
revalidateGitHubData()
```

After PR merge (around line where ratings are updated):
```typescript
// After database operation
await updateRatings(...)
revalidateGitHubData()
```

**Step 4: Test webhook with dev server**

Run: `npm run dev`
Trigger a GitHub webhook (if possible in dev environment)
Visit: `http://localhost:3109`
Expected: Changes appear without manual refresh

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/route.ts
git commit -m "feat: add cache revalidation to GitHub webhook handler"
```

---

## Task 7: Add Revalidation to Agent Discovery

**Files:**
- Modify: `src/app/api/agents/discover/route.ts`

**Step 1: Import revalidateTag**

At the top of `src/app/api/agents/discover/route.ts`, add:

```typescript
import { revalidateTag } from 'next/cache'
```

**Step 2: Add revalidation after agent discovery**

Find where agents are discovered/updated (likely near the end of successful discovery):

```typescript
// After agent discovery completes
await discoverAgents(...)

// Revalidate agent-related caches
revalidateTag('agents')
revalidateTag('agent-stats')
revalidateTag('agent-temporal-stats')
```

**Step 3: Test agent discovery**

Run: `npm run dev`
Visit: `http://localhost:3109/admin/agents`
Trigger agent discovery
Expected: New agents appear without manual refresh

**Step 4: Commit**

```bash
git add src/app/api/agents/discover/route.ts
git commit -m "feat: add cache revalidation to agent discovery"
```

---

## Task 8: Test Full Cache Invalidation Flow

**Files:**
- Test: Manual testing across all pages

**Step 1: Build and run production mode**

```bash
npm run build
npm start
```

Expected: Build succeeds, server starts on port 3109

**Step 2: Test homepage cache**

1. Visit `http://localhost:3109`
2. Note the current stats
3. Trigger a webhook or manual data change
4. Refresh page
Expected: See updated data without build/restart

**Step 3: Test issue detail cache**

1. Visit an issue detail page
2. Trigger a PR update webhook
3. Refresh page
Expected: See updated PR status

**Step 4: Test agents page cache**

1. Visit `http://localhost:3109/admin/agents`
2. Trigger agent discovery
3. Refresh page
Expected: See new agents

**Step 5: Verify no errors in logs**

Check server logs for:
- No cache-related errors
- Successful revalidation messages
Expected: Clean logs, no errors

**Step 6: Document results**

Create: `docs/cache-invalidation-testing.md`

```markdown
# Cache Invalidation Testing Results

Tested: 2025-11-12

## Test Results

### Homepage
- Initial load: ✓
- After webhook: ✓
- Cache revalidation: ✓

### Issue Detail
- Initial load: ✓
- After PR update: ✓
- Cache revalidation: ✓

### Agents Admin
- Initial load: ✓
- After discovery: ✓
- Cache revalidation: ✓

## Performance Notes

[Add any observations about cache hit rates, load times, etc.]
```

**Step 7: Commit test results**

```bash
git add docs/cache-invalidation-testing.md
git commit -m "docs: add cache invalidation testing results"
```

---

## Task 9: Update Deployment Documentation

**Files:**
- Modify: `docs/DEPLOYMENT.md`

**Step 1: Add cache configuration section**

Add a new section after "Environment Variables":

```markdown
### 4. Cache Configuration

This application uses Next.js 15's experimental `dynamicIO` feature for automatic cache invalidation:

- Database queries are cached with cache tags
- Webhooks automatically revalidate cached data
- No manual page refreshes needed for data updates

**How it works:**
1. Query functions use `'use cache'` + `cacheTag()` to cache results
2. Webhooks call `revalidateTag()` after database updates
3. Next.js automatically serves fresh data on next request

**No additional configuration needed** - this works automatically in production.
```

**Step 2: Update troubleshooting section**

Add to troubleshooting:

```markdown
### Stale data appearing on pages

- Verify `experimental.dynamicIO: true` is in `next.config.ts`
- Check webhook logs for revalidation calls
- Ensure database operations are followed by `revalidateTag()` calls
- Try manually refreshing the page (Cmd+Shift+R or Ctrl+F5)
```

**Step 3: Commit documentation**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: add cache configuration and troubleshooting"
```

---

## Final Verification Checklist

- [ ] `experimental.dynamicIO` enabled in next.config.ts
- [ ] All query functions have `'use cache'` and `cacheTag()`
- [ ] Linear webhook calls `revalidateTag()` after data changes
- [ ] GitHub webhook calls `revalidateTag()` after data changes
- [ ] Agent discovery calls `revalidateTag()` after updates
- [ ] All pages load without errors in dev mode
- [ ] Build succeeds without cache-related errors
- [ ] Production mode serves fresh data after webhooks
- [ ] Documentation updated with cache configuration
- [ ] All commits have clear, descriptive messages

---

## Expected Outcome

After implementing this plan:

1. **Automatic cache invalidation**: Database changes from webhooks automatically invalidate cached pages
2. **No manual refresh needed**: Users see fresh data on next page load after webhook events
3. **Performance improvement**: Cached queries reduce database load
4. **Developer experience**: Clear cache tags make invalidation logic obvious
5. **Production ready**: Works automatically on Vercel with no special configuration

## Notes

- Cache tags use descriptive names matching the data domain (e.g., 'agent-stats', 'issues')
- Revalidation is broad (invalidates multiple tags) to ensure consistency
- `revalidateTag()` uses stale-while-revalidate, so users may see brief stale data
- For immediate updates, could use `updateTag()` instead in Server Actions
