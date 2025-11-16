/**
 * Admin page for agent management.
 * Server Component that displays agent configuration and management UI.
 *
 * @packageDocumentation
 */

import { AgentConfigPlaceholder } from '@/components/AgentConfigPlaceholder'
import { AgentRefreshButton } from '@/components/AgentRefreshButton'
import { AgentsTable } from '@/components/AgentsTable'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'

/**
 * Forces dynamic rendering (no static generation).
 * Required for admin pages that fetch real-time data from database.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic
 */
export const dynamic = 'force-dynamic'

/**
 * Agent type from API response
 */
export type Agent = {
  /** Unique database identifier for the agent */
  id: string
  /** Unique name identifier for the agent (lowercase, no spaces) */
  name: string
  /** Human-readable display name for the agent */
  displayName: string
  /** Linear user ID for the agent */
  linearUserId: string
  /** Agent's email address, or null if not available */
  email: string | null
  /** URL to agent's avatar image, or null if not available */
  avatarUrl: string | null
  /** Whether agent is currently active in Linear workspace */
  isActive: boolean
  /** Whether agent is enabled to participate in the arena */
  isEnabled: boolean
  /** ISO 8601 timestamp when agent was first discovered */
  discoveredAt: string
  /** ISO 8601 timestamp when agent was last seen */
  lastSeenAt: string
}

/**
 * Fetches agents from the database.
 *
 * @returns Promise with agents data
 */
async function getAgents(): Promise<Agent[]> {
  const { db } = await import('@/db/client')
  const { agents } = await import('@/db/schema')
  const { asc } = await import('drizzle-orm')

  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      displayName: agents.displayName,
      linearUserId: agents.linearUserId,
      email: agents.email,
      avatarUrl: agents.avatarUrl,
      isActive: agents.isActive,
      isEnabled: agents.isEnabled,
      discoveredAt: agents.discoveredAt,
      lastSeenAt: agents.lastSeenAt,
    })
    .from(agents)
    .orderBy(asc(agents.name))

  // Convert Date objects to ISO strings
  return allAgents.map((agent) => ({
    ...agent,
    discoveredAt: agent.discoveredAt.toISOString(),
    lastSeenAt: agent.lastSeenAt.toISOString(),
  }))
}

/**
 * Admin agents page component.
 * Displays agent discovery status, agents table, and configuration.
 *
 * @returns Admin agents page
 */
export default async function AdminAgentsPage(): Promise<React.JSX.Element> {
  const agents = await getAgents()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Agent Management
        </h1>
        <p className="mt-2 text-lg text-foreground-secondary">
          Manage agent discovery and configuration
        </p>
      </div>

      {/* Agents Table Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Agents</CardTitle>
              <CardDescription>
                All discovered agents with their status and configuration
              </CardDescription>
            </div>
            <AgentRefreshButton />
          </div>
        </CardHeader>
        <CardContent>
          <AgentsTable initialAgents={agents} />
        </CardContent>
      </Card>

      {/* Configuration Placeholder Section */}
      <AgentConfigPlaceholder />
    </div>
  )
}
