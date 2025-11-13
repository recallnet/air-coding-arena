#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issueAgents, issues } from '../src/db/schema.js'

async function main() {
  const allIssues = await db.select().from(issues)
  const allAgents = await db.select().from(issueAgents)

  console.log('=== ISSUE AGENTS BY ISSUE ===\n')

  for (const issue of allIssues) {
    const agents = allAgents.filter(a => a.issueId === issue.id)
    console.log(`${issue.identifier || 'unknown'} (${issue.id}):`)

    // Group by agent name
    const byAgent = new Map<string, typeof agents>()
    for (const agent of agents) {
      if (!byAgent.has(agent.agentName)) {
        byAgent.set(agent.agentName, [])
      }
      byAgent.get(agent.agentName)?.push(agent)
    }

    for (const [agentName, entries] of byAgent.entries()) {
      if (entries.length > 1) {
        console.log(`  ❌ ${agentName}: ${entries.length} entries (DUPLICATE!)`)
        for (const entry of entries) {
          console.log(`     - status: ${entry.status}, triggered: ${entry.triggeredAt}`)
        }
      } else {
        console.log(`  ✅ ${agentName}: 1 entry (status: ${entries[0]?.status})`)
      }
    }
    console.log('')
  }

  // Summary
  const duplicates = allAgents.filter(agent => {
    const sameIssueAndAgent = allAgents.filter(
      a => a.issueId === agent.issueId && a.agentName === agent.agentName
    )
    return sameIssueAndAgent.length > 1
  })

  console.log('=== SUMMARY ===')
  console.log(`Total issue_agents entries: ${allAgents.length}`)
  console.log(`Entries with duplicates: ${duplicates.length}`)
  console.log(`Expected entries (4 issues × 4 agents): 16`)
}

main().catch(console.error)
