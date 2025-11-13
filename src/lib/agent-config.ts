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
 * Default agent configuration (fallback)
 */
const DEFAULT_AGENTS: AgentConfig[] = [
  { name: 'cursor', handle: '@Cursor' },
  { name: 'engine', handle: '@Engine' },
  { name: 'cyrus', handle: '@Cyrus' },
  { name: 'factory', handle: '@Factory' },
]

/**
 * Type guard to check if a value is a record object
 * @param value - Value to check
 * @returns True if value is a record object, false otherwise
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Legacy function to parse agent list from AGENTS_CONFIG_JSON env var
 * @deprecated Use getAgentConfigs() instead, which queries the database
 * @returns Array of agent configs
 */
function getAgentConfigsFromEnv(): AgentConfig[] {
  const configJson = process.env['AGENTS_CONFIG_JSON']

  if (!configJson) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(configJson)

    // Validate structure
    if (!Array.isArray(parsed)) {
      throw new Error('AGENTS_CONFIG_JSON must be an array')
    }

    const parsedArray: unknown[] = parsed

    if (parsedArray.length === 0) {
      throw new Error(
        'AGENTS_CONFIG_JSON is empty, must specify at least one agent'
      )
    }

    // Validate each agent config
    const configs: AgentConfig[] = []
    for (const item of parsedArray) {
      if (!isRecord(item)) {
        throw new Error('Each agent config must be an object')
      }

      const config: Record<string, unknown> = item

      if (
        typeof config['name'] !== 'string' ||
        config['name'].trim().length === 0
      ) {
        throw new Error('Agent config missing required field: name (string)')
      }

      if (
        typeof config['handle'] !== 'string' ||
        config['handle'].trim().length === 0
      ) {
        throw new Error('Agent config missing required field: handle (string)')
      }

      configs.push({
        name: config['name'].toLowerCase().trim(),
        handle: config['handle'].trim(),
      })
    }

    return configs
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in AGENTS_CONFIG_JSON: ${error.message}`)
    }
    throw error
  }
}

/**
 * Gets agent configs from database
 * Queries agents table for enabled and active agents
 * Falls back to AGENTS_CONFIG_JSON env var if database query fails
 * Falls back to DEFAULT_AGENTS if both fail
 * @returns Array of agent configs
 */
export async function getAgentConfigs(): Promise<AgentConfig[]> {
  try {
    // Query database for enabled and active agents
    const enabledAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.isEnabled, true))
      .orderBy(agents.name)

    if (enabledAgents.length > 0) {
      return enabledAgents.map((agent) => ({
        name: agent.name,
        handle: `@${agent.displayName}`,
      }))
    }

    // Fallback to env var if no enabled agents in database
    const envConfigs = getAgentConfigsFromEnv()
    if (envConfigs.length > 0) {
      return envConfigs
    }

    // Final fallback to default agents
    return DEFAULT_AGENTS
  } catch (error) {
    globalThis.console.error('Failed to query agents from database:', error)

    // Fallback to env var on database error
    try {
      const envConfigs = getAgentConfigsFromEnv()
      if (envConfigs.length > 0) {
        return envConfigs
      }
    } catch {
      // Ignore env parsing errors
    }

    // Final fallback to default agents
    return DEFAULT_AGENTS
  }
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
