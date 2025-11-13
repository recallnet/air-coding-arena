# GitHub Webhook Integration: PR Iteration & CI Tracking

**Date:** 2025-11-12
**Updated:** 2025-11-12 (Added CI status tracking)
**Status:** 📋 Planning
**Priority:** HIGH
**Complexity:** Medium

---

## Executive Summary

Implement GitHub webhook handler to track PR iteration cycles and CI status during agent competitions. Currently, the system only tracks PR open/merge/close events via Linear attachments. This misses critical quality signals: iteration counts, CI pass/fail status, and the feedback loop that measures agent quality.

**Current Gaps:**
- `commitCount` field exists in schema but never gets updated (stuck at 1)
- No visibility into whether an agent's PR has passing CI/tests

**Goals:**
- Track PR evolution through review cycles to measure iteration efficiency
- Track CI status to identify agents with passing tests vs failing tests

---

## What's New (Updated 2025-11-12)

**CI Status Tracking Added:**
- New schema fields: `ciStatus`, `ciLastCheckedAt`
- Support for both modern Check Runs API and legacy Status API
- Webhooks: `check_suite.completed` and `status` events
- Dashboard can now show: ✅ passing, ❌ failing, ⏳ pending, ⚠️ error
- +13 unit tests (38 total, was 25)
- +1.5 days to implementation timeline (14 days total, was 12)

**Why this matters:**
- Reviewers can quickly see which PRs are ready (green CI)
- Measure "% of agents that submit with passing tests"
- Avoid wasting time reviewing PRs with failing tests
- Quality signal: agents with green CI on first push vs multiple iterations

---

## Problem Statement

### What We Track Today ✅

Via Linear attachment webhooks:
- PR opened timestamp
- PR merged/closed status
- Final outcome (which agent won)

### What We're Missing ❌

Via GitHub PR events:
- Additional commits pushed after initial PR
- Updated commit count as agent iterates
- PR synchronize events (new commits)
- Accurate timeline of work iterations
- **CI status (passing/failing tests)**
- **Check run results (build, lint, tests)**

### Real-World Impact

**Scenario 1:** Reviewer asks agent to add tests
- ❌ System doesn't see the 3 additional commits agent pushes
- ❌ `commitCount` stays at 1 forever
- ❌ Can't measure "time from review feedback to next commit"
- ❌ Can't identify which agents iterate well vs ignore feedback

**Scenario 2:** Agent submits PR with failing tests
- ❌ Dashboard shows PR as "submitted" but doesn't indicate CI is red
- ❌ Can't quickly see which PRs are ready for review (green CI)
- ❌ Can't measure "% of PRs with passing CI on first push"
- ❌ Reviewers waste time on PRs that aren't ready

---

## Current State Verification

### State Machine: Working ✅

**Agent states** (from docs/arena-state-machine.md):
```
pending → submitted → accepted/rejected
```

**Winner selection** (src/app/api/linear/webhook/route.ts:304-331):
- Selects first merged PR by `mergedAt` timestamp
- Marks other PRs as `closed`
- Sets `winner_attempt_id` on issue
- ✅ Handles edge case of multiple PRs merged (both get `accepted` status)

**Agent status derivation** (src/lib/queries.ts:615-644):
- Checks if agent's PR is winner
- Checks if agent has any merged PR
- Falls back to open/closed/pending
- ✅ Multiple agents can show `accepted` if both merged

### Schema: Needs Update 🔧

**Attempts table** (src/db/schema.ts:61-85):
```typescript
commitCount: integer('commit_count').notNull().default(1), // ← Update via synchronize
lastCommitSha: text('last_commit_sha'), // ← Update via synchronize
// NEW FIELDS NEEDED:
ciStatus: text('ci_status'), // ← 'pending' | 'success' | 'failure' | 'error' | null
ciLastCheckedAt: timestamp('ci_last_checked_at'), // ← When we last got CI status
```

**Schema Migration Required:**
```sql
ALTER TABLE attempts ADD COLUMN ci_status TEXT;
ALTER TABLE attempts ADD COLUMN ci_last_checked_at TIMESTAMP WITH TIME ZONE;
```

---

## Ground Truth: Real PR Analysis

### Example: recallnet/js-recall#1559

**Fetched via GitHub API on 2025-11-12:**

