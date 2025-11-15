#!/usr/bin/env tsx
import 'dotenv/config'
import { db } from '../src/db/client'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('📊 Checking actual status values in database...\n')

  const statuses = await db.execute<{ status: string; count: number }>(
    sql`SELECT status, COUNT(*) as count FROM issues GROUP BY status ORDER BY status`
  )

  console.log('Status values found:')
  for (const row of statuses) {
    console.log(`  "${row.status}": ${row.count} issues`)
  }
}

main().catch(console.error)
