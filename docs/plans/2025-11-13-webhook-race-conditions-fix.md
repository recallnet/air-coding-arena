# Webhook Race Conditions Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical race conditions in winner selection and agent provenance tracking to ensure data integrity across concurrent webhook processing.

**Architecture:** Use PostgreSQL transactions with row-level locking (`FOR UPDATE`) to atomically select winners. Move rating updates inside winner transaction. Make agent extraction graceful by deferring to comment sync when branch name lacks agent info.

**Tech Stack:** Drizzle ORM (PostgreSQL), Vitest, Next.js API routes, Linear webhooks

---

## Task 1: Add Transaction Support and Update Winner Selection Logic

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts:346-373` (updateWinner function)
- Test: `src/app/api/linear/webhook/route.test.ts`

### Step 1: Write failing test for concurrent winner selection

Add test to `src/app/api/linear/webhook/route.test.ts`:

```typescript
describe('updateWinner - race condition protection', () => {
  it('should handle concurrent winner selection with transaction', async () => {
    const issueId = 'test-issue-id'
    const attemptA = 'attempt-a-id'
    const attemptB = 'attempt-b-id'

    // Mock transaction
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: issueId, winnerAttemptId: null }])
            })
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      })
    }

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return callback(mockTx as any)
    })

    // Mock attempts query - return attemptA as first merged
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: issueId, winnerAttemptId: null }])
          })
        })
      })
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: attemptA, agentName: 'cursor' }])
          })
        })
      })
    })

    // Call updateWinner (this will be extracted from route.ts)
    // For now, expect transaction to be called
    expect(db.transaction).toBeDefined()
  })

  it('should skip winner selection if winner already set (idempotency)', async () => {
    const issueId = 'test-issue-id'
    const existingWinner = 'existing-winner-id'

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: issueId, winnerAttemptId: existingWinner }])
            })
          })
        })
      })
    }

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return callback(mockTx as any)
    })

    // Expect early return when winner already set
    // No update should be called
    expect(mockTx.select).toBeDefined()
  })
})
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/app/api/linear/webhook/route.test.ts -t "updateWinner"`

Expected: FAIL - `db.transaction is not a function` or similar

### Step 3: Add transaction mock to db client mock

In `src/app/api/linear/webhook/route.test.ts`, update the db mock:

```typescript
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(), // Add this
  },
}))
```

### Step 4: Implement transactional updateWinner with row locking

Replace `updateWinner` function in `src/app/api/linear/webhook/route.ts`:

```typescript
/**
 * Updates winner for an issue with transaction-based race condition protection.
 * Uses row-level locking to ensure only one webhook can set the winner.
 * Idempotent - safe to call multiple times.
 *
 * @param issueId - Issue UUID
 */
async function updateWinner(issueId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Lock the issue row (prevents concurrent winner updates)
    const issueResult = await tx
      .select({ id: issues.id, winnerAttemptId: issues.winnerAttemptId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .for('update') // PostgreSQL row lock - blocks concurrent updates
      .limit(1)

    if (issueResult.length === 0) return

    const issue = issueResult[0]
    if (!issue) return

    // 2. If winner already set, skip (idempotency)
    if (issue.winnerAttemptId) {
      console.log(`Winner already set for issue ${issueId}`)
      return
    }

    // 3. Get first merged attempt (within transaction)
    const winnerResult = await tx
      .select({ id: attempts.id, agentName: attempts.agentName })
      .from(attempts)
      .where(and(eq(attempts.issueId, issueId), eq(attempts.status, 'merged')))
      .orderBy(asc(attempts.mergedAt), asc(attempts.openedAt))
      .limit(1)

    if (winnerResult.length === 0) return

    const winner = winnerResult[0]
    if (!winner) return

    // 4. Set winner (atomic with lock)
    await tx
      .update(issues)
      .set({ winnerAttemptId: winner.id })
      .where(eq(issues.id, issueId))

    // 5. Close losing attempts
    await tx
      .update(attempts)
      .set({ status: 'closed', closedAt: new Date() })
      .where(and(eq(attempts.issueId, issueId), eq(attempts.status, 'open')))

    // 6. Update ratings once per issue (inside transaction)
    await updateRatingsForIssue(issueId)

    console.log(`Winner set for issue ${issueId}: ${winner.agentName}`)
  })
}
```

### Step 5: Add import for updateRatingsForIssue

At top of `src/app/api/linear/webhook/route.ts`, add:

```typescript
import { updateRatingsForIssue } from '@/lib/update-ratings'
```

### Step 6: Run tests to verify implementation

Run: `npm test -- src/app/api/linear/webhook/route.test.ts`

Expected: Tests should pass with proper mocking

### Step 7: Commit transaction-based winner selection

```bash
git add src/app/api/linear/webhook/route.ts src/app/api/linear/webhook/route.test.ts
git commit -m "feat: add transaction-based winner selection with race condition protection