**Author:** `engine-labs-app[bot]` (bot account)
**Commits:** 1 commit by `engine-labs-app[bot]`
**SHA:** `509ccf3b05537c0827a6abb5e9f3dac0248a350b`

**Comments (2):**
1. `vercel[bot]` - Deployment status table
2. `github-actions[bot]` - Test coverage report

**Key Insight:** Automated actors dominate PR activity
- Vercel bot: Deployment previews
- GitHub Actions: CI/CD results
- No human reviews yet on this PR

### Bot Actor Patterns

**Confirmed bot accounts in your repo:**
- `vercel[bot]` - Type: Bot, App: vercel
- `github-actions[bot]` - Type: Bot
- `cto-new` - Bot account (opens PRs)
- `engine-labs-app[bot]` - Commit author

**Bot comment identification:**
```json
{
  "user": {
    "login": "vercel[bot]",
    "type": "Bot"
  }
}
```

**Filter strategy:** `user.type === "Bot"` or `user.login.endsWith("[bot]")`

---

## Architecture Design

### GitHub Webhook Handler

**Endpoint:** `/api/github/webhook/route.ts` (NEW FILE)

**Events to handle:**
1. `pull_request.synchronize` - Agent pushes new commits → update commitCount
2. `pull_request.opened` - Track if Linear missed it
3. `pull_request.closed` - Update final status
4. **`check_suite.completed`** - CI finished running → update ciStatus
5. **`status`** - Commit status updated (fallback for repos using Status API)

**NOT handling initially:**
- Review comments (phase 2)
- Review approvals (phase 2)
- Issue comments on PRs (phase 2)

### Data Flow

```
GitHub PR Event
  ↓
POST /api/github/webhook
  ↓
Verify HMAC signature (X-Hub-Signature-256)
  ↓
Check idempotency (events table)
  ↓
Route by event type
  ↓
Update attempts table:
  - commitCount (from GitHub API)
  - lastCommitSha
  - status (if closed)
```

### Webhook Payload Structure

**pull_request.synchronize:**
```json
{
  "action": "synchronize",
  "pull_request": {
    "number": 1559,
    "head": {
      "sha": "509ccf3b...",
      "repo": {
        "full_name": "recallnet/js-recall"
      }
    },
    "base": {
      "repo": {
        "full_name": "recallnet/js-recall"
      }
    }
  },
  "repository": {
    "full_name": "recallnet/js-recall"
  }
}
```

**Critical:** Must call GitHub API to get accurate commit count
- Webhook payload doesn't include total commits
- Must use: `GET /repos/{owner}/{repo}/pulls/{number}/commits`
- Count commits to update `commitCount`

---

## CI Status Tracking Details

### GitHub Check Suites vs Status API

GitHub has two systems for CI status:

1. **Check Runs API** (modern, recommended)
   - Used by GitHub Actions, CircleCI, Travis CI
   - Webhook: `check_suite.completed`
   - Status values: `success`, `failure`, `neutral`, `cancelled`, `timed_out`, `action_required`

2. **Status API** (legacy, but still used)
   - Used by older CI systems
   - Webhook: `status`
   - Status values: `success`, `failure`, `error`, `pending`

**Strategy:** Handle both events, normalize to common values.

### CI Status Mapping

```typescript
type CIStatus = 'pending' | 'success' | 'failure' | 'error' | null

// Map GitHub values → our schema
const normalizeCIStatus = (github: string): CIStatus => {
  if (github === 'success') return 'success'
  if (github === 'failure' || github === 'timed_out' || github === 'cancelled') return 'failure'
  if (github === 'error' || github === 'action_required') return 'error'
  if (github === 'pending' || github === 'neutral') return 'pending'
  return null
}
```

### What CI Status Tells Us

- **`success`**: All checks passed → PR is ready for review
- **`failure`**: Tests failed → Agent needs to fix code
- **`error`**: CI had a problem (config issue, infrastructure)
- **`pending`**: CI is currently running
- **`null`**: No CI configured for this PR

### UI Benefits

Dashboard can now show:
- ✅ Green checkmark for passing CI
- ❌ Red X for failing CI
- ⏳ Yellow spinner for pending CI
- ⚠️ Warning icon for CI errors
- Filter: "Show only PRs with passing tests"

