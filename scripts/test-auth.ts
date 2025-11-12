#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk'

const apiKey = 'REDACTED_REVOKE_BEFORE_USE'

console.log('API Key loaded:', apiKey ? 'YES' : 'NO')
console.log('API Key length:', apiKey.length)

const client = new LinearClient({ apiKey })

async function test() {
  try {
    console.log('\n1. Testing viewer authentication...')
    const viewer = await client.viewer
    console.log('✅ Authenticated as:', viewer.displayName, viewer.email)
    
    console.log('\n2. Testing issue fetch...')
    const issue = await client.issue('e7376814-a82e-48a4-bea7-55a263f88a09')
    console.log('✅ Issue:', issue.identifier, '-', issue.title)
    
    console.log('\n3. Testing comments...')
    const comments = await issue.comments()
    console.log('✅ Comments found:', comments.nodes.length)
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error('Error type:', error.type)
    console.error('Status:', error.status)
  }
}

test()
