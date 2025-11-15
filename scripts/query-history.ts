#!/usr/bin/env tsx
import 'dotenv/config'
import { db } from '../src/db/client'
import { agentScoreHistory } from '../src/db/schema'
import { eq, asc } from 'drizzle-orm'

async function main() {
  console.log('🔍 Querying cursor agent score history...\n')
  
  const history = await db
    .select()
    .from(agentScoreHistory)
    .where(eq(agentScoreHistory.agentName, 'cursor'))
    .orderBy(asc(agentScoreHistory.completedAt))
  
  if (history.length === 0) {
    console.log('No score history found for cursor agent')
  } else {
    console.log(`Found ${history.length} score history entries:\n`)
    for (const entry of history) {
      console.log(`Issue: ${entry.issueId}`)
      console.log(`  Ordinal: ${entry.ordinal}`)
      console.log(`  Rank: ${entry.rank}`)
      console.log(`  Completed: ${entry.completedAt}`)
      console.log('')
    }
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
