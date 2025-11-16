/**
 * PATCH /api/agents/[id] endpoint
 * Updates agent enabled status
 *
 * @packageDocumentation
 */

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

/**
 * Request body type for PATCH /api/agents/[id]
 */
type UpdateAgentRequest = {
  isEnabled: boolean
}

/**
 * Error response for PATCH /api/agents/[id]
 */
export type ErrorResponse = {
  /** Error message describing what went wrong */
  error: string
}

/**
 * PATCH /api/agents/[id]
 * Updates the enabled status of an agent
 *
 * @param request - Next.js request object
 * @param context - Route context with params
 * @returns JSON response with updated agent or error
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Parse request body
    let body: unknown
    try {
      body = (await request.json()) as unknown
    } catch {
      const errorResponse: ErrorResponse = { error: 'Invalid request body' }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // Validate request body
    if (typeof body !== 'object' || body === null) {
      const errorResponse: ErrorResponse = { error: 'Invalid request body' }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    const updateRequest = body as Record<string, unknown>

    if (!('isEnabled' in updateRequest)) {
      const errorResponse: ErrorResponse = { error: 'isEnabled is required' }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    if (typeof updateRequest['isEnabled'] !== 'boolean') {
      const errorResponse: ErrorResponse = {
        error: 'isEnabled must be a boolean',
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    const validatedBody = updateRequest as UpdateAgentRequest

    // Get agent ID from params
    const params = await context.params
    const agentId = params.id

    // Update agent
    const updatedAgents = await db
      .update(agents)
      .set({
        isEnabled: validatedBody.isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId))
      .returning()

    if (updatedAgents.length === 0) {
      const errorResponse: ErrorResponse = { error: 'Agent not found' }
      return NextResponse.json(errorResponse, { status: 404 })
    }

    return NextResponse.json(updatedAgents[0])
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update agent'

    const errorResponse: ErrorResponse = { error: errorMessage }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
