#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues, issueAgents, attempts } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const linearId = 'e7376814-a82e-48a4-bea7-55a263f88a09'

  console.log('Finding issue...')
  const issue = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.linearId, linearId))
    .limit(1)

  if (!issue[0]) {
    console.log('Issue not found')
    return
  }

  const issueId = issue[0].id

  console.log('Deleting attempts...')
  await db.delete(attempts).where(eq(attempts.issueId, issueId))

  console.log('Deleting issue agents...')
  await db.delete(issueAgents).where(eq(issueAgents.issueId, issueId))

  console.log('Deleting issue...')
  await db.delete(issues).where(eq(issues.id, issueId))

  console.log('✅ Cleared ENG-320 data')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
