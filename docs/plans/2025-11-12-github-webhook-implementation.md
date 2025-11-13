# GitHub Webhook PR Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track PR iteration cycles (commit counts) and CI status by handling GitHub webhook events for pull requests and check runs.

**Architecture:** Create `/api/github/webhook` endpoint that verifies HMAC signatures, ensures idempotency via events table, and routes to handlers that update the attempts table with commit counts and CI status from GitHub API.

**Tech Stack:** Next.js 15 API routes, Drizzle ORM (PostgreSQL), GitHub Webhooks API, Vitest for testing

---

## Phase 0: Schema Migration

### Task 0.1: Add CI Status Fields to Schema

**Files:**
- Modify: `src/db/schema.ts:61-85` (attempts table)

**Step 1: Add new fields to attempts table**

```typescript
// In src/db/schema.ts, add these fields to the attempts table definition:

export const attempts = pgTable('attempts', {
  // ... existing fields ...
  commitCount: integer('commit_count').notNull().default(1),
  lastCommitSha: text('last_commit_sha'),

  // NEW FIELDS - Add after lastCommitSha
  ciStatus: text('ci_status'), // 'pending' | 'success' | 'failure' | 'error' | null
  ciLastCheckedAt: timestamp('ci_last_checked_at', { withTimezone: true }),

  // ... rest of existing fields ...
})
```

**Step 2: Generate migration**

Run: `npm run db:generate`
Expected: Creates new migration file in `drizzle/` directory

**Step 3: Apply migration**

Run: `npm run db:migrate`
Expected: "Migration applied successfully"

**Step 4: Verify schema**

Run: `DATABASE_URL='...' tsx -e "import { db } from './src/db/client.js'; import { attempts } from './src/db/schema.js'; console.log(attempts)"`
Expected: Schema includes ciStatus and ciLastCheckedAt fields

**Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(schema): add CI status tracking fields to attempts table"
```

---

## Phase 1: Infrastructure

### Task 1.1: Create GitHub Webhook Route Structure

**Files:**
- Create: `src/app/api/github/webhook/route.ts`

**Step 1: Write failing test for route exists**

Create: `src/app/api/github/webhook/route.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