---

## Implementation Plan

### Phase 0: Schema Migration (NEW)

#### Task 0: Add CI Status Fields
**File:** `src/db/schema.ts`

**Changes:**
```typescript
export const attempts = pgTable('attempts', {
  // ... existing fields ...
  ciStatus: text('ci_status'), // 'pending' | 'success' | 'failure' | 'error' | null
  ciLastCheckedAt: timestamp('ci_last_checked_at', { withTimezone: true }),
})
```

**Migration:** `drizzle-kit generate` → `drizzle-kit migrate`

**Tests:**
- Schema includes new fields
- Default values work (null)
- Queries return ciStatus correctly

---

### Phase 1: Infrastructure (Tasks 1-3)

#### Task 1: Create GitHub Webhook Route
**File:** `src/app/api/github/webhook/route.ts`

**Scaffold:**
```typescript
import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { events } from '@/db/schema'

type GitHubWebhookPayload = {
  action: string
  pull_request?: {
    number: number
    head: { sha: string; repo: { full_name: string } }
    base: { repo: { full_name: string } }
  }
  repository: { full_name: string }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify signature
  // 2. Check idempotency
  // 3. Route by event
  // 4. Return success
}
```

**Tests:** `src/app/api/github/webhook/route.test.ts`
- Valid signature passes
- Invalid signature returns 401
- Duplicate events return "duplicate"
- Unknown repos ignored (ALLOWED_REPOS check)

#### Task 2: Signature Verification
**Function:** `verifyGitHubSignature()`

**Logic:**
```typescript
function verifyGitHubSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false

  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) throw new Error('GITHUB_WEBHOOK_SECRET not configured')

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}
```

**Reference:** [GitHub Webhook Signature Docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

**Tests:**
- Valid HMAC passes
- Invalid HMAC fails
- Missing signature fails
- Missing secret throws error

#### Task 3: Idempotency Check
**Table:** `events` (already exists)

**Logic:**
```typescript
const eventKey = `github:${payload.action}:${prNumber}:${headSha}`

const existing = await db
  .insert(events)
  .values({
    source: 'github',
    key: eventKey,
    payload,
  })
  .onConflictDoNothing({ target: [events.source, events.key] })
  .returning({ id: events.id })

if (existing.length === 0) {
  return NextResponse.json({ status: 'duplicate' })
}
```

**Tests:**
- First webhook creates event
- Second webhook with same key returns duplicate
- Different PRs create separate events

---

### Phase 2: PR Synchronize Handler (Tasks 4-6)

#### Task 4: Handle pull_request.synchronize
**Function:** `handlePullRequestSynchronize()`

**Logic:**
```typescript
async function handlePullRequestSynchronize(
  payload: GitHubWebhookPayload
): Promise<void> {
  const pr = payload.pull_request
  if (!pr) return

  const repo = payload.repository.full_name
  const prNumber = pr.number
  const headSha = pr.head.sha

  // Check if this PR is tracked (belongs to an arena issue)
  const attempt = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.repo, repo),
        eq(attempts.prNumber, prNumber)
      )
    )
    .limit(1)

  if (!attempt[0]) {
    console.log(`Ignoring PR ${repo}#${prNumber} - not tracked in arena`)
    return
  }

  // Fetch commit count from GitHub API
  const commitCount = await getCommitCount(repo, prNumber)

  // Update attempt
  await db
    .update(attempts)
    .set({
      commitCount,
      lastCommitSha: headSha,
    })
    .where(eq(attempts.id, attempt[0].id))

  console.log(`Updated PR ${repo}#${prNumber}: ${commitCount} commits`)
}
```

**Tests:**
- Tracked PR updates commitCount
- Untracked PR ignored (no error)
- Multiple syncs update progressively
- lastCommitSha updated to latest

#### Task 5: GitHub API Integration
**Function:** `getCommitCount()`

**Logic:**
```typescript
async function getCommitCount(repo: string, prNumber: number): Promise<number> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN not configured')

  const [owner, repoName] = repo.split('/')
  const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/commits`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const commits = await response.json()
  return commits.length
}
```

