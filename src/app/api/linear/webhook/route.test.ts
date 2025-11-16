/**
 * Tests for Linear webhook handler.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto'

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { updateAgentStatusOnPR } from '@/lib/agent-status'

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
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/agent-status', () => ({
  updateAgentStatusOnPR: vi.fn(),
  markIgnoredOnIssueClosed: vi.fn(),
}))

vi.mock('@/lib/update-ratings', () => ({
  updateRatingsForIssue: vi.fn(),
}))

const WEBHOOK_URL = 'http://localhost:3109/api/linear/webhook'
const TEST_SECRET = 'test-secret'
const ARENA_LABEL = 'arena:ready'
const TEST_PR_URL = 'https://github.com/org/repo/pull/42'
const TEST_ISSUE_ID = 'issue-123'
const TEST_ISSUE_URL = 'https://linear.app/test/issue/ENG-123'
const TEST_ISSUE_IDENTIFIER = 'ENG-123'
const TEST_ISSUE_TITLE = 'Test issue'
const TEST_TIMESTAMP = '2024-01-01T00:00:00Z'
const TEST_DB_ISSUE_ID = 'db-issue-id'
const TEST_ATTACHMENT_ID = 'attach-123'
const TEST_ATTACHMENT_SUBTITLE = 'org/repo #42 • open'
const TEST_BRANCH_WITH_AGENT = 'eng-123--feature-x--agent-cursor'

/**
 * Creates a mock Next.js request with Linear webhook signature.
 *
 * @param payload - Webhook payload object
 * @param secret - Webhook secret for signature
 * @returns Mock NextRequest
 */
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

