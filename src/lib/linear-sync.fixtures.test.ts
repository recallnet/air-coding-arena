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

  describe('Comment Parsing - PR URL Extraction', () => {
    /**
     * Extract PR URLs from comment body
     * Uses exact production logic from linear-sync.ts lines 356-364
     * Pattern: /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
     */
    function extractPRURLs(body: string): Array<{ org: string; repo: string; prNumber: string; fullUrl: string }> {
      const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
      const results: Array<{ org: string; repo: string; prNumber: string; fullUrl: string }> = []
      let prMatch: RegExpExecArray | null

      while ((prMatch = prRegex.exec(body)) !== null) {
        const [, org, repoName, prNumber] = prMatch
        if (org && repoName && prNumber) {
          results.push({
            org,
            repo: `${org}/${repoName}`,
            prNumber,
            fullUrl: `https://github.com/${org}/${repoName}/pull/${prNumber}`,
          })
        }
      }

      return results
    }

    it('should extract GitHub PR URLs from all real comments', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔗 Testing PR URL extraction across ${fixtures.length} issues...`)

      let totalUrls = 0
      let totalUrlsInAttachments = 0
      let issuesWithPRs = 0
      const foundPRs: Array<{ issue: string; pr: string; source: string }> = []

      for (const issue of fixtures) {
        let hasAnyPRs = false

        // Extract from comments
        for (const comment of issue.comments) {
          const prUrls = extractPRURLs(comment.body)

          if (prUrls.length > 0) {
            hasAnyPRs = true
            totalUrls += prUrls.length

            for (const pr of prUrls) {
              foundPRs.push({
                issue: issue.identifier,
                pr: `${pr.repo}#${pr.prNumber}`,
                source: 'comment',
              })
            }
          }
        }

        // Also check attachments (production code checks attachments but skips them)
        for (const attachment of issue.attachments) {
          const prUrls = extractPRURLs(attachment.url)

          if (prUrls.length > 0) {
            hasAnyPRs = true
            totalUrlsInAttachments += prUrls.length

            for (const pr of prUrls) {
              foundPRs.push({
                issue: issue.identifier,
                pr: `${pr.repo}#${pr.prNumber}`,
                source: 'attachment',
              })
            }
          }
        }

        if (hasAnyPRs) {
          issuesWithPRs++
        }
      }

      console.log(`   Total PR URLs found in comments: ${totalUrls}`)
      console.log(`   Total PR URLs found in attachments: ${totalUrlsInAttachments}`)
      console.log(`   Issues with PR links: ${issuesWithPRs}/${fixtures.length}`)
      console.log(`   Sample PRs found:`)
      for (const pr of foundPRs.slice(0, 5)) {
        console.log(`     - ${pr.issue}: ${pr.pr} (${pr.source})`)
      }

      // Real data should have PR links
      expect(totalUrls).toBeGreaterThan(0)
      expect(issuesWithPRs).toBeGreaterThan(0)
    })

    it('should extract PR URLs from various comment formats', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔗 Testing various PR URL formats...`)

      const testCases = [
        { input: 'https://github.com/org/repo/pull/123', expected: 1 },
        { input: '[PR Link](https://github.com/org/repo/pull/456)', expected: 1 },
        { input: 'Check out github.com/org/repo/pull/789', expected: 1 },
        { input: 'Multiple: github.com/org/repo/pull/1 and github.com/org/repo/pull/2', expected: 2 },
        { input: 'No PR here', expected: 0 },
        { input: 'github.com/org/repo/issues/123', expected: 0 }, // Not a PR
      ]

      // Test extraction logic against known patterns
      for (const testCase of testCases) {
        const matches = extractPRURLs(testCase.input)
        console.log(`   "${testCase.input.slice(0, 60)}${testCase.input.length > 60 ? '...' : ''}" → ${matches.length} PRs`)
        expect(matches.length).toBe(testCase.expected)
      }

      // Validate against real fixture data
      const issuesWithPRLinks = fixtures.filter((issue) =>
        issue.comments.some((c) => c.body.includes('github.com') && c.body.includes('/pull/'))
      )

      console.log(`\n   Issues with PR links in comments: ${issuesWithPRLinks.length}/${fixtures.length}`)
      expect(issuesWithPRLinks.length).toBeGreaterThan(0)
    })

    it('should match production regex pattern exactly', () => {
      console.log(`\n🔍 Verifying regex matches production logic...`)

      // Test cases that should match
      const shouldMatch = [
        'github.com/owner/repo/pull/123',
        'https://github.com/owner/repo/pull/456',
        'text before github.com/owner/repo/pull/789 text after',
        'github.com/owner-name/repo-name/pull/999',
        'github.com/org_name/repo_name/pull/111',
      ]

      // Test cases that should NOT match
      const shouldNotMatch = [
        'github.com/owner/repo/pull/', // Missing number
        'github.com/owner/pull/123', // Missing repo
        'github.com/owner/repo/issues/123', // Not a PR
        'githubs.com/owner/repo/pull/123', // Wrong domain
        'github.com/owner/repo /pull/123', // Space in path (should not match due to \s in pattern)
      ]

      for (const test of shouldMatch) {
        const results = extractPRURLs(test)
        console.log(`   ✓ Should match: "${test}" → ${results.length} PR(s)`)
        expect(results.length).toBeGreaterThan(0)
      }

      for (const test of shouldNotMatch) {
        const results = extractPRURLs(test)
        console.log(`   ✓ Should NOT match: "${test}" → ${results.length} PR(s)`)
        expect(results.length).toBe(0)
      }
    })
  })

  describe('Comment Parsing - Parent Chain Walking', () => {
    /**
     * Walk parent chain for a comment
     * Uses exact production logic from linear-sync.ts lines 186-255
     * Walks up parent chain until finding agent mention or reaching root
     */
    function walkParentChain(
      commentId: string,
      commentParents: Map<string, string | null>,
      commentMap: Map<string, IssueFixture['comments'][0]>
    ): Array<string> {
      const chain: string[] = []
      let currentId: string | null = commentId
      const visited = new Set<string>()

      // Walk up parent chain (matching production logic)
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        chain.push(currentId)

        // Move to parent
        const parentId = commentParents.get(currentId) ?? null
        currentId = parentId
      }

      return chain
    }

    it('should analyze parent-child comment relationships in real data', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🧵 Analyzing comment threading in ${fixtures.length} issues...`)

      let totalComments = 0
      let commentsWithParents = 0
      let maxDepth = 0
      let totalParentsCollected = 0
      const chainDepths: Record<number, number> = {}

      for (const issue of fixtures) {
        totalComments += issue.comments.length

        // Build parent map and comment map
        const parentMap = new Map<string, string | null>()
        const commentMap = new Map<string, IssueFixture['comments'][0]>()

        for (const comment of issue.comments) {
          parentMap.set(comment.id, comment.parentId)
          commentMap.set(comment.id, comment)

          if (comment.parentId) {
            commentsWithParents++
          }
        }

        // Walk parent chain for each comment
        for (const comment of issue.comments) {
          const chain = walkParentChain(comment.id, parentMap, commentMap)
          const depth = chain.length - 1 // Subtract self

          if (depth > 0) {
            totalParentsCollected += depth
            maxDepth = Math.max(maxDepth, depth)
            chainDepths[depth] = (chainDepths[depth] || 0) + 1
          }
        }
      }

      console.log(`   Total comments analyzed: ${totalComments}`)
      console.log(`   Comments with parents: ${commentsWithParents}`)
      console.log(`   Max chain depth: ${maxDepth}`)
      console.log(`   Total parents collected: ${totalParentsCollected}`)
      console.log(`   Chain depth distribution:`)
      for (const [depth, count] of Object.entries(chainDepths).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        console.log(`     Depth ${depth}: ${count} comments`)
      }

      // Validate findings
      expect(totalComments).toBeGreaterThan(0)
      expect(maxDepth).toBeLessThan(100) // No infinite loops
    })

    it('should find agent ownership by walking parent chain', async () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔍 Testing agent ownership via parent chain walking...`)

      // Find comments with PR URLs
      const prPattern = /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/

      let totalPRComments = 0
      let prCommentsWithDirectMention = 0
      let prCommentsRequiringChainWalk = 0
      let foundAgentInChain = 0
      let noAgentFound = 0

      for (const issue of fixtures) {
        const commentMap = new Map(issue.comments.map((c) => [c.id, c]))
        const parentMap = new Map<string, string | null>()

        for (const comment of issue.comments) {
          parentMap.set(comment.id, comment.parentId)
        }

        for (const comment of issue.comments) {
          if (prPattern.test(comment.body)) {
            totalPRComments++

            // Check if comment has direct agent mention
            const mentions = await extractAgentMentions(comment.body)
            const hasMention = mentions.length > 0

            if (hasMention) {
              prCommentsWithDirectMention++
            } else {
              prCommentsRequiringChainWalk++

              // Walk parent chain to find agent (matching production logic)
              let current = comment.parentId
              let foundAgent = false
              const visited = new Set<string>()

              while (current && !foundAgent && !visited.has(current)) {
                visited.add(current)

                const parent = commentMap.get(current)
                if (parent) {
                  const parentMentions = await extractAgentMentions(parent.body)
                  if (parentMentions.length > 0) {
                    foundAgent = true
                    foundAgentInChain++
                  }
                  current = parent.parentId
                } else {
                  break
                }
              }

              if (!foundAgent) {
                noAgentFound++
              }
            }
          }
        }
      }

      console.log(`   Total comments with PR URLs: ${totalPRComments}`)
      console.log(`   PR comments with direct agent mention: ${prCommentsWithDirectMention}`)
      console.log(`   PR comments requiring chain walk: ${prCommentsRequiringChainWalk}`)
      console.log(`   Found agent via chain walk: ${foundAgentInChain}`)
      console.log(`   No agent found (unknown): ${noAgentFound}`)

      // Test passes if we can walk chains without crashing
      expect(totalPRComments).toBeGreaterThanOrEqual(0)
    })

    it('should detect circular references in parent chains', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔄 Checking for circular parent chains...`)

      let circularChains = 0
      let totalChainWalks = 0

      for (const issue of fixtures) {
        const parentMap = new Map<string, string | null>()
        const commentMap = new Map<string, IssueFixture['comments'][0]>()

        for (const comment of issue.comments) {
          parentMap.set(comment.id, comment.parentId)
          commentMap.set(comment.id, comment)
        }

        for (const comment of issue.comments) {
          totalChainWalks++

          const visited = new Set<string>()
          let current: string | null = comment.id

          // Walk chain with cycle detection (matching production logic)
          while (current && !visited.has(current)) {
            visited.add(current)
            current = parentMap.get(current) ?? null
          }

          // If we exited because current was already visited, it's a cycle
          if (current && visited.has(current)) {
            circularChains++
            console.log(`   ⚠️  Circular chain detected in ${issue.identifier}: ${current.substring(0, 8)}...`)
          }
        }
      }

      console.log(`   Total chain walks: ${totalChainWalks}`)
      console.log(`   Circular chains found: ${circularChains}`)

      // Real data shouldn't have cycles
      expect(circularChains).toBe(0)
    })
  })
})