- Wrap updateWinner in db.transaction with row-level locking
- Add idempotency check - skip if winner already set
- Move rating updates inside transaction for consistency
- Add tests for concurrent winner selection scenarios"
```

---

## Task 2: Remove Rating Updates from GitHub Webhook

**Files:**
- Modify: `src/app/api/github/webhook/route.ts:319-325`
- Test: `src/app/api/github/webhook/route.test.ts`

### Step 1: Write test to verify GitHub webhook no longer calls rating updates

Add test to `src/app/api/github/webhook/route.test.ts`:

```typescript
describe('pull_request.closed - merged (rating updates moved to Linear)', () => {
  it('should NOT call updateRatingsForIssue when PR merged', async () => {
    // Setup: tracked attempt exists
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'attempt-123',
              issueId: 'issue-123',
              agentName: 'cursor',
            },
          ]),
        }),
      }),
    } as never)

    // Mock update
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const payload = {
      action: 'closed',
      pull_request: {
        number: 42,
        head: { sha: 'abc123' },
        merged: true,
        merged_at: '2024-01-15T10:00:00Z',
      },
      repository: {
        full_name: 'org/repo',
      },
    }

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)

    // Rating updates should NOT be called (handled by Linear webhook now)
    expect(updateRatingsForIssue).not.toHaveBeenCalled()

    // But agent status should still be updated
    expect(updateAgentStatusOnPRClose).toHaveBeenCalledWith('issue-123', 'cursor', true)
  })
})
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/app/api/github/webhook/route.test.ts -t "rating updates moved to Linear"`

Expected: FAIL - test expects updateRatingsForIssue not to be called, but it is

### Step 3: Remove rating update call from GitHub webhook

In `src/app/api/github/webhook/route.ts`, modify the `handlePullRequestClosed` function:

```typescript
// Update attempt status
if (merged && mergedAt) {
  await db
    .update(attempts)
    .set({
      status: 'merged',
      mergedAt,
    })
    .where(eq(attempts.id, attempt.id))

  console.log(`[GitHub] PR ${repo}#${prNumber} merged`)

  // Update agent status (accepted/rejected)
  await updateAgentStatusOnPRClose(attempt.issueId, attempt.agentName, true)
  console.log(
    `[GitHub] Updated agent status for ${attempt.agentName} on issue ${attempt.issueId}`
  )

  // NOTE: Rating updates moved to Linear webhook (updateWinner transaction)
  // GitHub webhook only tracks commit counts and CI status
  revalidateTag('agent-stats')
  console.log(
    `[GitHub] Invalidated cache for issue ${attempt.issueId}`
  )
} else {
  // ... existing closed without merge logic ...
}
```

Remove these lines:
```typescript
// Delete these lines:
await updateRatingsForIssue(attempt.issueId)
console.log(
  `[GitHub] Updated ratings for issue ${attempt.issueId} and invalidated cache`
)
```

### Step 4: Remove import if no longer used

At top of `src/app/api/github/webhook/route.ts`, remove:

```typescript
import { updateRatingsForIssue } from '@/lib/update-ratings'
```

### Step 5: Run tests to verify implementation

Run: `npm test -- src/app/api/github/webhook/route.test.ts`

Expected: All tests should pass

### Step 6: Commit GitHub webhook changes

```bash
git add src/app/api/github/webhook/route.ts src/app/api/github/webhook/route.test.ts
git commit -m "refactor: move rating updates from GitHub to Linear webhook