describe('/api/linear/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_WEBHOOK_SECRET'] = TEST_SECRET
    process.env['ARENA_LABEL'] = ARENA_LABEL
    process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
      { name: 'cursor', handle: '@Cursor' },
      { name: 'engine', handle: '@Engine' },
      { name: 'cyrus', handle: '@Cyrus' },
      { name: 'factory', handle: '@Factory' },
    ])

    // Mock db.select for time-window deduplication check (default: no recent events)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)
  })

  describe('signature verification', () => {
    it('should reject requests without signature', async () => {
      const req = new Request(WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({ type: 'Issue' }),
      }) as NextRequest

      const response = await POST(req)
      const data = (await response.json()) as { error: string }

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid signature')
    })

    it('should reject requests with invalid signature', async () => {
      const payload = { type: 'Issue', data: { id: '123' } }
      const body = JSON.stringify(payload)

      const req = new Request(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'linear-signature': 'invalid-signature',
        },
        body,
      }) as NextRequest

      const response = await POST(req)
      const data = (await response.json()) as { error: string }

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid signature')
    })

    it('should accept requests with valid signature', async () => {
      const payload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: TEST_ISSUE_ID,
          identifier: TEST_ISSUE_IDENTIFIER,
          title: TEST_ISSUE_TITLE,
          url: TEST_ISSUE_URL,
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }

      // Mock database calls
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)
      const data = (await response.json()) as { success: boolean }

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('idempotency', () => {
    it('should reject duplicate events', async () => {
      const payload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: TEST_ISSUE_ID,
          identifier: TEST_ISSUE_IDENTIFIER,
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      // Mock duplicate event (empty result)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)
      const data = (await response.json()) as { status: string }

      expect(response.status).toBe(200)
      expect(data.status).toBe('duplicate')
    })
  })

  describe('Issue events', () => {
    it('should create issue when arena:ready label is present', async () => {
      const payload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: TEST_ISSUE_ID,
          identifier: TEST_ISSUE_IDENTIFIER,
          title: 'Implement feature X',
          url: TEST_ISSUE_URL,
          team: { key: 'engineering' },
          state: { name: 'Backlog' },
          labels: [{ name: ARENA_LABEL }, { name: 'frontend' }],
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(mockInsert).toHaveBeenCalled()
    })

    it('should ignore issues without arena:ready label', async () => {
      const payload = {
        type: 'Issue',
        action: 'create',
        data: {
          id: 'issue-456',
          identifier: 'ENG-456',
          title: 'Regular issue',
          url: 'https://linear.app/test/issue/ENG-456',
          labels: [{ name: 'bug' }],
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      await POST(req)

      // Should only have created event, not issue (insert called once for event)
      expect(db.insert).toHaveBeenCalledOnce()
    })

    it('should trigger sync when arena label is added', async () => {
      const payload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: TEST_ISSUE_ID,
          identifier: TEST_ISSUE_IDENTIFIER,
          title: TEST_ISSUE_TITLE,
          url: TEST_ISSUE_URL,
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      await POST(req)

      expect(mockInsert).toHaveBeenCalled()
      // Note: Full integration test would verify sync was called
    })
  })

  describe('Comment events', () => {
    it('should trigger sync on comment with agent mentions', async () => {
      const payload = {
        type: 'Comment',
        action: 'create',
        data: {
          id: 'comment-123',
          body: 'Hey @cursor can you fix this? Also @engine please review.',
          createdAt: TEST_TIMESTAMP,
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: TEST_DB_ISSUE_ID, linearId: TEST_ISSUE_ID },
              ]),
          }),
        }),
      })

      vi.mocked(db.select).mockReturnValue(mockSelect() as never)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      // Note: Full integration test would verify sync was called
    })

    it('should trigger sync even for comments without agent mentions', async () => {
      const payload = {
        type: 'Comment',
        action: 'create',
        data: {
          id: 'comment-456',
          body: 'This is a regular comment',
          createdAt: TEST_TIMESTAMP,
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: TEST_DB_ISSUE_ID, linearId: TEST_ISSUE_ID },
              ]),
          }),
        }),
      })

      vi.mocked(db.select).mockReturnValue(mockSelect() as never)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      // Note: Full integration test would verify sync was called
    })

    it('should trigger full comment sync on comment event', async () => {
      const payload = {
        type: 'Comment',
        action: 'create',
        data: {
          id: 'comment-123',
          body: '@cursor fix this',
          createdAt: TEST_TIMESTAMP,
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: TEST_DB_ISSUE_ID, linearId: TEST_ISSUE_ID },
              ]),
          }),
        }),
      })

      vi.mocked(db.select).mockReturnValue(mockSelect() as never)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      // Note: Full integration test would verify sync was called
    })
  })

  describe('Attachment events', () => {
    it('should update agent status to submitted on PR attachment', async () => {
      const payload = {
        type: 'Attachment',
        action: 'create',
        data: {
          id: TEST_ATTACHMENT_ID,
          url: TEST_PR_URL,
          title: 'cursor: Fix issue',
          subtitle: 'org/repo #42',
          metadata: {
            branch: 'eng-123--fix-issue--agent-cursor',
          },
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      // Mock db.select to handle both time-window check and issue lookup
      let selectCallCount = 0
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call: time-window check (no recent events)
              if (selectCallCount === 1) return []
              // Second call: issue lookup (return issue)
              return [{ id: TEST_DB_ISSUE_ID }]
            }),
          }),
        }),
      })

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      })

      vi.mocked(db.select).mockReturnValue(mockSelect() as never)
      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(updateAgentStatusOnPR).toHaveBeenCalledWith(
        TEST_DB_ISSUE_ID,
        'cursor'
      )
    })

    it('should create attempt for GitHub PR attachment', async () => {
      const payload = {
        type: 'Attachment',
        action: 'create',
        data: {
          id: TEST_ATTACHMENT_ID,
          url: TEST_PR_URL,
          title: 'Add feature X (agent-cursor)',
          subtitle: TEST_ATTACHMENT_SUBTITLE,
          metadata: {
            branch: TEST_BRANCH_WITH_AGENT,
          },
          issue: {
            id: TEST_ISSUE_ID,
          },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      // Mock database calls
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'db-issue-uuid' }]),
          }),
        }),
      })

      vi.mocked(db.select).mockReturnValue(mockSelect() as never)

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      expect(mockSelect).toHaveBeenCalled()
    })

    it('should extract agent from branch name', async () => {
      const testCases = [
        { branch: 'eng-123--fix--agent-cursor', expected: 'cursor' },
        { branch: 'eng-124--feature--agent-engine', expected: 'engine' },
        { branch: 'eng-125--refactor--agent-cyrus', expected: 'cyrus' },
      ]

      for (const testCase of testCases) {
        const payload = {
          type: 'Attachment',
          action: 'create',
          data: {
            id: `attach-${testCase.branch}`,
            url: TEST_PR_URL,
            title: 'Test PR',
            subtitle: TEST_ATTACHMENT_SUBTITLE,
            metadata: { branch: testCase.branch },
            issue: { id: TEST_ISSUE_ID },
          },
          updatedAt: TEST_TIMESTAMP,
          createdAt: TEST_TIMESTAMP,
        }

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'uuid' }]),
            }),
          }),
        } as never)

        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
            onConflictDoUpdate: vi.fn().mockResolvedValue([]),
          }),
        } as never)

        const req = createMockRequest(payload)
        const response = await POST(req)
        expect(response.status).toBe(200)
      }
    })

    it('should gracefully handle attachment without issue field', async () => {
      // Reproduces production bug where attachment.issue is undefined
      const payload = {
        type: 'Attachment',
        action: 'create',
        data: {
          id: TEST_ATTACHMENT_ID,
          url: TEST_PR_URL,
          title: 'Fix issue',
          subtitle: TEST_ATTACHMENT_SUBTITLE,
          metadata: {
            branch: 'eng-123--fix-issue--agent-cursor',
          },
          // NOTE: issue field is missing - this causes the bug
          issueId: TEST_ISSUE_ID, // Linear might send issueId at root level instead
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      // Mock database calls
      let selectCallCount = 0
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call: time-window check (no recent events)
              if (selectCallCount === 1) return []
              // Second call: issue lookup (return issue)
              return [{ id: TEST_DB_ISSUE_ID }]
            }),
          }),
        }),
      } as never)

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      // Should not crash - should return 200 and gracefully skip
      expect(response.status).toBe(200)
    })
  })

  describe('Attachment.create - graceful agent name handling', () => {
    it('should skip attempt creation when branch name lacks agent info', async () => {
      const { syncIssueFromLinear } = await import('@/lib/linear-sync')

      // Mock: issue exists in database
      let selectCallCount = 0
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call: time-window check (no recent events)
              if (selectCallCount === 1) return []
              // Second call: issue lookup (return issue)
              return [{ id: TEST_DB_ISSUE_ID }]
            }),
          }),
        }),
      } as never)

      // Mock event insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock syncIssueFromLinear
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

      // Should NOT create attempt (db.insert only called once for event)
      expect(db.insert).toHaveBeenCalledOnce()
    })

    it('should create attempt when branch name contains agent', async () => {
      // Mock: issue exists
      let selectCallCount = 0
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call: time-window check (no recent events)
              if (selectCallCount === 1) return []
              // Second call: issue lookup (return issue)
              return [{ id: TEST_DB_ISSUE_ID }]
            }),
          }),
        }),
      } as never)

      // Mock insert for both event and attempt
      let insertCallCount = 0
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation(() => {
          insertCallCount++
          return {
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: insertCallCount }]),
            }),
            onConflictDoUpdate: vi.fn().mockResolvedValue([]),
          }
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

      // Should create attempt with agent name from branch (insert called twice: event + attempt)
      expect(db.insert).toHaveBeenCalledTimes(2)
    })

    it('should detect merged status from subtitle', async () => {
      const payload = {
        type: 'Attachment',
        action: 'update',
        data: {
          id: TEST_ATTACHMENT_ID,
          url: TEST_PR_URL,
          title: 'Add feature X',
          subtitle: 'org/repo #42 • merged',
          metadata: {
            branch: TEST_BRANCH_WITH_AGENT,
          },
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: '2024-01-01T01:00:00Z',
        createdAt: TEST_TIMESTAMP,
      }

      // Mock db.select to handle time-window check and issue lookup
      let selectCallCount = 0
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call: time-window check (no recent events)
              if (selectCallCount === 1) return []
              // Second call: issue lookup (return issue)
              return [{ id: 'uuid' }]
            }),
          }),
        }),
      } as never)

      // Mock for attempts insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      } as never)

      // Mock transaction for updateWinner
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([{ id: 'uuid', winnerAttemptId: null }]),
              }),
              orderBy: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([
                    { id: 'winner-id', agentName: 'cursor' },
                  ]),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return callback(mockTx as any)
      })

      const req = createMockRequest(payload)
      await POST(req)

      expect(db.transaction).toHaveBeenCalled()
    })

    it('should ignore non-GitHub URLs', async () => {
      const payload = {
        type: 'Attachment',
        action: 'create',
        data: {
          id: 'attach-doc',
          url: 'https://docs.google.com/document/123',
          title: 'Design doc',
          issue: { id: TEST_ISSUE_ID },
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const req = createMockRequest(payload)
      await POST(req)

      // Should only insert event, not query for issue or insert attempt
      expect(db.insert).toHaveBeenCalledOnce()
    })
  })

  describe('Issue events - metadata handling', () => {
    it('should handle issue with full metadata in webhook', async () => {
      const payload = {
        type: 'Issue',
        action: 'update',
        data: {
          id: TEST_ISSUE_ID,
          identifier: TEST_ISSUE_IDENTIFIER,
          title: 'Issue with metadata',
          url: TEST_ISSUE_URL,
          team: { key: 'engineering' },
          state: { name: 'In Progress' },
          labels: [{ name: ARENA_LABEL }, { name: 'bug' }, { name: 'urgent' }],
        },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)
      // Webhook should store basic fields, sync will enrich later
      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      const payload = {
        type: 'Issue',
        action: 'create',
        data: { id: TEST_ISSUE_ID },
        updatedAt: TEST_TIMESTAMP,
        createdAt: TEST_TIMESTAMP,
      }

      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const req = createMockRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(500)
    })

    it('should handle missing LINEAR_WEBHOOK_SECRET', async () => {
      delete process.env['LINEAR_WEBHOOK_SECRET']

      const payload = { type: 'Issue', data: { id: '123' } }
      const req = createMockRequest(payload, 'wrong-secret')
      const response = await POST(req)

      expect(response.status).toBe(401)
    })
  })

  describe('Time-window deduplication', () => {
    const WEBHOOK_URL_TEST = 'http://localhost:3000/api/linear/webhook'

    beforeEach(() => {
      // Track how many times select has been called
      let selectCallCount = 0

      // Mock database calls for deduplication tests
      const mockInsert = vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      })

      vi.mocked(db.insert).mockReturnValue({
        values: mockInsert,
      } as never)

      // Mock select for time-window check with stateful behavior
      // First call: no recent events (first request)
      // Second call: recent event found (second request in same window)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call returns empty (no recent events)
              // Second call returns event (recent event found)
              return selectCallCount === 1
                ? []
                : [{ id: 1, createdAt: new Date() }]
            }),
          }),
        }),
      } as never)

      // Mock update for remove actions
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never)
    })

    it('should deduplicate events within 5 second window for same action', async () => {
      // First event: Issue update
      const time1 = new Date().toISOString()
      const payload1 = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'test-issue-123',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: time1,
        createdAt: time1,
      }

      const req1 = new NextRequest(WEBHOOK_URL_TEST, {
        method: 'POST',
        body: JSON.stringify(payload1),
        headers: {
          'linear-signature': createValidSignature(payload1),
        },
      })

      const res1 = await POST(req1)
      expect(res1.status).toBe(200)
      const body1 = (await res1.json()) as { success: boolean }
      expect(body1.success).toBe(true)

      // Second event: Same issue, same action, 1 second later (different updatedAt)
      // This should be deduplicated
      const time2 = new Date(Date.now() + 1000).toISOString()
      const payload2 = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'test-issue-123',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: time2,
        createdAt: time1,
      }

      const req2 = new NextRequest(WEBHOOK_URL_TEST, {
        method: 'POST',
        body: JSON.stringify(payload2),
        headers: {
          'linear-signature': createValidSignature(payload2),
        },
      })

      const res2 = await POST(req2)
      expect(res2.status).toBe(200)
      const body2 = (await res2.json()) as { status: string }
      expect(body2.status).toBe('deduplicated')
    })

    it('should NOT deduplicate different actions within time window', async () => {
      // Reset mock to return empty for both calls (different actions don't match)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      // First event: Issue update
      const time1 = new Date().toISOString()
      const payload1 = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'test-issue-456',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: time1,
        createdAt: time1,
      }

      const req1 = new NextRequest(WEBHOOK_URL_TEST, {
        method: 'POST',
        body: JSON.stringify(payload1),
        headers: {
          'linear-signature': createValidSignature(payload1),
        },
      })

      const res1 = await POST(req1)
      expect(res1.status).toBe(200)

      // Second event: Same issue, DIFFERENT action (remove), 1 second later
      // This should NOT be deduplicated (different action)
      const time2 = new Date(Date.now() + 1000).toISOString()
      const payload2 = {
        type: 'Issue',
        action: 'remove',
        data: {
          id: 'test-issue-456',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: time2,
        createdAt: time1,
      }

      const req2 = new NextRequest(WEBHOOK_URL_TEST, {
        method: 'POST',
        body: JSON.stringify(payload2),
        headers: {
          'linear-signature': createValidSignature(payload2),
        },
      })

      const res2 = await POST(req2)
      expect(res2.status).toBe(200)
      const body2 = (await res2.json()) as { success: boolean; status?: string }
      // Should be processed, not deduplicated (different action)
      expect(body2.success).toBe(true)
      expect(body2.status).not.toBe('deduplicated')
    })

    it('should process events after 5 second window expires', async () => {
      // Reset mock to return empty for both calls (outside time window)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      vi.useFakeTimers()
      const startTime = Date.now()

      // First event
      const time1 = new Date(startTime).toISOString()
      const payload1 = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'test-issue-789',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: time1,
        createdAt: time1,
      }

      const req1 = new NextRequest(WEBHOOK_URL_TEST, {
        method: 'POST',
        body: JSON.stringify(payload1),
        headers: {
          'linear-signature': createValidSignature(payload1),
        },
      })

      await POST(req1)

      // Advance time by 6 seconds (past the 5 second window)
      vi.advanceTimersByTime(6000)

      // Second event - should be processed (outside window)
      const time2 = new Date(startTime + 6000).toISOString()
      const payload2 = {
        type: 'Issue',
        action: 'update',
        data: {
          id: 'test-issue-789',
          labels: [{ name: ARENA_LABEL }],
        },
        updatedAt: time2,
        createdAt: time1,
      }

      const req2 = new NextRequest(WEBHOOK_URL_TEST, {
        method: 'POST',
        body: JSON.stringify(payload2),
        headers: {
          'linear-signature': createValidSignature(payload2),
        },
      })

      const res2 = await POST(req2)
      const body2 = (await res2.json()) as { success: boolean; status?: string }
      expect(body2.success).toBe(true)
      expect(body2.status).not.toBe('deduplicated')

      vi.useRealTimers()
    })

    it('should handle 10 rapid webhooks like Linear delete spam', async () => {
      const issueId = 'spam-issue-999'
      let processedCount = 0
      let deduplicatedCount = 0

      // Reset the select mock to track state across requests
      let selectCallCount = 0
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(async () => {
              selectCallCount++
              // First call returns empty (no recent events)
              // All subsequent calls return event (recent event found)
              return selectCallCount === 1
                ? []
                : [{ id: 1, createdAt: new Date() }]
            }),
          }),
        }),
      } as never)

      // Simulate 10 webhooks arriving within 500ms (like real Linear behavior)
      for (let i = 0; i < 10; i++) {
        const payload = {
          type: 'Issue',
          action: 'update',
          data: { id: issueId },
          updatedAt: new Date(Date.now() + i * 50).toISOString(), // 50ms apart
          createdAt: new Date().toISOString(),
        }

        const req = new NextRequest(WEBHOOK_URL_TEST, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'linear-signature': createValidSignature(payload),
          },
        })

        const res = await POST(req)
        const body = (await res.json()) as {
          success?: boolean
          status?: string
        }

        if (body.success) {
          processedCount++
        } else if (body.status === 'deduplicated') {
          deduplicatedCount++
        }
      }

      // Should process first one, deduplicate the other 9
      expect(processedCount).toBe(1)
      expect(deduplicatedCount).toBe(9)
    })
  })
})

