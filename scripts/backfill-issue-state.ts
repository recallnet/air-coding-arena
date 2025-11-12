#!/usr/bin/env tsx
/**
 * Backfill existing issue state from Linear
 * Handles cases where agents were already dispatched and PRs created before webhook was active
 */

import { LinearClient } from '@linear/sdk'
import { db } from '@/db/client'
import { issues, attempts, issueAgents } from '@/db/schema'
import { eq } from 'drizzle-orm'

const LINEAR_API_KEY = process.env['LINEAR_API_KEY']

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not set')
  process.exit(1)
}

const AGENT_HANDLES = ['@cursor', '@engine', '@cyrus', '@claude']

async function backfillIssue(linearIssueId: string) {
  const client = new LinearClient({ apiKey: LINEAR_API_KEY })

  console.log(`\n🔍 Fetching issue ${linearIssueId}...`)
  const issue = await client.issue(linearIssueId)
  console.log(`📋 ${issue.identifier} - ${issue.title}`)
  console.log(`📊 Status: ${(await issue.state).name}`)

  // Get issue from database (should exist from label event)
  const dbIssues = await db
    .select()
    .from(issues)
    .where(eq(issues.linearId, linearIssueId))
    .limit(1)

  if (dbIssues.length === 0) {
    console.error('❌ Issue not found in database. Add arena:ready label first.')
    return
  }

  const dbIssue = dbIssues[0]!

  // 1. Process Comments for Agent Mentions
  console.log('\n💬 Processing comments...')
  const comments = await issue.comments()
  const agentMentions = new Map<
    string,
    { timestamp: Date; commentId: string }
  >()

  for (const comment of comments.nodes) {
    const body = comment.body || ''
    const createdAt = new Date(comment.createdAt)

    // Find agent mentions
    for (const handle of AGENT_HANDLES) {
      if (body.toLowerCase().includes(handle.toLowerCase())) {
        const agentName = handle.substring(1) // Remove @
        const existing = agentMentions.get(agentName)

        // Keep earliest mention
        if (!existing || createdAt < existing.timestamp) {
          agentMentions.set(agentName, {
            timestamp: createdAt,
            commentId: comment.id,
          })
          console.log(
            `   ✓ Found ${handle} mention at ${createdAt.toISOString()}`
          )
        }
      }
    }
  }

  // Insert agent mentions into database
  for (const [agentName, data] of agentMentions) {
    await db
      .insert(issueAgents)
      .values({
        issueId: dbIssue.id,
        agentName,
        triggeredAt: data.timestamp,
        mode: 'manual_comment',
      })
      .onConflictDoNothing({
        target: [issueAgents.issueId, issueAgents.agentName],
      })

    console.log(`   💾 Saved ${agentName} dispatch record`)
  }

  // 2. Process Attachments (formal Linear attachments)
  console.log('\n🔗 Processing attachments...')
  const attachments = await issue.attachments()

  if (attachments.nodes.length === 0) {
    console.log('   ℹ️  No formal attachments found')
  }

  for (const attachment of attachments.nodes) {
    const prMatch = attachment.url?.match(
      /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
    )

    if (!prMatch) {
      console.log(`   ⏭️  Skipping non-GitHub attachment: ${attachment.title}`)
      continue
    }

    const [, org, repoName, prNumber] = prMatch
    const repo = `${org}/${repoName}`

    // Guess agent from title/subtitle
    const agentName = guessAgent(attachment.title || '', attachment.subtitle)

    // Parse status
    let status = 'open'
    let mergedAt: Date | undefined

    if (attachment.subtitle?.includes('merged')) {
      status = 'merged'
      mergedAt = new Date()
    } else if (attachment.subtitle?.includes('closed')) {
      status = 'closed'
    }

    console.log(`   📎 ${attachment.title}`)
    console.log(`      Agent: ${agentName}, Status: ${status}`)

    await db
      .insert(attempts)
      .values({
        issueId: dbIssue.id,
        agentName,
        repo,
        prNumber: Number.parseInt(prNumber!, 10),
        prUrl: attachment.url!,
        branch: null,
        openedAt: new Date(attachment.createdAt),
        mergedAt,
        status,
        commitCount: 1,
        sourceAttachmentId: attachment.id,
        sourceAttachmentUrl: attachment.url!,
      })
      .onConflictDoUpdate({
        target: [attempts.issueId, attempts.agentName, attempts.prNumber],
        set: { status, mergedAt },
      })

    console.log('      💾 Saved attempt record')
  }

  // 3. Parse PR URLs from comment bodies (fallback for non-attached PRs)
  console.log('\n🔍 Scanning comments for PR URLs...')
  const prUrls = new Map<
    string,
    { agent: string; url: string; timestamp: Date }
  >()

  for (const comment of comments.nodes) {
    const body = comment.body || ''
    const createdAt = new Date(comment.createdAt)

    // Find GitHub PR URLs
    const githubPrRegex = /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
    let match

    while ((match = githubPrRegex.exec(body)) !== null) {
      const [fullUrl, org, repoName, prNumber] = match
      const repo = `${org}/${repoName}`
      const key = `${repo}#${prNumber}`

      // Determine which agent mentioned this PR
      let agentName = 'unknown'
      for (const handle of AGENT_HANDLES) {
        if (body.toLowerCase().includes(handle.toLowerCase())) {
          agentName = handle.substring(1)
          break
        }
      }

      // Keep earliest mention of each PR
      if (!prUrls.has(key)) {
        prUrls.set(key, { agent: agentName, url: fullUrl!, timestamp: createdAt })
        console.log(`   ✓ Found PR: ${fullUrl} (${agentName})`)
      }
    }

    // Also check for cursor.com agent links
    const cursorRegex = /https:\/\/(?:www\.)?cursor\.com\/agents\?id=([a-z0-9-]+)/g
    while ((match = cursorRegex.exec(body)) !== null) {
      const [fullUrl, agentId] = match
      const key = `cursor-${agentId}`

      if (!prUrls.has(key)) {
        prUrls.set(key, { agent: 'cursor', url: fullUrl!, timestamp: createdAt })
        console.log(`   ✓ Found Cursor agent: ${fullUrl}`)
      }
    }
  }

  // Insert PR attempts from comments
  for (const [key, data] of prUrls) {
    if (key.startsWith('cursor-')) {
      // Cursor agent links don't map to GitHub PRs directly
      console.log(`   ℹ️  Skipping Cursor agent link (not a GitHub PR): ${data.url}`)
      continue
    }

    const [repo, prNumberStr] = key.split('#')
    const prNumber = Number.parseInt(prNumberStr!, 10)

    await db
      .insert(attempts)
      .values({
        issueId: dbIssue.id,
        agentName: data.agent,
        repo: repo!,
        prNumber,
        prUrl: data.url,
        branch: null,
        openedAt: data.timestamp,
        status: 'open',
        commitCount: 1,
      })
      .onConflictDoNothing({
        target: [attempts.issueId, attempts.agentName, attempts.prNumber],
      })

    console.log(`   💾 Saved ${data.agent} attempt: ${repo}#${prNumber}`)
  }

  console.log('\n✨ Backfill complete!')
  console.log(`   Agents dispatched: ${agentMentions.size}`)
  console.log(`   PRs found: ${prUrls.size}`)
}

function guessAgent(title: string, subtitle?: string | null): string {
  const source = (subtitle ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  if (source.includes('claude')) return 'claude'
  return 'unknown'
}

// Main
const issueId = process.argv[2]

if (!issueId) {
  console.error('Usage: tsx backfill-issue-state.ts <linear-issue-id>')
  console.error('Example: tsx backfill-issue-state.ts e7376814-a82e-48a4-bea7-55a263f88a09')
  process.exit(1)
}

backfillIssue(issueId).catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
