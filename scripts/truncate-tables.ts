#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { attempts, ciMetrics, issueAgents, issues } from '../src/db/schema.js'

async function main() {
  console.log('Truncating all tables...')

  // Delete in reverse dependency order
  await db.delete(ciMetrics)
  console.log('✓ Deleted ci_metrics')

  await db.delete(attempts)
  console.log('✓ Deleted attempts')

  await db.delete(issueAgents)
  console.log('✓ Deleted issue_agents')

  await db.delete(issues)
  console.log('✓ Deleted issues')

  console.log('\nAll tables truncated successfully!')
}

main().catch((error) => {
  console.error('Error truncating tables:', error)
  process.exit(1)
})
