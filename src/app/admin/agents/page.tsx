/**
 * Admin page for agent management.
 * Server Component that displays agent configuration and management UI.
 *
 * @packageDocumentation
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { AgentConfigPlaceholder } from '@/components/AgentConfigPlaceholder'
import { AgentDiscovery } from '@/components/AgentDiscovery'
import { AgentsTable } from '@/components/AgentsTable'

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
 * API response type
 */
type AgentsResponse = {
  agents: Agent[]
}

/**
 * Fetches agents from the API.
 *
 * @returns Promise with agents data
 */
async function getAgents(): Promise<Agent[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const response = await fetch(`${baseUrl}/api/agents`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch agents')
  }

  const data = (await response.json()) as AgentsResponse
  return data.agents
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

      {/* Discovery Status Section */}
      <AgentDiscovery />

      {/* Agents Table Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>
            All discovered agents with their status and configuration
          </CardDescription>
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