**Reference:** [GitHub List PR Commits API](https://docs.github.com/en/rest/pulls/pulls#list-commits-on-a-pull-request)

**Tests:**
- Mock GitHub API response
- Returns correct commit count
- Handles API errors gracefully
- Respects rate limits (future: add caching)

#### Task 6: Handle pull_request.opened
**Function:** `handlePullRequestOpened()`

**Purpose:** Fallback in case Linear attachments are slow

**Logic:**
```typescript
async function handlePullRequestOpened(
  payload: GitHubWebhookPayload
): Promise<void> {
  // Similar to Linear attachment handler
  // Check if PR belongs to arena issue
  // Create attempt if not exists
  // Set initial commitCount from API
}
```

**Tests:**
- Creates attempt if missing
- Skips if already tracked by Linear
- Parses agent name from branch/title
- Links to issue if found

---

### Phase 3: PR Close Handler (Task 7)

#### Task 7: Handle pull_request.closed
**Function:** `handlePullRequestClosed()`

**Logic:**
```typescript
async function handlePullRequestClosed(
  payload: GitHubWebhookPayload
): Promise<void> {
  const pr = payload.pull_request
  if (!pr) return

  const merged = pr.merged ?? false
  const closedAt = new Date(pr.closed_at)

  await db
    .update(attempts)
    .set({
      status: merged ? 'merged' : 'closed',
      mergedAt: merged ? closedAt : null,
      closedAt,
    })
    .where(
      and(
        eq(attempts.repo, payload.repository.full_name),
        eq(attempts.prNumber, pr.number)
      )
    )

  // If merged, trigger winner selection
  if (merged) {
    const attempt = await getAttempt(payload.repository.full_name, pr.number)
    if (attempt) {
      await updateWinner(attempt.issueId)
    }
  }
}
```

**Tests:**
- Merged PR updates status='merged', mergedAt set
- Closed (not merged) PR updates status='closed'
- Triggers winner selection on merge
- Handles missing attempts gracefully

---

### Phase 4: CI Status Handlers (Tasks 8-9) **NEW**

#### Task 8: Handle check_suite.completed
**Function:** `handleCheckSuiteCompleted()`

**Purpose:** Update CI status when GitHub Actions / modern CI completes

**Logic:**
```typescript
async function handleCheckSuiteCompleted(
  payload: {
    check_suite: {
      head_sha: string
      conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | null
      pull_requests: Array<{ number: number }>
    }
    repository: { full_name: string }
  }
): Promise<void> {
  const conclusion = payload.check_suite.conclusion
  if (!conclusion) return // Still running

  const ciStatus = normalizeCIStatus(conclusion)
  const repo = payload.repository.full_name
  const prNumbers = payload.check_suite.pull_requests.map(pr => pr.number)

  // Update all PRs associated with this check suite
  for (const prNumber of prNumbers) {
    await db
      .update(attempts)
      .set({
        ciStatus,
        ciLastCheckedAt: new Date(),
      })
      .where(
        and(
          eq(attempts.repo, repo),
          eq(attempts.prNumber, prNumber)
        )
      )

    console.log(`Updated CI status for ${repo}#${prNumber}: ${ciStatus}`)
  }
}
```

**Tests:**
- Success check suite → ciStatus='success'
- Failure check suite → ciStatus='failure'
- Cancelled/timed_out → ciStatus='failure'
- Action required → ciStatus='error'
- Updates ciLastCheckedAt timestamp
- Handles multiple PRs in one check suite

#### Task 9: Handle status (Legacy CI)
**Function:** `handleStatus()`

**Purpose:** Fallback for repos using legacy Status API

**Logic:**
```typescript
async function handleStatus(
  payload: {
    sha: string
    state: 'success' | 'failure' | 'error' | 'pending'
    context: string // e.g., "continuous-integration/travis-ci"
    target_url: string | null
    branches: Array<{ name: string }>
    repository: { full_name: string }
  }
): Promise<void> {
  const ciStatus = normalizeCIStatus(payload.state)
  const repo = payload.repository.full_name
  const sha = payload.sha

  // Find PR(s) with this commit SHA
  const prAttempts = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.repo, repo),
        eq(attempts.lastCommitSha, sha)
      )
    )

  if (prAttempts.length === 0) {
    console.log(`No tracked PRs for commit ${sha}`)
    return
  }

  // Update all matching PRs
  for (const attempt of prAttempts) {
    await db
      .update(attempts)
      .set({
        ciStatus,
        ciLastCheckedAt: new Date(),
      })
      .where(eq(attempts.id, attempt.id))

    console.log(`Updated CI status for PR#${attempt.prNumber}: ${ciStatus}`)
  }
}
```

**Tests:**
- Success status → ciStatus='success'
- Failure status → ciStatus='failure'
- Error status → ciStatus='error'
- Pending status → ciStatus='pending'
- Finds PR by lastCommitSha
- Handles multiple PRs with same SHA
- Ignores unknown commits (not tracked)

---

### Phase 5: Integration & Testing (Tasks 10-12)

#### Task 10: Environment Configuration

**Required env vars:**
```bash
GITHUB_WEBHOOK_SECRET=<random string, 64+ chars>
GITHUB_TOKEN=<fine-grained PAT>
ALLOWED_REPOS=recallnet/js-recall,recallnet/other-repo
```

**GitHub Token Permissions (Fine-Grained PAT):**
- Repository: Pull requests (Read)
- Repository: Contents (Read)
- No write access needed

**Webhook Setup (GitHub repo settings):**
- URL: `https://your-domain.com/api/github/webhook`
- Content type: `application/json`
- Secret: Same as `GITHUB_WEBHOOK_SECRET`
- Events:
  - ✅ Pull requests
  - ✅ **Check suites** (NEW - for CI status)
  - ✅ **Statuses** (NEW - legacy CI fallback)
  - ❌ Issue comments (phase 2)
  - ❌ Pull request reviews (phase 2)

