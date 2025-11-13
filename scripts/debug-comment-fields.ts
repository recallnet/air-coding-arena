#!/usr/bin/env tsx
import 'dotenv/config'
import { LinearClient } from '@linear/sdk'

async function main() {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not set')
  }

  const client = new LinearClient({ apiKey })

  // ENG-901 has the unknown PR issue
  const linearIssueId = 'e7376814-a82e-48a4-bea7-55a263f88a09'
  const issue = await client.issue(linearIssueId)
  const comments = await issue.comments()

  console.log(`Found ${comments.nodes.length} comments for ENG-901\n`)

  for (const comment of comments.nodes) {
    const commentAny = comment as any
    console.log('Comment ID:', comment.id)
    console.log('  Body:', comment.body?.substring(0, 80))
    console.log('  Created:', comment.createdAt)
    console.log('  Keys:', Object.keys(commentAny).filter(k => k.includes('parent') || k.includes('Parent')))

    // Try to access parent
    if (commentAny.parent) {
      console.log('  parent exists:', typeof commentAny.parent)
      if (typeof commentAny.parent === 'function') {
        const parentData = await commentAny.parent
        console.log('  parent ID:', parentData?.id)
      } else {
        console.log('  parent value:', commentAny.parent)
      }
    }

    if (commentAny.parentId) {
      console.log('  parentId:', commentAny.parentId)
    }

    console.log('')
  }
}

main().catch(console.error)
