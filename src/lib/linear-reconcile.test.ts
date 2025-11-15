/* eslint-disable sonarjs/no-duplicate-string */
/**
 * Tests for Linear reconciliation functionality
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { issues } from '@/db/schema'

import { reconcileLinearIssues } from './linear-reconcile'

// Mock modules
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn(),
}))

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(),
}))

vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

// Mock linear-sync to avoid complex sync logic during reconciliation
vi.mock('./linear-sync', () => ({
  syncIssueFromLinear: vi.fn().mockResolvedValue(undefined),
}))

const MOCK_LINEAR_ID = 'linear-issue-1'
const MOCK_IDENTIFIER = 'ENG-123'
const MOCK_TITLE = 'Test Issue'
const MOCK_URL = 'https://linear.app/test/issue/eng-123'
const MOCK_STATUS = 'In Progress'
const MOCK_TEAM_KEY = 'ENG'

/**
 * Creates a mock Linear issue with minimal required properties
 * @param overrides - Optional property overrides
 * @returns Mock issue compatible with Linear SDK
 */
function createMockLinearIssue(overrides?: Record<string, unknown>) {
  return {
    id: MOCK_LINEAR_ID,
    identifier: MOCK_IDENTIFIER,
    title: MOCK_TITLE,
    url: MOCK_URL,
    state: Promise.resolve({ name: MOCK_STATUS }),
    team: Promise.resolve({ key: MOCK_TEAM_KEY }),
    ...overrides,
  }
}

