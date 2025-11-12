import { describe, expect, it } from 'vitest'

import { issues } from './schema'

describe('issues schema', () => {
  it('should have metadata columns', () => {
    const columns = Object.keys(issues)

    expect(columns).toContain('description')
    expect(columns).toContain('descriptionMarkdown')
    expect(columns).toContain('estimate')
    expect(columns).toContain('priority')
    expect(columns).toContain('labelsJson')
    expect(columns).toContain('assigneeId')
    expect(columns).toContain('assigneeName')
    expect(columns).toContain('assigneeEmail')
    expect(columns).toContain('creatorId')
    expect(columns).toContain('creatorName')
    expect(columns).toContain('creatorEmail')
    expect(columns).toContain('projectId')
    expect(columns).toContain('projectName')
    expect(columns).toContain('cycleId')
    expect(columns).toContain('cycleName')
    expect(columns).toContain('cycleNumber')
    expect(columns).toContain('dueDate')
    expect(columns).toContain('linearCreatedAt')
    expect(columns).toContain('linearUpdatedAt')
    expect(columns).toContain('parentId')
  })
})
