/**
 * Agent dispatch functionality for Linear issues
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues, issueAgents } from '@/db/schema'

import { getAgentConfigs, getAgentNames } from './agent-config'

/**
 * Looks up a Linear user by display name (case-insensitive)
 *
 * @param client - Linear API client
 * @param displayName - User's display name (e.g., "factory", "cursor")
 * @returns User ID if found, null otherwise
 */
async function findLinearUserByDisplayName(
  client: LinearClient,
  displayName: string
): Promise<string | null> {
  try {
    const usersResponse = await client.users()
    const users = usersResponse.nodes

    const user = users.find(
      (u) => u.displayName?.toLowerCase() === displayName.toLowerCase()
    )

    return user?.id ?? null
  } catch (error) {
    console.error(`Failed to look up user ${displayName}:`, error)
    return null
  }
}

/**
 * Generates a branch name following the pattern:
 * <ISSUE-KEY>--<title-slug>--agent-<agent-name>
 *
 * @param linearKey - Issue identifier (e.g., "ENG-320")
 * @param title - Issue title
 * @param agentName - Agent name (e.g., "factory")
 * @returns Branch name (e.g., "ENG-320--fix--agent-factory")
 */
export function generateBranchName(
  linearKey: string,
  title: string,
  agentName: string
): string {
  // Create slug from title: lowercase, replace spaces/special chars with hyphens
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 50) // Limit length

  return `${linearKey}--${slug}--agent-${agentName}`
}

/**
 * Dispatches missing agents to an issue by creating Linear comments
 * Only dispatches agents that are:
 * - In the current agent configuration
 * - Not already dispatched to this issue
 * - Issue is in open or in_progress status
 *
 * This function is idempotent - safe to call multiple times
 *
 * @param dbIssueId - Database issue ID
 * @returns Number of agents dispatched
 * @throws Error if LINEAR_API_KEY is not configured or issue not found
 */
export async function dispatchMissingAgents(
  dbIssueId: string
): Promise<number> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  // 1. Get issue from database
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.id, dbIssueId))
    .limit(1)

  if (!dbIssue[0]) {
    throw new Error(`Issue not found: ${dbIssueId}`)
  }

  const issue = dbIssue[0]
  const linearId = issue.linearId

  if (!linearId) {
    throw new Error(`Issue has no Linear ID: ${dbIssueId}`)
  }

  // 2. Check issue status - only dispatch to open/in_progress issues
  const status = issue.status?.toLowerCase() ?? ''
  if (!['open', 'in progress', 'in_progress'].includes(status)) {
    console.log(
      `Skipping dispatch for ${issue.linearKey}: status is ${issue.status}`
    )
    return 0
  }

  // 3. Get configured agents
  const configuredAgents = await getAgentNames()

  // 4. Get already-dispatched agents
  const dispatchedAgents = await db
    .select({ agentName: issueAgents.agentName })
    .from(issueAgents)
    .where(eq(issueAgents.issueId, dbIssueId))

  const dispatchedNames = new Set(dispatchedAgents.map((a) => a.agentName))

  // 5. Find missing agents
  const missingAgents = configuredAgents.filter(
    (agent) => !dispatchedNames.has(agent)
  )

  if (missingAgents.length === 0) {
    console.log(`All agents already dispatched to ${issue.linearKey}`)
    return 0
  }

  console.log(
    `Dispatching ${missingAgents.length} missing agents to ${issue.linearKey}: ${missingAgents.join(', ')}`
  )

  // 6. Create Linear client
  const client = new LinearClient({ apiKey })

  // 7. Defensive check: Fetch recent comments from Linear to verify agent hasn't been mentioned
  // This prevents duplicates after database wipes or race conditions
  const linearIssue = await client.issue(linearId)
  const recentComments = await linearIssue.comments({ first: 100 })
  const recentCommentBodies = recentComments.nodes
    .map((c) => c.body?.toLowerCase() ?? '')
    .join(' ')

  // Filter out agents that are already mentioned in recent Linear comments
  const trulyMissingAgents = missingAgents.filter((agentName) => {
    const mentioned =
      recentCommentBodies.includes(`@${agentName.toLowerCase()}`) ||
      recentCommentBodies.includes(`@[${agentName.toLowerCase()}]`)
    if (mentioned) {
      console.log(
        `Agent ${agentName} already mentioned in Linear comments for ${issue.linearKey}, skipping dispatch`
      )
    }
    return !mentioned
  })

  if (trulyMissingAgents.length === 0) {
    console.log(
      `All agents already mentioned in Linear for ${issue.linearKey}, nothing to dispatch`
    )
    return 0
  }

  console.log(
    `Verified ${trulyMissingAgents.length} agents need dispatch: ${trulyMissingAgents.join(', ')}`
  )

  // 8. Dispatch each truly missing agent
  let dispatchedCount = 0

  // Get all agent configs once
  const allAgentConfigs = await getAgentConfigs()

  for (const agentName of trulyMissingAgents) {
    const agentConfig = allAgentConfigs.find((a) => a.name === agentName)
    if (!agentConfig) {
      console.warn(`Agent config not found for: ${agentName}`)
      continue
    }

    try {
      // Look up Linear user ID for proper @mention
      const userId = await findLinearUserByDisplayName(client, agentName)

      if (!userId) {
        console.warn(
          `Linear user not found for ${agentName}, marking as dispatch_failed`
        )

        // Record dispatch failure in database
        await db.insert(issueAgents).values({
          issueId: dbIssueId,
          agentName,
          status: 'dispatch_failed',
          triggeredAt: new Date(),
        })

        continue
      }

      // Create simple dispatch comment with proper @mention: @[displayName](userId)
      const mention = `@[${agentName}](${userId})`
      const commentBody = `${mention} please work on this issue.`

      await client.createComment({
        issueId: linearId,
        body: commentBody,
      })

      // Record dispatch in database
      await db.insert(issueAgents).values({
        issueId: dbIssueId,
        agentName,
        status: 'pending',
        triggeredAt: new Date(),
      })

      dispatchedCount++
      console.log(`✅ Dispatched ${agentName} to ${issue.linearKey}`)
    } catch (error) {
      console.error(
        `❌ Failed to dispatch ${agentName} to ${issue.linearKey}:`,
        error
      )
      // Continue with other agents even if one fails
    }
  }

  return dispatchedCount
}

/**
 * Legacy function: Dispatches all configured agents to an issue
 * Note: Consider using dispatchMissingAgents() instead for idempotency
 *
 * @param dbIssueId - Database issue ID
 * @throws Error if LINEAR_API_KEY is not configured or issue not found
 * @deprecated Use dispatchMissingAgents() for better control
 */
export async function dispatchAgentsToIssue(dbIssueId: string): Promise<void> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  // 1. Get issue from database
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.id, dbIssueId))
    .limit(1)

  if (!dbIssue[0]) {
    throw new Error(`Issue not found: ${dbIssueId}`)
  }

  const issue = dbIssue[0]
  const linearId = issue.linearId

  if (!linearId) {
    throw new Error(`Issue has no Linear ID: ${dbIssueId}`)
  }

  // 2. Create Linear client
  const client = new LinearClient({ apiKey })

  // 3. Get agent mentions
  const agents = await getAgentConfigs()
  const mentionText = agents.map((agent) => agent.handle).join(' ')

  // 4. Create comment on the Linear issue using correct API
  const commentInput = {
    issueId: linearId,
    body: `${mentionText} - Dispatching agents to work on this issue`,
  }

  await client.createComment(commentInput)
}