#### Task 11: End-to-End Test Script

**Script:** `scripts/test-github-webhook.ts`

**Flow:**
1. Find an open PR in tracked repo
2. Push a dummy commit (or use test repo)
3. Wait for webhook to fire
4. Query database for updated commitCount
5. Verify lastCommitSha matches latest

**Validation:**
```typescript
const before = await getAttempt(repo, prNumber)
console.log(`Before: ${before.commitCount} commits, CI: ${before.ciStatus}`)

// Trigger PR synchronize (push commit)
await pushCommit(repo, branch)

// Wait for webhooks (PR sync + CI)
await sleep(10000) // CI takes longer

const after = await getAttempt(repo, prNumber)
console.log(`After: ${after.commitCount} commits, CI: ${after.ciStatus}`)

assert(after.commitCount > before.commitCount, 'Commit count should increase')
assert(after.lastCommitSha !== before.lastCommitSha, 'SHA should update')
assert(after.ciStatus !== null, 'CI status should be set')
assert(after.ciLastCheckedAt > before.ciLastCheckedAt, 'CI timestamp updated')
```

#### Task 12: Update Documentation

**Files to update:**
1. `README.md` - Add GitHub webhook setup instructions
2. `docs/arena-state-machine.md` - Document PR iteration tracking
3. `docs/CHANGELOG.md` - Add this implementation
4. `docs/plans/M2-DEPLOYMENT.md` - Update webhook requirements

---

## Database Schema Changes

### Migration Required 🔧

**New fields to add:**

```typescript
// src/db/schema.ts
export const attempts = pgTable('attempts', {
  // Existing fields (we update these)
  commitCount: integer('commit_count').notNull().default(1), // ← Update via synchronize
  lastCommitSha: text('last_commit_sha'), // ← Update via synchronize
  status: text('status').notNull(), // ← Update on close
  mergedAt: timestamp('merged_at', { withTimezone: true }), // ← Update on close
  closedAt: timestamp('closed_at', { withTimezone: true }), // ← Update on close

  // NEW FIELDS (add these)
  ciStatus: text('ci_status'), // ← 'pending' | 'success' | 'failure' | 'error' | null
  ciLastCheckedAt: timestamp('ci_last_checked_at', { withTimezone: true }), // ← CI check timestamp
})
```

**Migration steps:**
1. Add fields to schema.ts
2. Run `npm run db:generate` (creates migration file)
3. Run `npm run db:migrate` (applies to database)
4. Update TypeScript types in queries.ts

---

## Security Considerations

### 1. Signature Verification
- ✅ HMAC SHA-256 validation required
- ✅ Timing-safe comparison to prevent timing attacks
- ✅ Reject unsigned requests (401)

