/**
 * GitHub webhook handler for PR tracking
 * Tracks commit counts and CI status for arena competitions
 */

import crypto from 'node:crypto'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { events } from '@/db/schema'

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
 */
function verifyGitHubSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false

  const secret = process.env['GITHUB_WEBHOOK_SECRET']
  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET not configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    )
  } catch {
    // timingSafeEqual throws if lengths don't match
    return false
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

    // 3. Route by event type (TODO: implement handlers)
    console.log(`[GitHub] ${payload.action} event received`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
