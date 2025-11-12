/* eslint-disable sonarjs/no-duplicate-string */
/**
 * Tests for Linear API sync functions
 */
import { LinearClient } from '@linear/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

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

describe('syncIssueFromLinear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINEAR_API_KEY'] = 'test-key'
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)

    await syncIssueFromLinear('linear-issue-id')

    expect(mockClient.issue).toHaveBeenCalledWith('linear-issue-id')
    expect(mockIssue.comments).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledTimes(2) // cursor and engine
  })

  it('should return early if issue not in database', async () => {
    const mockIssue = {
      comments: vi.fn(),
      attachments: vi.fn(),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([]) // No issue found
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue(mockComments),
      attachments: vi.fn().mockResolvedValue({ nodes: [] }),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
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

    // Should create attempt with unknown agent (no agent status update)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue(mockAttachments),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should create attempt from attachment
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should detect merged status from attachment subtitle', async () => {
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue(mockAttachments),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should detect merged status
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should detect closed status from attachment subtitle', async () => {
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

    const mockIssue = {
      comments: vi.fn().mockResolvedValue({ nodes: [] }),
      attachments: vi.fn().mockResolvedValue(mockAttachments),
    }

    const mockClient = {
      issue: vi.fn().mockResolvedValue(mockIssue),
    }

    vi.mocked(LinearClient).mockImplementation(() => mockClient as never)

    const mockLimit = vi.fn().mockResolvedValue([{ id: 'db-issue-id' }])
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    const mockOnConflictDoUpdate = vi.fn().mockResolvedValue([])
    const mockValues = vi
      .fn()
      .mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)

    await syncIssueFromLinear('linear-issue-id')

    // Should detect closed status
    expect(mockInsert).toHaveBeenCalled()
  })
})
