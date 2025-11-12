/**
 * Agent dispatch functionality for Linear issues
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues } from '@/db/schema'

import { getAgentConfigs } from './agent-config'

/**
 * Dispatches all configured agents to an issue by creating a comment
 * mentioning them
 *
 * @param dbIssueId - Database issue ID
 * @throws Error if LINEAR_API_KEY is not configured or issue not found
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
  const agents = getAgentConfigs()
  const mentionText = agents.map((agent) => agent.handle).join(' ')

  // 4. Create comment on the Linear issue using correct API
  const commentInput = {
    issueId: linearId,
    body: `${mentionText} - Dispatching agents to work on this issue`,
  }

  await client.createComment(commentInput)
}
