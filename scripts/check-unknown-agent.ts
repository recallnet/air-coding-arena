#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { attempts } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const unknownAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.agentName, 'unknown'))

  console.log('Unknown agent attempts:', unknownAttempts.length)
  unknownAttempts.forEach((a) => {
    console.log('PR:', a.prUrl)
    console.log('  Issue ID:', a.issueId)
    console.log('  PR#:', a.prNumber)
    console.log('  Repo:', a.repo)
    console.log('  Source:', a.sourceAttachmentUrl ? 'attachment' : 'comment')
    console.log('')
  })
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
