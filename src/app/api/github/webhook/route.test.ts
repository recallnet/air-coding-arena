/* eslint-disable no-undef, sonarjs/no-duplicate-string */
import crypto from 'node:crypto'

import { NextRequest } from 'next/server'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import { db } from '@/db/client'
import { updateAgentStatusOnPRClose } from '@/lib/agent-status'
import { getInstallationToken } from '@/lib/github-app-auth'
import { updateRatingsForIssue } from '@/lib/update-ratings'

import { POST } from './route'

// Test constants
const WEBHOOK_URL = 'http://localhost:3000/api/github/webhook'
const TEST_SECRET = 'test-secret-key'
const TEST_REPO = 'recallnet/js-recall'
const TEST_PR_NUMBER = 1559
const TEST_SHA = 'new-sha-123'
const TEST_ATTEMPT_ID = 'attempt-uuid'
const TEST_ISSUE_ID = 'test-issue-id'

// Mock the database
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

// Mock agent status updates
vi.mock('@/lib/agent-status', () => ({
  updateAgentStatusOnPRClose: vi.fn(),
}))

// Mock rating updates
vi.mock('@/lib/update-ratings', () => ({
  updateRatingsForIssue: vi.fn(),
}))

// Mock GitHub App auth
vi.mock('@/lib/github-app-auth', () => ({
  getInstallationToken: vi.fn(),
}))

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

/**
 * Helper to create authenticated request
 *
 * @param payload - Request payload
 * @param secret - Webhook secret
 * @returns Authenticated NextRequest
 */
function createAuthenticatedRequest(
  payload: object,
  secret = TEST_SECRET
): NextRequest {
  const body = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret)
  const signature = 'sha256=' + hmac.update(body).digest('hex')

  return new NextRequest(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'x-hub-signature-256': signature },
    body,
  })
}

