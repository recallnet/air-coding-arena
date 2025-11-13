#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { attempts, issueAgents, issues } from '../src/db/schema.js'

async function main() {
  const allIssues = await db.select().from(issues)
  const allAgents = await db.select().from(issueAgents)
  const allAttempts = await db.select().from(attempts)

  console.log('=== ISSUES ===')
  console.log(`Total: ${allIssues.length}`)
  for (const issue of allIssues) {
    console.log(`  ${issue.identifier} - ${issue.title}`)
  }

  console.log('\n=== ISSUE AGENTS ===')
  console.log(`Total: ${allAgents.length}`)
  const byIssue = new Map<string, string[]>()
  for (const agent of allAgents) {
    const issue = allIssues.find((i) => i.id === agent.issueId)
    const identifier = issue?.identifier ?? 'unknown'
    if (!byIssue.has(identifier)) {
      byIssue.set(identifier, [])
    }
    byIssue.get(identifier)?.push(`${agent.agentName} (${agent.status})`)
  }
  for (const [identifier, agents] of byIssue.entries()) {
    console.log(`  ${identifier}: ${agents.join(', ')}`)
  }

  console.log('\n=== ATTEMPTS ===')
  console.log(`Total: ${allAttempts.length}`)
  if (allAttempts.length > 0) {
    for (const a of allAttempts) {
      console.log(`  PR #${a.prNumber} - ${a.agentName} - ${a.prUrl}`)
    }
  } else {
    console.log('  (none)')
  }
}

main().catch(console.error)
