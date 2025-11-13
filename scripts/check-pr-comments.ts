#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { attempts, issues } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const unknownAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.agentName, 'unknown'))

  for (const attempt of unknownAttempts) {
    console.log(`\nPR #${attempt.prNumber}: ${attempt.prUrl}`)
    console.log(`Issue ID: ${attempt.issueId}`)

    // Get issue details
    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, attempt.issueId))
      .limit(1)

    if (issue[0]) {
      console.log(`Issue: ${issue[0].linearKey} - ${issue[0].title}`)
      console.log(`Linear URL: ${issue[0].url}`)
    }
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