describe('reconcileLinearIssues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_API_KEY'] = 'test-api-key'
    process.env['ARENA_LABEL'] = 'arena:ready'
  })

  it('should throw error if LINEAR_API_KEY not configured', async () => {
    delete process.env['LINEAR_API_KEY']

    await expect(reconcileLinearIssues()).rejects.toThrow(
      'LINEAR_API_KEY not configured'
    )
  })

  it('should use ARENA_LABEL environment variable if set', async () => {
    process.env['ARENA_LABEL'] = 'custom:label'

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db operations
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    await reconcileLinearIssues()

    expect(mockIssues).toHaveBeenCalledWith({
      filter: {
        labels: {
          name: {
            eq: 'custom:label',
          },
        },
      },
    })
  })

  it('should fetch issues with arena:ready label from Linear API', async () => {
    const mockIssues = vi.fn().mockResolvedValue({ nodes: [] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db operations
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    await reconcileLinearIssues()

    expect(mockIssues).toHaveBeenCalledWith({
      filter: {
        labels: {
          name: {
            eq: 'arena:ready',
          },
        },
      },
    })
  })

  it('should upsert issues from Linear into database', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-1',
      identifier: 'ENG-456',
      title: 'New Issue',
      url: 'https://linear.app/test/issue/eng-456',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const { syncIssueFromLinear } = await import('./linear-sync')

    const count = await reconcileLinearIssues()

    expect(mockValues).toHaveBeenCalledWith({
      linearId: 'linear-1',
      linearKey: 'ENG-456',
      title: 'New Issue',
      url: 'https://linear.app/test/issue/eng-456',
      repo: MOCK_TEAM_KEY,
      status: MOCK_STATUS,
      arenaReadyLabeledAt: expect.any(Date),
    })

    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
      target: issues.linearId,
      set: {
        status: MOCK_STATUS,
        title: 'New Issue',
      },
    })

    expect(syncIssueFromLinear).toHaveBeenCalledWith('linear-1')
    expect(count).toBe(1)
  })

  it('should sync multiple issues in a single reconciliation', async () => {
    const mockIssues = [
      createMockLinearIssue({ id: 'linear-1', identifier: 'ENG-100' }),
      createMockLinearIssue({ id: 'linear-2', identifier: 'ENG-200' }),
      createMockLinearIssue({ id: 'linear-3', identifier: 'ENG-300' }),
    ]

    const mockIssuesResponse = vi.fn().mockResolvedValue({ nodes: mockIssues })
    const mockClient = { issues: mockIssuesResponse }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const { syncIssueFromLinear } = await import('./linear-sync')

    const count = await reconcileLinearIssues()

    expect(count).toBe(3)
    expect(mockValues).toHaveBeenCalledTimes(3)
    expect(syncIssueFromLinear).toHaveBeenCalledTimes(3)
    expect(syncIssueFromLinear).toHaveBeenCalledWith('linear-1')
    expect(syncIssueFromLinear).toHaveBeenCalledWith('linear-2')
    expect(syncIssueFromLinear).toHaveBeenCalledWith('linear-3')
  })

  it('should mark issues as deleted if not in Linear response', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-active',
      identifier: 'ENG-999',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi
      .fn()
      .mockResolvedValue([{ linearKey: 'ENG-100' }, { linearKey: 'ENG-200' }])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    await reconcileLinearIssues()

    // Verify deletion marking was called
    expect(db.update).toHaveBeenCalledWith(issues)
    expect(mockSet).toHaveBeenCalledWith({ status: 'deleted' })
    expect(mockWhere).toHaveBeenCalled()
    expect(mockReturning).toHaveBeenCalledWith({ linearKey: issues.linearKey })
  })

  it('should not mark any issues as deleted if Linear returns empty list', async () => {
    const mockIssues = vi.fn().mockResolvedValue({ nodes: [] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.update but it should not be called with deletion
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const count = await reconcileLinearIssues()

    expect(count).toBe(0)
    // db.update should not be called when no issues exist
    expect(db.update).not.toHaveBeenCalled()
  })

  it('should continue reconciling other issues if one sync fails', async () => {
    const mockIssues = [
      createMockLinearIssue({ id: 'linear-1', identifier: 'ENG-100' }),
      createMockLinearIssue({ id: 'linear-2', identifier: 'ENG-200' }),
      createMockLinearIssue({ id: 'linear-3', identifier: 'ENG-300' }),
    ]

    const mockIssuesResponse = vi.fn().mockResolvedValue({ nodes: mockIssues })
    const mockClient = { issues: mockIssuesResponse }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const { syncIssueFromLinear } = await import('./linear-sync')

    // Make second issue sync fail
    vi.mocked(syncIssueFromLinear)
      .mockResolvedValueOnce(undefined) // First succeeds
      .mockRejectedValueOnce(new Error('Sync failed')) // Second fails
      .mockResolvedValueOnce(undefined) // Third succeeds

    const count = await reconcileLinearIssues()

    // Should still count 2 successful syncs
    expect(count).toBe(2)
    expect(syncIssueFromLinear).toHaveBeenCalledTimes(3)
  })

  it('should handle issues with null state gracefully', async () => {
    const mockIssue = createMockLinearIssue({
      state: Promise.resolve(null),
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const count = await reconcileLinearIssues()

    expect(count).toBe(1)
    expect(mockValues).toHaveBeenCalledWith({
      linearId: MOCK_LINEAR_ID,
      linearKey: MOCK_IDENTIFIER,
      title: MOCK_TITLE,
      url: MOCK_URL,
      repo: MOCK_TEAM_KEY,
      status: undefined, // Null state results in undefined
      arenaReadyLabeledAt: expect.any(Date),
    })
  })

  it('should handle issues with null team gracefully', async () => {
    const mockIssue = createMockLinearIssue({
      team: Promise.resolve(null),
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const count = await reconcileLinearIssues()

    expect(count).toBe(1)
    expect(mockValues).toHaveBeenCalledWith({
      linearId: MOCK_LINEAR_ID,
      linearKey: MOCK_IDENTIFIER,
      title: MOCK_TITLE,
      url: MOCK_URL,
      repo: undefined, // Null team results in undefined
      status: MOCK_STATUS,
      arenaReadyLabeledAt: expect.any(Date),
    })
  })

  it('should handle Linear API errors gracefully', async () => {
    const mockIssues = vi
      .fn()
      .mockRejectedValue(new Error('Linear API unavailable'))
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    await expect(reconcileLinearIssues()).rejects.toThrow(
      'Linear API unavailable'
    )
  })

  it('should return count of successfully reconciled issues', async () => {
    const mockIssues = [
      createMockLinearIssue({ id: 'linear-1' }),
      createMockLinearIssue({ id: 'linear-2' }),
    ]

    const mockIssuesResponse = vi.fn().mockResolvedValue({ nodes: mockIssues })
    const mockClient = { issues: mockIssuesResponse }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const count = await reconcileLinearIssues()

    expect(count).toBe(2)
  })

  it('should handle database insert errors for individual issues', async () => {
    const mockIssues = [
      createMockLinearIssue({ id: 'linear-1', identifier: 'ENG-100' }),
      createMockLinearIssue({ id: 'linear-2', identifier: 'ENG-200' }),
    ]

    const mockIssuesResponse = vi.fn().mockResolvedValue({ nodes: mockIssues })
    const mockClient = { issues: mockIssuesResponse }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain to fail on first issue
    const mockOnConflictDoUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error('Database error'))
      .mockResolvedValueOnce(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    const count = await reconcileLinearIssues()

    // Should continue and count only successful inserts
    expect(count).toBe(1)
  })

  it('should use default arena:ready label if ARENA_LABEL not set', async () => {
    delete process.env['ARENA_LABEL']

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.update chain for deletion marking
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnThis()
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    } as never)

    await reconcileLinearIssues()

    expect(mockIssues).toHaveBeenCalledWith({
      filter: {
        labels: {
          name: {
            eq: 'arena:ready',
          },
        },
      },
    })
  })

  it('should handle 404 errors for deleted PRs gracefully', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-deleted-pr',
      identifier: 'ENG-404',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select for getting issue ID after insert
    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({
      limit: mockLimit,
    })
    const mockFrom = vi.fn().mockReturnValue({
      where: mockWhere,
    })
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    })
    vi.mocked(db).select = mockSelect as never

    // Mock db.select for getting attempts (empty for this test)
    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-1',
        repo: 'recallnet/air-coding-arena',
        prNumber: 9,
        status: 'open',
        mergedAt: null,
        closedAt: null,
      },
    ])
    vi.mocked(db).select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockAttemptsWhere,
      }),
    }) as never

    // Mock db.update chain for both PR status update and deletion marking
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue({
      returning: mockReturning,
    })
    const mockSet = vi.fn().mockReturnValue({
      where: mockUpdateWhere,
    })
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
    } as never)

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

    // Mock GitHub API to return 404 error
    process.env['GITHUB_TOKEN'] = 'test-token'

    // Need to mock Octokit globally
    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockRejectedValue({
      status: 404,
      message: 'Not Found',
      name: 'HttpError',
    })
    vi.mocked(Octokit).mockImplementation(
      () =>
        ({
          rest: {
            pulls: {
              get: mockGet,
            },
          },
        }) as never
    )

    const count = await reconcileLinearIssues()

    // Should complete successfully despite 404
    expect(count).toBe(1)

    // Should have attempted to update the PR status to 'closed'
    expect(mockSet).toHaveBeenCalledWith({
      status: 'closed',
      closedAt: expect.any(Date),
    })
  })
})
