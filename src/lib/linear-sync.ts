/**
 * Linear API synchronization functions
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq, and } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues, issueAgents, attempts } from '@/db/schema'

const AGENT_HANDLES = ['@cursor', '@engine', '@cyrus', '@claude']

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
 * Determines which agent submitted a PR based on comment context
 * @param mentionedAgents - Agents mentioned in the PR comment
 * @param body - PR comment body
 * @param comments - All comments (reverse chronological)
 * @param index - Index of PR comment
 * @param commentAgents - Map of comment indices to agent names
 * @returns Agent name or "unknown"
 */
function determineAgentOwnership(
  mentionedAgents: string[],
  body: string,
  comments: Array<{ body?: string | null; createdAt: Date }>,
  index: number,
  commentAgents: Map<number, string[]>
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

  // Comments are in reverse chronological order (newest first)
  // Search forward in array = backward in time (older comments)
  for (let i = index + 1; i < Math.min(comments.length, index + 6); i++) {
    const olderComment = comments[i]
    const olderBody = olderComment?.body ?? ''

    // First try to guess from the comment body
    const guessedFromOlder = guessAgent(olderBody, null)
    if (guessedFromOlder !== 'unknown') {
      return guessedFromOlder
    }

    // Then check for explicit mentions
    const olderAgents = commentAgents.get(i) ?? []
    if (olderAgents.length > 0 && olderAgents[0]) {
      return olderAgents[0]
    }
  }

  // If not found, search backward in array = forward in time (newer comments)
  for (let i = index - 1; i >= Math.max(0, index - 3); i--) {
    const newerComment = comments[i]
    const newerBody = newerComment?.body ?? ''

    // First try to guess from the comment body
    const guessedFromNewer = guessAgent(newerBody, null)
    if (guessedFromNewer !== 'unknown') {
      return guessedFromNewer
    }

    // Then check for explicit mentions
    const newerAgents = commentAgents.get(i) ?? []
    if (newerAgents.length > 0 && newerAgents[0]) {
      return newerAgents[0]
    }
  }

  return 'unknown'
}

/**
 * Syncs comments to find agent mentions and PR links
 * @param issueId - Database issue ID
 * @param comments - Comment nodes from Linear API
 */
async function syncComments(
  issueId: string,
  comments: Array<{ body?: string | null; createdAt: Date }>
): Promise<void> {
  // Track which agents are mentioned in each comment
  const commentAgents: Map<number, string[]> = new Map()

  // PHASE 1: Build agent mentions map for all comments
  for (const [index, comment] of comments.entries()) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt
    const mentionedAgents: string[] = []

    // Sync agent mentions
    for (const handle of AGENT_HANDLES) {
      if (body.toLowerCase().includes(handle.toLowerCase())) {
        const agentName = handle.substring(1)
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

    commentAgents.set(index, mentionedAgents)
  }

  // PHASE 2: Extract PR URLs now that we have the full agent map
  for (const [index, comment] of comments.entries()) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt
    const mentionedAgents = commentAgents.get(index) ?? []

    // Extract GitHub PR URLs from comment body
    const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
    let prMatch: RegExpExecArray | null

    while ((prMatch = prRegex.exec(body)) !== null) {
      const [, org, repoName, prNumber] = prMatch
      if (!org || !repoName || !prNumber) continue

      const repo = `${org}/${repoName}`
      const prUrl = `https://github.com/${org}/${repoName}/pull/${prNumber}`

      // Determine agent: check this comment, then search forward and backward
      const agentName = determineAgentOwnership(
        mentionedAgents,
        body,
        comments,
        index,
        commentAgents
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
  const source = (subtitle ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  if (source.includes('claude')) return 'claude'
  return 'unknown'
}
