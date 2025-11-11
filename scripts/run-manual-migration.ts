#!/usr/bin/env tsx
/**
 * Manual migration runner for SQL that Drizzle doesn't handle.
 * Runs SQL files from drizzle/manual-migrations/ in order.
 *
 * @example
 * ```bash
 * npm run db:migrate:manual
 * ```
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const client = postgres(process.env['DATABASE_URL'], {
  max: 1,
})

async function runManualMigrations(): Promise<void> {
  const migrationsDir = join(process.cwd(), 'drizzle', 'manual-migrations')
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  console.log('🔧 Running manual migrations...\n')

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const sql = readFileSync(filePath, 'utf-8')

    console.log(`▶ Running: ${file}`)
    try {
      await client.unsafe(sql)
      console.log(`✅ Success: ${file}\n`)
    } catch (error) {
      console.error(`❌ Failed: ${file}`)
      console.error(error)
      throw error
    }
  }

  console.log('✅ All manual migrations completed')
}

void runManualMigrations()
  .catch((error: unknown) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async (): Promise<void> => {
    await client.end()
  })
