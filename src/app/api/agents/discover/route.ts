/**
 * POST /api/agents/discover endpoint
 * Triggers agent discovery from Linear API
 *
 * @packageDocumentation
 */

import { NextResponse } from 'next/server'

import { discoverAgents } from '@/lib/agent-discovery'

/**
 * Error response for POST /api/agents/discover
 */
export type ErrorResponse = {
  /** Error message describing what went wrong */
  error: string
}

/**
 * POST /api/agents/discover
 * Calls discoverAgents() to fetch agents from Linear API
 * and update the database
 *
 * @returns JSON response with discovery stats or error
 */
export async function POST() {
  try {
    const results = await discoverAgents()

    return NextResponse.json(results)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to discover agents'

    const errorResponse: ErrorResponse = { error: errorMessage }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
