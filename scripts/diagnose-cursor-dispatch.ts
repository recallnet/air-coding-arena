/**
 * Diagnostic script to investigate why Cursor agent wasn't dispatched to ENG-901
 * Linear ID: ca76c613-cf9d-478c-beaa-ca17f4fc3f04
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables from .env.local BEFORE any imports that depend on them
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const [key, ...valueParts] = trimmed.split('=')
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim()
  }
})

// Now import modules that depend on environment variables
const { LinearClient } = await import('@linear/sdk')
const { eq } = await import('drizzle-orm')
const { db } = await import('@/db/client')
const { issues, issueAgents } = await import('@/db/schema')
const { getAgentConfigs, getAgentNames } = await import('@/lib/agent-config')

const LINEAR_ISSUE_ID = 'ca76c613-cf9d-478c-beaa-ca17f4fc3f04'

async function findLinearUserByDisplayName(
  client: LinearClient,
  displayName: string
): Promise<string | null> {
  try {
    const usersResponse = await client.users()
    const users = usersResponse.nodes

    const user = users.find(
      (u) => u.displayName?.toLowerCase() === displayName.toLowerCase()
    )

    return user?.id ?? null
  } catch (error) {
    console.error(`Failed to look up user ${displayName}:`, error)
    return null
  }
}

async function diagnose() {
  console.log('=== CURSOR DISPATCH DIAGNOSTIC REPORT ===\n')
  console.log('Issue: ENG-901')
  console.log(`Linear ID: ${LINEAR_ISSUE_ID}\n`)

  // 1. Check if issue exists in database
  console.log('1. DATABASE ISSUE LOOKUP')
  console.log('─────────────────────────')
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearId, LINEAR_ISSUE_ID))
    .limit(1)

  if (!dbIssue[0]) {
    console.log('❌ FINDING: Issue not found in database')
    return
  }

  const issue = dbIssue[0]
  console.log(`✅ Issue found in database`)
  console.log(`   DB ID: ${issue.id}`)
  console.log(`   Linear Key: ${issue.linearKey}`)
  console.log(`   Status: ${issue.status}`)
  console.log(`   Title: ${issue.title}\n`)

  // 2. Check issue status eligibility
  console.log('2. ISSUE STATUS CHECK')
  console.log('─────────────────────────')
  const status = issue.status?.toLowerCase() ?? ''
  const eligibleStatuses = ['open', 'in progress', 'in_progress']
  const isEligible = eligibleStatuses.includes(status)

  console.log(`   Current status: "${issue.status}"`)
  console.log(`   Normalized: "${status}"`)
  console.log(`   Eligible statuses: ${eligibleStatuses.join(', ')}`)

  if (isEligible) {
    console.log('✅ Status is eligible for dispatch\n')
  } else {
    console.log('❌ FINDING: Status is NOT eligible for dispatch')
    console.log('   ROOT CAUSE: Issue status prevents agent dispatch\n')
    return
  }

  // 3. Check AGENTS_CONFIG_JSON
  console.log('3. AGENTS CONFIGURATION')
  console.log('─────────────────────────')
  const agentConfigsJson = process.env['AGENTS_CONFIG_JSON']

  if (!agentConfigsJson) {
    console.log('❌ FINDING: AGENTS_CONFIG_JSON environment variable not set')
    console.log('   ROOT CAUSE: Agent configuration missing\n')
    return
  }

  console.log('✅ AGENTS_CONFIG_JSON is set')

  let parsedConfig
  try {
    parsedConfig = JSON.parse(agentConfigsJson)
    console.log(`   Raw config length: ${agentConfigsJson.length} chars`)
    console.log(`   Parsed successfully: ${Array.isArray(parsedConfig) ? parsedConfig.length : 'N/A'} agents`)
  } catch (error) {
    console.log('❌ FINDING: AGENTS_CONFIG_JSON is invalid JSON')
    console.log('   ROOT CAUSE: Configuration parse error')
    console.log(`   Error: ${error}\n`)
    return
  }

  const configuredAgents = getAgentNames()
  console.log(`   Configured agents: ${configuredAgents.join(', ')}`)

  const hasCursor = configuredAgents.includes('cursor')
  if (hasCursor) {
    console.log('✅ Cursor is in agent configuration\n')
  } else {
    console.log('❌ FINDING: Cursor is NOT in agent configuration')
    console.log('   ROOT CAUSE: AGENTS_CONFIG_JSON missing Cursor agent\n')
    return
  }

  // 4. Check dispatched agents in database
  console.log('4. DISPATCHED AGENTS')
  console.log('─────────────────────────')
  const dispatchedAgents = await db
    .select()
    .from(issueAgents)
    .where(eq(issueAgents.issueId, issue.id))

  console.log(`   Found ${dispatchedAgents.length} dispatched agents:`)
  for (const agent of dispatchedAgents) {
    console.log(`   - ${agent.agentName}: ${agent.status} (triggered: ${agent.triggeredAt})`)
  }

  const dispatchedNames = new Set(dispatchedAgents.map((a) => a.agentName))
  const hasCursorDispatched = dispatchedNames.has('cursor')

  if (hasCursorDispatched) {
    console.log('\n✅ Cursor is already dispatched')
    console.log('   NOTE: This is unexpected based on the problem statement\n')
  } else {
    console.log('\n❌ CONFIRMED: Cursor is NOT dispatched\n')
  }

  // 5. Check Linear user existence
  console.log('5. LINEAR USER LOOKUP')
  console.log('─────────────────────────')

  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    console.log('❌ FINDING: LINEAR_API_KEY not configured')
    console.log('   Cannot check Linear user existence\n')
    return
  }

  const client = new LinearClient({ apiKey })

  console.log('   Fetching all Linear users...')
  const usersResponse = await client.users()
  const users = usersResponse.nodes

  console.log(`   Total Linear users: ${users.length}`)
  console.log('   Looking for "cursor" (case-insensitive)...\n')

  const cursorUser = users.find(
    (u) => u.displayName?.toLowerCase() === 'cursor'
  )

  if (cursorUser) {
    console.log('✅ Linear user "cursor" found:')
    console.log(`   User ID: ${cursorUser.id}`)
    console.log(`   Display name: ${cursorUser.displayName}`)
    console.log(`   Email: ${cursorUser.email ?? 'N/A'}`)
    console.log(`   Active: ${cursorUser.active}\n`)
  } else {
    console.log('❌ FINDING: Linear user "cursor" NOT FOUND')
    console.log('   ROOT CAUSE: User lookup failed - cannot create @mention')
    console.log('\n   Available users:')
    for (const user of users.slice(0, 20)) {
      console.log(`   - ${user.displayName} (${user.email ?? 'no email'})`)
    }
    if (users.length > 20) {
      console.log(`   ... and ${users.length - 20} more`)
    }
    console.log()
    return
  }

  // 6. Check other agents for comparison
  console.log('6. CROSS-CHECK OTHER AGENTS')
  console.log('─────────────────────────')
  const otherAgents = ['engine', 'cyrus', 'factory']

  for (const agentName of otherAgents) {
    const userId = await findLinearUserByDisplayName(client, agentName)
    const isDispatched = dispatchedNames.has(agentName)
    console.log(`   ${agentName}:`)
    console.log(`     Linear user: ${userId ? '✅ Found' : '❌ Not found'}`)
    console.log(`     Dispatched: ${isDispatched ? '✅ Yes' : '❌ No'}`)
  }
  console.log()

  // 7. Final diagnosis
  console.log('7. ROOT CAUSE ANALYSIS')
  console.log('─────────────────────────')

  if (!hasCursorDispatched && cursorUser) {
    console.log('⚠️  INCONCLUSIVE: All preconditions met, but Cursor not dispatched')
    console.log('\n   Possible causes:')
    console.log('   a) Silent error during initial dispatch (check logs)')
    console.log('   b) Race condition during bulk dispatch')
    console.log('   c) Transaction rollback after partial dispatch')
    console.log('   d) Cursor added to config AFTER initial dispatch')
    console.log('\n   Recommendation: Check application logs for dispatch errors')
    console.log('   around the time when other agents were dispatched.')
  }

  console.log('\n=== END DIAGNOSTIC REPORT ===')
}

diagnose().catch((error) => {
  console.error('Diagnostic script failed:', error)
  process.exit(1)
})