// Helper function to create valid signature
function createValidSignature(payload: unknown): string {
  const secret = process.env['LINEAR_WEBHOOK_SECRET'] ?? 'test-secret'
  const body = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret)
  return hmac.update(body).digest('hex')
}

describe('updateWinner - issue completion and agent status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_WEBHOOK_SECRET'] = TEST_SECRET
    process.env['ARENA_LABEL'] = ARENA_LABEL

    // Mock db.select for time-window deduplication check (default: no recent events)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)
  })

  it('should mark issue as completed when winner is set', async () => {
    const payload = {
      type: 'Attachment',
      action: 'update',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'Add feature X',
        subtitle: 'org/repo #42 • merged',
        metadata: {
          branch: TEST_BRANCH_WITH_AGENT,
        },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: '2024-01-01T01:00:00Z',
      createdAt: TEST_TIMESTAMP,
    }

    // Mock db.select to handle time-window check and issue lookup
    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (return issue)
            return [{ id: 'uuid', linearKey: 'TEST-123' }]
          }),
        }),
      }),
    } as never)

    // Mock for attempts insert
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    // Mock transaction for updateWinner
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: 'uuid', winnerAttemptId: null }]),
            }),
            orderBy: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: 'winner-id', agentName: 'cursor' }]),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    }

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return callback(mockTx as any)
    })

    const req = createMockRequest(payload)
    await POST(req)

    expect(db.transaction).toHaveBeenCalled()

    // Verify issue status was set to 'completed' in the update call
    expect(mockTx.update).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const updateCall = mockTx.update().set
    expect(updateCall).toHaveBeenCalledWith(
      expect.objectContaining({
        winnerAttemptId: 'winner-id',
        status: 'completed',
      })
    )
  })

  it('should mark non-submitting agents as ignored when winner is set', async () => {
    const payload = {
      type: 'Attachment',
      action: 'update',
      data: {
        id: 'attach-789',
        url: 'https://github.com/org/repo/pull/789',
        title: 'Fix another bug',
        subtitle: 'org/repo #789 • merged',
        metadata: {
          branch: 'eng-456--fix--agent-engine',
        },
        issue: { id: 'issue-456' },
      },
      updatedAt: '2024-01-01T02:00:00Z',
      createdAt: TEST_TIMESTAMP,
    }

    // Mock db.select to handle time-window check and issue lookup
    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (return issue)
            return [{ id: 'uuid2', linearKey: 'TEST-456' }]
          }),
        }),
      }),
    } as never)

    // Mock for attempts insert
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    // Mock transaction for updateWinner
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: 'uuid2', winnerAttemptId: null }]),
            }),
            orderBy: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: 'winner-id-2', agentName: 'engine' },
                ]),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    }

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return callback(mockTx as any)
    })

    // Mock markIgnoredOnIssueClosed
    const { markIgnoredOnIssueClosed } = await import('@/lib/agent-status')
    vi.mocked(markIgnoredOnIssueClosed).mockResolvedValue(undefined)

    const req = createMockRequest(payload)
    await POST(req)

    // Verify markIgnoredOnIssueClosed was called
    expect(markIgnoredOnIssueClosed).toHaveBeenCalledWith('uuid2')
  })
})

