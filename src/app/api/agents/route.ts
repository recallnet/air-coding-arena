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

  return NextResponse.json({
    agents: allAgents,
  })
}
