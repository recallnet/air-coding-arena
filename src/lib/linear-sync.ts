/**
 * Linear API synchronization functions
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq, and } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues, issueAgents, attempts } from '@/db/schema'

import { getAgentHandles, guessAgentFromText } from './agent-config'

/**
 * Syncs issue state from Linear API
 * Fetches comments and attachments to capture mid-flight activity
 *
 * @param linearIssueId - Linear issue UUID
 */
export async function syncIssueFromLinear(
  linearIssueId: string
): Promise<void> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  // 1. Get issue from database
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearId, linearIssueId))
    .limit(1)

  if (!dbIssue[0]) {
    return // Issue not in database, nothing to sync
  }

  const issueId = dbIssue[0].id

  // 2. Fetch from Linear API
  const client = new LinearClient({ apiKey })
  const issue = await client.issue(linearIssueId)
  const comments = await issue.comments()
  const attachments = await issue.attachments()

  // 3. Sync comments → agent mentions
  await syncComments(issueId, comments.nodes)

  // 4. Sync attachments → attempts
  await syncAttachments(issueId, attachments.nodes)
}

/**
 * Determines which agent submitted a PR based on comment thread
 * Walks up the parent chain to find the root @mention comment
 * @param commentId - ID of the PR comment
 * @param mentionedAgents - Agents mentioned in the PR comment itself
 * @param body - PR comment body
 * @param commentAgents - Map of comment IDs to agent mentions
 * @param commentParents - Map of comment IDs to parent comment IDs
 * @returns Agent name or "unknown"
 */
function determineAgentOwnershipFromThread(
  commentId: string,
  mentionedAgents: string[],
  body: string,
  commentAgents: Map<string, string[]>,
  commentParents: Map<string, string | null>
): string {
  // First, check if agent is mentioned in this comment
  if (mentionedAgents.length > 0 && mentionedAgents[0]) {
    return mentionedAgents[0]
  }

  // Try to guess from the comment body itself (e.g., Cursor's comment format)
  const guessedAgent = guessAgent(body, null)
  if (guessedAgent !== 'unknown') {
    return guessedAgent
  }

  // Walk up the parent chain to find @mentions
  let currentId: string | null = commentId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)

    // Check if this comment has an agent mention
    const agents = commentAgents.get(currentId) ?? []
    if (agents.length > 0 && agents[0]) {
      return agents[0]
    }

    // Move to parent
    const parentId = commentParents.get(currentId)
    currentId = parentId ?? null
  }

  return 'unknown'
}

type CommentWithParent = {
  id: string
  body?: string | null
  createdAt: Date
  parentId?: string | undefined | null
}

/**
 * Syncs comments to find agent mentions and PR links
 * @param issueId - Database issue ID
 * @param comments - Comment nodes from Linear API
 */
async function syncComments(
  issueId: string,
  comments: CommentWithParent[]
): Promise<void> {
  // Track which agents are mentioned in each comment (by comment ID)
  const commentAgents: Map<string, string[]> = new Map()
  // Track parent IDs
  const commentParents: Map<string, string | null> = new Map()

  // PHASE 1: Build agent mentions map and parent relationships for all comments
  for (const comment of comments) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt
    const commentId = comment.id
    const mentionedAgents: string[] = []

    // Get parent ID if it exists
    const parentId: string | undefined | null = comment.parentId
    commentParents.set(commentId, parentId ?? null)

    // Sync agent mentions
    for (const handle of getAgentHandles()) {
      if (body.toLowerCase().includes(handle.toLowerCase())) {
        const agentName = handle.substring(1).toLowerCase() // Remove @ prefix and normalize to lowercase
        mentionedAgents.push(agentName)

        await db
          .insert(issueAgents)
          .values({
            issueId,
            agentName,
            status: 'pending',
            triggeredAt: createdAt,
          })
          .onConflictDoUpdate({
            target: [issueAgents.issueId, issueAgents.agentName],
            set: { triggeredAt: createdAt },
          })
      }
    }

    commentAgents.set(commentId, mentionedAgents)
  }

  // PHASE 2: Extract PR URLs now that we have the full agent map
  for (const comment of comments) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt
    const commentId = comment.id
    const mentionedAgents = commentAgents.get(commentId) ?? []

    // Extract GitHub PR URLs from comment body
    const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
    let prMatch: RegExpExecArray | null

    while ((prMatch = prRegex.exec(body)) !== null) {
      const [, org, repoName, prNumber] = prMatch
      if (!org || !repoName || !prNumber) continue

      const repo = `${org}/${repoName}`
      const prUrl = `https://github.com/${org}/${repoName}/pull/${prNumber}`

      // Determine agent using parent relationship
      const agentName = determineAgentOwnershipFromThread(
        commentId,
        mentionedAgents,
        body,
        commentAgents,
        commentParents
      )

      // Create attempt entry
      await db
        .insert(attempts)
        .values({
          issueId,
          agentName,
          repo,
          prNumber: Number.parseInt(prNumber, 10),
          prUrl,
          branch: null,
          openedAt: createdAt,
          mergedAt: undefined,
          status: 'open',
          commitCount: 1,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
        })
        .onConflictDoUpdate({
          target: [attempts.issueId, attempts.agentName, attempts.prNumber],
          set: { prUrl, status: 'open' },
        })

      // Update agent status from "pending" to "submitted"
      if (agentName !== 'unknown') {
        await db
          .update(issueAgents)
          .set({ status: 'submitted' })
          .where(
            and(
              eq(issueAgents.issueId, issueId),
              eq(issueAgents.agentName, agentName)
            )
          )
      }
    }
  }
}

/**
 * Syncs attachments to find PR links
 * @param issueId - Database issue ID
 * @param attachments - Attachment nodes from Linear API
 */
async function syncAttachments(
  issueId: string,
  attachments: Array<{
    url?: string | null
    title?: string | null
    subtitle?: string | null
    createdAt: Date
    id: string
  }>
): Promise<void> {
  for (const attachment of attachments) {
    const url = attachment.url
    if (!url) continue

    const prMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!prMatch) continue

    const [, org, repoName, prNumber] = prMatch
    if (!org || !repoName || !prNumber) continue

    const repo = `${org}/${repoName}`
    const agentName = guessAgent(attachment.title ?? '', attachment.subtitle)

    let status = 'open'
    let mergedAt: Date | undefined

    if (attachment.subtitle?.includes('merged')) {
      status = 'merged'
      mergedAt = new Date()
    } else if (attachment.subtitle?.includes('closed')) {
      status = 'closed'
    }

    await db
      .insert(attempts)
      .values({
        issueId,
        agentName,
        repo,
        prNumber: Number.parseInt(prNumber, 10),
        prUrl: url,
        branch: null,
        openedAt: attachment.createdAt,
        mergedAt,
        status,
        commitCount: 1,
        sourceAttachmentId: attachment.id,
        sourceAttachmentUrl: url,
      })
      .onConflictDoUpdate({
        target: [attempts.issueId, attempts.agentName, attempts.prNumber],
        set: { status, mergedAt },
      })
  }
}

/**
 * Guesses agent name from PR title or subtitle
 * @param title - PR title
 * @param subtitle - Attachment subtitle
 * @returns Agent name
 */
function guessAgent(title: string, subtitle?: string | null): string {
  return guessAgentFromText(subtitle ?? title)
}
