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
  name: string
  handle: string
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

/**
 * Guesses agent name from PR title or branch
 * Checks against configured agents
 * @param text - Text to search (title, branch, subtitle)
 * @returns Agent name or 'unknown'
 */
export async function guessAgentFromText(text: string): Promise<string> {
  const lowerText = text.toLowerCase()
  const configs = await getAgentConfigs()

  for (const agent of configs) {
    if (lowerText.includes(agent.name.toLowerCase())) {
      return agent.name
    }
  }

  return 'unknown'
}
