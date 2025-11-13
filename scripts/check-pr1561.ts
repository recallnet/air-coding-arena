#!/usr/bin/env tsx
// Set DATABASE_URL before importing db client
process.env['DATABASE_URL'] = 'postgresql://neondb_owner:REDACTED_REVOKE_BEFORE_USE@ep-misty-poetry-a4ukdnof-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

import { db } from '../src/db/client.js'
import { attempts, issueAgents, issues } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

async function main() {
  // Find ENG-901
  const issue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearKey, 'ENG-901'))
    .limit(1)

  if (issue.length === 0) {
    console.log('ENG-901 not found in database')
    return
  }

  console.log('━'.repeat(80))
  console.log('Issue: ENG-901')
  console.log('━'.repeat(80))
  console.log(`Title: ${issue[0]!.title}`)
  console.log(`Status: ${issue[0]!.status}`)
  console.log(`Linear ID: ${issue[0]!.linearId}`)
  console.log('')

  // Get all agents for this issue
  const agents = await db
    .select()
    .from(issueAgents)
    .where(eq(issueAgents.issueId, issue[0]!.id))

  console.log('━'.repeat(80))
  console.log(`Agents (${agents.length} total):`)
  console.log('━'.repeat(80))
  agents.forEach((a) => {
    console.log(`  ${a.agentName.padEnd(10)} - ${a.status.padEnd(10)} - triggered: ${a.triggeredAt}`)
  })
  console.log('')

  // Get all attempts for this issue
  const allAttempts = await db
    .select()
    .from(attempts)
    .where(eq(attempts.issueId, issue[0]!.id))

  console.log('━'.repeat(80))
  console.log(`Attempts (${allAttempts.length} total):`)
  console.log('━'.repeat(80))
  allAttempts.forEach((a) => {
    console.log(`  PR #${a.prNumber} - agent: ${a.agentName.padEnd(10)} - ${a.prUrl}`)
  })
  console.log('')

  // Find PR #1561 specifically
  const pr1561 = allAttempts.find(a => a.prNumber === 1561)

  if (pr1561) {
    console.log('━'.repeat(80))
    console.log('PR #1561 Details:')
    console.log('━'.repeat(80))
    console.log(`Agent: ${pr1561.agentName}`)
    console.log(`Status: ${pr1561.status}`)
    console.log(`Repo: ${pr1561.repo}`)
    console.log(`URL: ${pr1561.prUrl}`)
    console.log(`Opened: ${pr1561.openedAt}`)
    console.log('')

    if (pr1561.agentName === 'unknown') {
      console.log('⚠️  PR #1561 is attributed to "unknown" agent')
      console.log('   This indicates the parent chain detection is not working')
    } else {
      console.log(`✅ PR #1561 is attributed to "${pr1561.agentName}" agent`)
    }
  } else {
    console.log('⚠️  PR #1561 not found in attempts table')
  }

  console.log('━'.repeat(80))

  process.exit(0)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
