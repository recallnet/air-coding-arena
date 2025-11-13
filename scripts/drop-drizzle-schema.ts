import { db } from '../src/db/client'
import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL not set')
}

const client = postgres(process.env['DATABASE_URL'], { max: 1 })

async function drop() {
  await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
  console.log('✅ Dropped drizzle schema')
  await client.end()
}

drop().catch(console.error)
