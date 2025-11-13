#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues, attempts, issueAgents } from '../src/db/schema.js'

async function main() {
  const allIssues = await db.select().from(issues)
  const allAttempts = await db.select().from(attempts)
  const allAgents = await db.select().from(issueAgents)

  console.log('Current database state:')
  console.log('Issues:', allIssues.length)
  allIssues.forEach((issue) => {
    console.log(`  - ${issue.linearKey}: ${issue.title}`)
  })
  console.log('Attempts:', allAttempts.length)
  console.log('Agents:', allAgents.length)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
