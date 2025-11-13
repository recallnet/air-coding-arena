/**
 * Check Linear user details to understand the @engine mention
 */

import { LinearClient } from '@linear/sdk'

const ENGINE_USER_ID = '039e79a0-9e12-4000-9359-72957e5b02e2'

async function checkLinearUser(): Promise<void> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not found')
  }

  const client = new LinearClient({ apiKey })

  try {
    console.log('🔍 Checking Linear user details...\n')

    const user = await client.user(ENGINE_USER_ID)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('👤 User Details')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`ID: ${user.id}`)
    console.log(`Name: ${user.name}`)
    console.log(`Display Name: ${user.displayName}`)
    console.log(`Email: ${user.email ?? 'N/A'}`)
    console.log(`Active: ${user.active}`)
    console.log(`Admin: ${user.admin}`)
    console.log(`Bot: ${user.isMe ? 'Possibly (isMe=true)' : 'No'}`)
    console.log()

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💡 Analysis')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(
      'The @[engine] mention in Linear is a user mention, not a plain text'
    )
    console.log('agent handle like @cursor or @aider.')
    console.log()
    console.log('Linear mention format: @[username](user-id)')
    console.log(`Example: @[engine](${ENGINE_USER_ID})`)
    console.log()
    console.log('Expected agent handle format: @Engine or @engine')
    console.log('(plain text, case-insensitive)')
  } catch (error) {
    console.error('Error fetching user:', error)
  }
}

checkLinearUser().catch((error: Error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
