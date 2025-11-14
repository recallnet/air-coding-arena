/**
 * Integration tests for race condition scenarios.
 * Tests concurrent webhook processing with real-ish database mocks.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto'

import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { updateRatingsForIssue } from '@/lib/update-ratings'

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

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
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
    vi.mocked(updateRatingsForIssue).mockResolvedValue(undefined)
    process.env['LINEAR_WEBHOOK_SECRET'] = TEST_SECRET
    process.env['ARENA_LABEL'] = 'arena:ready'
  })

  it('should handle two concurrent merged PR webhooks correctly', async () => {
    let winnerSet = false
    let winnerAttemptId: string | null = null
    let winnerSetCount = 0 // Track how many times winner is actually set
    let transactionInProgress = false // Simulate FOR UPDATE blocking

    // Mock transaction to simulate row locking behavior with sequential execution
    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      // Wait for any in-progress transaction to complete (simulates FOR UPDATE blocking)
      while (transactionInProgress) {
        await new Promise((resolve) => {
          // eslint-disable-next-line no-undef
          setTimeout(resolve, 10)
        })
      }

      transactionInProgress = true

      const mockTx = {
        select: vi.fn(),
        update: vi.fn(),
      }

      // Capture current winner state AFTER acquiring lock (not at Promise.all time)
      const winnerAtLockTime = winnerSet ? winnerAttemptId : null

      // First select: issue with/without winner (locked state)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: TEST_DB_ISSUE_ID,
                  winnerAttemptId: winnerAtLockTime,
                },
              ]),
            }),
          }),
        }),
      } as never)

      // If no winner set yet, mock winner selection
      if (!winnerAtLockTime) {
        // Second select: get winner attempt
        mockTx.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([
                    { id: 'attempt-a', agentName: 'cursor' },
                  ]),
              }),
            }),
          }),
        } as never)

        // Update winner (called twice: once for setting winner, once for closing attempts)
        let updateCallCount = 0
        mockTx.update.mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(async () => {
              updateCallCount++
              if (updateCallCount === 1) {
                // First update: set winner
                winnerSet = true
                winnerAttemptId = 'attempt-a'
                winnerSetCount++ // Increment counter
              }
              // Second update: close losing attempts (no state change needed)
              return []
            }),
          }),
        } as never)
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await callback(mockTx as any)
      } finally {
        transactionInProgress = false // Release lock
      }
    })

    // Mock db.select for deduplication and issue lookup
    let selectCallCount = 0
    vi.mocked(db.select).mockImplementation((() => {
      selectCallCount++
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              // First two calls: time-window checks (no recent events)
              if (selectCallCount === 1 || selectCallCount === 2) return []
              // Third and fourth calls: issue lookup (return issue)
              return [{ id: TEST_DB_ISSUE_ID }]
            }),
          }),
        }),
      }
    }) as never)

    // Mock db.insert for events table and attempts (idempotency)
    let insertCallCount = 0
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(async () => {
            insertCallCount++
            // First two calls: events (both succeed)
            if (insertCallCount <= 2)
              return [{ id: `event-${insertCallCount}` }]
            // Events after that shouldn't happen
            return [{ id: `other-${insertCallCount}` }]
          }),
        }),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
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

    // Transaction should be called twice (once for each webhook)
    expect(db.transaction).toHaveBeenCalledTimes(2)

    // CRITICAL: Winner should be set exactly once (not twice!)
    expect(winnerSetCount).toBe(1)
    expect(winnerSet).toBe(true)
    expect(winnerAttemptId).toBe('attempt-a')

    // Note: updateRatingsForIssue is currently called for both webhooks (2x)
    // This is acceptable for now because rating updates are idempotent.
    // However, ideally it should only be called when winner is NEWLY set (1x).
    // This would require production code to track and return whether winner was newly set.
    // TODO: Optimize production code to skip rating updates when winner already set
    expect(updateRatingsForIssue).toHaveBeenCalledTimes(2)
    expect(updateRatingsForIssue).toHaveBeenCalledWith(TEST_DB_ISSUE_ID)
  })
})