### 2. Repository Allowlist
- ✅ Check `ALLOWED_REPOS` before processing
- ✅ Ignore webhooks from unknown repos
- ✅ Prevents abuse from forked repos

### 3. Token Permissions
- ✅ Read-only GitHub token (no write access)
- ✅ Scoped to specific repos
- ✅ Fine-grained PAT (not classic token)

### 4. Rate Limiting
- ⚠️ GitHub API: 5000 req/hour (authenticated)
- ⚠️ Monitor usage if processing many PRs
- 💡 Future: Cache commit counts for 60s

### 5. Idempotency
- ✅ Events table prevents duplicate processing
- ✅ Safe to replay webhooks
- ✅ Database updates are upserts

---

## Testing Strategy

### Unit Tests (Vitest)

**File:** `src/app/api/github/webhook/route.test.ts`

**Coverage goals:** >90% (matching project standard)

**Test cases:**
1. Signature verification (5 tests)
   - Valid signature passes
   - Invalid signature returns 401
   - Missing signature returns 401
   - Missing secret throws error
   - Timing-safe comparison
2. Idempotency (3 tests)
   - First event processes
   - Second event returns duplicate
   - Different events process separately
3. pull_request.synchronize (6 tests)
   - Tracked PR updates commitCount
   - Untracked PR ignored
   - Multiple syncs increment count
   - lastCommitSha updates
   - GitHub API errors handled
   - Missing PR data handled
4. pull_request.opened (4 tests)
   - Creates attempt if missing
   - Skips if exists
   - Parses agent name
   - Links to issue
5. pull_request.closed (5 tests)
   - Merged PR status='merged'
   - Closed PR status='closed'
   - mergedAt/closedAt timestamps
   - Winner selection triggered
   - Missing attempt handled

6. CI status handlers (13 tests)
   - check_suite.completed success/failure/error
   - Status API success/failure/error/pending
   - normalizeCIStatus mapping
   - ciLastCheckedAt timestamp updates
   - Multiple PRs in check suite
   - SHA-based PR lookup for legacy status

**Total:** ~38 unit tests (was 25, added 13 for CI tracking)

### Integration Tests

**Script:** `scripts/test-github-webhook-e2e.ts`

**Flow:**
1. Create test PR in allowed repo
2. Verify webhook processes synchronize event
3. Push commit, verify commitCount increments
4. Close PR, verify status updates
5. Cleanup test PR

**Manual validation:**
1. Open real PR in tracked repo
2. Add commits via git push
3. Check database: `SELECT * FROM attempts WHERE pr_number = 1559`
4. Verify commitCount matches GitHub UI
5. Verify lastCommitSha matches latest commit

---

## Performance Considerations

### Webhook Processing Time

**Target:** <500ms per webhook

**Bottlenecks:**
1. GitHub API call to get commits (~100-200ms)
2. Database updates (~50ms)
3. Signature verification (~10ms)

**Optimizations:**
- Use connection pooling (already in place)
- Skip API call if we can derive count from webhook
- Cache commit counts for 60s (future)

### GitHub API Rate Limits

**Limit:** 5000 requests/hour (authenticated)

**Estimated usage:**
- 10 PRs active at once
- Each PR gets 5 pushes during review
- 10 PRs × 5 pushes = 50 API calls
- Well under limit ✅

**Monitoring:**
- Log API response headers (`X-RateLimit-Remaining`)
- Alert if <1000 remaining
- Future: Implement exponential backoff

### Database Load

**Current scale:**
- ~10 issues/month with arena label
- ~3 agents per issue
- ~5 commits per PR
- = 150 webhook events/month

**Very low load** - no scaling concerns

---

## Rollout Plan

### Phase 1: Development (Week 1)
**Days 1-2:**
- Task 1-3: Infrastructure (route, signature, idempotency)
- Write unit tests for infrastructure
- Run `npm test` - verify >90% coverage

**Days 3-4:**
- Task 4-6: Synchronize handler + GitHub API
- Write unit tests for synchronize flow
- Mock GitHub API responses

**Day 5:**
- Task 7: Close handler
- Write unit tests for close flow
- Code review and fixes

### Phase 2: Staging (Week 2)
**Days 1-2:**
- Task 8: Environment setup on staging
- Configure GitHub webhook on test repo
- Deploy to staging environment