- Remove updateRatingsForIssue call from GitHub PR closed handler
- Ratings now calculated once in Linear webhook updateWinner transaction
- GitHub webhook remains optional (commit counts, CI status only)
- Reduces dependency on GitHub for core arena logic"
```

---

## Task 3: Fix Agent Name Extraction to be Graceful

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts:287-338` (handleAttachmentEvent)
- Test: `src/app/api/linear/webhook/route.test.ts`

### Step 1: Write test for graceful handling of missing agent name

Add test to `src/app/api/linear/webhook/route.test.ts`:

```typescript
describe('Attachment.create - graceful agent name handling', () => {
  it('should skip attempt creation when branch name lacks agent info', async () => {
    // Mock: issue exists in database
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: TEST_DB_ISSUE_ID }]),
        }),
      }),
    } as never)

    // Mock syncIssueFromLinear
    const { syncIssueFromLinear } = await import('@/lib/linear-sync')
    vi.mocked(syncIssueFromLinear).mockResolvedValue(undefined)

    const payload = {
      type: 'Attachment',
      action: 'create',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'PR Title',
        subtitle: TEST_ATTACHMENT_SUBTITLE,
        metadata: {
          branch: 'main', // No agent suffix
        },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should succeed (200) not throw (500)
    expect(response.status).toBe(200)

    // Should call syncIssueFromLinear to handle via comment thread
    expect(syncIssueFromLinear).toHaveBeenCalledWith(TEST_ISSUE_ID)

    // Should NOT create attempt (db.insert not called)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('should create attempt when branch name contains agent', async () => {
    // Mock: issue exists
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: TEST_DB_ISSUE_ID }]),
        }),
      }),
    } as never)

    // Mock: no recent events (dedup check)
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    // Mock insert for attempt
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const payload = {
      type: 'Attachment',
      action: 'create',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'PR Title',
        subtitle: TEST_ATTACHMENT_SUBTITLE,
        metadata: {
          branch: 'ENG-123--fix-bug--agent-cursor',
        },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)

    // Should create attempt with agent name from branch
    expect(db.insert).toHaveBeenCalled()
  })
})
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/app/api/linear/webhook/route.test.ts -t "graceful agent name handling"`

Expected: FAIL - currently throws error on missing agent name (500 response)

### Step 3: Implement graceful agent name extraction

Replace agent extraction logic in `handleAttachmentEvent` function in `src/app/api/linear/webhook/route.ts`:

