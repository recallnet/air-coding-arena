/**
 * Linear API synchronization functions
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq } from 'drizzle-orm'

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
 * Syncs comments to find agent mentions
 * @param issueId - Database issue ID
 * @param comments - Comment nodes from Linear API
 */
async function syncComments(
  issueId: string,
  comments: Array<{ body?: string | null; createdAt: Date }>
): Promise<void> {
  for (const comment of comments) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt

    for (const handle of AGENT_HANDLES) {
      if (body.toLowerCase().includes(handle.toLowerCase())) {
        const agentName = handle.substring(1)

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
