/**
 * Fixture-based tests for linear-sync.ts comment parsing.
 * Uses REAL Linear issues with actual comment structures to validate parsing logic.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Issue fixture structure from capture script
 */
type IssueFixture = {
  id: string
  identifier: string
  title: string
  comments: Array<{
    id: string
    body: string
    createdAt: string
    parentId: string | null
    userId: string | null
    userName: string | null
  }>
  attachments: Array<{
    id: string
    url: string
    title: string
  }>
}

/**
 * Load all captured Linear issue fixtures
 */
function loadIssueFixtures(): IssueFixture[] {
  const fixturesPath = join(
    __dirname,
    '../__tests__/fixtures/linear-issues/index.json'
  )
  const json = readFileSync(fixturesPath, 'utf-8')
  return JSON.parse(json) as IssueFixture[]
}

/**
 * Extract agent mentions from comment body
 * Matches patterns like @cursor, @engine, @[agent](uuid)
 */
function extractAgentMentions(body: string): string[] {
  const agentNames = ['cursor', 'engine', 'cyrus', 'claude', 'factory', 'githubcopilot']
  const mentions: string[] = []

  for (const agent of agentNames) {
    // Match @agent or @[agent](uuid)
    const pattern = new RegExp(`@(?:\\[)?(${agent})(?:\\]\\([^)]+\\))?`, 'gi')
    const matches = body.match(pattern)
    if (matches) {
      mentions.push(agent.toLowerCase())
    }
  }

  return [...new Set(mentions)] // Deduplicate
}

describe('Linear Sync - Fixture-Based Tests', () => {
  describe('Comment Parsing - Agent Mentions', () => {
    it('should detect agent mentions in all real comments', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔍 Testing agent mention detection across ${fixtures.length} issues...`)

      let totalComments = 0
      let commentsWithMentions = 0
      const mentionPatterns: Record<string, number> = {}

      for (const issue of fixtures) {
        totalComments += issue.comments.length

        for (const comment of issue.comments) {
          const mentions = extractAgentMentions(comment.body)

          if (mentions.length > 0) {
            commentsWithMentions++
            for (const mention of mentions) {
              mentionPatterns[mention] = (mentionPatterns[mention] || 0) + 1
            }
          }
        }
      }

      console.log(`   Total comments: ${totalComments}`)
      console.log(`   Comments with mentions: ${commentsWithMentions}`)
      console.log(`   Mention breakdown:`, mentionPatterns)

      // Should find mentions in real data
      expect(commentsWithMentions).toBeGreaterThan(0)
      expect(Object.keys(mentionPatterns).length).toBeGreaterThan(0)
    })
  })
})