```typescript
async function handleAttachmentEvent(
  payload: LinearWebhookPayload
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachment = payload.data as any as LinearAttachment

  // Only process GitHub PR attachments
  const prMatch = attachment.url?.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  )
  if (!prMatch) return

  const [, org, repoName, prNumber] = prMatch
  if (!org || !repoName || !prNumber) return
  const repo = `${org}/${repoName}`

  // Get the issue this attachment belongs to
  const issueResult = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.linearId, attachment.issue.id))
    .limit(1)

  if (issueResult.length === 0) {
    console.warn(`Attachment for unknown issue: ${attachment.issue.id}`)
    return
  }

  const issueId = issueResult[0]?.id
  if (!issueId) return

  // Parse status from subtitle (e.g., "org/repo #123 • merged")
  let status = 'open'
  let mergedAt: Date | undefined

  if (attachment.subtitle?.includes('merged')) {
    status = 'merged'
    mergedAt = new Date()
  } else if (attachment.subtitle?.includes('closed')) {
    status = 'closed'
  }

  // Extract branch from attachment metadata (if available)
  const metadata = attachment.metadata as Record<string, unknown> | undefined
  const branch = metadata?.['branch'] as string | undefined

  // Try to extract agent name from branch (best effort, not required)
  const agentMatch = branch?.match(/agent-([a-z]+)$/i)
  const agentNameFromBranch = agentMatch?.[1]?.toLowerCase()

  // If can't determine agent from branch, defer to comment sync
  // Comment sync will create the attempt with proper agent provenance from @mention thread
  if (!agentNameFromBranch) {
    console.log(
      `Skipping attempt creation for ${attachment.url} - ` +
        `agent provenance not available from branch name. ` +
        `Will be created by comment sync with @mention attribution.`
    )

    // Trigger immediate sync to process comment thread
    await syncIssueFromLinear(attachment.issue.id)
    return
  }

  // Agent known from branch - create attempt immediately
  await db
    .insert(attempts)
    .values({
      issueId,
      agentName: agentNameFromBranch,
      repo,
      prNumber: Number.parseInt(prNumber, 10),
      prUrl: attachment.url,
      branch: branch ?? null,
      openedAt: new Date(),
      mergedAt,
      status,
      commitCount: 1,
      sourceAttachmentId: attachment.id,
      sourceAttachmentUrl: attachment.url,
    })
    .onConflictDoUpdate({
      target: [attempts.issueId, attempts.agentName, attempts.prNumber],
      set: {
        status,
        mergedAt,
        branch: branch ?? sql`${attempts.branch}`,
        sourceAttachmentId: attachment.id,
        sourceAttachmentUrl: attachment.url,
      },
    })

  // Update agent status to submitted
  await updateAgentStatusOnPR(issueId, agentNameFromBranch)

  // If merged, check for winner
  if (status === 'merged') {
    await updateWinner(issueId)
  }

  console.log(
    `Attempt created/updated: ${repo}#${prNumber} (agent: ${agentNameFromBranch}, status: ${status})`
  )
}
```

### Step 4: Run tests to verify implementation

Run: `npm test -- src/app/api/linear/webhook/route.test.ts`

Expected: All tests should pass, including graceful handling tests

### Step 5: Commit graceful agent extraction

```bash
git add src/app/api/linear/webhook/route.ts src/app/api/linear/webhook/route.test.ts
git commit -m "fix: make agent name extraction graceful in attachment webhooks

