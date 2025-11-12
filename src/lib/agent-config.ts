/**
 * Agent configuration from environment variables
 * @packageDocumentation
 */

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
 * Parses agent list from AGENTS_CONFIG_JSON env var
 * Format: [{"name":"cursor","handle":"@Cursor"},{"name":"engine","handle":"@Engine"}]
 * @returns Array of agent configs
 */
export function getAgentConfigs(): AgentConfig[] {
  const configJson = process.env['AGENTS_CONFIG_JSON']

  if (!configJson) {
    // Fallback to default agents for backward compatibility
    return DEFAULT_AGENTS
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
 * Gets list of agent handles for mention detection
 * @returns Array of handles like ['@Cursor', '@Engine']
 */
export function getAgentHandles(): string[] {
  return getAgentConfigs().map((agent) => agent.handle)
}

/**
 * Gets list of agent names for database queries
 * @returns Array of names like ['cursor', 'engine']
 */
export function getAgentNames(): string[] {
  return getAgentConfigs().map((agent) => agent.name)
}

/**
 * Guesses agent name from PR title or branch
 * Checks against configured agents
 * @param text - Text to search (title, branch, subtitle)
 * @returns Agent name or 'unknown'
 */
export function guessAgentFromText(text: string): string {
  const lowerText = text.toLowerCase()

  for (const agent of getAgentConfigs()) {
    if (lowerText.includes(agent.name.toLowerCase())) {
      return agent.name
    }
  }

  return 'unknown'
}
