/**
 * Agent configuration from database
 * @packageDocumentation
 */

import { eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

/**
 * Agent configuration object
 */
export type AgentConfig = {
  /** Lowercase agent name used as unique identifier (e.g., 'cursor', 'engine') */
  name: string
  /** Agent display handle for mentions (e.g., '@Cursor', '@Engine') */
  handle: string
  /** Human-readable display name from Linear workspace */
  displayName: string
  /** Unique Linear user ID for this agent */
  linearUserId: string
}

/**
 * Gets agent configs from database
 * Queries agents table for enabled agents
 * THROWS if database query fails - NO FALLBACKS
 * @returns Array of agent configs
 * @throws Error if database query fails
 */
export async function getAgentConfigs(): Promise<AgentConfig[]> {
  // Query database for enabled agents - let errors propagate
  const enabledAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.isEnabled, true))
    .orderBy(agents.name)

  return enabledAgents.map((agent) => ({
    name: agent.name,
    handle: `@${agent.displayName}`,
    displayName: agent.displayName,
    linearUserId: agent.linearUserId,
  }))
}

/**
 * Gets list of agent handles for mention detection
 * @returns Array of handles like ['@Cursor', '@Engine']
 */
export async function getAgentHandles(): Promise<string[]> {
  const configs = await getAgentConfigs()
  return configs.map((agent) => agent.handle)
}

/**
 * Gets list of agent names for database queries
 * @returns Array of names like ['cursor', 'engine']
 */
export async function getAgentNames(): Promise<string[]> {
  const configs = await getAgentConfigs()
  return configs.map((agent) => agent.name)
}
