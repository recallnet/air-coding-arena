/**
 * Tests for agent status update logic
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'

import {
  updateAgentStatusOnPR,
  markIgnoredOnIssueClosed,
  updateAgentStatusOnPRClose,
} from './agent-status'

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

describe('updateAgentStatusOnPRClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should mark first merged agent as accepted and others as rejected', async () => {
    const issueId = 'issue-1'
    const winningAgent = 'cursor'

    // Mock check for existing accepted agents (none found)
    const mockSelectWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    // Mock update operations
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await updateAgentStatusOnPRClose(issueId, winningAgent, true)

    // Should call update twice: once for accepted, once for rejected
    expect(mockUpdate).toHaveBeenCalledTimes(2)

    // First call should mark winning agent as accepted
    expect(mockSet).toHaveBeenNthCalledWith(1, { status: 'accepted' })

    // Second call should mark other submitted agents as rejected
    expect(mockSet).toHaveBeenNthCalledWith(2, { status: 'rejected' })
  })

  it('should mark agent as rejected when PR closed without merge', async () => {
    const issueId = 'issue-1'
    const agentName = 'cursor'

    // Mock update operation
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await updateAgentStatusOnPRClose(issueId, agentName, false)

    // Should call update once to mark agent as rejected
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith({ status: 'rejected' })
  })

  it('should mark second merged agent as rejected when another already won', async () => {
    const issueId = 'issue-1'
    const lateAgent = 'engine'

    // Mock check for existing accepted agents (one found)
    const mockSelectWhere = vi.fn().mockResolvedValue([
      {
        id: 'agent-uuid',
        issueId: 'issue-1',
        agentName: 'cursor',
        status: 'accepted',
      },
    ])
    const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    // Mock update operation
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await updateAgentStatusOnPRClose(issueId, lateAgent, true)

    // Should call update once to mark late agent as rejected
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith({ status: 'rejected' })
  })

  it('should handle case with no submitted agents gracefully', async () => {
    const issueId = 'issue-1'
    const agentName = 'cursor'

    // Mock check for existing accepted agents (none found)
    const mockSelectWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    // Mock update operations
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    vi.mocked(db.update).mockImplementation(mockUpdate as never)

    await updateAgentStatusOnPRClose(issueId, agentName, true)

    // Should still call update operations
    expect(mockUpdate).toHaveBeenCalled()
  })
})
