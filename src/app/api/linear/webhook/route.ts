/**
 * Linear webhook handler for M2 integration.
 * Handles Issue and Attachment events to track arena activity.
 *
 * @packageDocumentation
 * @type-coverage:ignore-file External webhook payloads require type assertions
 */

import crypto from 'node:crypto'

import { eq, and, asc } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { issues, attempts, events } from '@/db/schema'
import { guessAgentFromText } from '@/lib/agent-config'
import { updateAgentStatusOnPR } from '@/lib/agent-status'
import { syncIssueFromLinear } from '@/lib/linear-sync'

/**
 * Linear webhook payload type (simplified).
 */
type LinearWebhookPayload = {
  type: string
  action: string
  data: Record<string, unknown>
  updatedAt: string
  url?: string
  createdAt: string
}

/**
 * Linear Issue data structure.
 */
type LinearIssue = {
  id: string
  identifier: string
  title: string
  url: string
  team?: { key: string }
  state?: { name: string }
  labels?: Array<{ name: string }>
}

/**
 * Linear Attachment data structure.
 */
type LinearAttachment = {
  id: string
  url: string
  title: string
  subtitle?: string
  metadata?: Record<string, unknown>
  issue: { id: string }
}

/**
 * Linear Comment data structure.
 */
type LinearComment = {
  id: string
  body: string
  createdAt: string
  issue: { id: string }
}

/**
 * POST handler for Linear webhooks.
 *
 * @param req - Next.js request object
 * @returns JSON response with success/error status
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const signature = req.headers.get('linear-signature')
    const body = await req.text()

    if (!verifyLinearSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body) as LinearWebhookPayload

    // 2. Check idempotency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataId = payload.data['id'] as any as string

    const eventKey = `linear:${payload.type}:${dataId}:${payload.updatedAt}`

    const existing = await db
      .insert(events)
      .values({
        source: 'linear',
        key: eventKey,
        payload,
      })
      .onConflictDoNothing({
        target: [events.source, events.key],
      })
      .returning({ id: events.id })

    if (existing.length === 0) {
      return NextResponse.json({ status: 'duplicate' })
    }

    // 3. Route by type
    if (payload.type === 'Issue') {
      await handleIssueEvent(payload)
    } else if (payload.type === 'Attachment') {
      await handleAttachmentEvent(payload)
    } else if (payload.type === 'Comment') {
      await handleCommentEvent(payload)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Linear webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Verifies Linear webhook signature using HMAC SHA-256.
 *
 * @param payload - Raw request body
 * @param signature - Signature from Linear-Signature header
 * @returns True if signature is valid
 */
function verifyLinearSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false

  const secret = process.env['LINEAR_WEBHOOK_SECRET']
  if (!secret) {
    console.error('LINEAR_WEBHOOK_SECRET not configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return signature === digest
}

/**
 * Handles Issue webhook events.
 * Upserts issue when arena:ready label is present and syncs existing state.
 *
 * @param payload - Linear webhook payload
 */
async function handleIssueEvent(payload: LinearWebhookPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issue = payload.data as any

  // Check for arena:ready label
  const arenaLabel = process.env['ARENA_LABEL'] ?? 'arena:ready'
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const hasArenaLabel = issue.labels?.some((label: any) => label.name === arenaLabel)

  if (!hasArenaLabel) return

  // Upsert issue
  await db
    .insert(issues)
    .values({
      linearId: issue.id,
      linearKey: issue.identifier,
      title: issue.title,
      url: issue.url,
      repo: issue.team?.key,
      status: issue.state?.name,
      arenaReadyLabeledAt: new Date(),
    })
    .onConflictDoUpdate({
      target: issues.linearId,
      set: {
        status: issue.state?.name,
      },
    })
    .returning({ id: issues.id })

  console.log(`Issue ${issue.identifier} labeled ${arenaLabel}`)

  // Sync existing state from Linear API (catches mid-flight activity)
  await syncIssueFromLinear(issue.id)
}

/**
 * Handles Attachment webhook events.
 * Creates/updates attempts when PR is linked to issue.
 *
 * @param payload - Linear webhook payload
 */
async function handleAttachmentEvent(
  payload: LinearWebhookPayload
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachment = payload.data as any as LinearAttachment

  // Only process GitHub PR attachments
  const prMatch = attachment.url?.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  )
  if (!prMatch) return

  const [, org, repoName, prNumber] = prMatch
  if (!org || !repoName || !prNumber) return
  const repo = `${org}/${repoName}`

  // Get the issue this attachment belongs to
  const issueResult = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.linearId, attachment.issue.id))
    .limit(1)

  if (issueResult.length === 0) {
    console.warn(`Attachment for unknown issue: ${attachment.issue.id}`)
    return
  }

  const issueId = issueResult[0]?.id
  if (!issueId) return

  // Parse status from subtitle (e.g., "org/repo #123 • merged")
  let status = 'open'
  let mergedAt: Date | undefined

  if (attachment.subtitle?.includes('merged')) {
    status = 'merged'
    mergedAt = new Date()
  } else if (attachment.subtitle?.includes('closed')) {
    status = 'closed'
  }

  // Guess agent from branch or title
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const branch = (attachment.metadata?.['branch'] as any) ?? null
  const agentName = guessAgent(attachment.title, branch ?? undefined)

  // Upsert attempt
  await db
    .insert(attempts)
    .values({
      issueId,
      agentName,
      repo,
      prNumber: Number.parseInt(prNumber, 10),
      prUrl: attachment.url,
      branch,
      openedAt: new Date(),
      mergedAt,
      status,
      commitCount: 1,
      sourceAttachmentId: attachment.id,
      sourceAttachmentUrl: attachment.url,
    })
    .onConflictDoUpdate({
      target: [attempts.issueId, attempts.agentName, attempts.prNumber],
      set: {
        status,
        mergedAt,
        sourceAttachmentId: attachment.id,
        sourceAttachmentUrl: attachment.url,
      },
    })

  // Update agent status to submitted
  await updateAgentStatusOnPR(issueId, agentName)

  // If merged, check for winner
  if (status === 'merged') {
    await updateWinner(issueId)
  }

  console.log(`Attempt created/updated: ${repo}#${prNumber} (${status})`)
}

/**
 * Guesses agent name from PR title or branch name.
 *
 * @param title - PR title
 * @param branch - Branch name
 * @returns Agent name (cursor, engine, cyrus, factory, or unknown)
 */
function guessAgent(title: string, branch?: string): string {
  return guessAgentFromText(branch ?? title)
}

/**
 * Updates winner for an issue.
 * Selects first merged attempt and closes others.
 *
 * @param issueId - Issue UUID
 */
async function updateWinner(issueId: string): Promise<void> {
  // Get first merged attempt
  const winnerResult = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.issueId, issueId), eq(attempts.status, 'merged')))
    .orderBy(asc(attempts.mergedAt), asc(attempts.openedAt))
    .limit(1)

  if (winnerResult.length === 0) return

  const winnerId = winnerResult[0]?.id
  if (!winnerId) return

  // Set winner
  await db
    .update(issues)
    .set({ winnerAttemptId: winnerId })
    .where(eq(issues.id, issueId))

  // Close other attempts
  await db
    .update(attempts)
    .set({ status: 'closed', closedAt: new Date() })
    .where(and(eq(attempts.issueId, issueId), eq(attempts.status, 'open')))

  console.log(`Winner set for issue ${issueId}`)
}

/**
 * Handles Comment webhook events.
 * Triggers full sync to ensure no mentions are missed.
 *
 * @param payload - Linear webhook payload
 */
async function handleCommentEvent(
  payload: LinearWebhookPayload
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comment = payload.data as any as LinearComment

  // Get issue from database
  const issueResult = await db
    .select({ id: issues.id, linearId: issues.linearId })
    .from(issues)
    .where(eq(issues.linearId, comment.issue.id))
    .limit(1)

  if (issueResult.length === 0) {
    console.warn(`Comment on unknown issue: ${comment.issue.id}`)
    return
  }

  const issue = issueResult[0]
  if (!issue) return

  // Re-sync all comments for this issue from API
  // (Cheaper than parsing single comment + risk of missing context)
  await syncIssueFromLinear(issue.linearId)
}
