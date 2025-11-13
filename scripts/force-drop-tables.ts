import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL not set')
}

const client = postgres(process.env['DATABASE_URL'], { max: 1 })

async function forceDrop() {
  console.log('Force dropping agent_scores and agent_score_history...')
  await client.unsafe('DROP TABLE IF EXISTS agent_score_history CASCADE')
  await client.unsafe('DROP TABLE IF EXISTS agent_scores CASCADE')
  console.log('✅ Tables dropped')
  await client.end()
}

forceDrop().catch(console.error)
