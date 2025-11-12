#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues } from '../src/db/schema.js'

async function main() {
  console.log('Adding ENG-320 issue...')

  await db.insert(issues).values({
    linearId: 'e7376814-a82e-48a4-bea7-55a263f88a09',
    linearKey: 'ENG-320',
    title: "Drop `uuid` package usage for native `crypto` and UUID's",
    url: 'https://linear.app/recall-labs/issue/ENG-320',
    status: 'In Progress',
    arenaReadyLabeledAt: new Date(),
  })

  console.log('✅ Added ENG-320')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})
