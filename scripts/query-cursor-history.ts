#!/usr/bin/env tsx
import 'dotenv/config'
import { db } from '../src/db/client'
import { agentScoreHistory } from '../src/db/schema'
import { eq, asc } from 'drizzle-orm'

async function main() {
  const history = await db
    .select()
    .from(agentScoreHistory)
    .where(eq(agentScoreHistory.agentName, 'cursor'))
    .orderBy(asc(agentScoreHistory.completedAt))
  
  console.log('Cursor Agent Score History:')
  console.log(JSON.stringify(history, null, 2))
}

main()
