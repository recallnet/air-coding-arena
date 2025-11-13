/**
 * GitHub webhook handler for PR tracking
 * Tracks commit counts and CI status for arena competitions
 */

/* eslint-disable no-undef */
import crypto from 'node:crypto'

import { and, eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { attempts, events } from '@/db/schema'
import { updateRatingsForIssue } from '@/lib/update-ratings'

type GitHubWebhookPayload = {
  action: string
  pull_request?: {
    number: number
    head: { sha: string }
    merged?: boolean
    merged_at?: string | null
  }
  check_suite?: {
    status?: string
    conclusion: string | null
    head_sha: string
    pull_requests: Array<{ number: number }>
  }
  repository?: {
    full_name: string
  }
}

/**
 * Verifies GitHub webhook signature using HMAC SHA-256
 *
 * @param payload - Raw request body
 * @param signature - Signature from x-hub-signature-256 header
 * @returns True if signature is valid
 */
function verifyGitHubSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false

  const secret = process.env['GITHUB_WEBHOOK_SECRET']
  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET not configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
  } catch {
    // timingSafeEqual throws if lengths don't match
    return false
  }
}

/**
 * Fetches commit count from GitHub API
 *
 * @param repo - Repository full name (owner/repo)
 * @param prNumber - Pull request number
 * @returns Number of commits in the PR
 */
async function getCommitCount(repo: string, prNumber: number): Promise<number> {
  const token = process.env['GITHUB_TOKEN']
  if (!token) {
    console.error('GITHUB_TOKEN not configured')
    return 1 // Fallback to current count
  }

  const [owner, repoName] = repo.split('/')
  if (!owner || !repoName) {
    console.error(`Invalid repo format: ${repo}`)
    return 1
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/commits`

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      console.error(`GitHub API error: ${response.status}`)
      return 1
    }

    const commits = (await response.json()) as unknown[]
    return Array.isArray(commits) ? commits.length : 1
  } catch (error) {
    console.error('Error fetching commit count:', error)
    return 1
  }
}

/**
 * Handles PR synchronize events (new commits pushed)
 *
 * @param payload - GitHub webhook payload
 */
async function handlePullRequestSynchronize(
  payload: GitHubWebhookPayload
): Promise<void> {
  const pr = payload.pull_request
  if (!pr) return

  const repo = payload.repository?.full_name
  if (!repo) return

  const prNumber = pr.number
  const headSha = pr.head.sha

  // Check if this PR is tracked
  const attemptResult = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.repo, repo), eq(attempts.prNumber, prNumber)))
    .limit(1)

  if (attemptResult.length === 0) {
    console.log(`[GitHub] Ignoring PR ${repo}#${prNumber} - not tracked`)
    return
  }

  const attempt = attemptResult[0]
  if (!attempt) return

  // Fetch commit count from GitHub API
  const commitCount = await getCommitCount(repo, prNumber)

  // Update attempt
  await db
    .update(attempts)
    .set({
      commitCount,
      lastCommitSha: headSha,
    })
    .where(eq(attempts.id, attempt.id))

  console.log(`[GitHub] Updated PR ${repo}#${prNumber}: ${commitCount} commits`)
}

/**
 * Maps GitHub check suite conclusion to our CI status values
 *
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> pending: Initial state
 *   pending --> success: check_suite (conclusion=success)
 *   pending --> failure: check_suite (conclusion=failure/timeout/cancelled)
 *   pending --> error: check_suite (conclusion=action_required)
 *   pending --> pending: check_suite (conclusion=neutral/skipped)
 *   success --> success: check_suite updates (no auto-reset)
 *   success --> failure: check_suite (new run fails)
 *   success --> error: check_suite (requires action)
 *   failure --> success: check_suite (fixed)
 *   failure --> failure: check_suite updates
 *   error --> success: check_suite (resolved)
 *   error --> failure: check_suite (failed)
 *
 *   note right of pending
 *     New commits (synchronize) do NOT reset CI status
 *     Only check_suite events update status
 *   end note
 * ```
 *
 * @param conclusion - GitHub check suite conclusion
 * @returns Normalized CI status
 */
function mapCIStatus(conclusion: string): string {
  switch (conclusion) {
    case 'success':
      return 'success'
    case 'failure':
    case 'timed_out':
    case 'cancelled':
      return 'failure'
    case 'action_required':
      return 'error'
    case 'neutral':
    case 'skipped':
      return 'pending'
    default:
      return 'pending'
  }
}

