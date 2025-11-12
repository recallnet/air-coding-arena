import { describe, expect, it, beforeEach, vi } from 'vitest'

import { db } from '@/db/client'

import {
  getIssuesByLabel,
  getIssuesByPriority,
  getIssuesByEstimate,
  getIssuesByAssignee,
  getIssuesInCycle,
  getIssuesInProject,
  getOverdueIssues,
} from './issue-queries'

// Mock database module
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
  },
}))

describe('issue-queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should query issues by label name', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const issues = await getIssuesByLabel('bug')
    expect(Array.isArray(issues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('should query issues by priority', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const urgentIssues = await getIssuesByPriority(1)
    expect(Array.isArray(urgentIssues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('should query issues by estimate range', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const mediumIssues = await getIssuesByEstimate(3, 5)
    expect(Array.isArray(mediumIssues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('should query issues by assignee', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const issues = await getIssuesByAssignee('user-123')
    expect(Array.isArray(issues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('should query issues in a cycle', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const issues = await getIssuesInCycle('cycle-42')
    expect(Array.isArray(issues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('should query issues in a project', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const issues = await getIssuesInProject('project-q1')
    expect(Array.isArray(issues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  it('should query overdue issues', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.mocked(db.select).mockImplementation(mockSelect as never)

    const issues = await getOverdueIssues()
    expect(Array.isArray(issues)).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })
})
