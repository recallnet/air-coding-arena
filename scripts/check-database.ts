#!/usr/bin/env tsx
/**
 * Check database state
 */

import { db } from '@/db/client'
import { issues, issueAgents, attempts } from '@/db/schema'

async function main() {
  console.log('📊 Checking database state...\n')

  // Check issues
  const issuesList = await db
    .select({
      linearKey: issues.linearKey,
      title: issues.title,
      status: issues.status,
      arenaReadyLabeledAt: issues.arenaReadyLabeledAt,
    })
    .from(issues)
  console.log(`📋 Issues: ${issuesList.length}`)
  for (const issue of issuesList) {
    console.log(`  - ${issue.linearKey}: ${issue.title}`)
    console.log(`    Status: ${issue.status}`)
    console.log(`    Arena ready: ${issue.arenaReadyLabeledAt}`)
  }

  // Check issue_agents
  const agentsList = await db.select().from(issueAgents)
  console.log(`\n👥 Issue Agents: ${agentsList.length}`)
  for (const agent of agentsList) {
    console.log(`  - ${agent.agentName} (${agent.status})`)
    console.log(`    Triggered at: ${agent.triggeredAt}`)
  }

  // Check attempts
  const attemptsList = await db.select().from(attempts)
  console.log(`\n🔄 Attempts: ${attemptsList.length}`)
  for (const attempt of attemptsList) {
    console.log(`  - ${attempt.agentName}: ${attempt.prUrl}`)
    console.log(`    Status: ${attempt.status}`)
    console.log(`    Opened: ${attempt.openedAt}`)
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
