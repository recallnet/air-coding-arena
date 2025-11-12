import { describe, expect, it } from 'vitest'

import { extractIssueMetadata, type LinearIssue } from './linear-metadata'

const LINEAR_APP_URL = 'https://linear.app/test/issue'
const MOCK_DATE_1 = '2024-12-01T00:00:00Z'

describe('extractIssueMetadata', () => {
  it('should extract all metadata from issue object', () => {
    const mockIssue: LinearIssue = {
      id: 'issue-123',
      identifier: 'ENG-123',
      title: 'Test issue',
      description: 'Issue description',
      descriptionData: '{"type":"doc","content":[]}',
      url: `${LINEAR_APP_URL}/ENG-123`,
      estimate: 5,
      priority: 2,
      labels: [
        { id: 'label-1', name: 'bug', color: '#ff0000' },
        { id: 'label-2', name: 'frontend', color: '#00ff00' },
      ],
      assignee: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
      },
      creator: {
        id: 'user-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
      project: {
        id: 'project-1',
        name: 'Q1 Goals',
      },
      cycle: {
        id: 'cycle-1',
        name: 'Sprint 42',
        number: 42,
      },
      dueDate: '2025-01-01T00:00:00Z',
      createdAt: MOCK_DATE_1,
      updatedAt: '2024-12-15T00:00:00Z',
      parent: {
        id: 'parent-1',
        identifier: 'ENG-100',
      },
      team: {
        id: 'team-1',
        key: 'ENG',
        name: 'Engineering',
      },
      state: {
        id: 'state-1',
        name: 'In Progress',
        type: 'started',
      },
    }

    const result = extractIssueMetadata(mockIssue)

    expect(result).toEqual({
      // Core fields
      linearId: 'issue-123',
      linearKey: 'ENG-123',
      title: 'Test issue',
      url: `${LINEAR_APP_URL}/ENG-123`,
      repo: 'ENG',
      status: 'In Progress',

      // Metadata fields
      description: 'Issue description',
      descriptionMarkdown: '{"type":"doc","content":[]}',
      estimate: 5,
      priority: 2,
      labelsJson: [
        { id: 'label-1', name: 'bug', color: '#ff0000', description: null },
        {
          id: 'label-2',
          name: 'frontend',
          color: '#00ff00',
          description: null,
        },
      ],
      assigneeId: 'user-1',
      assigneeName: 'John Doe',
      assigneeEmail: 'john@example.com',
      creatorId: 'user-2',
      creatorName: 'Jane Smith',
      creatorEmail: 'jane@example.com',
      projectId: 'project-1',
      projectName: 'Q1 Goals',
      cycleId: 'cycle-1',
      cycleName: 'Sprint 42',
      cycleNumber: 42,
      dueDate: new Date('2025-01-01T00:00:00Z'),
      linearCreatedAt: new Date(MOCK_DATE_1),
      linearUpdatedAt: new Date('2024-12-15T00:00:00Z'),
      parentId: 'parent-1',
    })
  })

  it('should handle missing optional fields', () => {
    const minimalIssue: LinearIssue = {
      id: 'issue-456',
      identifier: 'ENG-456',
      title: 'Minimal issue',
      url: `${LINEAR_APP_URL}/ENG-456`,
      createdAt: MOCK_DATE_1,
      updatedAt: MOCK_DATE_1,
    }

    const result = extractIssueMetadata(minimalIssue)

    expect(result.linearId).toBe('issue-456')
    expect(result.description).toBeUndefined()
    expect(result.estimate).toBeUndefined()
    expect(result.priority).toBeUndefined()
    expect(result.assigneeId).toBeUndefined()
  })

  it('should handle labels with missing colors', () => {
    const issueWithLabels: LinearIssue = {
      id: 'issue-789',
      identifier: 'ENG-789',
      title: 'Issue with labels',
      url: `${LINEAR_APP_URL}/ENG-789`,
      labels: [
        { id: 'label-1', name: 'bug' },
        { id: 'label-2', name: 'urgent', color: '#ff0000' },
      ],
      createdAt: MOCK_DATE_1,
      updatedAt: MOCK_DATE_1,
    }

    const result = extractIssueMetadata(issueWithLabels)

    expect(result.labelsJson).toEqual([
      { id: 'label-1', name: 'bug', color: null, description: null },
      {
        id: 'label-2',
        name: 'urgent',
        color: '#ff0000',
        description: null,
      },
    ])
  })

  it('should parse date strings to Date objects', () => {
    const issueWithDates: LinearIssue = {
      id: 'issue-101',
      identifier: 'ENG-101',
      title: 'Issue with dates',
      url: `${LINEAR_APP_URL}/ENG-101`,
      dueDate: '2025-06-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    }

    const result = extractIssueMetadata(issueWithDates)

    expect(result.dueDate).toBeInstanceOf(Date)
    expect(result.linearCreatedAt).toBeInstanceOf(Date)
    expect(result.linearUpdatedAt).toBeInstanceOf(Date)
    expect(result.dueDate?.toISOString()).toBe('2025-06-01T00:00:00.000Z')
  })
})
