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

  console.log('Total comments:', comments.nodes.length)
  console.log('\nComments with PR #1559:')

  for (const comment of comments.nodes) {
    const body = comment.body ?? ''
    if (body.includes('1559')) {
      const commentAny = comment as any
      console.log('\n---')
      console.log('Comment ID:', comment.id)
      console.log('Parent ID:', commentAny.parentId ?? 'null')
      console.log('Created:', comment.createdAt)
      console.log('Body snippet:', body.substring(0, 150) + '...')

      // Check for agent mentions
      const mentions = ['@cursor', '@engine', '@cyrus', '@factory']
      const foundMentions = mentions.filter(m => body.toLowerCase().includes(m.toLowerCase()))
      console.log('Agent mentions:', foundMentions.length > 0 ? foundMentions : 'none')
    }
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