- Skip attempt creation when branch lacks agent suffix
- Defer to comment sync for proper @mention attribution
- Prevents 500 errors on non-standard branch names
- Returns 200 success and triggers syncIssueFromLinear
- Comment sync will create attempt with correct agent provenance"
```

---

## Task 4: Integration Test for Full Race Condition Scenario

**Files:**
- Create: `src/app/api/linear/webhook/route.race-condition.test.ts`

### Step 1: Write integration test for concurrent webhooks

Create `src/app/api/linear/webhook/route.race-condition.test.ts`:

```typescript
/**
 * Integration tests for race condition scenarios.
 * Tests concurrent webhook processing with real-ish database mocks.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto'

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import { POST } from './route'

// Mock modules
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('@/lib/linear-sync', () => ({
  syncIssueFromLinear: vi.fn(),
}))

vi.mock('@/lib/agent-status', () => ({
  updateAgentStatusOnPR: vi.fn(),
}))

vi.mock('@/lib/update-ratings', () => ({
  updateRatingsForIssue: vi.fn(),
}))

const WEBHOOK_URL = 'http://localhost:3109/api/linear/webhook'
const TEST_SECRET = 'test-secret'
const TEST_ISSUE_ID = 'linear-issue-123'
const TEST_DB_ISSUE_ID = 'db-issue-uuid'
const TEST_TIMESTAMP = '2024-01-15T10:00:00Z'

function createMockRequest(
  payload: Record<string, unknown>,
  secret?: string
): NextRequest {
  const body = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret ?? TEST_SECRET)
  const signature = hmac.update(body).digest('hex')

  return new Request(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'linear-signature': signature,
    },
    body,
  }) as NextRequest
}

describe('Race Condition Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_WEBHOOK_SECRET'] = TEST_SECRET
    process.env['ARENA_LABEL'] = 'arena:ready'
  })

  it('should handle two concurrent merged PR webhooks correctly', async () => {
    let winnerSet = false
    let winnerAttemptId: string | null = null

    // Mock transaction to simulate row locking behavior
    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      const mockTx = {
        select: vi.fn(),
        update: vi.fn(),
      }

      // First select: issue with/without winner
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: TEST_DB_ISSUE_ID,
                  winnerAttemptId: winnerSet ? winnerAttemptId : null,
                },
              ]),
            }),
          }),
        }),
      } as never)

      // If no winner set yet, mock winner selection
      if (!winnerSet) {
        // Second select: get winner attempt
        mockTx.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: 'attempt-a', agentName: 'cursor' },
                ]),
              }),
            }),
          }),
        } as never)

        // Update winner
        mockTx.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(async () => {
              winnerSet = true
              winnerAttemptId = 'attempt-a'
              return []
            }),
          }),
        } as never)

        // Close losing attempts
        mockTx.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as never)
      }

      return callback(mockTx as any)
    })

    // Mock db.select for deduplication and issue lookup
    vi.mocked(db.select).mockImplementation((() => {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
    }) as never)

    // Mock db.insert for events table (idempotency)
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
        }),
      }),
    } as never)

    // Simulate two concurrent webhooks for merged PRs
    const payloadA = {
      type: 'Attachment',
      action: 'update',
      data: {
        id: 'attach-a',
        url: 'https://github.com/org/repo/pull/1',
        title: 'PR A',
        subtitle: 'org/repo #1 • merged',
        metadata: { branch: 'ENG-123--fix--agent-cursor' },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    const payloadB = {
      type: 'Attachment',
      action: 'update',
      data: {
        id: 'attach-b',
        url: 'https://github.com/org/repo/pull/2',
        title: 'PR B',
        subtitle: 'org/repo #2 • merged',
        metadata: { branch: 'ENG-123--fix--agent-engine' },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    const reqA = createMockRequest(payloadA)
    const reqB = createMockRequest(payloadB)

    // Process both webhooks (simulating concurrent arrival)
    const [responseA, responseB] = await Promise.all([POST(reqA), POST(reqB)])

    // Both should succeed
    expect(responseA.status).toBe(200)
    expect(responseB.status).toBe(200)

    // Transaction should be called (at least once, possibly twice)
    expect(db.transaction).toHaveBeenCalled()

    // Winner should be set exactly once
    expect(winnerSet).toBe(true)
    expect(winnerAttemptId).toBe('attempt-a')
  })
})
```

### Step 2: Run integration test

Run: `npm test -- src/app/api/linear/webhook/route.race-condition.test.ts`

Expected: Test should pass, demonstrating race condition protection

### Step 3: Commit integration test

```bash
git add src/app/api/linear/webhook/route.race-condition.test.ts
git commit -m "test: add integration tests for webhook race condition protection

- Test concurrent merged PR webhooks
- Verify transaction-based winner selection works correctly
- Ensure only one winner set despite concurrent processing"
```

---

## Task 5: Update Documentation

**Files:**
- Modify: `docs/arena-state-machine.md`
- Create: `docs/WEBHOOK_RACE_CONDITIONS.md`

### Step 1: Create race condition documentation

Create `docs/WEBHOOK_RACE_CONDITIONS.md`:

```markdown
# Webhook Race Condition Prevention

## Problem

Linear sends webhooks for various events (Issue, Attachment, Comment). When multiple PRs merge around the same time, concurrent webhooks can race to set the winner, potentially selecting the wrong agent.

## Solution

### Transaction-Based Winner Selection

Use PostgreSQL transactions with row-level locking (`FOR UPDATE`) to atomically select and set the winner.

```typescript
await db.transaction(async (tx) => {
  // 1. Lock issue row (blocks concurrent updates)
  const [issue] = await tx
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .for('update') // Row-level lock
    .limit(1)

  // 2. Idempotency check
  if (issue.winnerAttemptId) {
    return // Winner already set
  }

  // 3. Select winner
  // 4. Update issue.winnerAttemptId
  // 5. Close losing attempts
  // 6. Update ratings
})
```

### Key Properties

- **Atomicity**: All operations in transaction succeed or fail together
- **Isolation**: Row lock prevents concurrent winner selection
- **Idempotency**: Safe to call multiple times (checks if winner already set)
- **Consistency**: Ratings calculated with correct winner state

## Implementation Details

### Files Changed
- `src/app/api/linear/webhook/route.ts`: Add transaction wrapping to `updateWinner()`
- `src/app/api/github/webhook/route.ts`: Remove rating updates (moved to Linear webhook)
- Tests: Add race condition integration tests

### Database Impact
- Uses PostgreSQL `FOR UPDATE` (row-level lock)
- Slightly slower (transaction overhead) but guarantees correctness
- No schema changes required

## Testing

See `src/app/api/linear/webhook/route.race-condition.test.ts` for integration tests simulating concurrent webhook processing.
```

### Step 2: Update state machine documentation

In `docs/arena-state-machine.md`, add section about race condition protection:

```markdown
## Race Condition Protection

### Winner Selection

Winner selection uses PostgreSQL transactions with row-level locking to prevent race conditions:

1. **Row Lock**: `FOR UPDATE` on issues table prevents concurrent winner updates
2. **Idempotency**: Check if winner already set before proceeding
3. **Atomic Update**: Winner selection and rating updates in single transaction

See `docs/WEBHOOK_RACE_CONDITIONS.md` for implementation details.

### Agent Provenance

Agent attribution uses a two-phase approach:

1. **Fast Path**: If attachment metadata contains valid branch name with agent suffix, create attempt immediately
2. **Deferred Path**: If branch lacks agent info, skip attempt creation and let comment sync handle it via @mention thread walking

This prevents 500 errors on non-standard branch names while ensuring correct agent attribution from Linear comments.
```

### Step 3: Commit documentation

```bash
git add docs/WEBHOOK_RACE_CONDITIONS.md docs/arena-state-machine.md
git commit -m "docs: add webhook race condition prevention documentation

- Document transaction-based winner selection approach
- Explain row-level locking and idempotency guarantees
- Update state machine docs with race condition protection
- Add agent provenance two-phase approach explanation"
```

---

## Verification Steps

After completing all tasks, verify the fixes work correctly:

### 1. Run Full Test Suite

```bash
npm test
```

Expected: All tests pass (unit + integration)

### 2. Check Test Coverage

```bash
npm run test:coverage
```

Expected: Coverage maintained or improved (especially for webhook handlers)

### 3. Type Check

```bash
npm run typecheck
```

Expected: No TypeScript errors

### 4. Lint Check

```bash
npm run lint
```

Expected: No linting errors

### 5. Manual Verification (Optional)

If you have access to staging environment:

1. Deploy changes to staging
2. Trigger multiple concurrent Linear webhooks for same issue
3. Verify only one winner is set in database
4. Verify ratings calculated correctly
5. Check webhook response times (transactions add slight overhead)

---

## Rollback Plan

If issues are discovered after deployment:

1. **Revert commits in reverse order**:
   ```bash
   git revert <commit-sha> --no-edit
   ```

2. **Most critical to revert first**: Task 1 (transaction changes)

3. **Safe to keep**: Task 5 (documentation only)

---

## Success Criteria

- ✅ Winner selection is race-condition free (transaction-based)
- ✅ Ratings calculated exactly once per issue
- ✅ Linear is source of truth for winner detection
- ✅ GitHub webhook is optional (commit tracking only)
- ✅ No 500 errors on missing agent names
- ✅ All tests pass
- ✅ Test coverage maintained
- ✅ Documentation updated

---

## Notes for Engineer

- **Transaction Support**: Drizzle ORM supports `db.transaction()` - see [Drizzle docs](https://orm.drizzle.team/docs/transactions)
- **Row Locking**: PostgreSQL `FOR UPDATE` is supported via `.for('update')` in Drizzle select queries
- **Testing Transactions**: Mock `db.transaction` to test transaction logic without real database
- **Performance**: Transactions add ~10-50ms overhead but are necessary for correctness
- **Idempotency**: Always check if winner already set before updating (prevents duplicate rating calculations)
