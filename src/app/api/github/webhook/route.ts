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

type GitHubWebhookPayload = {
  action: string
  pull_request?: {
    number: number
    head: { sha: string }
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
