/**
 * Linear reconciliation - fetches all arena:ready issues from Linear API
 * and syncs them to the database
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { Octokit } from '@octokit/rest'
import { eq, notInArray } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  issues,
  attempts,
  githubAppInstallations,
  issueAgents,
} from '@/db/schema'

import { getInstallationToken } from './github-app-auth'
import { syncIssueFromLinear } from './linear-sync'
import { updateWinner } from './update-winner'

/**
 * Reconciles database state with Linear API
 * Fetches all issues with arena:ready label and syncs them
 *
 * @returns Number of issues reconciled
 * @throws Error if LINEAR_API_KEY not configured
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
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

  const allArenaIssues = issuesResponse.nodes

  // Deduplicate issues by ID (Linear API might return duplicates)
  const seenIds = new Set<string>()
  const arenaIssues = allArenaIssues.filter((issue) => {
    if (seenIds.has(issue.id)) {
      console.warn(`[Reconcile] Duplicate issue detected: ${issue.identifier}`)
      return false
    }
    seenIds.add(issue.id)
    return true
  })

  console.log(
    `[Reconcile] Found ${arenaIssues.length} unique issues with ${arenaLabel} label` +
      (allArenaIssues.length !== arenaIssues.length
        ? ` (${allArenaIssues.length - arenaIssues.length} duplicates removed)`
        : '')
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

        // Validation: If issue has zero agent assignments, remove from arena
        // This prevents issues from entering arena before agents are assigned
        const agentAssignments = await db
          .select()
          .from(issueAgents)
          .where(eq(issueAgents.issueId, dbIssueForSync[0].id))

        if (agentAssignments.length === 0) {
          await db
            .update(issues)
            .set({ arenaReadyLabeledAt: null })
            .where(eq(issues.id, dbIssueForSync[0].id))
          console.log(
            `[Reconcile] ${issue.identifier} has no agent assignments - removed from arena`
          )
        }
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
 * Handles errors when syncing PR status from GitHub
 * Logs errors but does not modify PR status
 * 404 errors can indicate deleted PRs OR draft PRs (which return 404 with some auth methods)
 * To avoid incorrectly marking draft PRs as closed, we skip status updates on error
 *
 * @param error - Error from GitHub API
 * @param attempt - Attempt being synced
 * @returns true if error was handled, false if it should be re-thrown
 */
async function handlePRSyncError(
  error: unknown,
  attempt: { id: string; repo: string; prNumber: number }
): Promise<boolean> {
  // Check if this is a 404 error
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 404
  ) {
    // 404 can mean PR was deleted OR it's a draft PR (which can return 404)
    // Don't modify status - rely on webhooks for accurate state
    console.warn(
      `[Reconcile] PR ${attempt.repo}#${attempt.prNumber} returned 404 (deleted or inaccessible) - skipping status update`
    )
    return true
  }

  // Other error - log and continue
  console.error(
    `[Reconcile] Failed to sync PR status for ${attempt.repo}#${attempt.prNumber}:`,
    error
  )
  return true
}

/**
 * Determines PR status from GitHub API response
 * Only trusts pr.state and pr.merged, not timestamps
 *
 * @param pr - GitHub PR data with state, merged flag, and timestamps
 * @param currentStatus - Current database status
 * @param currentMergedAt - Current merged timestamp
 * @param currentClosedAt - Current closed timestamp
 * @returns New status, mergedAt, and closedAt values
 */
function determinePRStatus(
  pr: {
    state: string
    merged: boolean
    merged_at: string | null
    closed_at: string | null
  },
  currentStatus: string,
  currentMergedAt: Date | null,
  currentClosedAt: Date | null
): { status: string; mergedAt: Date | null; closedAt: Date | null } {
  if (pr.merged && pr.merged_at) {
    return {
      status: 'merged',
      mergedAt: new Date(pr.merged_at),
      closedAt: currentClosedAt,
    }
  }

  if (pr.state === 'closed') {
    return {
      status: 'closed',
      mergedAt: currentMergedAt,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : currentClosedAt,
    }
  }

  if (pr.state === 'open') {
    return {
      status: 'open',
      mergedAt: currentMergedAt,
      closedAt: null,
    }
  }

  return {
    status: currentStatus,
    mergedAt: currentMergedAt,
    closedAt: currentClosedAt,
  }
}

/**
 * Groups attempts by repository owner for batch processing
 *
 * @param issueAttempts - All attempts for an issue
 * @returns Map of owner to their attempts
 */
function groupAttemptsByOwner(
  issueAttempts: Array<{
    id: string
    repo: string
    prNumber: number
    status: string
    mergedAt: Date | null
    closedAt: Date | null
  }>
): Map<string, typeof issueAttempts> {
  const attemptsByOwner = new Map<string, typeof issueAttempts>()

  for (const attempt of issueAttempts) {
    const [owner] = attempt.repo.split('/')
    if (!owner) continue

    if (!attemptsByOwner.has(owner)) {
      attemptsByOwner.set(owner, [])
    }
    attemptsByOwner.get(owner)?.push(attempt)
  }

  return attemptsByOwner
}

/**
 * Syncs a single PR attempt with GitHub API
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param attempt - Attempt to sync
 */
async function syncSinglePRAttempt(
  octokit: Octokit,
  owner: string,
  attempt: {
    id: string
    repo: string
    prNumber: number
    status: string
    mergedAt: Date | null
    closedAt: Date | null
  }
): Promise<void> {
  const [, repo] = attempt.repo.split('/')
  if (!repo) return

  try {
    // Fetch PR status from GitHub
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: attempt.prNumber,
    })

    // Determine correct status
    const {
      status: newStatus,
      mergedAt: newMergedAt,
      closedAt: newClosedAt,
    } = determinePRStatus(
      pr,
      attempt.status,
      attempt.mergedAt,
      attempt.closedAt
    )

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
    await handlePRSyncError(error, attempt)
  }
}

/**
 * Syncs PR status from GitHub for all attempts in an issue
 * Safety net for missed webhooks - fetches current status from GitHub API
 * Uses GitHub App installation token for authentication
 *
 * @param issueId - Database issue ID
 */
async function syncPRStatusFromGitHub(issueId: string): Promise<void> {
  // Get all attempts for this issue
  const issueAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issueId))

  if (issueAttempts.length === 0) return

  // Group attempts by owner to minimize installation token lookups
  const attemptsByOwner = groupAttemptsByOwner(issueAttempts)

  // Process attempts per owner
  for (const [owner, ownerAttempts] of attemptsByOwner) {
    try {
      // Look up installation ID for this owner
      const installation = await db
        .select()
        .from(githubAppInstallations)
        .where(eq(githubAppInstallations.accountLogin, owner))
        .limit(1)

      if (!installation[0]) {
        console.warn(
          `[Reconcile] No GitHub App installation found for owner: ${owner} - skipping PR sync`
        )
        continue
      }

      // Get installation access token
      const githubToken = await getInstallationToken(
        installation[0].installationId
      )
      const octokit = new Octokit({ auth: githubToken })

      // Sync PRs for this owner
      for (const attempt of ownerAttempts) {
        await syncSinglePRAttempt(octokit, owner, attempt)
      }
    } catch (error) {
      console.error(
        `[Reconcile] Failed to get installation token for ${owner}:`,
        error
      )
    }
  }
}
