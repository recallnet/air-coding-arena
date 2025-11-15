#!/usr/bin/env tsx
/**
 * Debug script - check agent statuses for ENG-954
 */
import 'dotenv/config'
import { db } from '../src/db/client'
import { issues, issueAgents } from '../src/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  console.log('🔍 Checking agent statuses for ENG-954...\n')

  // Find ENG-954 issue
  const issue = await db.query.issues.findFirst({
    where: (issues, { eq }) => eq(issues.linearKey, 'ENG-954'),
  })

  if (!issue) {
    console.log('❌ ENG-954 not found in database')
    return
  }

  console.log(`📋 Issue: ${issue.linearKey}`)
  console.log(`   Winner Attempt ID: ${issue.winnerAttemptId || 'NULL'}\n`)

  // Get all agents for this issue
  const agents = await db
    .select()
    .from(issueAgents)
    .where(eq(issueAgents.issueId, issue.id))

  console.log('🤖 Agents:')
  for (const agent of agents) {
    console.log(`   ${agent.agentName}: ${agent.status}`)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
