#!/usr/bin/env tsx
/**
 * Fix agent statuses for ENG-954
 * cursor should be 'accepted', engine should be 'rejected'
 */
import 'dotenv/config'
import { db } from '../src/db/client'
import { issues, issueAgents, attempts } from '../src/db/schema'
import { eq, and } from 'drizzle-orm'

async function main() {
  console.log('🔧 Fixing agent statuses for ENG-954...\n')

  // Find ENG-954 issue
  const issue = await db.query.issues.findFirst({
    where: (issues, { eq }) => eq(issues.linearKey, 'ENG-954'),
    with: {
      attempts: true,
    },
  })

  if (!issue) {
    console.log('❌ ENG-954 not found in database')
    return
  }

  if (!issue.winnerAttemptId) {
    console.log('❌ No winner set for ENG-954')
    return
  }

  // Find the winning agent
  const winnerAttempt = issue.attempts.find(
    (a) => a.id === issue.winnerAttemptId
  )

  if (!winnerAttempt) {
    console.log('❌ Winner attempt not found')
    return
  }

  console.log(`Winner: ${winnerAttempt.agentName}\n`)

  // Mark winning agent as accepted
  await db
    .update(issueAgents)
    .set({ status: 'accepted' })
    .where(
      and(
        eq(issueAgents.issueId, issue.id),
        eq(issueAgents.agentName, winnerAttempt.agentName)
      )
    )
  console.log(`✅ Marked ${winnerAttempt.agentName} as accepted`)

  // Mark all other submitted agents as rejected
  const rejected = await db
    .update(issueAgents)
    .set({ status: 'rejected' })
    .where(
      and(
        eq(issueAgents.issueId, issue.id),
        eq(issueAgents.status, 'submitted')
      )
    )
    .returning({ agentName: issueAgents.agentName })

  for (const agent of rejected) {
    console.log(`✅ Marked ${agent.agentName} as rejected`)
  }

  console.log('\n🎉 Agent statuses fixed!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
