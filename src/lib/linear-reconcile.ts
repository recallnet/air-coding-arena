/**
 * Linear reconciliation - fetches all arena:ready issues from Linear API
 * and syncs them to the database
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { notInArray } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues } from '@/db/schema'

import { syncIssueFromLinear } from './linear-sync'
import { updateWinner } from './update-winner'

/**
 * Reconciles database state with Linear API
 * Fetches all issues with arena:ready label and syncs them
 *
 * @returns Number of issues reconciled
 * @throws Error if LINEAR_API_KEY not configured
 */
export async function reconcileLinearIssues(): Promise<number> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  const arenaLabel = process.env['ARENA_LABEL'] ?? 'arena:ready'

  console.log(`[Reconcile] Fetching issues with label: ${arenaLabel}`)

  const client = new LinearClient({ apiKey })

  // Fetch all issues with arena:ready label
  const issuesResponse = await client.issues({
    filter: {
      labels: {
        name: {
          eq: arenaLabel,
        },
      },
    },
  })

  const arenaIssues = issuesResponse.nodes
  console.log(
    `[Reconcile] Found ${arenaIssues.length} issues with ${arenaLabel} label`
  )

  let reconciledCount = 0

  for (const issue of arenaIssues) {
    try {
      const state = await issue.state
      const team = await issue.team

      // Upsert issue into database
      await db
        .insert(issues)
        .values({
          linearId: issue.id,
          linearKey: issue.identifier,
          title: issue.title,
          url: issue.url,
          repo: team?.key,
          status: state?.name,
          arenaReadyLabeledAt: new Date(),
        })
        .onConflictDoUpdate({
          target: issues.linearId,
          set: {
            status: state?.name,
            title: issue.title,
          },
        })

      console.log(`[Reconcile] Upserted ${issue.identifier}`)

      // Sync full metadata and dispatch agents
      await syncIssueFromLinear(issue.id)

      reconciledCount++
      console.log(`[Reconcile] Synced ${issue.identifier}`)

      // Check if issue needs winner determination and rating calculation
      // This covers missed Linear webhooks that would have triggered these
      const issueRecord = await db.query.issues.findFirst({
        where: (issues, { eq }) => eq(issues.linearId, issue.id),
        with: {
          attempts: {
            where: (attempts, { eq }) => eq(attempts.status, 'merged'),
          },
        },
      })

      if (issueRecord && issueRecord.attempts.length > 0) {
        // Has merged PRs - ensure winner is set and ratings calculated
        if (!issueRecord.winnerAttemptId) {
          console.log(
            `[Reconcile] Issue ${issue.identifier} has merged PRs but no winner - updating...`
          )
          await updateWinner(issueRecord.id)
          console.log(
            `[Reconcile] Winner and ratings updated for ${issue.identifier}`
          )
        }
      }
    } catch (error) {
      console.error(`[Reconcile] Failed to sync ${issue.identifier}:`, error)
      // Continue with other issues
    }
  }

  console.log(
    `[Reconcile] Complete: ${reconciledCount}/${arenaIssues.length} issues reconciled`
  )

  // Mark issues that are no longer in Linear (deleted or label removed) as deleted
  const linearIds = arenaIssues.map((issue) => issue.id)
  if (linearIds.length > 0) {
    const markedDeleted = await db
      .update(issues)
      .set({ status: 'deleted' })
      .where(notInArray(issues.linearId, linearIds))
      .returning({ linearKey: issues.linearKey })

    if (markedDeleted.length > 0) {
      console.log(
        `[Reconcile] Marked ${markedDeleted.length} issues as deleted: ${markedDeleted.map((i) => i.linearKey).join(', ')}`
      )
    }
  }

  return reconciledCount
}
