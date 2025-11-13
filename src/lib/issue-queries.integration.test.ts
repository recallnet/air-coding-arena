import { eq } from 'drizzle-orm'
import { describe, expect, it, afterAll } from 'vitest'

import { db } from '@/db/client'
import { issues } from '@/db/schema'

import { getIssuesByLabel } from './issue-queries'

describe.skipIf(
  !process.env['DATABASE_URL'] || process.env['IS_TEST_DB_URL'] === 'true'
)('issue-queries integration tests', () => {
  const testLinearId = 'test-label-query-integration-' + Date.now()

  afterAll(async () => {
    // Clean up test data
    await db.delete(issues).where(eq(issues.linearId, testLinearId))
  })

  it('should find issues with label regardless of other properties', async () => {
    // Insert a test issue with a full label object (including id, color, description)
    await db.insert(issues).values({
      linearId: testLinearId,
      linearKey: 'TEST-LABEL-1',
      title: 'Test Issue for Label Query',
      url: 'https://linear.app/test/issue/TEST-LABEL-1',
      labelsJson: [
        {
          id: 'label-1',
          name: 'bug',
          color: '#ff0000',
          description: null,
        },
      ],
    })

    // Query by label name only
    const results = await getIssuesByLabel('bug')

    // Verify the issue was found
    expect(results.length).toBeGreaterThanOrEqual(1)

    const testIssue = results.find((r) => r.linearId === testLinearId)
    expect(testIssue).toBeDefined()
    expect(testIssue?.linearKey).toBe('TEST-LABEL-1')
    expect(testIssue?.labelsJson).toEqual([
      {
        id: 'label-1',
        name: 'bug',
        color: '#ff0000',
        description: null,
      },
    ])
  })

  it('should find issues with multiple labels when one matches', async () => {
    const multiLabelId = 'test-label-query-multi-' + Date.now()

    try {
      // Insert issue with multiple labels
      await db.insert(issues).values({
        linearId: multiLabelId,
        linearKey: 'TEST-LABEL-2',
        title: 'Test Issue with Multiple Labels',
        url: 'https://linear.app/test/issue/TEST-LABEL-2',
        labelsJson: [
          {
            id: 'label-1',
            name: 'bug',
            color: '#ff0000',
            description: null,
          },
          {
            id: 'label-2',
            name: 'feature',
            color: '#00ff00',
            description: 'New feature request',
          },
        ],
      })

      // Query by one of the labels
      const results = await getIssuesByLabel('feature')

      // Verify the issue was found
      const testIssue = results.find((r) => r.linearId === multiLabelId)
      expect(testIssue).toBeDefined()
      expect(testIssue?.linearKey).toBe('TEST-LABEL-2')
    } finally {
      // Clean up
      await db.delete(issues).where(eq(issues.linearId, multiLabelId))
    }
  })

  it('should not find issues without the label', async () => {
    const noLabelId = 'test-label-query-none-' + Date.now()

    try {
      // Insert issue with different labels
      await db.insert(issues).values({
        linearId: noLabelId,
        linearKey: 'TEST-LABEL-3',
        title: 'Test Issue without Target Label',
        url: 'https://linear.app/test/issue/TEST-LABEL-3',
        labelsJson: [
          {
            id: 'label-3',
            name: 'documentation',
            color: '#0000ff',
            description: null,
          },
        ],
      })

      // Query by a label that doesn't exist on this issue
      const results = await getIssuesByLabel('nonexistent-label')

      // Verify the issue was not found
      const testIssue = results.find((r) => r.linearId === noLabelId)
      expect(testIssue).toBeUndefined()
    } finally {
      // Clean up
      await db.delete(issues).where(eq(issues.linearId, noLabelId))
    }
  })
})
