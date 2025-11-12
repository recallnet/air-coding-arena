/**
 * Tests for agent status update logic
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import { updateAgentStatusOnPR, markIgnoredOnIssueClosed } from './agent-status'

vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}))

describe('updateAgentStatusOnPR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update agent to submitted when PR created', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    const mockSelectWhere = vi
      .fn()
      .mockResolvedValue([
        { issueId: 'issue-1', agentName: 'cursor', status: 'pending' },
      ])
    const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await updateAgentStatusOnPR('issue-1', 'cursor')

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({ status: 'submitted' })
  })

  it('should create new agent record if not found', async () => {
    const mockValues = vi.fn().mockResolvedValue([])
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    const mockSelectWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)
    vi.mocked(db.insert).mockImplementation(mockInsert as never)

    await updateAgentStatusOnPR('issue-1', 'cursor')

    expect(mockInsert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: 'issue-1',
        agentName: 'cursor',
        status: 'submitted',
      })
    )
  })
})

describe('markIgnoredOnIssueClosed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should mark pending agents as ignored', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await markIgnoredOnIssueClosed('issue-1')

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({ status: 'ignored' })
  })
})
