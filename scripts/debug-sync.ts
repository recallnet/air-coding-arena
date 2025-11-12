#!/usr/bin/env tsx
/**
 * Debug Linear sync to see what attachments exist
 */

import { LinearClient } from '@linear/sdk'

const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320

async function main() {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  console.log('🔍 Fetching issue from Linear API...\n')

  const client = new LinearClient({ apiKey })
  const issue = await client.issue(ISSUE_ID)

  console.log(`📋 Issue: ${issue.identifier} - ${issue.title}`)
  console.log(`   Status: ${issue.state?.name}`)
  console.log(`   URL: ${issue.url}\n`)

  // Get comments
  const comments = await issue.comments()
  console.log(`💬 Comments: ${comments.nodes.length}\n`)
  for (const comment of comments.nodes) {
    console.log(`Comment ${comment.id}:`)
    console.log(`  Body: ${comment.body?.substring(0, 100)}...`)
    console.log(`  User: ${comment.user?.name}`)
    console.log(`  Created: ${comment.createdAt}`)
    console.log(`  Bot actor: ${comment.botActor?.name}`)

    // Check for any URL or externalLinks fields
    const commentObj = comment as any
    if (commentObj.url) console.log(`  URL: ${commentObj.url}`)
    if (commentObj.externalLinks) console.log(`  External Links:`, commentObj.externalLinks)
    if (commentObj.externalUserCreator) console.log(`  External Creator:`, commentObj.externalUserCreator)

    // Look for GitHub PR patterns in body
    const prMatch = comment.body?.match(/github\.com\/[^/]+\/[^/]+\/pull\/\d+/g)
    if (prMatch) {
      console.log(`  ✅ Found GitHub PR URLs: ${prMatch.join(', ')}`)
    }
    console.log('')
  }

  // Get attachments
  const attachments = await issue.attachments()
  console.log(`\n📎 Attachments: ${attachments.nodes.length}`)
  for (const attachment of attachments.nodes) {
    console.log(`   - ${attachment.title}`)
    console.log(`     URL: ${attachment.url}`)
    console.log(`     Subtitle: ${attachment.subtitle}`)
    console.log(`     Created: ${attachment.createdAt}`)
    console.log(`     ID: ${attachment.id}`)
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
