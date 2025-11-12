#!/usr/bin/env tsx
/**
 * Test syncIssueFromLinear directly
 */

import { syncIssueFromLinear } from '@/lib/linear-sync'

const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320

async function main() {
  console.log('🔍 Testing syncIssueFromLinear...\n')

  try {
    await syncIssueFromLinear(ISSUE_ID)
    console.log('\n✅ Sync completed successfully')
  } catch (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
