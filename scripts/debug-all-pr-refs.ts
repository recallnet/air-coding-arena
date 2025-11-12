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
  const attachments = await issue.attachments()

  console.log('=== SEARCHING FOR PR #1559 ===\n')

  console.log('COMMENTS:')
  let commentCount = 0
  for (const comment of comments.nodes) {
    const body = comment.body ?? ''
    const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
    let prMatch: RegExpExecArray | null

    while ((prMatch = prRegex.exec(body)) !== null) {
      const [, org, repoName, prNumber] = prMatch
      if (prNumber === '1559') {
        commentCount++
        const commentAny = comment as any
        console.log(`  Comment ${commentCount}:`)
        console.log(`    ID: ${comment.id}`)
        console.log(`    Parent ID: ${commentAny.parentId ?? 'null'}`)
        console.log(`    Body snippet: ${body.substring(0, 100)}...`)
      }
    }
  }

  console.log(`\nTotal comments with PR #1559: ${commentCount}`)

  console.log('\nATTACHMENTS:')
  let attachmentCount = 0
  for (const attachment of attachments.nodes) {
    const url = attachment.url ?? ''
    if (url.includes('1559')) {
      attachmentCount++
      console.log(`  Attachment ${attachmentCount}:`)
      console.log(`    ID: ${attachment.id}`)
      console.log(`    URL: ${url}`)
      console.log(`    Title: ${attachment.title ?? 'null'}`)
      console.log(`    Subtitle: ${attachment.subtitle ?? 'null'}`)
    }
  }

  console.log(`\nTotal attachments with PR #1559: ${attachmentCount}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
