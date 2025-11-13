/**
 * Reset database script - drops all tables and recreates from schema.
 * Use only in development/pre-v1.0 for breaking schema changes.
 */

import { sql as drizzleSql } from 'drizzle-orm'
import { db } from '../src/db/client.js'

async function resetDatabase(): Promise<void> {
  console.log('Dropping all tables...')

  // Drop all tables in the correct order (respecting foreign keys)
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS ci_metrics CASCADE'))
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS attempts CASCADE'))
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS issue_agents CASCADE'))
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS events CASCADE'))
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS issues CASCADE'))
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS agents CASCADE'))
  await db.execute(drizzleSql.raw('DROP TABLE IF EXISTS agent_config CASCADE'))

  console.log('All tables dropped.')
  console.log('Run "npm run db:push" to recreate tables from schema.ts')

  process.exit(0)
}

resetDatabase().catch((error) => {
  console.error('Failed to reset database:', error)
  process.exit(1)
})
