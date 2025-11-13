/**
 * Agent discovery functions for Linear workspace
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq, notInArray } from 'drizzle-orm'

import { db } from '@/db/client'
import { agents, agentConfig } from '@/db/schema'

/**
 * Linear user type from SDK
 */
type LinearUser = {
  id: string
  name: string
  email?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  guest?: boolean | null
}

/**
 * Checks if Linear user is a coding agent
 *
 * Primary detection method: OAuth app email pattern
 * Coding agents authenticate via OAuth and get emails like:
 * UUID@oauthapp.linear.app
 *
 * Example agents from actual workspace:
 * - cursor: UUID@oauthapp.linear.app
 * - engine: UUID@oauthapp.linear.app
 * - factory: UUID@oauthapp.linear.app
 * - cyrus: UUID@oauthapp.linear.app
 * - notionai: UUID@oauthapp.linear.app
 *
 * Human users have real email addresses:
 * - andrew@textile.io
 * - carson@textile.io
 * - etc.
 *
 * @param user - Linear user object
 * @returns True if user is a coding agent, false otherwise
 */
export function isAgent(user: LinearUser): boolean {
  // First check: Guest users are never agents
  // Guest users are external contractors/collaborators with real emails
  if (user.guest) {
    return false
  }

  // Primary heuristic: OAuth app email pattern
  // This is the most reliable indicator based on actual Linear workspace data
  if (user.email?.endsWith('@oauthapp.linear.app')) {
    return true
  }

  return false
}

/**
 * Gets list of known coding agents from environment variable
 * Default: cursor, engine, factory, cyrus
 *
 * @returns Array of lowercase agent names
 */
function getKnownAgents(): string[] {
  const knownAgentsEnv = process.env['KNOWN_CODING_AGENTS']
  if (!knownAgentsEnv) {
    // Default known agents
    return ['cursor', 'engine', 'factory', 'cyrus']
  }
  return knownAgentsEnv.split(',').map((name) => name.trim().toLowerCase())
}

/**
 * Discovers agents from Linear API workspace
 * Filters users to identify coding agents
 * Updates agents table with active status
 *
 * @returns Discovery stats: discovered, updated, deactivated
 */
export async function discoverAgents(): Promise<{
  discovered: number
  updated: number
  deactivated: number
}> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  const client = new LinearClient({ apiKey })

  // Query all users in workspace
  const usersResponse = await client.users()
  const users = usersResponse.nodes

  // Filter to identify agents
  const agentUsers = users.filter(isAgent)

  // Get known agents list
  const knownAgents = getKnownAgents()

  // Track stats
  let discovered = 0
  let updated = 0

  // Collect Linear user IDs for agents we've seen
  const seenLinearUserIds: string[] = []

  // Upsert agents to database
  for (const agentUser of agentUsers) {
    seenLinearUserIds.push(agentUser.id)

    // Determine if this is a known agent
    const agentName = agentUser.name.toLowerCase()
    const isKnownAgent = knownAgents.includes(agentName)

    // Check if agent already exists in database
    const existingAgent = await db
      .select()
      .from(agents)
      .where(eq(agents.linearUserId, agentUser.id))
      .limit(1)

    if (existingAgent.length === 0) {
      // New agent - insert
      await db.insert(agents).values({
        name: agentName,
        displayName: agentUser.displayName ?? agentUser.name,
        linearUserId: agentUser.id,
        email: agentUser.email ?? null,
        avatarUrl: agentUser.avatarUrl ?? null,
        isActive: true,
        isEnabled: isKnownAgent, // Only enable known agents by default
        lastSeenAt: new Date(),
      })
      discovered++
    } else {
      // Existing agent - update
      // Don't change isEnabled - that's user-controlled
      // Only update metadata and active status
      await db
        .update(agents)
        .set({
          displayName: agentUser.displayName ?? agentUser.name,
          email: agentUser.email ?? null,
          avatarUrl: agentUser.avatarUrl ?? null,
          isActive: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agents.linearUserId, agentUser.id))
      updated++
    }
  }

  // Mark agents not seen as inactive
  let deactivated = 0
  if (seenLinearUserIds.length > 0) {
    const deactivatedAgents = await db
      .update(agents)
      .set({ isActive: false, updatedAt: new Date() })
      .where(notInArray(agents.linearUserId, seenLinearUserIds))
      .returning({ id: agents.id })
    deactivated = deactivatedAgents.length
  } else {
    // If no agents found, mark all as inactive
    const deactivatedAgents = await db
      .update(agents)
      .set({ isActive: false, updatedAt: new Date() })
      .returning({ id: agents.id })
    deactivated = deactivatedAgents.length
  }

  // Update lastDiscoveryAt in agent_config
  // Get or create singleton config
  const configRows = await db
    .select()
    .from(agentConfig)
    .where(eq(agentConfig.id, 'singleton'))
    .limit(1)

  if (configRows.length === 0) {
    // Create default config
    await db.insert(agentConfig).values({
      id: 'singleton',
      mode: 'all',
      maxAgents: null,
      lastDiscoveryAt: new Date(),
    })
  } else {
    // Update existing config
    await db
      .update(agentConfig)
      .set({ lastDiscoveryAt: new Date(), updatedAt: new Date() })
      .where(eq(agentConfig.id, 'singleton'))
  }

  return { discovered, updated, deactivated }
}
