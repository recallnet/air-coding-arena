/**
 * Winner determination and rating update functions.
 * Extracted from Linear webhook handler for reuse in reconciliation.
 *
 * @packageDocumentation
 */

import { eq, and, asc, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues, attempts, issueAgents } from '@/db/schema'
import { markIgnoredOnIssueClosed } from '@/lib/agent-status'
import { updateRatingsForIssue } from '@/lib/update-ratings'

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
export async function updateWinner(issueId: string): Promise<void> {
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
      globalThis.console.log(`Winner already set for issue ${issueId}`)
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

    // 6. Mark winning agent as accepted
    await tx
      .update(issueAgents)
      .set({ status: 'accepted' })
      .where(
        and(
          eq(issueAgents.issueId, issueId),
          eq(issueAgents.agentName, winner.agentName)
        )
      )

    // 7. Mark all other submitted agents as rejected
    await tx
      .update(issueAgents)
      .set({ status: 'rejected' })
      .where(
        and(
          eq(issueAgents.issueId, issueId),
          eq(issueAgents.status, 'submitted'),
          sql`${issueAgents.agentName} != ${winner.agentName}`
        )
      )

    globalThis.console.log(
      `Winner set: ${winner.agentName} for issue ${issueId}`
    )
  })

  // Post-transaction operations (outside transaction for error isolation)
  try {
    await markIgnoredOnIssueClosed(issueId)
    await updateRatingsForIssue(issueId)
  } catch (error) {
    globalThis.console.error(
      `Failed to update ratings for issue ${issueId}:`,
      error
    )
    // Don't throw - winner is already set successfully
  }
}