/**
 * Handles check suite completed events (CI status changes)
 *
 * @param payload - GitHub webhook payload
 */
async function handleCheckSuiteCompleted(
  payload: GitHubWebhookPayload
): Promise<void> {
  const checkSuite = payload.check_suite
  if (!checkSuite) return

  const conclusion = checkSuite.conclusion
  if (!conclusion) return // Still running

  const repo = payload.repository?.full_name
  if (!repo) return

  const ciStatus = mapCIStatus(conclusion)
  const pullRequests = checkSuite.pull_requests

  if (!pullRequests || pullRequests.length === 0) return

  // Update CI status for each PR in the check suite
  for (const pr of pullRequests) {
    await db
      .update(attempts)
      .set({
        ciStatus,
        ciLastCheckedAt: new Date(),
      })
      .where(and(eq(attempts.repo, repo), eq(attempts.prNumber, pr.number)))

    console.log(
      `[GitHub] Updated CI status for ${repo}#${pr.number}: ${ciStatus}`
    )
  }
}

/**
 * Handles PR closed events (merge or close)
 *
 * Updates attempt status based on whether PR was merged or closed without merge.
 * On merge, triggers rating updates for all agents on the issue.
 *
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> open: PR created
 *   open --> open: synchronize (new commits)
 *   open --> merged: closed (merged=true)
 *   open --> closed: closed (merged=false)
 *   merged --> [*]
 *   closed --> [*]
 *
 *   note right of open
 *     Tracks commits via synchronize events
 *     CI status updated by check_suite events
 *   end note
 *
 *   note right of merged
 *     Triggers agent rating updates
 *     Uses OpenSkill algorithm
 *   end note
 * ```
 *
 * @param payload - GitHub webhook payload
 */
async function handlePullRequestClosed(
  payload: GitHubWebhookPayload
): Promise<void> {
  const pr = payload.pull_request
  if (!pr) return

  const repo = payload.repository?.full_name
  if (!repo) return

  const prNumber = pr.number
  const merged = pr.merged ?? false
  const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null

  // Check if this PR is tracked
  const attemptResult = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.repo, repo), eq(attempts.prNumber, prNumber)))
    .limit(1)

  if (attemptResult.length === 0) {
    console.log(`[GitHub] Ignoring PR ${repo}#${prNumber} - not tracked`)
    return
  }

  const attempt = attemptResult[0]
  if (!attempt) return

  // Update attempt status
  if (merged && mergedAt) {
    await db
      .update(attempts)
      .set({
        status: 'merged',
        mergedAt,
      })
      .where(eq(attempts.id, attempt.id))

    console.log(`[GitHub] PR ${repo}#${prNumber} merged`)

    // Update agent ratings after PR merge
    try {
      await updateRatingsForIssue(attempt.issueId)
      console.log(`[GitHub] Updated ratings for issue ${attempt.issueId}`)
    } catch (error) {
      console.error('Failed to update ratings:', error)
      // Don't fail the webhook, just log the error
    }
  } else {
    // PR was closed without merging
    await db
      .update(attempts)
      .set({
        status: 'closed',
        closedAt: new Date(),
      })
      .where(eq(attempts.id, attempt.id))

    console.log(`[GitHub] PR ${repo}#${prNumber} closed without merge`)
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify signature
    const signature = req.headers.get('x-hub-signature-256')
    const body = await req.text()

    if (!verifyGitHubSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body) as GitHubWebhookPayload

    // 2. Check idempotency
    const pr = payload.pull_request
    const eventKey = pr
      ? `github:${payload.action}:${pr.number}:${pr.head.sha}`
      : `github:${payload.action}:${Date.now()}`

    const existing = await db
      .insert(events)
      .values({
        source: 'github',
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

    // 3. Route by event type
    if (payload.action === 'synchronize') {
      await handlePullRequestSynchronize(payload)
    } else if (payload.action === 'closed' && payload.pull_request) {
      await handlePullRequestClosed(payload)
    } else if (payload.action === 'completed' && payload.check_suite) {
      await handleCheckSuiteCompleted(payload)
    } else {
      console.log(`[GitHub] ${payload.action} event received`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
