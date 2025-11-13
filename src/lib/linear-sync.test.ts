/* eslint-disable sonarjs/no-duplicate-string */
/**
 * Tests for Linear API sync functions
 */
import { LinearClient } from '@linear/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { attempts, issues } from '@/db/schema'

import { syncIssueFromLinear } from './linear-sync'

// Mock modules
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn(),
}))

// Mock agent-dispatch to avoid complex query mocking
vi.mock('./agent-dispatch', () => ({
  dispatchMissingAgents: vi.fn().mockResolvedValue(0),
}))

/**
 * Create a mock Linear SDK Issue with all required properties
 * @param overrides - Optional property overrides for the mock issue
 * @returns Mock issue object compatible with Linear SDK Issue type
 */
function createMockIssue(overrides?: Record<string, unknown>) {
  return {
    id: 'linear-issue-id',
    identifier: 'ENG-123',
    title: 'Test Issue',
    description: 'Test description',
    url: 'https://linear.app/test/issue/ENG-123',
    estimate: 3,
    priority: 2,
    dueDate: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    labels: vi.fn().mockResolvedValue({ nodes: [] }),
    assignee: Promise.resolve(null),
    creator: Promise.resolve(null),
    project: Promise.resolve(null),
    cycle: Promise.resolve(null),
    parent: Promise.resolve(null),
    team: Promise.resolve(null),
    state: Promise.resolve(null),
    comments: vi.fn().mockResolvedValue({ nodes: [] }),
    attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    ...overrides,
  }
}

