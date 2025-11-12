#!/usr/bin/env tsx
/**
 * Backfill existing PR attachments for an issue
 */

import { LinearClient } from '@linear/sdk'
import { db } from '@/db/client'
import { issues, attempts } from '@/db/schema'
import { eq } from 'drizzle-orm'

const LINEAR_API_KEY = process.env['LINEAR_API_KEY']
const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not set')
  process.exit(1)
}

async function main() {
  const client = new LinearClient({ apiKey: LINEAR_API_KEY })

  console.log('🔍 Fetching issue...')
  const issue = await client.issue(ISSUE_ID)
  console.log(`📋 Issue: ${issue.identifier} - ${issue.title}`)

  // Get issue from database
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearId, ISSUE_ID))
    .limit(1)

  if (dbIssue.length === 0) {
    console.error('❌ Issue not found in database')
    process.exit(1)
  }

  const dbIssueId = dbIssue[0]!.id

  console.log('🔗 Fetching attachments...')
  const attachments = await issue.attachments()

  console.log(`Found ${attachments.nodes.length} attachments`)

  for (const attachment of attachments.nodes) {
    console.log(`\n📎 ${attachment.title}`)
    console.log(`   URL: ${attachment.url}`)
    console.log(`   Subtitle: ${attachment.subtitle}`)

    // Parse GitHub PR URL
    const prMatch = attachment.url?.match(
      /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
    )
    if (!prMatch) {
      console.log('   ⏭️  Not a GitHub PR, skipping')
      continue
    }

    const [, org, repoName, prNumber] = prMatch
    const repo = `${org}/${repoName}`

    // Guess agent from title or branch
    const agentName = guessAgent(attachment.title || '', attachment.subtitle)

    // Parse status from subtitle
    let status = 'open'
    let mergedAt: Date | undefined

    if (attachment.subtitle?.includes('merged')) {
      status = 'merged'
      mergedAt = new Date()
    } else if (attachment.subtitle?.includes('closed')) {
      status = 'closed'
    }

    console.log(`   🤖 Agent: ${agentName}`)
    console.log(`   📊 Status: ${status}`)

    // Create attempt
    await db
      .insert(attempts)
      .values({
        issueId: dbIssueId,
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
      .onConflictDoNothing({
        target: [attempts.issueId, attempts.agentName, attempts.prNumber],
      })

    console.log('   ✅ Attempt created')
  }

  console.log('\n✨ Done!')
}

function guessAgent(title: string, subtitle?: string | null): string {
  const source = (subtitle ?? title).toLowerCase()
  if (source.includes('cursor')) return 'cursor'
  if (source.includes('engine')) return 'engine'
  if (source.includes('cyrus')) return 'cyrus'
  if (source.includes('claude')) return 'claude'
  return 'unknown'
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