describe('/api/github/webhook', () => {
  it('should return 401 for missing signature', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      body: JSON.stringify({ action: 'opened' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

**Step 3: Create minimal route**

Create: `src/app/api/github/webhook/route.ts`

```typescript
/**
 * GitHub webhook handler for PR tracking
 * Tracks commit counts and CI status for arena competitions
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify signature
  const signature = req.headers.get('x-hub-signature-256')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/
git commit -m "feat(webhook): create GitHub webhook route skeleton"
```

---

### Task 1.2: Implement Signature Verification

**Files:**
- Modify: `src/app/api/github/webhook/route.ts`

**Step 1: Write failing test for signature verification**

Add to `src/app/api/github/webhook/route.test.ts`:

```typescript
import crypto from 'node:crypto'

describe('Signature Verification', () => {
  const secret = 'test-secret-key'
  const payload = JSON.stringify({ action: 'opened', pull_request: { number: 1 } })

  beforeEach(() => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', secret)
  })

  it('should accept valid HMAC signature', async () => {
    const hmac = crypto.createHmac('sha256', secret)
    const signature = 'sha256=' + hmac.update(payload).digest('hex')

    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body: payload,
    })

    const response = await POST(req)
    expect(response.status).not.toBe(401)
  })

  it('should reject invalid HMAC signature', async () => {
    const req = new NextRequest('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=invalid' },
      body: payload,
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: FAIL with test rejection (signature not verified)

**Step 3: Implement signature verification**

Update `src/app/api/github/webhook/route.ts`:

```typescript
import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Verifies GitHub webhook signature using HMAC SHA-256
 */
function verifyGitHubSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false

  const secret = process.env['GITHUB_WEBHOOK_SECRET']
  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET not configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const signature = req.headers.get('x-hub-signature-256')
    const body = await req.text()

    if (!verifyGitHubSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/route.ts src/app/api/github/webhook/route.test.ts
git commit -m "feat(webhook): add HMAC signature verification for GitHub webhooks"
```

---

### Task 1.3: Add Idempotency Check

**Files:**
- Modify: `src/app/api/github/webhook/route.ts`

**Step 1: Write failing test for idempotency**

Add to `src/app/api/github/webhook/route.test.ts`:

```typescript
import { db } from '@/db/client'
import { events } from '@/db/schema'

describe('Idempotency', () => {
  beforeEach(async () => {
    // Clean events table
    await db.delete(events)
  })

  it('should process first webhook event', async () => {
    const payload = { action: 'synchronize', pull_request: { number: 1, head: { sha: 'abc123' } } }
    const req = createAuthenticatedRequest(payload)

    const response = await POST(req)
    const json = await response.json()

    expect(json.success).toBe(true)
  })

  it('should return duplicate for same event', async () => {
    const payload = { action: 'synchronize', pull_request: { number: 1, head: { sha: 'abc123' } } }

    // First request
    await POST(createAuthenticatedRequest(payload))

    // Second request with same payload
    const response = await POST(createAuthenticatedRequest(payload))
    const json = await response.json()

    expect(json.status).toBe('duplicate')
  })
})

function createAuthenticatedRequest(payload: object): NextRequest {
  const body = JSON.stringify(payload)
  const secret = process.env['GITHUB_WEBHOOK_SECRET'] || 'test-secret'
  const hmac = crypto.createHmac('sha256', secret)
  const signature = 'sha256=' + hmac.update(body).digest('hex')

  return new NextRequest('http://localhost:3000/api/github/webhook', {
    method: 'POST',
    headers: { 'x-hub-signature-256': signature },
    body,
  })
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: FAIL (no idempotency check exists)

**Step 3: Implement idempotency**

Update `src/app/api/github/webhook/route.ts`:

```typescript
import crypto from 'node:crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { events } from '@/db/schema'

type GitHubWebhookPayload = {
  action: string
  pull_request?: {
    number: number
    head: { sha: string }
  }
  repository?: {
    full_name: string
  }
}

// ... verifyGitHubSignature function ...

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const signature = req.headers.get('x-hub-signature-256')
    const body = await req.text()

    if (!verifyGitHubSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body) as GitHubWebhookPayload

    // 2. Check idempotency
    const pr = payload.pull_request
    const eventKey = pr
      ? `github:${payload.action}:${pr.number}:${pr.head.sha}`
      : `github:${payload.action}:${Date.now()}`

    const existing = await db
      .insert(events)
      .values({
        source: 'github',
        key: eventKey,
        payload,
      })
      .onConflictDoNothing({
        target: [events.source, events.key],
      })
      .returning({ id: events.id })

    if (existing.length === 0) {
      return NextResponse.json({ status: 'duplicate' })
    }

    // 3. Route by event type (TODO: implement handlers)
    console.log(`[GitHub] ${payload.action} event received`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/route.ts src/app/api/github/webhook/route.test.ts
git commit -m "feat(webhook): add idempotency check using events table"
```

---

## Phase 2: PR Synchronize Handler

### Task 2.1: Handle pull_request.synchronize Events

**Files:**
- Modify: `src/app/api/github/webhook/route.ts`

**Step 1: Write failing test for synchronize handler**

Add to `src/app/api/github/webhook/route.test.ts`:

```typescript
import { attempts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

describe('pull_request.synchronize', () => {
  beforeEach(async () => {
    await db.delete(attempts)
    await db.delete(events)

    // Create a tracked attempt
    await db.insert(attempts).values({
      issueId: 'test-issue-id',
      agentName: 'cursor',
      repo: 'recallnet/js-recall',
      prNumber: 1559,
      prUrl: 'https://github.com/recallnet/js-recall/pull/1559',
      status: 'open',
      commitCount: 1,
    })
  })

  it('should update commit count for tracked PR', async () => {
    const payload = {
      action: 'synchronize',
      pull_request: {
        number: 1559,
        head: { sha: 'new-sha-123' },
      },
      repository: { full_name: 'recallnet/js-recall' },
    }

    // Mock GitHub API response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { sha: 'commit1' },
        { sha: 'commit2' },
        { sha: 'commit3' },
      ],
    })

    const response = await POST(createAuthenticatedRequest(payload))
    expect(response.status).toBe(200)

    // Verify database updated
    const attempt = await db
      .select()
      .from(attempts)
      .where(and(
        eq(attempts.repo, 'recallnet/js-recall'),
        eq(attempts.prNumber, 1559)
      ))
      .limit(1)

    expect(attempt[0]?.commitCount).toBe(3)
    expect(attempt[0]?.lastCommitSha).toBe('new-sha-123')
  })

  it('should ignore untracked PRs', async () => {
    const payload = {
      action: 'synchronize',
      pull_request: {
        number: 9999,
        head: { sha: 'unknown-sha' },
      },
      repository: { full_name: 'recallnet/js-recall' },
    }

    const response = await POST(createAuthenticatedRequest(payload))
    expect(response.status).toBe(200)

    // Should not error, just log and continue
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: FAIL (handler not implemented)

**Step 3: Implement synchronize handler**

Update `src/app/api/github/webhook/route.ts`:

```typescript
import { attempts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

// ... existing code ...

/**
 * Fetches commit count from GitHub API
 */
async function getCommitCount(repo: string, prNumber: number): Promise<number> {
  const token = process.env['GITHUB_TOKEN']
  if (!token) {
    console.error('GITHUB_TOKEN not configured')
    return 1 // Fallback to current count
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    console.error(`Invalid repo format: ${repo}`)
    return 1
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/commits`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!response.ok) {
    console.error(`GitHub API error: ${response.status}`)
    return 1
  }

  const commits = await response.json()
  return Array.isArray(commits) ? commits.length : 1
}

/**
 * Handles PR synchronize events (new commits pushed)
 */
async function handlePullRequestSynchronize(
  payload: GitHubWebhookPayload
): Promise<void> {
  const pr = payload.pull_request
  if (!pr) return

  const repo = payload.repository?.full_name
  if (!repo) return

  const prNumber = pr.number
  const headSha = pr.head.sha

  // Check if this PR is tracked
  const attempt = await db
    .select()
    .from(attempts)
    .where(and(
      eq(attempts.repo, repo),
      eq(attempts.prNumber, prNumber)
    ))
    .limit(1)

  if (attempt.length === 0) {
    console.log(`[GitHub] Ignoring PR ${repo}#${prNumber} - not tracked`)
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
    .where(eq(attempts.id, attempt[0]!.id))

  console.log(`[GitHub] Updated PR ${repo}#${prNumber}: ${commitCount} commits`)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ... signature and idempotency checks ...

    // 3. Route by event type
    if (payload.action === 'synchronize') {
      await handlePullRequestSynchronize(payload)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/
git commit -m "feat(webhook): handle pull_request.synchronize to track commit counts"
```

---

## Phase 3: CI Status Tracking

### Task 3.1: Handle check_suite.completed Events

**Files:**
- Modify: `src/app/api/github/webhook/route.ts`

**Step 1: Write failing test for CI status updates**

Add to `src/app/api/github/webhook/route.test.ts`:

```typescript
describe('check_suite.completed', () => {
  beforeEach(async () => {
    await db.delete(attempts)
    await db.delete(events)

    await db.insert(attempts).values({
      issueId: 'test-issue-id',
      agentName: 'cursor',
      repo: 'recallnet/js-recall',
      prNumber: 1559,
      prUrl: 'https://github.com/recallnet/js-recall/pull/1559',
      status: 'open',
      commitCount: 1,
      lastCommitSha: 'test-sha',
    })
  })

  it('should update CI status to success', async () => {
    const payload = {
      action: 'completed',
      check_suite: {
        conclusion: 'success',
        head_sha: 'test-sha',
        pull_requests: [{ number: 1559 }],
      },
      repository: { full_name: 'recallnet/js-recall' },
    }

    const response = await POST(createAuthenticatedRequest(payload))
    expect(response.status).toBe(200)

    const attempt = await db
      .select()
      .from(attempts)
      .where(eq(attempts.prNumber, 1559))
      .limit(1)

    expect(attempt[0]?.ciStatus).toBe('success')
    expect(attempt[0]?.ciLastCheckedAt).toBeTruthy()
  })

  it('should normalize failure statuses', async () => {
    const payload = {
      action: 'completed',
      check_suite: {
        conclusion: 'timed_out',
        head_sha: 'test-sha',
        pull_requests: [{ number: 1559 }],
      },
      repository: { full_name: 'recallnet/js-recall' },
    }

    await POST(createAuthenticatedRequest(payload))

    const attempt = await db
      .select()
      .from(attempts)
      .where(eq(attempts.prNumber, 1559))
      .limit(1)

    expect(attempt[0]?.ciStatus).toBe('failure')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: FAIL (CI handler not implemented)

**Step 3: Implement CI status handler**

Update `src/app/api/github/webhook/route.ts`:

```typescript
type CIStatus = 'pending' | 'success' | 'failure' | 'error' | null

type CheckSuitePayload = GitHubWebhookPayload & {
  check_suite: {
    conclusion: string | null
    head_sha: string
    pull_requests: Array<{ number: number }>
  }
}

/**
 * Normalizes GitHub CI status to our schema values
 */
function normalizeCIStatus(github: string): CIStatus {
  if (github === 'success') return 'success'
  if (github === 'failure' || github === 'timed_out' || github === 'cancelled') return 'failure'
  if (github === 'error' || github === 'action_required') return 'error'
  if (github === 'pending' || github === 'neutral') return 'pending'
  return null
}

/**
 * Handles check suite completion (CI status)
 */
async function handleCheckSuiteCompleted(
  payload: CheckSuitePayload
): Promise<void> {
  const conclusion = payload.check_suite.conclusion
  if (!conclusion) return // Still running

  const ciStatus = normalizeCIStatus(conclusion)
  const repo = payload.repository?.full_name
  if (!repo) return

  const prNumbers = payload.check_suite.pull_requests.map(pr => pr.number)

  for (const prNumber of prNumbers) {
    await db
      .update(attempts)
      .set({
        ciStatus,
        ciLastCheckedAt: new Date(),
      })
      .where(and(
        eq(attempts.repo, repo),
        eq(attempts.prNumber, prNumber)
      ))

    console.log(`[GitHub] Updated CI status for ${repo}#${prNumber}: ${ciStatus}`)
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ... existing code ...

    // 3. Route by event type
    if (payload.action === 'synchronize') {
      await handlePullRequestSynchronize(payload)
    } else if (payload.action === 'completed' && 'check_suite' in payload) {
      await handleCheckSuiteCompleted(payload as CheckSuitePayload)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/github/webhook/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/
git commit -m "feat(webhook): track CI status from check_suite.completed events"
```

---

## Phase 4: Environment Setup

### Task 4.1: Update Environment Variables

**Files:**
- Modify: `.env.example`

**Step 1: Add GitHub webhook environment variables**

```bash
# Add to .env.example after LINEAR integration section:

# -----------------------------------------------------------------------------
# GITHUB INTEGRATION (M2: Webhook Integration for PR Tracking)
# -----------------------------------------------------------------------------
# GITHUB_WEBHOOK_SECRET=
# Generate with: openssl rand -hex 32
# Used to verify webhook signatures from GitHub
# REQUIRED for M2: Verifies incoming webhook requests from GitHub
# Example: GITHUB_WEBHOOK_SECRET=a3f9d8c2e1b4f5a6...

# GITHUB_TOKEN=
# Fine-grained Personal Access Token with:
#   - Repository access: Select repos in ALLOWED_REPOS
#   - Permissions: Pull requests = Read, Contents = Read
# Used to fetch PR commit counts and CI status
# Create at: https://github.com/settings/tokens?type=beta
# Example: GITHUB_TOKEN=github_pat_...

# ALLOWED_REPOS=
# Comma-separated list of repositories to track
# Example: ALLOWED_REPOS=recallnet/js-recall,recallnet/other-repo
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): add GitHub webhook environment variables"
```

---

## Verification Steps

### Manual Testing Checklist

1. **Setup environment:**
   ```bash
   export GITHUB_WEBHOOK_SECRET="test-secret-$(openssl rand -hex 16)"
   export GITHUB_TOKEN="your-github-pat"
   export ALLOWED_REPOS="recallnet/js-recall"
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Test endpoint exists:**
   ```bash
   curl -X POST http://localhost:3109/api/github/webhook \
     -H "Content-Type: application/json" \
     -d '{"action":"ping"}'
   # Expected: 401 (missing signature)
   ```

4. **Test with valid signature:**
   ```bash
   # Create signed request (use scripts/test-github-webhook.sh if available)
   ```

5. **Verify in database:**
   ```sql
   SELECT * FROM attempts WHERE pr_number = 1559;
   -- Check commitCount and ciStatus updated
   ```

---

## Success Criteria

- [ ] All tests pass with >90% coverage
- [ ] GitHub webhook endpoint accepts valid signatures
- [ ] Idempotency prevents duplicate processing
- [ ] PR synchronize events update commitCount
- [ ] Check suite events update ciStatus
- [ ] Untracked PRs are safely ignored
- [ ] Environment variables documented
- [ ] Manual testing succeeds

---

## Next Steps After Implementation

1. **Configure GitHub webhook** in repository settings:
   - URL: `https://your-domain.vercel.app/api/github/webhook`
   - Secret: Value of `GITHUB_WEBHOOK_SECRET`
   - Events: Pull requests, Check suites

2. **Monitor logs** for webhook processing

3. **Verify data** in production database

4. **Update documentation** with webhook setup instructions
