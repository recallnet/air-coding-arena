#!/usr/bin/env tsx
import { syncIssueFromLinear } from '../src/lib/linear-sync.js'

const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320

async function main() {
  console.log(`🔄 Syncing issue ${ISSUE_ID}...`)
  await syncIssueFromLinear(ISSUE_ID)
  console.log('✅ Sync complete')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