describe('/api/github/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 for missing signature', async () => {
    const req = new NextRequest(WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'opened' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })

  describe('Signature Verification', () => {
    const payload = JSON.stringify({
      action: 'opened',
      pull_request: { number: 1, head: { sha: 'abc123' } },
    })

    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
    })

    it('should accept valid HMAC signature', async () => {
      const hmac = crypto.createHmac('sha256', TEST_SECRET)
      const signature = 'sha256=' + hmac.update(payload).digest('hex')

      // Mock successful insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

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

    it('should reject when GITHUB_WEBHOOK_SECRET is not configured', async () => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', '')

      const hmac = crypto.createHmac('sha256', 'some-secret')
      const payload = JSON.stringify({
        action: 'opened',
        pull_request: { number: 1, head: { sha: 'abc123' } },
      })
      const signature = 'sha256=' + hmac.update(payload).digest('hex')

      const req = new NextRequest('http://localhost:3000/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        body: payload,
      })

      const response = await POST(req)
      expect(response.status).toBe(401)
    })
  })

  describe('Idempotency', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.clearAllMocks()
    })

    it('should process first webhook event', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: { number: 1, head: { sha: 'abc123' } },
      }
      const req = createAuthenticatedRequest(payload)

      // Mock successful insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            target: vi.fn(),
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(req)
      const json = (await response.json()) as { success?: boolean }

      expect(json.success).toBe(true)
    })

    it('should return duplicate for same event', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: { number: 1, head: { sha: 'abc123' } },
      }

      // Mock duplicate (empty result)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            target: vi.fn(),
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      const json = (await response.json()) as { status?: string }

      expect(json.status).toBe('duplicate')
    })
  })

  describe('pull_request.synchronize', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.stubEnv('GITHUB_TOKEN', 'github_pat_test_token')
      vi.clearAllMocks()
    })

    it('should update commit count for tracked PR', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check (event is new)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock db.select for both installation lookup (returns empty) and attempt lookup
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No installation found
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                // Attempt lookup (PR is tracked)
                {
                  id: TEST_ATTEMPT_ID,
                  issueId: TEST_ISSUE_ID,
                  agentName: 'cursor',
                  repo: TEST_REPO,
                  prNumber: TEST_PR_NUMBER,
                  commitCount: 1,
                },
              ]),
            }),
          }),
        } as never)

      // Mock GitHub API response for commit count
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { sha: 'commit1' },
          { sha: 'commit2' },
          { sha: 'commit3' },
        ],
      })

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify update was called with correct data
      expect(db.update).toHaveBeenCalled()
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

      // Mock idempotency check (event is new)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup (PR not found)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call update for untracked PRs
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle GitHub API errors gracefully', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1)
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle missing GITHUB_TOKEN', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      vi.stubEnv('GITHUB_TOKEN', '')

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1) when token is missing
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle invalid repository format', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'invalid-repo' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'invalid-repo',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1) for invalid repo format
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle fetch exceptions', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock fetch to throw an error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should still update with fallback count (1) on network error
      expect(db.update).toHaveBeenCalled()
    })

    it('should handle missing pull_request in payload', async () => {
      const payload = {
        action: 'synchronize',
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call select or update
      expect(db.select).not.toHaveBeenCalled()
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle missing repository in payload', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call select or update
      expect(db.select).not.toHaveBeenCalled()
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle non-array response from GitHub API', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'attempt-uuid',
                issueId: 'test-issue-id',
                agentName: 'cursor',
                repo: 'recallnet/js-recall',
                prNumber: 1559,
                commitCount: 1,
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API returning non-array
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Not an array' }),
      })

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'attempt-uuid' }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should update with fallback count (1) when response is not array
      expect(db.update).toHaveBeenCalled()
    })

    it('should reset CI status to pending when new commit pushed', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup - PR with previous success status
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
                commitCount: 2,
                ciStatus: 'success', // Previous CI passed
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { sha: 'commit1' },
          { sha: 'commit2' },
          { sha: 'commit3' },
        ],
      })

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify CI status reset to pending
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          commitCount: 3,
          lastCommitSha: TEST_SHA,
          ciStatus: 'pending',
          ciLastCheckedAt: expect.any(Date),
        })
      )
    })

    it('should reset CI status from failure to pending on new commit', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup - PR with previous failure status
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
                commitCount: 1,
                ciStatus: 'failure', // Previous CI failed
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ sha: 'commit1' }, { sha: 'commit2' }],
      })

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify CI status reset to pending
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'pending',
          ciLastCheckedAt: expect.any(Date),
        })
      )
    })

    it('should reset CI status from error to pending on new commit', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup - PR with previous error status
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
                commitCount: 1,
                ciStatus: 'error', // Previous CI had error
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ sha: 'commit1' }, { sha: 'commit2' }],
      })

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify CI status reset to pending
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'pending',
          ciLastCheckedAt: expect.any(Date),
        })
      )
    })

    it('should use GitHub App installation tokens when available', async () => {
      // Note: This test verifies that installation tokens are used.
      // The existing tests already verify PAT fallback behavior implicitly.
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock db.select: first for installation lookup, second for attempt lookup
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  installation_id: '12345', // Use snake_case as returned by database
                  account_login: 'recallnet',
                },
              ]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: TEST_ATTEMPT_ID,
                  issueId: TEST_ISSUE_ID,
                  agentName: 'cursor',
                  repo: 'recallnet/js-recall',
                  prNumber: TEST_PR_NUMBER,
                  commitCount: 1,
                },
              ]),
            }),
          }),
        } as never)

      // Mock getInstallationToken
      vi.mocked(getInstallationToken).mockResolvedValue('ghs_installation_token')

      // Mock GitHub API response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ sha: 'commit1' }, { sha: 'commit2' }, { sha: 'commit3' }],
      })
      global.fetch = mockFetch

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify installation token was requested
      expect(getInstallationToken).toHaveBeenCalledWith('12345')

      // Verify fetch used installation token with correct headers
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/recallnet/js-recall/pulls/1559/commits',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ghs_installation_token',
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          }),
        })
      )
    })
  })

  describe('CI status state transitions', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.stubEnv('GITHUB_TOKEN', 'github_pat_test_token')
      vi.clearAllMocks()
    })

    it('should transition from success to pending to failure', async () => {
      // Step 1: Synchronize event (new commit) resets success to pending
      const synchronizePayload = {
        action: 'synchronize',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup - PR with previous success status
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
                commitCount: 2,
                ciStatus: 'success',
              },
            ]),
          }),
        }),
      } as never)

      // Mock GitHub API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { sha: 'commit1' },
          { sha: 'commit2' },
          { sha: 'commit3' },
        ],
      })

      // Mock update operation for synchronize
      const mockWhere1 = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet1 = vi.fn().mockReturnValue({ where: mockWhere1 })
      vi.mocked(db.update).mockReturnValue({ set: mockSet1 } as never)

      const response1 = await POST(
        createAuthenticatedRequest(synchronizePayload)
      )
      expect(response1.status).toBe(200)

      // Verify CI status reset to pending
      expect(mockSet1).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'pending',
          ciLastCheckedAt: expect.any(Date),
        })
      )

      // Step 2: Check suite completed event updates pending to failure
      vi.clearAllMocks()

      const checkSuitePayload = {
        action: 'completed',
        check_suite: {
          conclusion: 'failure',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 2 }]),
          }),
        }),
      } as never)

      // Mock update operation for check_suite
      const mockWhere2 = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet2 = vi.fn().mockReturnValue({ where: mockWhere2 })
      vi.mocked(db.update).mockReturnValue({ set: mockSet2 } as never)

      const response2 = await POST(
        createAuthenticatedRequest(checkSuitePayload)
      )
      expect(response2.status).toBe(200)

      // Verify CI status updated to failure
      expect(mockSet2).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'failure',
          ciLastCheckedAt: expect.any(Date),
        })
      )
    })
  })

  describe('check_suite.completed', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.clearAllMocks()
    })

    it('should update CI status to success', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          status: 'completed',
          conclusion: 'success',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify update was called with correct CI status
      expect(db.update).toHaveBeenCalled()
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'success',
          ciLastCheckedAt: expect.any(Date),
        })
      )
    })

    it('should update CI status to failure', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          status: 'completed',
          conclusion: 'failure',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'failure',
        })
      )
    })

    it('should map timed_out to failure', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'timed_out',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      await POST(createAuthenticatedRequest(payload))

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'failure',
        })
      )
    })

    it('should map cancelled to failure', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'cancelled',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      await POST(createAuthenticatedRequest(payload))

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'failure',
        })
      )
    })

    it('should map action_required to error', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'action_required',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      await POST(createAuthenticatedRequest(payload))

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'error',
        })
      )
    })

    it('should map neutral to pending', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'neutral',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      await POST(createAuthenticatedRequest(payload))

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'pending',
        })
      )
    })

    it('should map skipped to pending', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'skipped',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      await POST(createAuthenticatedRequest(payload))

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ciStatus: 'pending',
        })
      )
    })

    it('should handle multiple PRs in one check suite', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'success',
          head_sha: TEST_SHA,
          pull_requests: [{ number: 1 }, { number: 2 }, { number: 3 }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should update all 3 PRs
      expect(db.update).toHaveBeenCalledTimes(3)
    })

    it('should handle null conclusion (still running)', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: null,
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call update when conclusion is null
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle missing repository', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'success',
          head_sha: TEST_SHA,
          pull_requests: [{ number: TEST_PR_NUMBER }],
        },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call update when repository is missing
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle empty pull_requests array', async () => {
      const payload = {
        action: 'completed',
        check_suite: {
          conclusion: 'success',
          head_sha: TEST_SHA,
          pull_requests: [],
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call update when no PRs
      expect(db.update).not.toHaveBeenCalled()
    })
  })

  describe('pull_request.closed', () => {
    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', TEST_SECRET)
      vi.clearAllMocks()
    })

    it('should update attempt to merged and update agent status', async () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
          merged: true,
          merged_at: '2025-11-12T18:00:00Z',
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
              },
            ]),
          }),
        }),
      } as never)

      // Mock update operation
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }]),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify update was called with merged status
      expect(db.update).toHaveBeenCalled()

      // Verify agent status was updated
      expect(updateAgentStatusOnPRClose).toHaveBeenCalledWith(
        TEST_ISSUE_ID,
        'cursor',
        true
      )

      // Rating updates moved to Linear webhook - should NOT be called here
      expect(updateRatingsForIssue).not.toHaveBeenCalled()
    })

    it('should update attempt to closed when not merged', async () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
          merged: false,
          merged_at: null,
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: TEST_ATTEMPT_ID,
                issueId: TEST_ISSUE_ID,
                agentName: 'cursor',
                repo: TEST_REPO,
                prNumber: TEST_PR_NUMBER,
              },
            ]),
          }),
        }),
      } as never)

      // Mock update operation
      const mockWhere = vi.fn().mockResolvedValue([{ id: TEST_ATTEMPT_ID }])
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Verify update was called with closed status
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'closed',
          closedAt: expect.any(Date),
        })
      )

      // Verify agent status was updated to rejected
      expect(updateAgentStatusOnPRClose).toHaveBeenCalledWith(
        TEST_ISSUE_ID,
        'cursor',
        false
      )

      // Verify rating update was NOT triggered for closed PRs
      expect(updateRatingsForIssue).not.toHaveBeenCalled()
    })

    it('should NOT call updateRatingsForIssue when PR merged (rating updates moved to Linear)', async () => {
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

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
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

      const req = createAuthenticatedRequest(payload)
      const response = await POST(req)

      expect(response.status).toBe(200)

      // Rating updates should NOT be called (handled by Linear webhook now)
      expect(updateRatingsForIssue).not.toHaveBeenCalled()

      // But agent status should still be updated
      expect(updateAgentStatusOnPRClose).toHaveBeenCalledWith(
        'issue-123',
        'cursor',
        true
      )
    })

    it('should ignore untracked PRs', async () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: 9999,
          head: { sha: 'unknown-sha' },
          merged: true,
          merged_at: '2025-11-12T18:00:00Z',
        },
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      // Mock attempt lookup (not found)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call update for untracked PRs
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle missing pull_request in payload', async () => {
      const payload = {
        action: 'closed',
        repository: { full_name: TEST_REPO },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call select or update
      expect(db.select).not.toHaveBeenCalled()
      expect(db.update).not.toHaveBeenCalled()
    })

    it('should handle missing repository in payload', async () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: TEST_PR_NUMBER,
          head: { sha: TEST_SHA },
          merged: true,
          merged_at: '2025-11-12T18:00:00Z',
        },
      }

      // Mock idempotency check
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as never)

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(200)

      // Should not call select or update
      expect(db.select).not.toHaveBeenCalled()
      expect(db.update).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    const secret = 'test-secret-key'

    beforeEach(() => {
      vi.stubEnv('GITHUB_WEBHOOK_SECRET', secret)
      vi.clearAllMocks()
    })

    function createAuthenticatedRequest(payload: object): NextRequest {
      const body = JSON.stringify(payload)
      const hmac = crypto.createHmac('sha256', secret)
      const signature = 'sha256=' + hmac.update(body).digest('hex')

      return new NextRequest('http://localhost:3000/api/github/webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        body,
      })
    }

    it('should handle database errors gracefully', async () => {
      const payload = {
        action: 'synchronize',
        pull_request: {
          number: 1559,
          head: { sha: 'new-sha-123' },
        },
        repository: { full_name: 'recallnet/js-recall' },
      }

      // Mock idempotency check to throw an error
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const response = await POST(createAuthenticatedRequest(payload))
      expect(response.status).toBe(500)

      const json = (await response.json()) as { error?: string }
      expect(json.error).toBe('Internal server error')
    })
  })
})
