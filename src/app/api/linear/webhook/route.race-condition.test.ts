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

      // Capture current winner state at transaction start (simulating row lock)
      const winnerAtStart = winnerSet ? winnerAttemptId : null

      // First select: issue with/without winner (locked state)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: TEST_DB_ISSUE_ID,
                  winnerAttemptId: winnerAtStart,
                },
              ]),
            }),
          }),
        }),
      } as never)

      // If no winner set yet, mock winner selection
      if (!winnerAtStart) {
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
              }
              // Second update: close losing attempts (no state change needed)
              return []
            }),
          }),
        } as never)
      }

      return callback(mockTx as any)
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
            if (insertCallCount <= 2) return [{ id: `event-${insertCallCount}` }]
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

    // Transaction should be called (at least once, possibly twice)
    expect(db.transaction).toHaveBeenCalled()

    // Winner should be set exactly once
    expect(winnerSet).toBe(true)
    expect(winnerAttemptId).toBe('attempt-a')
  })
})
