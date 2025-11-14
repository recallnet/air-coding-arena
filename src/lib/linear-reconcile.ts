/**
 * Linear reconciliation - fetches all arena:ready issues from Linear API
 * and syncs them to the database
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { Octokit } from '@octokit/rest'
import { eq, notInArray } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues, attempts } from '@/db/schema'

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

      // Sync PR status from GitHub for all attempts (safety net for missed webhooks)
      // Need to get database issue ID first
      const dbIssueForSync = await db
        .select({ id: issues.id })
        .from(issues)
        .where(eq(issues.linearId, issue.id))
        .limit(1)
      if (dbIssueForSync[0]) {
        await syncPRStatusFromGitHub(dbIssueForSync[0].id)
      }

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

/**
 * Syncs PR status from GitHub for all attempts in an issue
 * Safety net for missed webhooks - fetches current status from GitHub API
 *
 * @param issueId - Database issue ID
 */
async function syncPRStatusFromGitHub(issueId: string): Promise<void> {
  const githubToken = process.env['GITHUB_TOKEN']
  if (!githubToken) {
    console.warn(
      '[Reconcile] GITHUB_TOKEN not configured - skipping PR status sync'
    )
    return
  }

  // Get all attempts for this issue
  const issueAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issueId))

  if (issueAttempts.length === 0) return

  const octokit = new Octokit({ auth: githubToken })

  for (const attempt of issueAttempts) {
    try {
      // Parse owner/repo from repo field
      const [owner, repo] = attempt.repo.split('/')
      if (!owner || !repo) continue

      // Fetch PR status from GitHub
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: attempt.prNumber,
      })

      // Determine correct status
      const merged = pr.merged
      const closed = pr.state === 'closed'
      let newStatus = attempt.status
      let newMergedAt = attempt.mergedAt
      let newClosedAt = attempt.closedAt

      if (merged && pr.merged_at) {
        newStatus = 'merged'
        newMergedAt = new Date(pr.merged_at)
      } else if (closed && pr.closed_at) {
        newStatus = 'closed'
        newClosedAt = new Date(pr.closed_at)
      } else if (pr.state === 'open') {
        newStatus = 'open'
      }

      // Update database if status changed
      if (
        newStatus !== attempt.status ||
        newMergedAt?.getTime() !== attempt.mergedAt?.getTime() ||
        newClosedAt?.getTime() !== attempt.closedAt?.getTime()
      ) {
        await db
          .update(attempts)
          .set({
            status: newStatus,
            mergedAt: newMergedAt,
            closedAt: newClosedAt,
          })
          .where(eq(attempts.id, attempt.id))

        console.log(
          `[Reconcile] Updated PR status for ${attempt.repo}#${attempt.prNumber}: ${attempt.status} → ${newStatus}`
        )
      }
    } catch (error) {
      // Log but continue - don't fail reconciliation if GitHub API errors
      console.error(
        `[Reconcile] Failed to sync PR status for ${attempt.repo}#${attempt.prNumber}:`,
        error
      )
    }
  }
}
