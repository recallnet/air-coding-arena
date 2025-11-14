/**
 * Linear webhook handler for M2 integration.
 * Handles Issue and Attachment events to track arena activity.
 *
 * @packageDocumentation
 * @type-coverage:ignore-file External webhook payloads require type assertions
 */

import crypto from 'node:crypto'

import { eq, and, asc, gt, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { issues, attempts, events } from '@/db/schema'
import {
  updateAgentStatusOnPR,
  markIgnoredOnIssueClosed,
} from '@/lib/agent-status'
import { syncIssueFromLinear } from '@/lib/linear-sync'
import { updateRatingsForIssue } from '@/lib/update-ratings'
import type { LinearWebhookIssue } from '@/types/linear'

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
 * Linear Attachment data structure.
 */
type LinearAttachment = {
  id: string
  url: string
  title: string
  subtitle?: string
  metadata?: Record<string, unknown>
  issue?: { id: string } // Optional - may not be included in webhook payload
  issueId?: string // Alternative field Linear might use
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

    // Log all webhook events for debugging
    console.log(
      `[Webhook] Received: type=${payload.type}, action=${payload.action}`
    )

    // 2. Time-window deduplication (checks for recent same-action events)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataId = payload.data['id'] as any as string
    const baseKey = `linear:${payload.type}:${dataId}:${payload.action}`

    // Check for recent events with same base key (within 5 seconds)
    const DEDUP_WINDOW_MS = 5000
    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS)

    const recentEvents = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.source, 'linear'),
          sql`${events.key} LIKE ${baseKey + '%'}`,
          gt(events.createdAt, windowStart)
        )
      )
      .limit(1)

    if (recentEvents.length > 0) {
      console.log(`[Webhook] Deduplicated (5s window): ${baseKey}`)
      return NextResponse.json({ status: 'deduplicated' })
    }

    // 3. Exact-match idempotency check (safety net for exact duplicates)
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

    // 4. Route by type
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
 * Marks issue as deleted when issue is deleted or label is removed.
 * Webhook stores basic fields only - sync enriches with full metadata.
 *
 * @param payload - Linear webhook payload
 */
async function handleIssueEvent(payload: LinearWebhookPayload): Promise<void> {
  const issue = payload.data as unknown as LinearWebhookIssue

  // Handle issue deletion or removal
  if (payload.action === 'remove') {
    await db
      .update(issues)
      .set({ status: 'deleted' })
      .where(eq(issues.linearId, issue.id))

    console.log(`Issue ${issue.identifier} marked as deleted`)
    return
  }

  // Check for arena:ready label
  const arenaLabel = process.env['ARENA_LABEL'] ?? 'arena:ready'
  const hasArenaLabel = issue.labels?.some((label) => label.name === arenaLabel)

  // If label was removed (on update), mark as deleted
  // On create without label, just ignore it
  if (!hasArenaLabel) {
    if (payload.action === 'update') {
      await db
        .update(issues)
        .set({ status: 'deleted' })
        .where(eq(issues.linearId, issue.id))

      console.log(
        `Issue ${issue.identifier} arena label removed, marked as deleted`
      )
    }
    return
  }

  // Upsert issue with basic fields from webhook
  // Full metadata will be added by syncIssueFromLinear
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
      // Note: metadata fields will be filled by sync
    })
    .onConflictDoUpdate({
      target: issues.linearId,
      set: {
        status: issue.state?.name,
        // Don't overwrite metadata fields on webhook updates
        // Only sync updates those to avoid race conditions
      },
    })
    .returning({ id: issues.id })

  console.log(`Issue ${issue.identifier} labeled ${arenaLabel}`)

  // Sync existing state from Linear API (fills metadata)
  await syncIssueFromLinear(issue.id)

  // Invalidate homepage cache to show updated issue
  revalidatePath('/')
  console.log(`[Linear] Revalidated homepage for issue ${issue.identifier}`)
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

  // Extract issue ID from attachment (try multiple possible fields)
  const linearIssueId = attachment.issue?.id ?? attachment.issueId
  if (!linearIssueId) {
    console.warn(
      `Attachment ${attachment.id} missing issue ID - skipping (URL: ${attachment.url})`
    )
    return
  }

  // Get the issue this attachment belongs to
  const issueResult = await db
    .select({ id: issues.id, linearKey: issues.linearKey })
    .from(issues)
    .where(eq(issues.linearId, linearIssueId))
    .limit(1)

  if (issueResult.length === 0) {
    console.warn(`Attachment for unknown issue: ${linearIssueId}`)
    return
  }

  const issueRecord = issueResult[0]
  if (!issueRecord) return
  const issueId = issueRecord.id

  // Parse status from subtitle (e.g., "org/repo #123 • merged")
  let status = 'open'
  let mergedAt: Date | undefined

  if (attachment.subtitle?.includes('merged')) {
    status = 'merged'
    mergedAt = new Date()
  } else if (attachment.subtitle?.includes('closed')) {
    status = 'closed'
  }

  // Extract branch from attachment metadata (if available)
  const metadata = attachment.metadata as Record<string, unknown> | undefined
  const branch = metadata?.['branch'] as string | undefined

  // Try to extract agent name from branch (best effort, not required)
  const agentMatch = branch?.match(/agent-([a-z]+)$/i)
  const agentNameFromBranch = agentMatch?.[1]?.toLowerCase()

  // If can't determine agent from branch, defer to comment sync
  // Comment sync will create the attempt with proper agent provenance from @mention thread
  if (!agentNameFromBranch) {
    console.log(
      `Skipping attempt creation for ${attachment.url} - ` +
        `agent provenance not available from branch name. ` +
        `Will be created by comment sync with @mention attribution.`
    )

    // Trigger immediate sync to process comment thread
    await syncIssueFromLinear(linearIssueId)
    return
  }

  // Agent known from branch - create attempt immediately
  await db
    .insert(attempts)
    .values({
      issueId,
      agentName: agentNameFromBranch,
      repo,
      prNumber: Number.parseInt(prNumber, 10),
      prUrl: attachment.url,
      branch: branch ?? null,
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
        branch: branch ?? sql`${attempts.branch}`,
        sourceAttachmentId: attachment.id,
        sourceAttachmentUrl: attachment.url,
      },
    })

  // Invalidate homepage cache to show new PR attachment
  revalidatePath('/')
  console.log(
    `[Linear] Revalidated homepage for attachment on issue ${issueRecord.linearKey}`
  )

  // Update agent status to submitted
  await updateAgentStatusOnPR(issueId, agentNameFromBranch)

  // If merged, check for winner
  if (status === 'merged') {
    await updateWinner(issueId)
  }

  console.log(
    `Attempt created/updated: ${repo}#${prNumber} (agent: ${agentNameFromBranch}, status: ${status})`
  )
}