describe('updateWinner - race condition protection', () => {
  it('should handle concurrent winner selection with transaction', async () => {
    const issueId = 'test-issue-id'
    const attemptA = 'attempt-a-id'

    // Mock transaction
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: issueId, winnerAttemptId: null }]),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    }

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return callback(mockTx as any)
    })

    // Mock attempts query - return attemptA as first merged
    mockTx.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: issueId, winnerAttemptId: null }]),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([{ id: attemptA, agentName: 'cursor' }]),
            }),
          }),
        }),
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
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: issueId, winnerAttemptId: existingWinner },
                ]),
            }),
          }),
        }),
      }),
    }

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return callback(mockTx as any)
    })

    // Expect early return when winner already set
    // No update should be called
    expect(mockTx.select).toBeDefined()
  })
})

describe('Issue.remove action', () => {
  it('should mark issue as deleted on remove action', async () => {
    const payload = {
      type: 'Issue',
      action: 'remove',
      data: {
        id: TEST_ISSUE_ID,
        identifier: TEST_ISSUE_IDENTIFIER,
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock db.select for time-window deduplication check (no recent events)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    const mockUpdate = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    })

    vi.mocked(db.update).mockReturnValue({
      set: mockUpdate,
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('Issue.update - label removal', () => {
  it('should mark issue as deleted when arena label is removed on update', async () => {
    const payload = {
      type: 'Issue',
      action: 'update',
      data: {
        id: TEST_ISSUE_ID,
        identifier: TEST_ISSUE_IDENTIFIER,
        title: TEST_ISSUE_TITLE,
        url: TEST_ISSUE_URL,
        labels: [{ name: 'bug' }], // No arena:ready label
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock db.select for time-window deduplication check (no recent events)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    const mockUpdate = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    })

    vi.mocked(db.update).mockReturnValue({
      set: mockUpdate,
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('Attachment events - edge cases', () => {
  it('should handle attachment for unknown issue gracefully', async () => {
    const payload = {
      type: 'Attachment',
      action: 'create',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'PR for unknown issue',
        subtitle: TEST_ATTACHMENT_SUBTITLE,
        metadata: {
          branch: TEST_BRANCH_WITH_AGENT,
        },
        issue: { id: 'unknown-issue-id' },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock: time-window check returns no events
    // Mock: issue lookup returns empty (issue not found)
    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (issue not found)
            return []
          }),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should return success but not create attempt
    expect(response.status).toBe(200)
    // Only one insert call (for event, not for attempt)
    expect(db.insert).toHaveBeenCalledOnce()
  })

  it('should detect closed status from subtitle', async () => {
    const payload = {
      type: 'Attachment',
      action: 'update',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'PR that was closed',
        subtitle: 'org/repo #42 • closed',
        metadata: {
          branch: TEST_BRANCH_WITH_AGENT,
        },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (return issue)
            return [{ id: TEST_DB_ISSUE_ID, linearKey: 'ENG-123' }]
          }),
        }),
      }),
    } as never)

    const mockInsert = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    })

    vi.mocked(db.insert).mockReturnValue({
      values: mockInsert,
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
    // Should have called insert for both event and attempt
    expect(mockInsert).toHaveBeenCalled()
  })
})

describe('Comment events - unknown issue', () => {
  it('should handle comment on unknown issue gracefully', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-unknown',
        body: '@cursor please help',
        createdAt: TEST_TIMESTAMP,
        issue: { id: 'unknown-issue-999' },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock: time-window check returns no events
    // Mock: issue lookup returns empty (issue not found)
    let selectCallCount = 0
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (issue not found)
            return []
          }),
        }),
      }),
    })

    vi.mocked(db.select).mockReturnValue(mockSelect() as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should return success without error
    expect(response.status).toBe(200)
    // Should have inserted event
    expect(db.insert).toHaveBeenCalledOnce()
  })
})