describe('syncIssueFromLinear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_API_KEY'] = 'test-key'
    process.env['AGENTS_CONFIG_JSON'] = JSON.stringify([
      { name: 'cursor', handle: '@Cursor' },
      { name: 'engine', handle: '@Engine' },
      { name: 'cyrus', handle: '@Cyrus' },
      { name: 'factory', handle: '@Factory' },
    ])
  })

  it('should sync comments and find agent mentions', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-1',
          body: '@cursor can you help?',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'comment-2',
          body: '@engine please review',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    expect(mockClient.issue).toHaveBeenCalledWith('linear-issue-id')
    expect(mockIssue.comments).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledTimes(2) // cursor and engine
  })

  it('should return early if issue not in database', async () => {
    const mockIssue = createMockIssue({
      comments: vi.fn(),
      attachments: vi.fn(),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([]) // No issue found
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    await syncIssueFromLinear('unknown-issue')

    expect(mockClient.issue).not.toHaveBeenCalled()
    expect(mockIssue.comments).not.toHaveBeenCalled()
  })

  it('should extract PR URLs from comment bodies', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-with-pr',
          body: 'I created a PR: https://github.com/org/repo/pull/123',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'comment-with-agent',
          body: '@cursor can you help?',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should create: 1 agent mention + 1 PR attempt
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })

  it('should detect agent from cursor.com URL in comment', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'cursor-pr',
          body: 'Check out https://cursor.com/agent and github.com/org/repo/pull/456',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should detect cursor agent from cursor.com URL
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should search older comments for agent when not in PR comment', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-0',
          body: 'Here is the PR: github.com/org/repo/pull/789',
          createdAt: new Date('2024-01-03T00:00:00Z'),
        },
        {
          id: 'comment-1',
          body: 'Working on it now',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
        {
          id: 'comment-2',
          body: '@engine please handle this',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should find @engine in older comment
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should search older comments by explicit mention when body analysis fails', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-0',
          body: 'PR is ready: github.com/org/repo/pull/800',
          createdAt: new Date('2024-01-05T00:00:00Z'),
        },
        {
          id: 'comment-1',
          body: 'Almost done',
          createdAt: new Date('2024-01-04T00:00:00Z'),
        },
        {
          id: 'comment-2',
          body: 'Still working',
          createdAt: new Date('2024-01-03T00:00:00Z'),
        },
        {
          id: 'comment-3',
          body: '@claude taking this one',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should find @claude in older comment after body analysis fails
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should search newer comments for agent as fallback', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-0',
          body: '@cyrus confirming assignment',
          createdAt: new Date('2024-01-03T00:00:00Z'),
        },
        {
          id: 'comment-1',
          body: 'PR submitted: github.com/org/repo/pull/101',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should find @cyrus in newer comment
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should search newer comments by explicit mention when body analysis fails', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-0',
          body: '@engine confirmed',
          createdAt: new Date('2024-01-04T00:00:00Z'),
        },
        {
          id: 'comment-1',
          body: 'Status update',
          createdAt: new Date('2024-01-03T00:00:00Z'),
        },
        {
          id: 'comment-2',
          body: 'Here is my PR: github.com/org/repo/pull/900',
          createdAt: new Date('2024-01-02T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should find @engine in newer comment after body analysis fails
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should handle multiple PR URLs in single comment', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-multi',
          body: '@cursor I created two PRs: github.com/org/repo/pull/111 and github.com/org/repo/pull/112',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should create 3 entries: 1 agent + 2 PRs
    expect(mockInsert).toHaveBeenCalledTimes(3)
  })

  it('should fallback to unknown agent when no context found', async () => {
    const mockComments = {
      nodes: [
        {
          id: 'comment-orphan',
          body: 'Found this PR: github.com/org/repo/pull/999',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateSet = vi.fn().mockResolvedValue([])
    const mockUpdateWhere = vi.fn().mockReturnValue(mockUpdateSet)
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: mockUpdateWhere }),
    })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should create attempt with unknown agent
    expect(mockInsert).toHaveBeenCalledTimes(1)

    // db.update is called once for issue metadata, but NOT for agent status
    // (agent status updates only happen for known agents)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(issues)
  })

  it('should attribute PR to agent mentioned in parent comment thread', async () => {
    // Scenario: @engine is mentioned in parent comment, PR link is in child reply
    const mockComments = {
      nodes: [
        {
          id: 'comment-1',
          body: '@engine can you fix this?',
          createdAt: '2024-01-01T00:00:00Z',
          parentId: null, // root comment
        },
        {
          id: 'comment-2',
          body: 'https://github.com/org/repo/pull/1562',
          createdAt: '2024-01-02T00:00:00Z',
          parentId: 'comment-1', // replies to @mention
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should create attempt with 'engine' agent (not 'unknown')
    // First insert is for issueAgents, second is for attempts
    expect(mockInsert).toHaveBeenCalledTimes(2)

    // Find the attempts.insert call
    const attemptsInsertCall = mockInsert.mock.calls.find(
      (call) => call[0] === attempts
    )
    expect(attemptsInsertCall).toBeDefined()

    // Check that the values function was called with engine agent
    const valuesCall = mockValues.mock.calls[mockValues.mock.calls.length - 1]
    expect(valuesCall?.[0]).toMatchObject({
      agentName: 'engine',
      prNumber: 1562,
    })

    // Should also update agent status to 'submitted' for engine
    expect(mockUpdate).toHaveBeenCalledTimes(2) // once for issue, once for agent
  })

  it('should handle attachments with PR links', async () => {
    const mockAttachments = {
      nodes: [
        {
          id: 'attachment-1',
          url: 'https://github.com/org/repo/pull/555',
          title: 'Fix bug',
          subtitle: 'Pull request by cursor',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue(mockAttachments),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Orphaned attachments are now skipped - no insert should happen
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('should skip orphaned attachment with merged status', async () => {
    const mockAttachments = {
      nodes: [
        {
          id: 'attachment-merged',
          url: 'https://github.com/org/repo/pull/666',
          title: 'Feature complete',
          subtitle: 'Pull request merged',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue(mockAttachments),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Orphaned attachments are now skipped - no insert should happen
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('should skip orphaned attachment with closed status', async () => {
    const mockAttachments = {
      nodes: [
        {
          id: 'attachment-closed',
          url: 'https://github.com/org/repo/pull/777',
          title: 'Not accepted',
          subtitle: 'Pull request closed',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    }

    const mockIssue = createMockIssue({
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue(mockAttachments),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Orphaned attachments are now skipped - no insert should happen
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('should extract full issue metadata with all fields populated', async () => {
    const mockIssue = createMockIssue({
      assignee: Promise.resolve({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
      }),
      creator: Promise.resolve({
        id: 'user-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
      }),
      project: Promise.resolve({
        id: 'project-1',
        name: 'Main Project',
      }),
      cycle: Promise.resolve({
        id: 'cycle-1',
        name: 'Sprint 1',
        number: 1,
      }),
      parent: Promise.resolve({
        id: 'parent-1',
        identifier: 'ENG-100',
      }),
      team: Promise.resolve({
        id: 'team-1',
        key: 'ENG',
        name: 'Engineering',
      }),
      state: Promise.resolve({
        id: 'state-1',
        name: 'In Progress',
        type: 'started',
      }),
      labels: vi.fn().mockResolvedValue({
        nodes: [
          {
            id: 'label-1',
            name: 'bug',
            color: '#ff0000',
            description: 'Bug label',
          },
        ],
      }),
    })

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi
      .fn()
      .mockResolvedValue([
        { id: 'db-issue-id', linearId: 'test-linear-id', status: 'open' },
      ])
    const mockOrderBy = vi.fn().mockResolvedValue([
      { name: 'cursor', displayName: 'Cursor', isEnabled: true },
      { name: 'engine', displayName: 'Engine', isEnabled: true },
      { name: 'cyrus', displayName: 'Cyrus', isEnabled: true },
      { name: 'factory', displayName: 'Factory', isEnabled: true },
    ])
    const mockWhere = vi
      .fn()
      .mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockUpdateWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await syncIssueFromLinear('linear-issue-id')

    // Verify metadata was extracted with all fields
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeId: 'user-1',
        assigneeName: 'John Doe',
        assigneeEmail: 'john@example.com',
        creatorId: 'user-2',
        creatorName: 'Jane Smith',
        creatorEmail: 'jane@example.com',
        projectId: 'project-1',
        projectName: 'Main Project',
        cycleId: 'cycle-1',
        cycleName: 'Sprint 1',
        cycleNumber: 1,
        parentId: 'parent-1',
      })
    )
  })
})
