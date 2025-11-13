#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { attempts } from '../src/db/schema.js'

async function main() {
  const allAttempts = await db.select().from(attempts)

  console.log(`Total attempts: ${allAttempts.length}`)

  if (allAttempts.length > 0) {
    console.log('\nAttempts by agent:')
    const byAgent = new Map<string, number>()
    for (const a of allAttempts) {
      byAgent.set(a.agentName, (byAgent.get(a.agentName) || 0) + 1)
    }
    for (const [agent, count] of byAgent.entries()) {
      console.log(`  ${agent}: ${count}`)
    }

    console.log('\nAll attempts:')
    for (const a of allAttempts) {
      console.log(`  PR #${a.prNumber} - ${a.agentName} - ${a.prUrl}`)
    }
  }
}

main().catch(console.error)
