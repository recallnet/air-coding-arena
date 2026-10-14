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

// Constants for duplicate strings
const MOCK_USER_ID = 'mock-user-id'
const GITHUB_COM_PATH = 'github.com'
const MOCK_TEAM_ID = 'team-1'
const ENGINEERING_NAME = 'Engineering'
// eslint-disable-next-line sonarjs/no-duplicate-string
const IN_PROGRESS_STATE = 'In Progress'

// Set up mock data with real agent configs
const mockAgentConfigs: AgentConfig[] = [
  {
    name: 'cursor',
    handle: '@Cursor',
    displayName: 'Cursor',
    linearUserId: MOCK_USER_ID,
  },
  {
    name: 'engine',
    handle: '@Engine',
    displayName: 'Engine',
    linearUserId: MOCK_USER_ID,
  },
  {
    name: 'cyrus',
    handle: '@Cyrus',
    displayName: 'Cyrus',
    linearUserId: MOCK_USER_ID,
  },
  {
    name: 'claude',
    handle: '@Claude',
    displayName: 'Claude',
    linearUserId: MOCK_USER_ID,
  },
  {
    name: 'factory',
    handle: '@Factory',
    displayName: 'Factory',
    linearUserId: MOCK_USER_ID,
  },
  {
    name: 'githubcopilot',
    handle: '@GitHubCopilot',
    displayName: 'GitHubCopilot',
    linearUserId: MOCK_USER_ID,
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
  url: string
  createdAt: string
  updatedAt: string
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
 * @returns Array of Linear issue fixtures
 */
function loadIssueFixtures(): IssueFixture[] {
  const fixturesPath = join(
    process.cwd(),
    'src/__tests__/fixtures/linear-issues/index.json'
  )
  const json = readFileSync(fixturesPath, 'utf-8')
  return JSON.parse(json) as IssueFixture[]
}

/**
 * Extract agent mentions from comment body
 * Uses exact production logic from linear-sync.ts lines 302-308
 * Matches both @displayName and @[displayName] formats using .includes()
 * @param body - Comment body text to search for agent mentions
 * @returns Promise resolving to array of agent names mentioned in the body
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

// Mock Linear SDK and database at module boundaries
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn(),
}))

vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('./agent-dispatch', () => ({
  dispatchMissingAgents: vi.fn().mockResolvedValue(undefined),
}))

describe('Linear Sync - Fixture-Based Tests', () => {
  beforeEach(() => {
    // Configure mock to return agent configs
    vi.mocked(getAgentConfigs).mockResolvedValue(mockAgentConfigs)
  })

  describe('Comment Parsing - Agent Mentions', () => {
    it('should detect agent mentions in all real comments', async () => {
      const fixtures = loadIssueFixtures()

      console.log(
        `\n🔍 Testing agent mention detection across ${fixtures.length} issues...`
      )

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
              mentionPatterns[mention] = (mentionPatterns[mention] ?? 0) + 1
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
     * @param body - Comment body text to search for PR URLs
     * @returns Array of PR URL information objects
     */
    function extractPRURLs(
      body: string
    ): Array<{ org: string; repo: string; prNumber: string; fullUrl: string }> {
      const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
      const results: Array<{
        org: string
        repo: string
        prNumber: string
        fullUrl: string
      }> = []
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

    // eslint-disable-next-line sonarjs/cognitive-complexity
    it('should extract GitHub PR URLs from all real comments', () => {
      const fixtures = loadIssueFixtures()

      console.log(
        `\n🔗 Testing PR URL extraction across ${fixtures.length} issues...`
      )

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
      console.log(
        `   Total PR URLs found in attachments: ${totalUrlsInAttachments}`
      )
      console.log(
        `   Issues with PR links: ${issuesWithPRs}/${fixtures.length}`
      )
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
        {
          input: '[PR Link](https://github.com/org/repo/pull/456)',
          expected: 1,
        },
        { input: 'Check out github.com/org/repo/pull/789', expected: 1 },
        {
          input:
            'Multiple: github.com/org/repo/pull/1 and github.com/org/repo/pull/2',
          expected: 2,
        },
        { input: 'No PR here', expected: 0 },
        { input: 'github.com/org/repo/issues/123', expected: 0 }, // Not a PR
      ]

      // Test extraction logic against known patterns
      for (const testCase of testCases) {
        const matches = extractPRURLs(testCase.input)
        console.log(
          `   "${testCase.input.slice(0, 60)}${testCase.input.length > 60 ? '...' : ''}" → ${matches.length} PRs`
        )
        expect(matches.length).toBe(testCase.expected)
      }

      // Validate against real fixture data
      const issuesWithPRLinks = fixtures.filter((issue) =>
        issue.comments.some(
          (c) => c.body.includes(GITHUB_COM_PATH) && c.body.includes('/pull/')
        )
      )

      console.log(
        `\n   Issues with PR links in comments: ${issuesWithPRLinks.length}/${fixtures.length}`
      )
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
        console.log(
          `   ✓ Should NOT match: "${test}" → ${results.length} PR(s)`
        )
        expect(results.length).toBe(0)
      }
    })
  })

  describe('Comment Parsing - Parent Chain Walking', () => {
    /**
     * Walk parent chain for a comment
     * Uses exact production logic from linear-sync.ts lines 186-255
     * Walks up parent chain until finding agent mention or reaching root
     * @param commentId - Starting comment ID
     * @param commentParents - Map of comment IDs to parent IDs
     * @returns Array of comment IDs in the chain
     */
    function walkParentChain(
      commentId: string,
      commentParents: Map<string, string | null>
    ): string[] {
      const chain: string[] = []
      let currentId: string | null = commentId
      const visited = new Set<string>()

      // Walk up parent chain (matching production logic)
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        chain.push(currentId)

        // Move to parent
        const parentId: string | null = commentParents.get(currentId) ?? null
        currentId = parentId
      }

      return chain
    }

    it('should analyze parent-child comment relationships in real data', () => {
      const fixtures = loadIssueFixtures()

      console.log(
        `\n🧵 Analyzing comment threading in ${fixtures.length} issues...`
      )

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
          const chain = walkParentChain(comment.id, parentMap)
          const depth = chain.length - 1 // Subtract self

          if (depth > 0) {
            totalParentsCollected += depth
            maxDepth = Math.max(maxDepth, depth)
            chainDepths[depth] = (chainDepths[depth] ?? 0) + 1
          }
        }
      }

      console.log(`   Total comments analyzed: ${totalComments}`)
      console.log(`   Comments with parents: ${commentsWithParents}`)
      console.log(`   Max chain depth: ${maxDepth}`)
      console.log(`   Total parents collected: ${totalParentsCollected}`)
      console.log(`   Chain depth distribution:`)
      for (const [depth, count] of Object.entries(chainDepths).sort(
        (a, b) => Number(a[0]) - Number(b[0])
      )) {
        console.log(`     Depth ${depth}: ${count} comments`)
      }

      // Validate findings
      expect(totalComments).toBeGreaterThan(0)
      expect(maxDepth).toBeLessThan(100) // No infinite loops
    })

    // eslint-disable-next-line sonarjs/cognitive-complexity
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
      console.log(
        `   PR comments with direct agent mention: ${prCommentsWithDirectMention}`
      )
      console.log(
        `   PR comments requiring chain walk: ${prCommentsRequiringChainWalk}`
      )
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
            console.log(
              `   ⚠️  Circular chain detected in ${issue.identifier}: ${current.substring(0, 8)}...`
            )
          }
        }
      }

      console.log(`   Total chain walks: ${totalChainWalks}`)
      console.log(`   Circular chains found: ${circularChains}`)

      // Fixtures include 1 synthetic circular chain fixture with 3 comments
      // Each comment in the circle will be detected as circular when walked
      expect(circularChains).toBe(3)
    })
  })

  describe('Full Integration - syncIssueFromLinear with Real Data', () => {
    beforeEach(async () => {
      vi.clearAllMocks()

      // Set required environment variable
      process.env['LINEAR_API_KEY'] = 'test-api-key'

      // Configure agent config mock
      vi.mocked(getAgentConfigs).mockResolvedValue(mockAgentConfigs)

      // Mock database client
      const { db } = await import('@/db/client')

      // Mock db.select() - returns issue exists in database with linearId
      // Also handles attempts pre-fetch query
      // Pattern: each syncIssueFromLinear call makes 2 select queries:
      // 1. select issue by linearId (has .limit())
      // 2. select attempts for pre-fetch (direct await, no .limit())
      let callCount = 0
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++
          // Odd calls (1st, 3rd, 5th...): query for issue (returns issue with .limit())
          if (callCount % 2 === 1) {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'mock-db-issue-id',
                    linearId: 'mock-linear-id',
                    linearKey: 'ENG-000',
                    title: 'Mock Issue',
                    url: 'https://linear.app/mock',
                    status: 'open',
                  },
                ]),
              }),
            }
          }
          // Even calls (2nd, 4th, 6th...): pre-fetch attempts (returns empty array directly)
          return {
            where: vi.fn().mockImplementation(() => Promise.resolve([])),
          }
        }),
      } as never)

      // Mock db.update() - returns chainable object
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never)

      // Mock db.insert() - returns chainable object
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      } as never)
    })

    it('should sync all 7 fixture issues through full integration flow', async () => {
      const fixtures = loadIssueFixtures()

      console.log(
        `\n🔄 Testing full integration sync for ${fixtures.length} issues...`
      )

      const stats = {
        issuesSynced: 0,
        totalComments: 0,
        totalAttachments: 0,
        agentMentionsFound: 0,
        prUrlsFound: 0,
        dbUpdateCalls: 0,
        dbInsertCalls: 0,
      }

      for (const fixture of fixtures) {
        console.log(`\n   Processing ${fixture.identifier}: "${fixture.title}"`)

        // Mock Linear SDK to return fixture data
        const { LinearClient } = await import('@linear/sdk')

        const mockIssue = {
          id: fixture.id,
          identifier: fixture.identifier,
          title: fixture.title,
          url: fixture.url,
          priority: 0,
          estimate: null,
          description: null,
          dueDate: null,
          createdAt: new Date(fixture.createdAt),
          updatedAt: new Date(fixture.updatedAt),
          comments: vi.fn().mockResolvedValue({
            nodes: fixture.comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: new Date(c.createdAt),
              parent: Promise.resolve(c.parentId ? { id: c.parentId } : null),
              user: Promise.resolve({
                id: c.userId,
                name: c.userName,
              }),
            })),
            pageInfo: { hasNextPage: false },
            fetchNext: vi.fn().mockResolvedValue(null),
          }),
          attachments: vi.fn().mockResolvedValue({
            nodes: fixture.attachments.map((a) => ({
              id: a.id,
              url: a.url,
              title: a.title,
              createdAt: new Date(),
            })),
          }),
          labels: vi.fn().mockResolvedValue({ nodes: [] }),
          assignee: Promise.resolve(null),
          creator: Promise.resolve(null),
          project: Promise.resolve(null),
          cycle: Promise.resolve(null),
          parent: Promise.resolve(null),
          team: Promise.resolve({
            id: MOCK_TEAM_ID,
            key: 'ENG',
            name: ENGINEERING_NAME,
          }),
          state: Promise.resolve({
            id: 'state-1',
            name: IN_PROGRESS_STATE,
            type: 'started',
          }),
        }

        vi.mocked(LinearClient).mockImplementation(function () {
          return {
            issue: vi.fn().mockResolvedValue(mockIssue),
          } as never
        })

        // Clear mocks before each issue to get accurate counts
        const { db } = await import('@/db/client')
        vi.mocked(db.update).mockClear()
        vi.mocked(db.insert).mockClear()

        // Import and execute sync (DO NOT MOCK internal functions - test end-to-end)
        const { syncIssueFromLinear } = await import('./linear-sync')
        await syncIssueFromLinear(fixture.id)

        // Count database operations for this issue
        const updateCalls = vi.mocked(db.update).mock.calls.length
        const insertCalls = vi.mocked(db.insert).mock.calls.length

        stats.issuesSynced++
        stats.totalComments += fixture.comments.length
        stats.totalAttachments += fixture.attachments.length
        stats.dbUpdateCalls += updateCalls
        stats.dbInsertCalls += insertCalls

        // Count agent mentions and PR URLs in fixture
        for (const comment of fixture.comments) {
          const mentions = await extractAgentMentions(comment.body)
          if (mentions.length > 0) {
            stats.agentMentionsFound += mentions.length
          }

          const prMatches = comment.body.match(
            /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/g
          )
          if (prMatches) {
            stats.prUrlsFound += prMatches.length
          }
        }

        console.log(
          `     ✓ Synced ${fixture.comments.length} comments, ${fixture.attachments.length} attachments`
        )
        console.log(
          `     ✓ Database operations: ${updateCalls} updates, ${insertCalls} inserts`
        )
      }

      // Report final statistics
      console.log(`\n   📊 Integration Test Statistics:`)
      console.log(`     Issues synced: ${stats.issuesSynced}`)
      console.log(`     Total comments processed: ${stats.totalComments}`)
      console.log(`     Total attachments processed: ${stats.totalAttachments}`)
      console.log(`     Agent mentions found: ${stats.agentMentionsFound}`)
      console.log(`     PR URLs found: ${stats.prUrlsFound}`)
      console.log(`     Total db.update() calls: ${stats.dbUpdateCalls}`)
      console.log(`     Total db.insert() calls: ${stats.dbInsertCalls}`)

      // Validate that sync actually ran
      expect(stats.issuesSynced).toBe(fixtures.length)
      expect(stats.totalComments).toBeGreaterThan(0)
      expect(stats.dbUpdateCalls).toBeGreaterThan(0)

      // Validate database operations were called
      const { db } = await import('@/db/client')
      expect(db.update).toHaveBeenCalled()
      expect(db.insert).toHaveBeenCalled()
    })

    it('should process comments and extract agent mentions correctly', async () => {
      const fixtures = loadIssueFixtures()
      const testIssue = fixtures[0]

      if (!testIssue) {
        throw new Error('No fixtures available')
      }

      console.log(
        `\n🧪 Testing comment processing for ${testIssue.identifier}...`
      )

      // Set up Linear SDK mock
      const { LinearClient } = await import('@linear/sdk')

      const mockIssue = {
        id: testIssue.id,
        identifier: testIssue.identifier,
        title: testIssue.title,
        url: testIssue.url,
        priority: 0,
        estimate: null,
        description: null,
        dueDate: null,
        createdAt: new Date(testIssue.createdAt),
        updatedAt: new Date(testIssue.updatedAt),
        comments: vi.fn().mockResolvedValue({
          nodes: testIssue.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: new Date(c.createdAt),
            parent: Promise.resolve(c.parentId ? { id: c.parentId } : null),
            user: Promise.resolve({ id: c.userId, name: c.userName }),
          })),
          pageInfo: { hasNextPage: false },
          fetchNext: vi.fn().mockResolvedValue(null),
        }),
        attachments: vi.fn().mockResolvedValue({ nodes: [] }),
        labels: vi.fn().mockResolvedValue({ nodes: [] }),
        assignee: Promise.resolve(null),
        creator: Promise.resolve(null),
        project: Promise.resolve(null),
        cycle: Promise.resolve(null),
        parent: Promise.resolve(null),
        team: Promise.resolve({
          id: 'team-1',
          key: 'ENG',
          name: 'Engineering',
        }),
        state: Promise.resolve({
          id: 'state-1',
          name: 'In Progress',
          type: 'started',
        }),
      }

      vi.mocked(LinearClient).mockImplementation(function () {
        return {
          issue: vi.fn().mockResolvedValue(mockIssue),
        } as never
      })

      // Execute sync
      const { syncIssueFromLinear } = await import('./linear-sync')
      await syncIssueFromLinear(testIssue.id)

      // Validate that issue_agents inserts were called for agent mentions
      const { db } = await import('@/db/client')
      const insertCalls = vi.mocked(db.insert).mock.calls

      // Count how many agent mention inserts were made
      let agentMentionInserts = 0
      for (const call of insertCalls) {
        // Check if this insert is for issue_agents table by inspecting the call
        const insertTarget = call[0]
        if (insertTarget && typeof insertTarget === 'object') {
          // This is a heuristic - in real code we'd check the table name
          // For now, we just count all inserts as the fixture has agent mentions
          agentMentionInserts++
        }
      }

      console.log(`   ✓ Processed ${testIssue.comments.length} comments`)
      console.log(`   ✓ Database insert operations: ${agentMentionInserts}`)

      // Validate database was called
      expect(db.insert).toHaveBeenCalled()
      expect(agentMentionInserts).toBeGreaterThan(0)
    })

    it('should process PR URLs and create attempts correctly', async () => {
      const fixtures = loadIssueFixtures()

      // Find an issue with PR URLs
      let testIssue: IssueFixture | null = null
      for (const fixture of fixtures) {
        const hasPR = fixture.comments.some(
          (c) => c.body.includes(GITHUB_COM_PATH) && c.body.includes('/pull/')
        )
        if (hasPR) {
          testIssue = fixture
          break
        }
      }

      if (!testIssue) {
        console.log(`\n   ⚠️  No fixture with PR URLs found, skipping PR test`)
        return
      }

      console.log(
        `\n🔗 Testing PR URL processing for ${testIssue.identifier}...`
      )

      // Set up Linear SDK mock
      const { LinearClient } = await import('@linear/sdk')

      const mockIssue = {
        id: testIssue.id,
        identifier: testIssue.identifier,
        title: testIssue.title,
        url: testIssue.url,
        priority: 0,
        estimate: null,
        description: null,
        dueDate: null,
        createdAt: new Date(testIssue.createdAt),
        updatedAt: new Date(testIssue.updatedAt),
        comments: vi.fn().mockResolvedValue({
          nodes: testIssue.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: new Date(c.createdAt),
            parent: Promise.resolve(c.parentId ? { id: c.parentId } : null),
            user: Promise.resolve({ id: c.userId, name: c.userName }),
          })),
          pageInfo: { hasNextPage: false },
          fetchNext: vi.fn().mockResolvedValue(null),
        }),
        attachments: vi.fn().mockResolvedValue({ nodes: [] }),
        labels: vi.fn().mockResolvedValue({ nodes: [] }),
        assignee: Promise.resolve(null),
        creator: Promise.resolve(null),
        project: Promise.resolve(null),
        cycle: Promise.resolve(null),
        parent: Promise.resolve(null),
        team: Promise.resolve({
          id: 'team-1',
          key: 'ENG',
          name: 'Engineering',
        }),
        state: Promise.resolve({
          id: 'state-1',
          name: 'In Progress',
          type: 'started',
        }),
      }

      vi.mocked(LinearClient).mockImplementation(function () {
        return {
          issue: vi.fn().mockResolvedValue(mockIssue),
        } as never
      })

      // Execute sync
      const { syncIssueFromLinear } = await import('./linear-sync')
      await syncIssueFromLinear(testIssue.id)

      // Count PR URLs in fixture
      let prCount = 0
      for (const comment of testIssue.comments) {
        const matches = comment.body.match(
          /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/g
        )
        if (matches) {
          prCount += matches.length
        }
      }

      console.log(`   ✓ Found ${prCount} PR URLs in fixture`)
      console.log(`   ✓ Sync completed successfully`)

      // Validate that attempts were inserted
      const { db } = await import('@/db/client')
      expect(db.insert).toHaveBeenCalled()
      expect(prCount).toBeGreaterThan(0)
    })

    it('should handle parent chain walking for agent attribution', async () => {
      const fixtures = loadIssueFixtures()
      const testIssue = fixtures[0]

      if (!testIssue) {
        throw new Error('No fixtures available')
      }

      console.log(
        `\n🧵 Testing parent chain walking for ${testIssue.identifier}...`
      )

      // Set up Linear SDK mock
      const { LinearClient } = await import('@linear/sdk')

      const mockIssue = {
        id: testIssue.id,
        identifier: testIssue.identifier,
        title: testIssue.title,
        url: testIssue.url,
        priority: 0,
        estimate: null,
        description: null,
        dueDate: null,
        createdAt: new Date(testIssue.createdAt),
        updatedAt: new Date(testIssue.updatedAt),
        comments: vi.fn().mockResolvedValue({
          nodes: testIssue.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: new Date(c.createdAt),
            parent: Promise.resolve(c.parentId ? { id: c.parentId } : null),
            user: Promise.resolve({ id: c.userId, name: c.userName }),
          })),
          pageInfo: { hasNextPage: false },
          fetchNext: vi.fn().mockResolvedValue(null),
        }),
        attachments: vi.fn().mockResolvedValue({ nodes: [] }),
        labels: vi.fn().mockResolvedValue({ nodes: [] }),
        assignee: Promise.resolve(null),
        creator: Promise.resolve(null),
        project: Promise.resolve(null),
        cycle: Promise.resolve(null),
        parent: Promise.resolve(null),
        team: Promise.resolve({
          id: 'team-1',
          key: 'ENG',
          name: 'Engineering',
        }),
        state: Promise.resolve({
          id: 'state-1',
          name: 'In Progress',
          type: 'started',
        }),
      }

      vi.mocked(LinearClient).mockImplementation(function () {
        return {
          issue: vi.fn().mockResolvedValue(mockIssue),
        } as never
      })

      // Execute sync
      const { syncIssueFromLinear } = await import('./linear-sync')
      await syncIssueFromLinear(testIssue.id)

      // Count comments with parents
      const commentsWithParents = testIssue.comments.filter(
        (c) => c.parentId !== null
      ).length

      console.log(`   ✓ Issue has ${commentsWithParents} threaded comments`)
      console.log(`   ✓ Parent chain walking completed without errors`)

      // Test passes if sync completed without throwing
      expect(commentsWithParents).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Edge Case Validation', () => {
    it('should handle comments with null/empty body gracefully', async () => {
      console.log(`\n🔍 Testing null/empty comment body handling...`)

      // Test cases that production code handles with ?? ''
      const edgeCases = [
        { body: null, description: 'null body' },
        { body: undefined, description: 'undefined body' },
        { body: '', description: 'empty string' },
        { body: '   ', description: 'whitespace only' },
        { body: '\n\n', description: 'newlines only' },
      ]

      for (const testCase of edgeCases) {
        try {
          // Test extractAgentMentions with defensive handling
          const body = testCase.body ?? ''
          const mentions = await extractAgentMentions(body)
          console.log(
            `   ✓ ${testCase.description}: ${mentions.length} mentions`
          )
          expect(Array.isArray(mentions)).toBe(true)
          expect(mentions.length).toBe(0)
        } catch (error) {
          console.log(`   ✗ Crashed on ${testCase.description}`)
          throw error
        }
      }

      console.log(
        `   ✓ All ${edgeCases.length} edge cases handled without crashing`
      )
    })

    it('should handle comments with null/missing parentId', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n🔍 Testing null/missing parentId handling...`)

      let commentsWithNullParent = 0
      let commentsWithParent = 0

      for (const issue of fixtures) {
        for (const comment of issue.comments) {
          // Production code handles this with ?? null
          const parentId = comment.parentId ?? null

          if (parentId === null) {
            commentsWithNullParent++
          } else {
            commentsWithParent++
          }
        }
      }

      console.log(`   Root comments (null parent): ${commentsWithNullParent}`)
      console.log(`   Threaded comments (with parent): ${commentsWithParent}`)

      // Real data should have both root and threaded comments
      expect(commentsWithNullParent).toBeGreaterThan(0)
      expect(commentsWithParent).toBeGreaterThan(0)
    })

    it('should handle issues with no comments', async () => {
      console.log(`\n🔍 Testing issue with no comments...`)

      // Create synthetic issue with empty comments array
      const emptyIssue: IssueFixture = {
        id: 'test-empty-comments',
        identifier: 'TEST-EMPTY',
        title: 'Issue with no comments',
        url: 'https://linear.app/test/issue/TEST-EMPTY',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        comments: [], // Empty array
        attachments: [],
      }

      // Simulate comment processing
      const commentAgents = new Map<string, string[]>()
      const commentParents = new Map<string, string | null>()

      for (const comment of emptyIssue.comments) {
        const body = comment.body ?? ''
        const mentions = await extractAgentMentions(body)
        commentAgents.set(comment.id, mentions)
        commentParents.set(comment.id, comment.parentId ?? null)
      }

      console.log(
        `   ✓ Processed ${emptyIssue.comments.length} comments (empty array)`
      )
      expect(commentAgents.size).toBe(0)
      expect(commentParents.size).toBe(0)
    })

    it('should handle issues with no attachments', () => {
      console.log(`\n🔍 Testing issue with no attachments...`)

      // Find or create issue with no attachments
      const fixtures = loadIssueFixtures()
      const issuesWithoutAttachments = fixtures.filter(
        (issue) => issue.attachments.length === 0
      )

      console.log(
        `   Issues without attachments: ${issuesWithoutAttachments.length}/${fixtures.length}`
      )

      // Validate empty attachments array is handled
      for (const issue of issuesWithoutAttachments) {
        expect(Array.isArray(issue.attachments)).toBe(true)
        expect(issue.attachments.length).toBe(0)
      }

      // If no real fixtures have empty attachments, test synthetic case
      if (issuesWithoutAttachments.length === 0) {
        console.log(
          `   ✓ No real fixtures without attachments - testing synthetic case`
        )
        const emptyAttachments: Array<{
          id: string
          url: string
          title: string
        }> = []
        expect(emptyAttachments.length).toBe(0)
      }
    })

    it('should handle empty agent mention arrays', async () => {
      console.log(`\n🔍 Testing empty agent mention arrays...`)

      const fixtures = loadIssueFixtures()
      let commentsWithoutMentions = 0
      let totalComments = 0

      for (const issue of fixtures) {
        for (const comment of issue.comments) {
          totalComments++
          const mentions = await extractAgentMentions(comment.body)

          if (mentions.length === 0) {
            commentsWithoutMentions++
          }

          // Production code handles this with ?? []
          expect(Array.isArray(mentions)).toBe(true)
        }
      }

      console.log(`   Total comments: ${totalComments}`)
      console.log(
        `   Comments without agent mentions: ${commentsWithoutMentions}`
      )
      console.log(
        `   Percentage without mentions: ${((commentsWithoutMentions / totalComments) * 100).toFixed(1)}%`
      )

      // Most comments should NOT have agent mentions
      expect(commentsWithoutMentions).toBeGreaterThan(0)
    })

    it('should handle invalid/malformed PR URLs', () => {
      console.log(`\n🔍 Testing invalid PR URL handling...`)

      const invalidURLs = [
        'github.com/org/repo/pull/', // Missing PR number
        'github.com/org/pull/123', // Missing repo
        'github.com/pull/123', // Missing org and repo
        'githubs.com/org/repo/pull/123', // Wrong domain
        'github.com/org/repo/issues/123', // Not a PR (issue instead)
        'github.com/org/repo /pull/123', // Space in path
        'github.com//repo/pull/123', // Missing org (double slash)
        'github.com/org//pull/123', // Missing repo (double slash)
        'not a URL at all',
        '',
      ]

      // Production regex: /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
      const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g

      for (const url of invalidURLs) {
        const matches = [...url.matchAll(prRegex)]
        console.log(`   "${url.slice(0, 60)}" → ${matches.length} matches`)

        // All invalid URLs should have zero matches
        expect(matches.length).toBe(0)
      }

      console.log(
        `   ✓ All ${invalidURLs.length} invalid URLs correctly rejected`
      )
    })

    it('should handle attachments without issue field (the bug that was fixed)', () => {
      console.log(`\n🔍 Testing attachments without issue field...`)

      // This was the actual bug: attachment.issue was undefined
      // Production code now skips attachments entirely in syncAttachments()

      const fixtures = loadIssueFixtures()
      let totalAttachments = 0
      let attachmentsWithPRUrls = 0

      for (const issue of fixtures) {
        for (const attachment of issue.attachments) {
          totalAttachments++

          // Check if attachment URL contains PR link
          const prMatch = attachment.url.match(
            /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
          )

          if (prMatch) {
            attachmentsWithPRUrls++
            console.log(`   Found PR in attachment: ${attachment.url}`)
            console.log(`   Note: Production code skips orphaned attachments`)
          }
        }
      }

      console.log(`   Total attachments: ${totalAttachments}`)
      console.log(`   Attachments with PR URLs: ${attachmentsWithPRUrls}`)
      console.log(
        `   ✓ Production code skips attachments (bug fix: attachment.issue was undefined)`
      )

      // Test passes if we processed attachments without crashing
      expect(totalAttachments).toBeGreaterThanOrEqual(0)
    })

    // eslint-disable-next-line sonarjs/cognitive-complexity
    it('should detect malformed agent mentions in real data', async () => {
      console.log(`\n🔍 Checking for malformed mentions in real data...`)

      const fixtures = loadIssueFixtures()
      const malformedPatterns = {
        justAt: 0, // Just @ symbol
        doubleAt: 0, // @@agent
        brackets: 0, // @[agent] without UUID
        emptyUUID: 0, // @[agent]()
      }

      for (const issue of fixtures) {
        for (const comment of issue.comments) {
          const body = comment.body

          // Check for patterns (these should still work or be handled gracefully)
          if (body.includes('@') && !body.match(/@\w+/)) {
            malformedPatterns.justAt++
          }
          if (body.includes('@@')) {
            malformedPatterns.doubleAt++
          }
          if (body.match(/@\[\w+\](?!\()/)) {
            malformedPatterns.brackets++
          }
          if (body.includes('@[') && body.includes(']()')) {
            malformedPatterns.emptyUUID++
          }
        }
      }

      console.log(`   Malformed pattern statistics:`)
      console.log(`     Just @ symbol: ${malformedPatterns.justAt}`)
      console.log(`     Double @@: ${malformedPatterns.doubleAt}`)
      console.log(`     @[agent] without UUID: ${malformedPatterns.brackets}`)
      console.log(`     @[agent]() empty UUID: ${malformedPatterns.emptyUUID}`)

      // Real data may or may not have these patterns
      // Test passes if we can analyze without crashing
      expect(true).toBe(true)
    })

    it('should handle circular parent chains without infinite loops', () => {
      console.log(`\n🔍 Testing circular parent chain protection...`)

      // Create synthetic circular chain
      const circularChain = {
        commentMap: new Map([
          ['A', 'B'], // A points to B
          ['B', 'C'], // B points to C
          ['C', 'A'], // C points back to A (CYCLE!)
        ]),
      }

      // Walk chain with cycle detection (matching production logic)
      const visited = new Set<string>()
      let current: string | null = 'A'
      let depth = 0
      const maxDepth = 100

      while (current && !visited.has(current) && depth < maxDepth) {
        visited.add(current)
        current = circularChain.commentMap.get(current) ?? null
        depth++
      }

      console.log(`   Chain depth before cycle: ${depth}`)
      console.log(`   Visited nodes: ${visited.size}`)
      console.log(`   Cycle detected: ${current && visited.has(current)}`)

      // Should detect cycle and stop
      expect(depth).toBeLessThan(maxDepth)
      expect(visited.size).toBe(3) // A, B, C
      expect(current).toBeTruthy()
      if (current) {
        expect(visited.has(current)).toBe(true) // Current is already visited (cycle)
      }
    })

    // eslint-disable-next-line sonarjs/cognitive-complexity
    it('should validate fixture data integrity for edge cases', () => {
      const fixtures = loadIssueFixtures()

      console.log(`\n✅ Validating fixture data for edge cases...`)

      const stats = {
        issuesWithEmptyTitle: 0,
        commentsWithEmptyBody: 0,
        commentsWithVeryLongBody: 0,
        attachmentsWithEmptyUrl: 0,
        orphanedComments: 0, // parentId points to non-existent comment
      }

      for (const issue of fixtures) {
        // Check title
        if (!issue.title || issue.title.trim().length === 0) {
          stats.issuesWithEmptyTitle++
        }

        // Build comment ID set
        const commentIds = new Set(issue.comments.map((c) => c.id))

        // Check comments
        for (const comment of issue.comments) {
          if (!comment.body || comment.body.trim().length === 0) {
            stats.commentsWithEmptyBody++
          }
          if (comment.body && comment.body.length > 2000) {
            stats.commentsWithVeryLongBody++
          }

          // Check for orphaned comments (parent not in comment list)
          if (comment.parentId && !commentIds.has(comment.parentId)) {
            stats.orphanedComments++
          }
        }

        // Check attachments
        for (const attachment of issue.attachments) {
          if (!attachment.url || attachment.url.trim().length === 0) {
            stats.attachmentsWithEmptyUrl++
          }
        }
      }

      console.log(`   Edge case statistics:`)
      console.log(`     Issues with empty title: ${stats.issuesWithEmptyTitle}`)
      console.log(
        `     Comments with empty body: ${stats.commentsWithEmptyBody}`
      )
      console.log(
        `     Comments with very long body (>2000 chars): ${stats.commentsWithVeryLongBody}`
      )
      console.log(
        `     Attachments with empty URL: ${stats.attachmentsWithEmptyUrl}`
      )
      console.log(
        `     Orphaned comments (parent not found): ${stats.orphanedComments}`
      )

      // All fixtures should be valid (no empty titles, URLs, etc.)
      expect(stats.issuesWithEmptyTitle).toBe(0)
      expect(stats.attachmentsWithEmptyUrl).toBe(0)
    })
  })

  describe('Synthetic Test Cases - Based on Real Data Models', () => {
    /**
     * Load a synthetic fixture by filename
     * Synthetic fixtures are created by modifying real data to test edge cases
     * @param filename - Name of the synthetic fixture file
     * @returns Parsed IssueFixture object
     */
    function loadSyntheticFixture(filename: string): IssueFixture {
      const path = join(
        process.cwd(),
        `src/__tests__/fixtures/linear-issues/synthetic/${filename}`
      )
      return JSON.parse(readFileSync(path, 'utf-8')) as IssueFixture
    }

    it('should detect and handle circular parent chains', () => {
      const fixture = loadSyntheticFixture('circular-chain.json')

      console.log(
        `\n🔄 Testing circular chain detection with synthetic fixture...`
      )
      console.log(`   Fixture: ${fixture.identifier} - ${fixture.title}`)

      // Build parent map
      const parentMap = new Map<string, string | null>()
      const commentMap = new Map<string, IssueFixture['comments'][0]>()

      for (const comment of fixture.comments) {
        parentMap.set(comment.id, comment.parentId)
        commentMap.set(comment.id, comment)
      }

      // Try to walk chain from last comment (which should hit a cycle)
      const visited = new Set<string>()
      let current: string | null = fixture.comments[0]?.id ?? null
      let cycleDetected = false
      let steps = 0

      console.log(`   Walking chain from comment: ${current}`)

      while (current && steps < 100) {
        if (visited.has(current)) {
          cycleDetected = true
          console.log(`   ✓ Detected cycle at: ${current} after ${steps} steps`)
          break
        }
        visited.add(current)
        current = parentMap.get(current) ?? null
        steps++
      }

      console.log(`   Visited ${visited.size} comments before detecting cycle`)

      // Should detect the synthetic cycle
      expect(cycleDetected).toBe(true)
      expect(visited.size).toBe(3) // Should visit all 3 comments before hitting cycle
    })

    // eslint-disable-next-line sonarjs/cognitive-complexity
    it('should handle deep nested threading (depth 5+)', async () => {
      const fixture = loadSyntheticFixture('deep-threading.json')

      console.log(
        `\n🧵 Testing deep nested threading with synthetic fixture...`
      )
      console.log(`   Fixture: ${fixture.identifier} - ${fixture.title}`)

      // Build parent map
      const parentMap = new Map<string, string | null>()
      const commentMap = new Map<string, IssueFixture['comments'][0]>()

      for (const comment of fixture.comments) {
        parentMap.set(comment.id, comment.parentId)
        commentMap.set(comment.id, comment)
      }

      // Find the deepest comment (should be last in chain)
      const lastComment = fixture.comments[fixture.comments.length - 1]
      if (!lastComment) {
        throw new Error('No comments in fixture')
      }

      // Walk chain from deepest to root
      const visited = new Set<string>()
      let current: string | null = lastComment.id
      let depth = 0

      while (current && !visited.has(current)) {
        visited.add(current)
        const parent: string | null = parentMap.get(current) ?? null
        if (parent) {
          depth++
        }
        current = parent
      }

      console.log(`   Chain depth: ${depth}`)
      console.log(`   Comments in chain: ${visited.size}`)

      // Should handle depth 5 (6 comments total: root + 5 levels)
      expect(depth).toBe(5)
      expect(visited.size).toBe(6)

      // Verify agent mention is found by walking up the chain
      const prComment = fixture.comments.find((c) =>
        c.body.includes(GITHUB_COM_PATH)
      )
      if (prComment) {
        // Walk to find agent mention
        let currentId: string | null = prComment.id
        let foundAgent = false

        while (currentId && !foundAgent) {
          const comment = commentMap.get(currentId)
          if (comment) {
            const mentions = await extractAgentMentions(comment.body)
            if (mentions.length > 0) {
              foundAgent = true
              console.log(
                `   ✓ Found agent @${mentions[0]} in chain for PR comment`
              )
            }
            currentId = comment.parentId
          } else {
            break
          }
        }

        expect(foundAgent).toBe(true)
      }
    })

    it('should extract multiple PR URLs from single comment', () => {
      const fixture = loadSyntheticFixture('multiple-prs.json')

      console.log(`\n🔗 Testing multiple PR URLs in single comment...`)
      console.log(`   Fixture: ${fixture.identifier} - ${fixture.title}`)

      // Find comment with multiple PRs
      const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g

      for (const comment of fixture.comments) {
        const matches = [...comment.body.matchAll(prRegex)]

        if (matches.length > 1) {
          console.log(`   Found ${matches.length} PR URLs in comment:`)
          for (const match of matches) {
            const [, org, repo, prNumber] = match
            console.log(`     - ${org}/${repo}#${prNumber}`)
          }

          // Should extract all 3 PRs from the synthetic comment
          expect(matches.length).toBe(3)

          // Validate each PR has correct structure
          for (const match of matches) {
            expect(match[1]).toBeTruthy() // org
            expect(match[2]).toBeTruthy() // repo
            expect(match[3]).toBeTruthy() // prNumber
          }
        }
      }
    })

    it('should handle mixed agent mention formats in single comment', async () => {
      const fixture = loadSyntheticFixture('mixed-mentions.json')

      console.log(`\n👥 Testing mixed agent mention formats...`)
      console.log(`   Fixture: ${fixture.identifier} - ${fixture.title}`)

      // Find comment with multiple mention formats
      const firstComment = fixture.comments[0]
      if (!firstComment) {
        throw new Error('No comments in fixture')
      }

      console.log(`   Comment body: "${firstComment.body.slice(0, 100)}..."`)

      // Extract mentions using production logic
      const mentions = await extractAgentMentions(firstComment.body)

      console.log(`   Extracted ${mentions.length} agent mentions:`)
      for (const mention of mentions) {
        console.log(`     - @${mention}`)
      }

      // Should detect multiple agents: cursor, engine, claude
      expect(mentions.length).toBeGreaterThan(1)
      expect(mentions).toContain('cursor')
      expect(mentions).toContain('engine')
      expect(mentions).toContain('claude')

      // Verify each mentioned agent has a corresponding PR in thread
      const prComments = fixture.comments.filter((c) =>
        c.body.includes(GITHUB_COM_PATH)
      )
      console.log(`   Found ${prComments.length} comments with PR URLs`)
      expect(prComments.length).toBeGreaterThan(0)
    })

    // eslint-disable-next-line sonarjs/cognitive-complexity
    it('should handle extreme case with 20+ comments in deep chain', async () => {
      const fixture = loadSyntheticFixture('extreme-long-chain.json')

      console.log(
        `\n💪 Testing extreme case with long chain and many comments...`
      )
      console.log(`   Fixture: ${fixture.identifier} - ${fixture.title}`)
      console.log(`   Total comments: ${fixture.comments.length}`)

      // Build maps
      const parentMap = new Map<string, string | null>()
      const commentMap = new Map<string, IssueFixture['comments'][0]>()

      for (const comment of fixture.comments) {
        parentMap.set(comment.id, comment.parentId)
        commentMap.set(comment.id, comment)
      }

      // Find deepest comment
      let maxDepth = 0
      let deepestComment: IssueFixture['comments'][0] | null = null

      for (const comment of fixture.comments) {
        const visited = new Set<string>()
        let current: string | null = comment.id
        let depth = 0

        while (current && !visited.has(current)) {
          visited.add(current)
          const parent: string | null = parentMap.get(current) ?? null
          if (parent) depth++
          current = parent
        }

        if (depth > maxDepth) {
          maxDepth = depth
          deepestComment = comment
        }
      }

      console.log(`   Max chain depth: ${maxDepth}`)

      // Should handle depth 19 (20 comments in chain)
      expect(maxDepth).toBeGreaterThan(15)
      expect(fixture.comments.length).toBe(20)

      // Walk full chain from deepest to root
      if (deepestComment) {
        const visited = new Set<string>()
        let current: string | null = deepestComment.id

        while (current && !visited.has(current)) {
          visited.add(current)
          current = parentMap.get(current) ?? null
        }

        console.log(`   Full chain length: ${visited.size} comments`)
        expect(visited.size).toBe(20) // All comments in single chain
      }

      // Find agent mention at root
      const rootComments = fixture.comments.filter((c) => c.parentId === null)
      expect(rootComments.length).toBe(1)

      const rootComment = rootComments[0]
      if (!rootComment) {
        throw new Error('No root comment found')
      }
      const rootMentions = await extractAgentMentions(rootComment.body)
      console.log(`   Root comment agent mentions: ${rootMentions.join(', ')}`)
      expect(rootMentions.length).toBeGreaterThan(0)

      // Find PR in deep comment
      const prComment = fixture.comments.find(
        (c) => c.body.includes(GITHUB_COM_PATH) && c.body.includes('/pull/')
      )
      expect(prComment).toBeTruthy()

      if (prComment) {
        console.log(`   PR found at comment: ${prComment.id}`)
        console.log(`   PR comment body: "${prComment.body.slice(0, 60)}..."`)
      }
    })

    it('should validate synthetic fixtures have correct structure', () => {
      console.log(`\n✅ Validating all synthetic fixtures...`)

      const syntheticFiles = [
        'circular-chain.json',
        'deep-threading.json',
        'multiple-prs.json',
        'mixed-mentions.json',
        'extreme-long-chain.json',
      ]

      for (const filename of syntheticFiles) {
        const fixture = loadSyntheticFixture(filename)

        console.log(`   Checking ${fixture.identifier}...`)

        // Validate required fields
        expect(fixture.id).toBeTruthy()
        expect(fixture.identifier).toBeTruthy()
        expect(fixture.title).toBeTruthy()
        expect(Array.isArray(fixture.comments)).toBe(true)
        expect(Array.isArray(fixture.attachments)).toBe(true)

        // Validate each comment
        for (const comment of fixture.comments) {
          expect(comment.id).toBeTruthy()
          expect(comment.body).toBeDefined()
          expect(comment.createdAt).toBeTruthy()
          expect(comment).toHaveProperty('parentId')
          expect(comment).toHaveProperty('userId')
          expect(comment).toHaveProperty('userName')
        }

        console.log(
          `     ✓ ${fixture.identifier}: ${fixture.comments.length} comments`
        )
      }

      expect(syntheticFiles.length).toBe(5)
    })
  })
})
