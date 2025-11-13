#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues, issueAgents } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  const issue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearKey, 'ENG-901'))
    .limit(1)

  if (issue.length === 0) {
    console.log('ENG-901 not found in database')
    return
  }

  console.log('Issue:', issue[0]!.linearKey, issue[0]!.title)
  console.log('Status:', issue[0]!.status)
  console.log('Linear ID:', issue[0]!.linearId)

  const agents = await db
    .select()
    .from(issueAgents)
    .where(eq(issueAgents.issueId, issue[0]!.id))

  console.log('\nAgents:', agents.length)
  agents.forEach((a) => console.log('  -', a.agentName, a.status))
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