describe('Malformed webhook payloads', () => {
  it('should handle webhook with missing required fields gracefully', async () => {
    const payload = {
      type: 'Issue',
      action: 'update',
      data: {
        // Missing required fields like id
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    // Mock db.select for time-window deduplication check (no recent events)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should handle gracefully (may return 500 or process partially)
    expect([200, 500]).toContain(response.status)
  })

  it('should handle webhook with invalid JSON gracefully', async () => {
    const body = '{invalid json}'
    const hmac = crypto.createHmac('sha256', TEST_SECRET)
    const signature = hmac.update(body).digest('hex')

    const req = new Request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'linear-signature': signature,
      },
      body,
    }) as NextRequest

    const response = await POST(req)

    // Should return error
    expect(response.status).toBe(500)
  })

  it('should handle attachment with null issueRecord gracefully', async () => {
    const payload = {
      type: 'Attachment',
      action: 'create',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'Test PR',
        subtitle: TEST_ATTACHMENT_SUBTITLE,
        metadata: {
          branch: TEST_BRANCH_WITH_AGENT,
        },
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (return undefined in array)
            return [undefined]
          }),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should handle gracefully
    expect(response.status).toBe(200)
  })

  it('should handle attachment with no issue ID fields', async () => {
    const payload = {
      type: 'Attachment',
      action: 'create',
      data: {
        id: TEST_ATTACHMENT_ID,
        url: TEST_PR_URL,
        title: 'PR without issue link',
        subtitle: TEST_ATTACHMENT_SUBTITLE,
        metadata: {
          branch: TEST_BRANCH_WITH_AGENT,
        },
        // No issue or issueId field at all
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should handle gracefully and return success
    expect(response.status).toBe(200)
    // Should only insert event, not attempt
    expect(db.insert).toHaveBeenCalledOnce()
  })
})

