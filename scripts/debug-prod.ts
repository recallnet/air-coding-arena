#!/usr/bin/env tsx
/**
 * Debug script - check production database state for ENG-954
 */
import 'dotenv/config'
import { db } from '../src/db/client'
import { issues, attempts, agentScoreHistory } from '../src/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  console.log('🔍 Checking production database state...\n')

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

  console.log('📋 Issue:', issue.linearKey, '-', issue.title)
  console.log('   Status:', issue.status)
  console.log('   Winner Attempt ID:', issue.winnerAttemptId || 'NULL')
  console.log('\n🎯 Attempts:')

  for (const attempt of issue.attempts) {
    console.log(`   PR #${attempt.prNumber} - ${attempt.agentName}`)
    console.log(`      Status: ${attempt.status}`)
    console.log(`      Opened: ${attempt.openedAt}`)
    console.log(`      Merged: ${attempt.mergedAt || 'NULL'}`)
    console.log(`      Closed: ${attempt.closedAt || 'NULL'}`)
    console.log('')
  }

  // Check agent_score_history
  console.log('📊 Score History:')
  const scores = await db
    .select()
    .from(agentScoreHistory)
    .where(eq(agentScoreHistory.issueId, issue.id))

  if (scores.length === 0) {
    console.log('   ❌ No score history entries found')
  } else {
    for (const score of scores) {
      console.log(`   ${score.agentName}: ordinal=${score.ordinal}, rank=${score.rank}`)
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
