#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues, attempts } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const issueData = await db
    .select({ id: issues.id, linearKey: issues.linearKey })
    .from(issues)
    .where(eq(issues.linearKey, 'ENG-320'))

  if (!issueData[0]) {
    console.log('Issue not found')
    return
  }

  console.log('Issue ID:', issueData[0].id)

  const attemptsData = await db
    .select({
      agentName: attempts.agentName,
      prUrl: attempts.prUrl,
      prNumber: attempts.prNumber,
      status: attempts.status,
    })
    .from(attempts)
    .where(eq(attempts.issueId, issueData[0].id))

  console.log('Attempts for ENG-320:', attemptsData.length)
  for (const a of attemptsData) {
    console.log('  -', a.agentName, ':', a.prUrl, '(PR #' + a.prNumber + ')')
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
