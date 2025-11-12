#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk'

const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320

async function main() {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  const client = new LinearClient({ apiKey })
  const issue = await client.issue(ISSUE_ID)
  const comments = await issue.comments()

  console.log('Looking for PR #1559 comment...\n')

  for (const comment of comments.nodes) {
    const body = comment.body ?? ''
    if (body.includes('1559')) {
      console.log('=== FULL COMMENT BODY ===')
      console.log(body)
      console.log('\n=== ANALYSIS ===')
      console.log('Contains "cursor":', body.toLowerCase().includes('cursor'))
      console.log('Contains "engine":', body.toLowerCase().includes('engine'))
      console.log('Contains "cyrus":', body.toLowerCase().includes('cyrus'))
      console.log('Contains "factory":', body.toLowerCase().includes('factory'))
    }
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
