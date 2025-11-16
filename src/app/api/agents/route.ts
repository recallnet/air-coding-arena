/**
 * GET /api/agents endpoint
 * Returns all agents with active/enabled status
 *
 * @packageDocumentation
 */

import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

/**
 * Agent information returned by GET /api/agents
 */
export type AgentInfo = {
  /** Unique agent identifier (UUID) */
  id: string
  /** Agent name (lowercase) */
  name: string
  /** URL-friendly slug derived from name */
  slug: string
  /** Display name for UI */
  displayName: string
  /** Linear user ID for this agent */
  linearUserId: string
  /** Agent email address */
  email: string | null
  /** URL to agent avatar image */
  avatarUrl: string | null
  /** Whether agent is currently active in Linear workspace */
  isActive: boolean
  /** Whether agent is enabled for arena participation */
  isEnabled: boolean
  /** Timestamp when agent was first discovered */
  discoveredAt: Date
  /** Timestamp when agent was last seen in Linear workspace */
  lastSeenAt: Date | null
}

/**
 * Response type for GET /api/agents
 */
export type AgentsResponse = {
  /** List of all agents with their metadata and status */
  agents: AgentInfo[]
}

/**
 * GET /api/agents
 * Returns all agents with their metadata and status
 *
 * @returns JSON response with agents array
 */
export async function GET() {
  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      slug: agents.slug,
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

  const response: AgentsResponse = {
    agents: allAgents,
  }
  return NextResponse.json(response)
}
