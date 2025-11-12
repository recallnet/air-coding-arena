/**
 * Agent status update logic
 * @packageDocumentation
 */

import { eq, and } from 'drizzle-orm'

import { db } from '@/db/client'
import { issueAgents } from '@/db/schema'

/**
 * Updates agent status to 'submitted' when PR is created
 * @param issueId - Issue UUID
 * @param agentName - Agent name
 */
export async function updateAgentStatusOnPR(
  issueId: string,
  agentName: string
): Promise<void> {
  const agents = await db
    .select()
    .from(issueAgents)
    .where(
      and(
        eq(issueAgents.issueId, issueId),
        eq(issueAgents.agentName, agentName)
      )
    )

  if (agents.length === 0) {
    // Agent not mentioned yet, create record
    await db.insert(issueAgents).values({
      issueId,
      agentName,
      status: 'submitted',
      triggeredAt: new Date(),
    })
  } else {
    // Update existing record
    await db
      .update(issueAgents)
      .set({ status: 'submitted' })
      .where(
        and(
          eq(issueAgents.issueId, issueId),
          eq(issueAgents.agentName, agentName)
        )
      )
  }
}

/**
 * Marks pending agents as ignored when issue closes
 * @param issueId - Issue UUID
 */
export async function markIgnoredOnIssueClosed(issueId: string): Promise<void> {
  await db
    .update(issueAgents)
    .set({ status: 'ignored' })
    .where(
      and(eq(issueAgents.issueId, issueId), eq(issueAgents.status, 'pending'))
    )
}
