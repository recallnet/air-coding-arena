#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk'

async function main() {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    console.error('LINEAR_API_KEY not set in environment')
    process.exit(1)
  }

  const client = new LinearClient({ apiKey })

  // ENG-903 Linear ID (has unknown PR #1562)
  const linearIssueId = '2f4ef7d2-3339-4b01-8357-172ed7a98b5a'
  const issue = await client.issue(linearIssueId)
  const comments = await issue.comments()

  console.log(`Found ${comments.nodes.length} comments for ENG-903\n`)

  for (const comment of comments.nodes) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Comment ID:', comment.id)
    console.log('Body preview:', comment.body?.substring(0, 100).replace(/\n/g, ' '))
    console.log('Created:', comment.createdAt)

    // Try to access parent
    try {
      const parent = await comment.parent
      if (parent) {
        console.log('✅ Has parent! ID:', parent.id)
      } else {
        console.log('❌ No parent (root comment)')
      }
    } catch (error) {
      console.log('⚠️  Error getting parent:', error)
    }
    console.log('')
  }
}

main().catch(console.error)
