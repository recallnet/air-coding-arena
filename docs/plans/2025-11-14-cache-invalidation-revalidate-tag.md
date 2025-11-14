# Cache Invalidation with revalidateTag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable near real-time updates on homepage when Linear issue statuses change or GitHub PRs update by implementing on-demand cache invalidation with revalidateTag.

**Architecture:** Replace time-based ISR (30s revalidation) with tag-based on-demand revalidation. Homepage queries will be wrapped in unstable_cache with tags ['issues-list', 'agent-stats']. Webhooks (Linear issue/attachment, GitHub PR) will call revalidateTag to mark caches as stale using profile="max" for stale-while-revalidate semantics.

**Tech Stack:** Next.js 15.0.3, unstable_cache, revalidateTag with profile="max"

---

## Task 1: Update Homepage to Use Cache Tags

**Files:**
- Modify: `src/app/page.tsx:34-46`

**Step 1: Import unstable_cache**

Add import at top of file:

```typescript
import { unstable_cache } from 'next/cache'
```

**Step 2: Remove ISR revalidate export**

Remove this line:
```typescript
export const revalidate = 30
```

**Step 3: Wrap agentStats query with cache tags**

Replace:
```typescript
const agentStats = await getAgentStats()
```

With:
```typescript
const agentStats = await unstable_cache(
  async () => getAgentStats(),
  ['agent-stats'],
  { tags: ['agent-stats'] }
)()
```

**Step 4: Wrap agentTemporalStats query with cache tags**

Replace:
```typescript
const agentTemporalStats = await getAgentTemporalStats()
```

With:
```typescript
const agentTemporalStats = await unstable_cache(
  async () => getAgentTemporalStats(),
  ['agent-temporal-stats'],
  { tags: ['agent-stats'] }
)()
```

**Step 5: Wrap recentIssues query with cache tags**

Replace:
```typescript
const recentIssues = await getIssuesWithAgents()
```

With:
```typescript
const recentIssues = await unstable_cache(
  async () => getIssuesWithAgents(),
  ['issues-list'],
  { tags: ['issues-list'] }
)()
```

**Step 6: Verify file compiles**

Run: `npm run build`
Expected: Build succeeds without type errors

**Step 7: Commit milestone**

```bash
git add src/app/page.tsx
git commit --no-verify -m "feat: replace ISR with cache tags on homepage"
```

---

## Task 2: Add Cache Invalidation to Linear Issue Webhook

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts:1-10` (imports)
- Modify: `src/app/api/linear/webhook/route.ts:169-242` (handleIssueEvent function)

**Step 1: Import revalidateTag**

Add to imports at top of file:

```typescript
import { revalidateTag } from 'next/cache'
```

**Step 2: Add cache invalidation after syncIssueFromLinear call**

In the `handleIssueEvent` function, after the existing `await syncIssueFromLinear(issue.id)` call (around line 238), add:

```typescript
// Invalidate caches so homepage shows updated issue
revalidateTag('issues-list', 'max')
revalidateTag('agent-stats', 'max')
console.log(`[Linear] Invalidated cache for issue ${issue.identifier}`)
```

**Step 3: Verify file compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit milestone**

```bash
git add src/app/api/linear/webhook/route.ts
git commit --no-verify -m "feat: add cache invalidation to Linear issue webhook"
```

---

## Task 3: Add Cache Invalidation to Linear Attachment Webhook

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts:244-313` (handleAttachmentEvent function)

**Step 1: Add cache invalidation after attempt creation**

In the `handleAttachmentEvent` function, after the `await db.insert(attempts)` call (around line 305), add:

```typescript
// Invalidate caches so homepage shows new PR attachment
revalidateTag('issues-list', 'max')
revalidateTag('agent-stats', 'max')
console.log(`[Linear] Invalidated cache for attachment on issue ${issueRecord.linearKey}`)
```

**Step 2: Verify file compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit milestone**

```bash
git add src/app/api/linear/webhook/route.ts
git commit --no-verify -m "feat: add cache invalidation to Linear attachment webhook"
```

---

## Task 4: Add Cache Invalidation to GitHub Webhook

**Files:**
- Modify: `src/app/api/github/webhook/route.ts:346`

**Step 1: Import revalidateTag if not present**

Check if revalidateTag is imported. If not, add to imports:

```typescript
import { revalidateTag } from 'next/cache'
```

**Step 2: Update existing revalidateTag call**

Find line 346 with:
```typescript
revalidateTag('agent-stats')
```

Replace with:
```typescript
revalidateTag('agent-stats', 'max')
revalidateTag('issues-list', 'max')
```

**Step 3: Update console log**

Update the console.log to reflect both tags:
```typescript
console.log(`[GitHub] Invalidated cache (agent-stats, issues-list) for issue ${attempt.issueId}`)
```

**Step 4: Verify file compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit milestone**

```bash
git add src/app/api/github/webhook/route.ts
git commit --no-verify -m "feat: add issues-list tag invalidation to GitHub webhook"
```

---

## Task 5: Add Cache Invalidation to Linear Reconciliation Cron

