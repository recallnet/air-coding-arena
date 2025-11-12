#!/usr/bin/env tsx
/**
 * Backfill Linear issue metadata for existing issues
 */

import { db } from '../src/db/client'
import { issues } from '../src/db/schema'
import { syncIssueFromLinear } from '../src/lib/linear-sync'

async function main() {
  console.log('🔄 Backfilling Linear issue metadata...\n')

  // Get all issues
  const allIssues = await db.select().from(issues)

  console.log(`Found ${allIssues.length} issues\n`)

  let updated = 0
  let errors = 0

  for (const issue of allIssues) {
    try {
      console.log(`Syncing ${issue.linearKey}...`)
      await syncIssueFromLinear(issue.linearId)
      updated++
      console.log(`✅ ${issue.linearKey} updated\n`)
    } catch (error) {
      console.error(`❌ Error syncing ${issue.linearKey}:`, error)
      errors++
    }

    // Rate limit: 50ms between requests
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('\n📊 Backfill complete!')
  console.log(`   Updated: ${updated}`)
  console.log(`   Errors: ${errors}`)
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error)
  process.exit(1)
})
