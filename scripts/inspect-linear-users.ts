import { LinearClient } from '@linear/sdk'

async function inspectUsers() {
  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) {
    console.error('LINEAR_API_KEY not set')
    process.exit(1)
  }

  const client = new LinearClient({ apiKey })

  console.log('Fetching all users from Linear workspace...\n')
  const users = await client.users()

  console.log(`Found ${users.nodes.length} total users\n`)
  console.log('='.repeat(80))

  for (const user of users.nodes) {
    console.log(`\nUser: ${user.displayName}`)
    console.log(`  ID: ${user.id}`)
    console.log(`  Name: ${user.name}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Active: ${user.active}`)
    console.log(`  Admin: ${user.admin}`)
    console.log(`  Created: ${user.createdAt}`)
    console.log(`  Avatar URL: ${user.avatarUrl || 'none'}`)

    // Check for any fields that might indicate bot/agent status
    const userObj = user as any
    console.log(`  Guest: ${userObj.guest ?? 'undefined'}`)
    console.log(`  IsMe: ${userObj.isMe ?? 'undefined'}`)
    console.log(`  ArchivedAt: ${userObj.archivedAt ?? 'null'}`)

    // Print all available fields
    console.log(`  All fields: ${Object.keys(user).join(', ')}`)

    // Look for agent-like names
    const lowerName = user.displayName.toLowerCase()
    const lowerEmail = (user.email || '').toLowerCase()
    const possibleAgent =
      lowerName.includes('cursor') ||
      lowerName.includes('engine') ||
      lowerName.includes('foundry') ||
      lowerName.includes('agent') ||
      lowerName.includes('bot') ||
      lowerName.includes('ai')

    if (possibleAgent) {
      console.log(`  >>> POSSIBLE AGENT (based on name)`)
    }

    console.log('-'.repeat(80))
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  const possibleAgents = users.nodes.filter(u => {
    const lowerName = u.displayName.toLowerCase()
    return lowerName.includes('cursor') ||
           lowerName.includes('engine') ||
           lowerName.includes('foundry') ||
           lowerName.includes('agent') ||
           lowerName.includes('bot') ||
           lowerName.includes('ai')
  })

  console.log(`\nTotal users: ${users.nodes.length}`)
  console.log(`Possible agents (by name): ${possibleAgents.length}`)
  console.log('\nPossible agent names:')
  for (const agent of possibleAgents) {
    console.log(`  - ${agent.displayName} (${agent.email || 'no email'})`)
  }
}

inspectUsers().catch(console.error)