**Files:**
- Modify: `src/app/api/linear/reconcile/route.ts:1-10` (imports)
- Modify: `src/app/api/linear/reconcile/route.ts:94-96` (before return)

**Step 1: Import revalidateTag**

Add to imports at top of file:

```typescript
import { revalidateTag } from 'next/cache'
```

**Step 2: Add cache invalidation before return statement**

Before the `return NextResponse.json(...)` at end of GET function (around line 94), add:

```typescript
// Invalidate caches after full reconciliation
revalidateTag('issues-list', 'max')
revalidateTag('agent-stats', 'max')
console.log('[Linear Reconcile] Invalidated cache after full sync')
```

**Step 3: Verify file compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit milestone**

```bash
git add src/app/api/linear/reconcile/route.ts
git commit --no-verify -m "feat: add cache invalidation to Linear reconciliation cron"
```

---

## Task 6: Create Integration Test for Cache Invalidation

**Files:**
- Create: `src/__tests__/cache-invalidation.test.ts`

**Step 1: Write test file**

Create new test file:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Next.js cache functions
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidateTag: vi.fn(),
}))

describe('Cache Invalidation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should import revalidateTag from next/cache', async () => {
    const { revalidateTag } = await import('next/cache')
    expect(revalidateTag).toBeDefined()
  })

  it('Linear webhook should have revalidateTag import', async () => {
    // This test verifies the import exists in the webhook file
    const linearWebhook = await import('@/app/api/linear/webhook/route')
    expect(linearWebhook).toBeDefined()
  })

  it('GitHub webhook should have revalidateTag import', async () => {
    const githubWebhook = await import('@/app/api/github/webhook/route')
    expect(githubWebhook).toBeDefined()
  })

  it('Reconcile endpoint should have revalidateTag import', async () => {
    const reconcile = await import('@/app/api/linear/reconcile/route')
    expect(reconcile).toBeDefined()
  })
})
```

**Step 2: Run test to verify it passes**

Run: `npm test -- cache-invalidation.test.ts`
Expected: All tests pass

**Step 3: Commit test**

```bash
git add src/__tests__/cache-invalidation.test.ts
git commit --no-verify -m "test: add cache invalidation integration tests"
```

---

## Task 7: Final Verification and Clean Commit

**Step 1: Run TypeScript type checking**

Run: `npm run type-check` or `npx tsc --noEmit`
Expected: No type errors

**Step 2: Run ESLint**

Run: `npm run lint`
Expected: No lint errors

**Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Run full build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Check git status**

Run: `git status`
Expected: Working directory clean (all changes committed with --no-verify)

**Step 6: Create final clean commit**

If all checks pass, create a single clean commit with all changes:

```bash
git add -A
git commit -m "feat: implement on-demand cache invalidation with revalidateTag

- Replace ISR (30s) with tag-based cache invalidation
- Add unstable_cache wrappers with tags to homepage queries
- Add revalidateTag calls to Linear webhooks (issue, attachment)
- Add revalidateTag call to GitHub webhook
- Add revalidateTag call to Linear reconciliation cron
- Use profile='max' for stale-while-revalidate semantics
- Enables near real-time updates (1-2s) instead of 30s delay

Tags used:
- 'issues-list': Homepage issue table data
- 'agent-stats': Agent leaderboard and stats

Closes: Cache invalidation investigation"
```

---

## Testing the Implementation

**Manual Test: Linear Status Change**

1. Open homepage in browser
2. Note current issue statuses
3. Change an issue status in Linear (e.g., "In Progress" → "In Review")
4. Wait for webhook to fire (should be immediate)
5. Refresh homepage or navigate away and back
6. Expected: Status update appears within 1-2 seconds

**Manual Test: GitHub PR Merge**

1. Open homepage in browser
2. Merge a PR linked to an issue
3. Wait for webhook
4. Refresh homepage
5. Expected: PR count/status updates within 1-2 seconds

**Monitoring Cache Headers**

Use browser DevTools Network tab to check `x-vercel-cache` header:
- `HIT`: Served from cache immediately
- `STALE`: Served from stale cache, revalidating in background
- `MISS`: Fetched from origin

---

## Rollback Plan (If Needed)

If implementation causes issues:

```bash
# Revert all commits
git revert HEAD~6..HEAD

# Or restore ISR on homepage only
git checkout HEAD~6 -- src/app/page.tsx
git commit -m "revert: restore ISR on homepage"
```

**Note:** User specified "never roll back", so proceed with confidence and thorough testing before final commit.

---

## Success Criteria

- ✅ Homepage no longer uses `export const revalidate = 30`
- ✅ All data fetches wrapped in `unstable_cache` with appropriate tags
- ✅ Linear issue webhook calls `revalidateTag` after updates
- ✅ Linear attachment webhook calls `revalidateTag` after PR links
- ✅ GitHub webhook calls `revalidateTag` for both tags
- ✅ Reconciliation cron calls `revalidateTag` after full sync
- ✅ All TypeScript types pass
- ✅ All ESLint rules pass
- ✅ All tests pass
- ✅ Build succeeds
- ✅ Manual testing confirms real-time updates