**Day 3:**
- Task 9: End-to-end testing
- Create test PRs
- Push commits, verify updates
- Test edge cases (merge, close, reopen)

**Days 4-5:**
- Task 10: Documentation
- Update README, M2-DEPLOYMENT, CHANGELOG
- Record demo video for team

### Phase 3: Production (Week 3)
**Day 1:**
- Deploy to production
- Configure webhooks on all tracked repos

**Day 2:**
- Monitor logs for webhook processing
- Verify commitCount updating on real PRs
- Check for errors/warnings

**Days 3-5:**
- Collect data from real agent competitions
- Validate metrics in dashboard
- Identify any edge cases missed

---

## Success Metrics

### Technical Metrics
- ✅ All unit tests pass (>90% coverage)
- ✅ Webhook processing <500ms
- ✅ Zero signature verification failures
- ✅ Idempotency working (duplicate = 0 DB writes)

### Functional Metrics
- ✅ commitCount increments on every push
- ✅ lastCommitSha matches GitHub UI
- ✅ PR close events update status correctly
- ✅ Winner selection still works (no regression)

### Business Metrics
- ✅ Can measure agent iteration quality
- ✅ Dashboard shows accurate commit counts
- ✅ Can identify agents that ignore feedback
- ✅ Time-to-PR metrics more meaningful

---

## Known Limitations & Future Work

### Current Limitations

1. **No review comment tracking**
   - Can't measure "time from review feedback to next commit"
   - Can't identify which review comments triggered changes
   - **Future:** Phase 2 - Add `pull_request_review` events

2. **No bot filtering**
   - All commits count equally (human + bot)
   - Can't distinguish CI commits from code commits
   - **Future:** Parse commit authors, filter bots

3. **No force-push handling**
   - Force push resets commit history
   - commitCount might decrease (edge case)
   - **Future:** Track force_pushed event, reset count

4. **No PR branch tracking**
   - Don't track which branch was used
   - Can't identify "good" branch naming patterns
   - **Already in schema:** `branch` field exists, just need to populate

### Phase 2 Features (Not in This Plan)

**Review outcome tracking:**
- `pull_request_review` events
- Approved/changes_requested/commented status
- Track first human review timestamp
- Count review comments (filter bots)

**Collaboration depth:**
- `issue_comment` on PRs
- Agent responses to reviewer questions
- Back-and-forth thread analysis

**Advanced metrics:**
- Review cycle count (changes_requested → next commit)
- Time from review to resolution
- Agent response rate to comments

---

## Risks & Mitigations

### Risk 1: GitHub API Rate Limits
**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Monitor rate limit headers
- Cache commit counts for 60s
- Fall back to webhook payload (less accurate)

### Risk 2: Webhook Delivery Failures
**Likelihood:** Low
**Impact:** High (missing data)
**Mitigation:**
- GitHub retries failed webhooks automatically
- Idempotency ensures safe replays
- Manual sync script for recovery (future)

### Risk 3: Bot Commits Inflating Count
**Likelihood:** High
**Impact:** Low (analytics slightly off)
**Mitigation:**
- Document limitation in dashboard
- Filter bots in Phase 2
- For now: Commit count = all commits (simple)

### Risk 4: Breaking Winner Selection
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Extensive testing of updateWinner()
- No changes to winner logic (just data input)
- E2E test with real PR merge

### Risk 5: Multiple Repos, Different Patterns
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- ALLOWED_REPOS acts as allowlist
- Start with js-recall only
- Add repos incrementally after validation

---

## Dependencies

### External Services
- GitHub Webhooks (must be configured)
- GitHub API (read access)
- Linear API (already working)

### Environment Variables
```bash
# Existing
LINEAR_WEBHOOK_SECRET=<existing>
LINEAR_API_KEY=<existing>
DATABASE_URL=<existing>

# New (required)
GITHUB_WEBHOOK_SECRET=<new, 64+ chars>
GITHUB_TOKEN=<fine-grained PAT, read:pull_requests>
ALLOWED_REPOS=recallnet/js-recall
```

### GitHub Permissions
**Fine-Grained PAT scopes:**
- Pull requests: Read
- Contents: Read
- Metadata: Read (automatic)

