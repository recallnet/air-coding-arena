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
 * Agent configuration response
 */
export type AgentConfigResponse = {
  /** Agent selection mode: 'all' | 'max_n' | 'manual' */
  mode: string
  /** Maximum number of agents when mode is 'max_n' */
  maxAgents: number | null
  /** ISO timestamp of last agent discovery run */
  lastDiscoveryAt: Date | null
}

/**
 * Error response for GET /api/agents/config
 */
export type ErrorResponse = {
  /** Error message describing what went wrong */
  error: string
}

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
      const response: AgentConfigResponse = {
        mode: 'all',
        maxAgents: null,
        lastDiscoveryAt: null,
      }
      return NextResponse.json(response)
    }

    const firstConfig = config[0]
    if (!firstConfig) {
      // Return default config if none exists
      const response: AgentConfigResponse = {
        mode: 'all',
        maxAgents: null,
        lastDiscoveryAt: null,
      }
      return NextResponse.json(response)
    }

    const response: AgentConfigResponse = {
      mode: firstConfig.mode,
      maxAgents: firstConfig.maxAgents,
      lastDiscoveryAt: firstConfig.lastDiscoveryAt,
    }
    return NextResponse.json(response)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch config'

    const errorResponse: ErrorResponse = { error: errorMessage }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
