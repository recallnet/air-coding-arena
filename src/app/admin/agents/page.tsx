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

// Force dynamic rendering - admin pages should always show fresh data
export const dynamic = 'force-dynamic'

/**
 * Agent type from API response
 */
export type Agent = {
  id: string
  name: string
  displayName: string
  linearUserId: string
  email: string | null
  avatarUrl: string | null
  isActive: boolean
  isEnabled: boolean
  discoveredAt: string
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
    <main className="container mx-auto p-6 md:p-8 lg:p-12">
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
    </main>
  )
}