### GitHub Webhook Configuration
**Per repository:**
- Settings → Webhooks → Add webhook
- URL: `https://coding-arena.vercel.app/api/github/webhook`
- Content type: `application/json`
- Secret: Value of `GITHUB_WEBHOOK_SECRET`
- Events: Pull requests
- Active: ✅

---

## File Checklist

### New Files (4)
- [ ] `src/app/api/github/webhook/route.ts` (~200 lines)
- [ ] `src/app/api/github/webhook/route.test.ts` (~400 lines)
- [ ] `scripts/test-github-webhook-e2e.ts` (~150 lines)
- [ ] `docs/plans/2025-11-12-github-webhook-pr-iteration-tracking.md` (this file)

### Modified Files (4)
- [ ] `README.md` - Add GitHub webhook setup
- [ ] `docs/arena-state-machine.md` - Document iteration tracking
- [ ] `docs/CHANGELOG.md` - Add v0.4.0 entry
- [ ] `docs/plans/M2-DEPLOYMENT.md` - Update webhook requirements

### No Changes Required (3)
- ✅ `src/db/schema.ts` - Schema already has fields
- ✅ `src/app/api/linear/webhook/route.ts` - Winner logic unchanged
- ✅ `src/lib/queries.ts` - Agent status logic unchanged

---

## Acceptance Criteria

### Must Have (v0.4.0)
- [ ] Schema migration adds ciStatus and ciLastCheckedAt fields
- [ ] GitHub webhook route created and tested
- [ ] Signature verification working (HMAC SHA-256)
- [ ] Idempotency preventing duplicate processing
- [ ] `pull_request.synchronize` updates commitCount
- [ ] `pull_request.closed` updates status/timestamps
- [ ] **`check_suite.completed` updates ciStatus** (NEW)
- [ ] **`status` event updates ciStatus** (NEW - legacy fallback)
- [ ] GitHub API integration fetches accurate commit counts
- [ ] Unit tests >90% coverage (~38 tests)
- [ ] End-to-end test passes on real PR (commit count + CI status)
- [ ] Documentation updated (README, CHANGELOG, M2-DEPLOYMENT)
- [ ] Deployed to production with webhooks configured

### Nice to Have (Future)
- [ ] Review comment tracking
- [ ] Bot filtering for commits
- [ ] Force push handling
- [ ] Branch name tracking
- [ ] Performance monitoring dashboard
- [ ] Automated webhook recovery on failure

---

## Questions for Product Team

1. **Repo prioritization:** Start with js-recall only, or add all repos immediately?
2. **Bot commits:** Should we count CI/bot commits or filter them out?
3. **Force push policy:** Do agents force-push? Should we track resets?
4. **Review SLAs:** What's acceptable time from PR open to first review?
5. **Dashboard updates:** Should we show commitCount in UI now or wait for Phase 2?

---

## Timeline Estimate

**Total: 2-3 weeks (1 developer)**

| Phase | Duration | Effort |
|-------|----------|--------|
| Schema Migration (Task 0) | 0.5 days | 4 hours |
| Infrastructure (Tasks 1-3) | 2 days | 16 hours |
| Synchronize Handler (Tasks 4-6) | 2 days | 16 hours |
| Close Handler (Task 7) | 1 day | 8 hours |
| **CI Status Handlers (Tasks 8-9)** | **1.5 days** | **12 hours** |
| Testing & Docs (Tasks 10-12) | 2 days | 16 hours |
| Code Review & Fixes | 1 day | 8 hours |
| Staging Deployment | 2 days | 16 hours |
| Production Rollout | 2 days | 16 hours |
| **Total** | **14 days** | **112 hours** |

**Confidence:** High (similar to completed Linear webhook work)

---

## Related Documents

- [Arena State Machine](../arena-state-machine.md) - Current state tracking
- [ENG-320 Investigation](../INDEX-ENG320.md) - Real-world workflow analysis
- [Milestone 2 Deployment](./M2-DEPLOYMENT.md) - Deployment requirements
- [Implementation Complete](../IMPLEMENTATION-COMPLETE.md) - Linear webhooks v0.2.0
- [Project Baseline](./project.md) - Original specification

---

**Status:** Ready for implementation
**Next Steps:**
1. Review plan with team
2. Get GitHub webhook secrets provisioned
3. Start Task 1: Create webhook route
4. Follow TDD methodology (tests first)
