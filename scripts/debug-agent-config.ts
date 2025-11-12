#!/usr/bin/env tsx
import { getAgentConfigs, getAgentHandles, getAgentNames } from '../src/lib/agent-config.js'

async function main() {
  console.log('=== AGENT CONFIGURATION ===\n')

  const configs = getAgentConfigs()
  console.log('Agent Configs:')
  for (const config of configs) {
    console.log(`  - name: "${config.name}", handle: "${config.handle}"`)
    console.log(`    handle.substring(1): "${config.handle.substring(1)}"`)
  }

  console.log('\nAgent Handles:', getAgentHandles())
  console.log('Agent Names:', getAgentNames())
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
