/* eslint-disable sonarjs/no-duplicate-string */
/**
 * Tests for Linear reconciliation functionality
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { attempts, issues } from '@/db/schema'

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

// Mock update-winner to avoid complex winner calculation logic
vi.mock('./update-winner', () => ({
  updateWinner: vi.fn().mockResolvedValue(undefined),
}))

// Mock github-app-auth to avoid needing credentials
vi.mock('./github-app-auth', () => ({
  getInstallationToken: vi.fn().mockResolvedValue('test-installation-token'),
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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select chain for getting issue ID and attempts
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      }) as never

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select chain - called twice per issue (6 times total)
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([])

    vi.mocked(db).select = vi.fn().mockReturnValue({
      from: vi.fn((schema) => {
        // Check if schema is attempts or issues
        if (schema === attempts) {
          return { where: mockAttemptsWhere }
        }
        return { where: mockIssueWhere }
      }),
    }) as never

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select chain
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([])

    vi.mocked(db).select = vi.fn().mockReturnValue({
      from: vi.fn((schema) => {
        if (schema === attempts) {
          return { where: mockAttemptsWhere }
        }
        return { where: mockIssueWhere }
      }),
    }) as never

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

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

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select - needs to handle three different queries:
    // 1. Getting issue ID after insert (with .limit())
    // 2. Getting attempts for an issue (without .limit())
    // 3. Getting GitHub App installation (with .limit())
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

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
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    const mockInstallationLimit = vi
      .fn()
      .mockResolvedValue([{ installationId: 'test-installation-id' }])
    const mockInstallationWhere = vi.fn().mockReturnValue({
      limit: mockInstallationLimit,
    })
    const mockInstallationFrom = vi.fn().mockReturnValue({
      where: mockInstallationWhere,
    })

    // db.select is called three times - issue ID, attempts, installation
    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      })
      .mockReturnValueOnce({
        from: mockInstallationFrom,
      }) as never

    // Mock db.update chain for deletion marking only
    // PR status updates should NOT happen on 404
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
    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockRejectedValue({
      status: 404,
      message: 'Not Found',
      name: 'HttpError',
    })
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully despite 404
    expect(count).toBe(1)

    // Should NOT have updated the PR status (404 errors are now skipped)
    expect(mockSet).not.toHaveBeenCalledWith({
      status: 'closed',
      closedAt: expect.any(Date),
    })
    expect(mockSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'closed' })
    )
  })

  it('should handle non-404 GitHub API errors gracefully', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-error',
      identifier: 'ENG-500',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select - needs to handle two different queries:
    // 1. Getting issue ID after insert (with .limit())
    // 2. Getting attempts for an issue (without .limit())
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-1',
        repo: 'recallnet/air-coding-arena',
        prNumber: 10,
        status: 'open',
        mergedAt: null,
        closedAt: null,
      },
    ])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    // db.select is called twice - once for getting issue ID, once for getting attempts
    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      }) as never

    // Mock db.update chain
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

    // Mock GitHub API to return 500 error (non-404)
    process.env['GITHUB_TOKEN'] = 'test-token'

    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockRejectedValue({
      status: 500,
      message: 'Internal Server Error',
      name: 'HttpError',
    })
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully despite error
    expect(count).toBe(1)

    // Should NOT have updated the PR status (non-404 errors are logged but don't update DB)
    expect(mockSet).not.toHaveBeenCalledWith({
      status: 'closed',
      closedAt: expect.any(Date),
    })
  })

  it('should sync PR status successfully when PR is merged', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-merged-pr',
      identifier: 'ENG-MERGED',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select - needs to handle three different queries:
    // 1. Getting issue ID after insert (with .limit())
    // 2. Getting attempts for an issue (without .limit())
    // 3. Getting GitHub App installation (with .limit())
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-merged',
        repo: 'recallnet/air-coding-arena',
        prNumber: 11,
        status: 'open',
        mergedAt: null,
        closedAt: null,
      },
    ])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    const mockInstallationLimit = vi
      .fn()
      .mockResolvedValue([{ installationId: 'test-installation-id' }])
    const mockInstallationWhere = vi.fn().mockReturnValue({
      limit: mockInstallationLimit,
    })
    const mockInstallationFrom = vi.fn().mockReturnValue({
      where: mockInstallationWhere,
    })

    // db.select is called three times - issue ID, attempts, installation
    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      })
      .mockReturnValueOnce({
        from: mockInstallationFrom,
      }) as never

    // Mock db.update chain
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

    // Mock GitHub API to return merged PR
    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        state: 'closed',
        merged: true,
        merged_at: '2024-01-15T10:30:00Z',
        closed_at: '2024-01-15T10:30:00Z',
      },
    })
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully
    expect(count).toBe(1)

    // Should have updated the PR status to 'merged'
    expect(mockSet).toHaveBeenCalledWith({
      status: 'merged',
      mergedAt: new Date('2024-01-15T10:30:00Z'),
      closedAt: null,
    })
  })

  it('should sync PR status successfully when PR is closed without merge', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-closed-pr',
      identifier: 'ENG-CLOSED',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select - needs to handle three different queries:
    // 1. Getting issue ID after insert (with .limit())
    // 2. Getting attempts for an issue (without .limit())
    // 3. Getting GitHub App installation (with .limit())
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-closed',
        repo: 'recallnet/air-coding-arena',
        prNumber: 12,
        status: 'open',
        mergedAt: null,
        closedAt: null,
      },
    ])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    const mockInstallationLimit = vi
      .fn()
      .mockResolvedValue([{ installationId: 'test-installation-id' }])
    const mockInstallationWhere = vi.fn().mockReturnValue({
      limit: mockInstallationLimit,
    })
    const mockInstallationFrom = vi.fn().mockReturnValue({
      where: mockInstallationWhere,
    })

    // db.select is called three times - issue ID, attempts, installation
    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      })
      .mockReturnValueOnce({
        from: mockInstallationFrom,
      }) as never

    // Mock db.update chain
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

    // Mock GitHub API to return closed PR (not merged)
    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        state: 'closed',
        merged: false,
        merged_at: null,
        closed_at: '2024-01-15T11:00:00Z',
      },
    })
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully
    expect(count).toBe(1)

    // Should have updated the PR status to 'closed'
    expect(mockSet).toHaveBeenCalledWith({
      status: 'closed',
      mergedAt: null,
      closedAt: new Date('2024-01-15T11:00:00Z'),
    })
  })

  it('should update winner when issue has merged PRs but no winner set', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-merged-no-winner',
      identifier: 'ENG-WINNER',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select chain - multiple calls:
    // 1. Getting issue ID for sync
    // 2. Getting attempts for PR sync (empty)
    // 3. Getting issue agents (has agents - prevents removal from arena)
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    // Mock issueAgents query - return some agents (prevent arena removal)
    const mockAgentsWhere = vi
      .fn()
      .mockResolvedValue([{ agentName: 'engine', status: 'submitted' }])
    const mockAgentsFrom = vi.fn().mockReturnValue({
      where: mockAgentsWhere,
    })

    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      })
      .mockReturnValueOnce({
        from: mockAgentsFrom,
      }) as never

    // Mock db.query.issues.findFirst to return issue with merged attempts but no winner
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'db-issue-id',
          linearId: 'linear-with-merged-no-winner',
          winnerAttemptId: null, // No winner set yet
          attempts: [
            {
              id: 'attempt-merged-1',
              status: 'merged',
              mergedAt: new Date('2024-01-15T10:00:00Z'),
            },
          ],
        }),
      },
    } as never

    // Mock db.update chain
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

    // Mock updateWinner function
    const { updateWinner } = await import('./update-winner')
    vi.mocked(updateWinner).mockResolvedValue(undefined)

    const count = await reconcileLinearIssues()

    // Should complete successfully
    expect(count).toBe(1)

    // Should have called updateWinner for issue with merged PRs but no winner
    expect(updateWinner).toHaveBeenCalledWith('db-issue-id')
  })

  it('should skip attempts with invalid repo format during PR sync', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-invalid-repo',
      identifier: 'ENG-INVALID',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select chain
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    // Return an attempt with invalid repo format (missing owner or repo)
    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-invalid-repo',
        repo: 'invalid-repo-format', // Missing '/' separator
        prNumber: 14,
        status: 'open',
        mergedAt: null,
        closedAt: null,
      },
    ])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      }) as never

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

    // Mock db.update chain
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

    // Mock GitHub API (should not be called due to invalid repo format)
    process.env['GITHUB_TOKEN'] = 'test-token'

    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn()
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully
    expect(count).toBe(1)

    // GitHub API should NOT have been called (invalid repo format)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should update PR when mergedAt timestamp changes', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-merged-timestamp-change',
      identifier: 'ENG-TIMESTAMP',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select - needs to handle three different queries:
    // 1. Getting issue ID after insert (with .limit())
    // 2. Getting attempts for an issue (without .limit())
    // 3. Getting GitHub App installation (with .limit())
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    // Return an attempt that's already merged but with different timestamp
    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-merged-old-timestamp',
        repo: 'recallnet/air-coding-arena',
        prNumber: 15,
        status: 'merged',
        mergedAt: new Date('2024-01-15T09:00:00Z'), // Old timestamp
        closedAt: null,
      },
    ])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    const mockInstallationLimit = vi
      .fn()
      .mockResolvedValue([{ installationId: 'test-installation-id' }])
    const mockInstallationWhere = vi.fn().mockReturnValue({
      limit: mockInstallationLimit,
    })
    const mockInstallationFrom = vi.fn().mockReturnValue({
      where: mockInstallationWhere,
    })

    // db.select is called three times - issue ID, attempts, installation
    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      })
      .mockReturnValueOnce({
        from: mockInstallationFrom,
      }) as never

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

    // Mock db.update chain
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

    // Mock GitHub API to return merged PR with newer timestamp
    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        state: 'closed',
        merged: true,
        merged_at: '2024-01-15T10:00:00Z', // New timestamp
        closed_at: '2024-01-15T10:00:00Z',
      },
    })
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully
    expect(count).toBe(1)

    // Should have updated the PR with new timestamp
    expect(mockSet).toHaveBeenCalledWith({
      status: 'merged',
      mergedAt: new Date('2024-01-15T10:00:00Z'),
      closedAt: null,
    })
  })

  it('should sync PR status successfully when PR remains open', async () => {
    const mockIssue = createMockLinearIssue({
      id: 'linear-with-open-pr',
      identifier: 'ENG-OPEN',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [mockIssue] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select - needs to handle two different queries:
    // 1. Getting issue ID after insert (with .limit())
    // 2. Getting attempts for an issue (without .limit())
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    const mockAttemptsWhere = vi.fn().mockResolvedValue([
      {
        id: 'attempt-open',
        repo: 'recallnet/air-coding-arena',
        prNumber: 13,
        status: 'open',
        mergedAt: null,
        closedAt: null,
      },
    ])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    // db.select is called twice
    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      }) as never

    // Mock db.update chain - track calls separately for PR status vs deletion
    const mockSetForPRStatus = vi.fn()
    const mockSetForDeletion = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn((setArg: Record<string, unknown>) => {
        // Check if this is a PR status update or deletion marking
        if ('status' in setArg && setArg['status'] === 'deleted') {
          return mockSetForDeletion(setArg) as { where: () => unknown }
        }
        // Track PR status updates
        mockSetForPRStatus(setArg)
        return {
          where: vi.fn().mockResolvedValue(undefined),
        }
      }),
    } as never)

    // Mock db.query.issues.findFirst for winner check
    vi.mocked(db).query = {
      issues: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never

    // Mock GitHub API to return open PR
    process.env['GITHUB_TOKEN'] = 'test-token'

    const { Octokit } = await import('@octokit/rest')
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        state: 'open',
        merged: false,
        merged_at: null,
        closed_at: null,
      },
    })
    vi.mocked(Octokit).mockImplementation(function () {
      return {
        rest: {
          pulls: {
            get: mockGet,
          },
        },
      } as never
    })

    const count = await reconcileLinearIssues()

    // Should complete successfully
    expect(count).toBe(1)

    // Should NOT have updated the PR status (no change from 'open' to 'open')
    expect(mockSetForPRStatus).not.toHaveBeenCalled()
  })

  it('should not mark issue as arena-ready if no agents assigned', async () => {
    const issueWithNoAgents = createMockLinearIssue({
      id: 'linear-no-agents',
      identifier: 'ENG-999',
      title: 'Issue with no agents',
      url: 'https://linear.app/test/issue/eng-999',
    })

    const mockIssues = vi.fn().mockResolvedValue({ nodes: [issueWithNoAgents] })
    const mockClient = { issues: mockIssues }

    vi.mocked(LinearClient).mockImplementation(function () {
      return mockClient as never
    })

    // Mock db.insert chain
    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as never)

    // Mock db.select chain - called multiple times:
    // 1. Getting issue ID for sync (with .limit())
    // 2. Getting attempts for PR sync (returns empty - no PRs)
    // 3. Getting issue agents (returns empty array - no agents!)
    const mockIssueLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockIssueWhere = vi.fn().mockReturnValue({
      limit: mockIssueLimit,
    })
    const mockIssueFrom = vi.fn().mockReturnValue({
      where: mockIssueWhere,
    })

    // Mock attempts query - returns empty array (no PRs)
    const mockAttemptsWhere = vi.fn().mockResolvedValue([])
    const mockAttemptsFrom = vi.fn().mockReturnValue({
      where: mockAttemptsWhere,
    })

    // Mock issueAgents query - returns empty array (no agents assigned)
    const mockAgentsWhere = vi.fn().mockResolvedValue([])
    const mockAgentsFrom = vi.fn().mockReturnValue({
      where: mockAgentsWhere,
    })

    vi.mocked(db).select = vi
      .fn()
      .mockReturnValueOnce({
        from: mockIssueFrom,
      })
      .mockReturnValueOnce({
        from: mockAttemptsFrom,
      })
      .mockReturnValueOnce({
        from: mockAgentsFrom,
      }) as never

    // Mock db.update chain - should be called to set arenaReadyLabeledAt to null
    const mockUpdateReturning = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue({
      returning: mockUpdateReturning,
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

    const { syncIssueFromLinear } = await import('./linear-sync')

    await reconcileLinearIssues()

    // Issue should be initially created with arena timestamp
    expect(mockValues).toHaveBeenCalledWith({
      linearId: 'linear-no-agents',
      linearKey: 'ENG-999',
      title: 'Issue with no agents',
      url: 'https://linear.app/test/issue/eng-999',
      repo: MOCK_TEAM_KEY,
      status: MOCK_STATUS,
      arenaReadyLabeledAt: expect.any(Date), // Initially set
    })

    // Should still sync the issue (to detect agent mentions)
    expect(syncIssueFromLinear).toHaveBeenCalledWith('linear-no-agents')

    // Should then NULL out arenaReadyLabeledAt after sync when no agents found
    expect(mockSet).toHaveBeenCalledWith({ arenaReadyLabeledAt: null })
  })
})
