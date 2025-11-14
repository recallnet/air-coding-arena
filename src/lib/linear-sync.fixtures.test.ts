/**
 * Fixture-based tests for linear-sync.ts comment parsing.
 * Uses REAL Linear issues with actual comment structures to validate parsing logic.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AgentConfig } from './agent-config'
import { getAgentConfigs } from './agent-config'

// Set up mock data with real agent configs
const mockAgentConfigs: AgentConfig[] = [
  {
    name: 'cursor',
    handle: '@Cursor',
    displayName: 'Cursor',
    linearUserId: 'mock-user-id',
  },
  {
    name: 'engine',
    handle: '@Engine',
    displayName: 'Engine',
    linearUserId: 'mock-user-id',
  },
  {
    name: 'cyrus',
    handle: '@Cyrus',
    displayName: 'Cyrus',
    linearUserId: 'mock-user-id',
  },
  {
    name: 'claude',
    handle: '@Claude',
    displayName: 'Claude',
    linearUserId: 'mock-user-id',
  },
  {
    name: 'factory',
    handle: '@Factory',
    displayName: 'Factory',
    linearUserId: 'mock-user-id',
  },
  {
    name: 'githubcopilot',
    handle: '@GitHubCopilot',
    displayName: 'GitHubCopilot',
    linearUserId: 'mock-user-id',
  },
]

// Mock agent-config to avoid database calls
vi.mock('./agent-config', () => ({
  getAgentConfigs: vi.fn(),
}))

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
 * Uses exact production logic from linear-sync.ts lines 302-308
 * Matches both @displayName and @[displayName] formats using .includes()
 */
async function extractAgentMentions(body: string): Promise<string[]> {
  const agentConfigs = await getAgentConfigs()
  const mentions: string[] = []

  for (const agent of agentConfigs) {
    const displayName = agent.displayName.toLowerCase()
    const lowerBody = body.toLowerCase()

    // Match both @displayName and @[displayName] formats
    if (
      lowerBody.includes(`@${displayName}`) ||
      lowerBody.includes(`@[${displayName}]`)
    ) {
      // Use the actual agent name (not displayName) for results
      mentions.push(agent.name)
    }
  }

  return mentions
}

describe('Linear Sync - Fixture-Based Tests', () => {
  beforeEach(() => {
    // Configure mock to return agent configs
    vi.mocked(getAgentConfigs).mockResolvedValue(mockAgentConfigs)
  })

  describe('Comment Parsing - Agent Mentions', () => {
    it('should detect agent mentions in all real comments', async () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔍 Testing agent mention detection across ${fixtures.length} issues...`)

      let totalComments = 0
      let commentsWithMentions = 0
      const mentionPatterns: Record<string, number> = {}

      for (const issue of fixtures) {
        totalComments += issue.comments.length

        for (const comment of issue.comments) {
          const mentions = await extractAgentMentions(comment.body)

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