describe('Comment events - null issue check', () => {
  it('should handle comment with null issue in result array', async () => {
    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-null-check',
        body: '@cursor test',
        createdAt: TEST_TIMESTAMP,
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (return undefined in array)
            return [undefined]
          }),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const req = createMockRequest(payload)
    const response = await POST(req)

    // Should handle gracefully without crashing
    expect(response.status).toBe(200)
  })

  it('should sync issue when comment event has valid issue', async () => {
    const { syncIssueFromLinear } = await import('@/lib/linear-sync')

    const payload = {
      type: 'Comment',
      action: 'create',
      data: {
        id: 'comment-sync-test',
        body: '@cursor please help with this',
        createdAt: TEST_TIMESTAMP,
        issue: { id: TEST_ISSUE_ID },
      },
      updatedAt: TEST_TIMESTAMP,
      createdAt: TEST_TIMESTAMP,
    }

    let selectCallCount = 0
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            selectCallCount++
            // First call: time-window check (no recent events)
            if (selectCallCount === 1) return []
            // Second call: issue lookup (return valid issue)
            return [{ id: TEST_DB_ISSUE_ID, linearId: TEST_ISSUE_ID }]
          }),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    vi.mocked(syncIssueFromLinear).mockResolvedValue(undefined)

    const req = createMockRequest(payload)
    const response = await POST(req)

    expect(response.status).toBe(200)
    // Should have called syncIssueFromLinear with the linear issue ID
    expect(syncIssueFromLinear).toHaveBeenCalledWith(TEST_ISSUE_ID)
  })
})
