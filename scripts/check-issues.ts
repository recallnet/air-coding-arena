#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues } from '../src/db/schema.js'

async function main() {
  const results = await db.select().from(issues)

  console.log('=== ALL ISSUES ===\n')
  for (const issue of results) {
    console.log(`${issue.linearKey || 'NO-KEY'}: ${issue.status}`)
    console.log(`  Title: ${issue.title}`)
    console.log(`  ID: ${issue.id}`)
    console.log()
  }

  console.log(`Total: ${results.length} issues`)
}

main().catch(console.error)
