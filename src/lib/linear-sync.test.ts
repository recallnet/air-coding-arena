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
})
