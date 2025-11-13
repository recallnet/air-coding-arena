#!/usr/bin/env tsx
/**
 * Verify agent ratings schema was created successfully.
 */

import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env['DATABASE_URL'], {
  max: 1,
})

async function verify(): Promise<void> {
  console.log('🔍 Verifying agent ratings schema...\n')

  // Check if tables exist
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('agent_scores', 'agent_score_history')
    ORDER BY table_name
  `

  console.log('Tables found:', tables.map(t => t.table_name).join(', '))

  if (tables.length !== 2) {
    throw new Error('Expected 2 tables but found ' + tables.length)
  }

  // Check agent_scores structure
  const scoresColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'agent_scores'
    ORDER BY ordinal_position
  `

  console.log('\n📊 agent_scores columns:')
  scoresColumns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
  })

  // Check agent_score_history structure
  const historyColumns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'agent_score_history'
    ORDER BY ordinal_position
  `

  console.log('\n📈 agent_score_history columns:')
  historyColumns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
  })

  // Check initial data
  const scores = await sql`SELECT * FROM agent_scores ORDER BY agent_name`

  console.log('\n🎯 Initial agent scores:')
  scores.forEach(score => {
    console.log(`  - ${score.agent_name}: mu=${score.mu}, sigma=${score.sigma}, ordinal=${score.ordinal}, games=${score.games_played}`)
  })

  console.log('\n✅ Schema verification complete!')
}

void verify()
  .catch((error: unknown) => {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  })
  .finally(async (): Promise<void> => {
    await sql.end()
  })