/**
 * Updates winner for an issue with transaction-based race condition protection.
 * Uses row-level locking to ensure only one webhook can set the winner.
 * Idempotent - safe to call multiple times.
 *
 * Transaction handles atomic winner selection (steps 1-5).
 * Rating updates happen after transaction completes (step 6) with separate error handling.
 * This maintains transaction atomicity while allowing rating failures to not rollback winner selection.
 *
 * @param issueId - Issue UUID
 */
async function updateWinner(issueId: string): Promise<void> {
  // Transaction scope: atomic winner selection only
  await db.transaction(async (tx) => {
    // 1. Lock the issue row (prevents concurrent winner updates)
    const issueResult = await tx
      .select({ id: issues.id, winnerAttemptId: issues.winnerAttemptId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .for('update') // PostgreSQL row lock - blocks concurrent updates
      .limit(1)

    if (issueResult.length === 0) return

    const issue = issueResult[0]
    if (!issue) return

    // 2. If winner already set, skip (idempotency)
    if (issue.winnerAttemptId) {
      console.log(`Winner already set for issue ${issueId}`)
      return
    }

    // 3. Get first merged attempt (within transaction)
    const winnerResult = await tx
      .select({ id: attempts.id, agentName: attempts.agentName })
      .from(attempts)
      .where(and(eq(attempts.issueId, issueId), eq(attempts.status, 'merged')))
      .orderBy(asc(attempts.mergedAt), asc(attempts.openedAt))
      .limit(1)

    if (winnerResult.length === 0) return

    const winner = winnerResult[0]
    if (!winner) return

    // 4. Set winner and mark issue as completed (atomic with lock)
    await tx
      .update(issues)
      .set({
        winnerAttemptId: winner.id,
        status: 'completed',
      })
      .where(eq(issues.id, issueId))

    // 5. Close losing attempts
    await tx
      .update(attempts)
      .set({ status: 'closed', closedAt: new Date() })
      .where(and(eq(attempts.issueId, issueId), eq(attempts.status, 'open')))

    console.log(`Winner set for issue ${issueId}: ${winner.agentName}`)
  })

  // 7. Mark agents who never submitted as ignored
  await markIgnoredOnIssueClosed(issueId)

  // 6. Calculate ratings after transaction (separate error boundary)
  // Rating updates use global db instance, so must be outside transaction.
  // If ratings fail, winner is already set correctly - no rollback needed.
  try {
    await updateRatingsForIssue(issueId)
  } catch (error) {
    console.error(`Failed to update ratings for issue ${issueId}:`, error)
    // Don't throw - winner is already set correctly
  }
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

// Export for integration testing
export { updateWinner }
