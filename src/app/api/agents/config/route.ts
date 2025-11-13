/**
 * GET /api/agents/config endpoint
 * Returns current agent configuration
 *
 * @packageDocumentation
 */

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { agentConfig } from '@/db/schema'

/**
 * GET /api/agents/config
 * Returns the current agent configuration (mode, maxAgents, lastDiscoveryAt)
 *
 * @returns JSON response with config or error
 */
export async function GET() {
  try {
    const config = await db
      .select()
      .from(agentConfig)
      .where(eq(agentConfig.id, 'singleton'))
      .limit(1)

    if (config.length === 0) {
      // Return default config if none exists
      return NextResponse.json({
        mode: 'all',
        maxAgents: null,
        lastDiscoveryAt: null,
      })
    }

    return NextResponse.json({
      mode: config[0].mode,
      maxAgents: config[0].maxAgents,
      lastDiscoveryAt: config[0].lastDiscoveryAt,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch config'

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
