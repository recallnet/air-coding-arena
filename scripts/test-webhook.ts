#!/usr/bin/env tsx
/**
 * Test Linear webhook by adding/removing label via API
 */

import { LinearClient } from '@linear/sdk'

const LINEAR_API_KEY = process.env['LINEAR_API_KEY']
const ISSUE_ID = 'e7376814-a82e-48a4-bea7-55a263f88a09' // ENG-320
const LABEL_NAME = 'ar'

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not set')
  process.exit(1)
}

async function main() {
  const client = new LinearClient({ apiKey: LINEAR_API_KEY })

  console.log('🔍 Fetching issue...')
  const issue = await client.issue(ISSUE_ID)

  console.log(`📋 Issue: ${issue.identifier} - ${issue.title}`)

  // Get current labels
  const labels = await issue.labels()
  const labelNames = labels.nodes.map((l) => l.name)
  console.log(`🏷️  Current labels: ${labelNames.join(', ') || 'none'}`)

  // Find the 'ar' label in the workspace
  const allLabels = await client.issueLabels()
  const arLabel = allLabels.nodes.find((l) => l.name === LABEL_NAME)

  if (!arLabel) {
    console.error(`❌ Label "${LABEL_NAME}" not found in workspace`)
    process.exit(1)
  }

  const hasLabel = labelNames.includes(LABEL_NAME)

  if (hasLabel) {
    console.log(`➖ Removing label "${LABEL_NAME}"...`)
    const newLabelIds = labels.nodes
      .filter((l) => l.name !== LABEL_NAME)
      .map((l) => l.id)
    await client.updateIssue(ISSUE_ID, { labelIds: newLabelIds })
    console.log('✅ Label removed')
    console.log('⏳ Waiting 2 seconds...')
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`➕ Adding label "${LABEL_NAME}"...`)
  const currentLabelIds = (await issue.labels()).nodes.map((l) => l.id)
  await client.updateIssue(ISSUE_ID, {
    labelIds: [...currentLabelIds, arLabel.id],
  })
  console.log('✅ Label added')

  console.log('\n✨ Done! Check the database for the issue.')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
