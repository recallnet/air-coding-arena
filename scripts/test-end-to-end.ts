#!/usr/bin/env tsx
/**
 * End-to-end test of state machine and sync logic
 * Tests: Remove and add ar label to trigger full sync
 */

import { LinearClient } from '@linear/sdk'

const LINEAR_API_KEY = process.env['LINEAR_API_KEY']
const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320
const LABEL_NAME = 'ar'

async function main() {
  if (!LINEAR_API_KEY) {
    console.error('❌ LINEAR_API_KEY not set')
    process.exit(1)
  }

  const client = new LinearClient({ apiKey: LINEAR_API_KEY })

  console.log('🔍 Fetching issue ENG-320...')
  const issue = await client.issue(ISSUE_ID)
  console.log(`📋 ${issue.identifier} - ${issue.title}`)

  // Get current labels
  const currentLabels = await issue.labels()
  const currentLabelIds = currentLabels.nodes.map((l) => l.id)
  console.log(`🏷️  Current labels: ${currentLabels.nodes.map((l) => l.name).join(', ')}`)

  // Get ar label
  const allLabels = await client.issueLabels()
  const arLabel = allLabels.nodes.find((l) => l.name === LABEL_NAME)
  if (!arLabel) {
    console.error(`❌ Label "${LABEL_NAME}" not found`)
    process.exit(1)
  }

  // Check if ar label is present
  const hasArLabel = currentLabelIds.includes(arLabel.id)

  if (hasArLabel) {
    console.log(`\n🗑️  Removing "${LABEL_NAME}" label...`)
    const newLabelIds = currentLabelIds.filter((id) => id !== arLabel.id)
    await client.updateIssue(ISSUE_ID, {
      labelIds: newLabelIds,
    })
    console.log('✅ Label removed')
    console.log('⏱️  Waiting 3 seconds for webhook...')
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  console.log(`\n➕ Adding "${LABEL_NAME}" label...`)
  const labelIds = currentLabelIds.filter((id) => id !== arLabel.id)
  labelIds.push(arLabel.id)
  await client.updateIssue(ISSUE_ID, {
    labelIds,
  })
  console.log('✅ Label added')
  console.log('⏱️  Waiting 5 seconds for webhook and sync...')
  await new Promise((resolve) => setTimeout(resolve, 5000))

  console.log('\n✨ Test complete!')
  console.log('\nExpected behavior:')
  console.log('1. Webhook received for label add')
  console.log('2. Issue upserted to database')
  console.log('3. Full sync triggered from Linear API')
  console.log('4. All comments parsed for agent mentions')
  console.log('5. All attachments synced to attempts table')
  console.log('\nCheck database to verify:')
  console.log('- Issue in "issues" table')
  console.log('- Agents in "issue_agents" table with status=pending')
  console.log('- PRs in "attempts" table')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
