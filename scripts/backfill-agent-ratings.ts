#!/usr/bin/env tsx
/**
 * Backfill agent ratings for all completed issues.
 * Processes issues in chronological order to build accurate rating history.
 */

import 'dotenv/config'
import { db } from '../src/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '../src/db/schema'
import { eq, isNotNull, asc } from 'drizzle-orm'
import { updateRatingsForIssue } from '../src/lib/update-ratings'

async function main() {
  console.log('🔄 Backfilling agent ratings for completed issues...\n')

  // Clear existing scores and history
  console.log('Clearing existing ratings...')
  await db.delete(agentScoreHistory)
  await db.delete(agentScores)

  // Reset to defaults
  await db.insert(agentScores).values([
    { agentName: 'cursor', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    { agentName: 'engine', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    { agentName: 'cyrus', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
    { agentName: 'factory', mu: 25, sigma: 8.333, ordinal: 0, gamesPlayed: 0 },
  ])
  console.log('✅ Reset agent scores to defaults\n')

  // Fetch all issues with merged PRs (completed issues)
  const completedIssues = await db
    .select({ id: issues.id, linearKey: issues.linearKey })
    .from(issues)
    .innerJoin(attempts, eq(issues.id, attempts.issueId))
    .where(eq(attempts.status, 'merged'))
    .groupBy(issues.id, issues.linearKey)
    .orderBy(asc(issues.createdAt))

  console.log(`Found ${completedIssues.length} completed issues\n`)

  let processed = 0
  let errors = 0

  for (const issue of completedIssues) {
    try {
      console.log(`Processing ${issue.linearKey}...`)
      await updateRatingsForIssue(issue.id)
      processed++
      console.log(`✅ ${issue.linearKey} ratings updated\n`)
    } catch (error) {
      console.error(`❌ Error processing ${issue.linearKey}:`, error)
      errors++
    }

    // Rate limit: 50ms between updates
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n📊 Backfill complete!')
  console.log(`   Processed: ${processed}`)
  console.log(`   Errors: ${errors}`)

  // Show final ratings
  const finalScores = await db.select().from(agentScores)
  console.log('\n🏆 Final Agent Ratings:')
  for (const score of finalScores) {
    console.log(
      `   ${score.agentName}: ${score.ordinal.toFixed(0)} (mu=${score.mu.toFixed(2)}, sigma=${score.sigma.toFixed(2)}, games=${score.gamesPlayed})`
    )
  }
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error)
  process.exit(1)
})
