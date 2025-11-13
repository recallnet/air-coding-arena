/**
 * Agent status update logic
 * @packageDocumentation
 */

import { eq, and, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { issueAgents } from '@/db/schema'

/**
 * Updates agent status to 'submitted' when PR is created
 *
 * Tracks agent lifecycle from mention to PR submission.
 * Creates new tracking record if agent not yet mentioned.
 *
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> pending: Agent mentioned in issue
 *   pending --> submitted: PR created
 *   pending --> ignored: Issue closed (no PR)
 *   submitted --> accepted: PR merged (first)
 *   submitted --> rejected: PR closed or another PR merged first
 *   accepted --> [*]
 *   rejected --> [*]
 *   ignored --> [*]
 *
 *   note right of pending
 *     Created when agent mentioned in Linear issue
 *     via agent-dispatch webhook
 *   end note
 *
 *   note right of submitted
 *     Set when PR attachment added to Linear issue
 *     Tracks submission but not yet merge/close outcome
 *   end note
 *
 *   note right of accepted
 *     Agent's PR was merged first (winner)
 *     Set by GitHub webhook on PR merge
 *   end note
 *
 *   note right of rejected
 *     Agent's PR was closed without merge, or
 *     another agent's PR was merged first
 *   end note
 * ```
 *
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

/**
 * Updates agent status when PR is closed or merged
 *
 * Implements the final stage of agent status lifecycle:
 * - If PR merged and no winner yet: mark agent as accepted, mark others as rejected
 * - If PR merged but another agent already won: mark agent as rejected
 * - If PR closed without merge: mark agent as rejected
 *
 * @param issueId - Issue UUID
 * @param agentName - Agent name
 * @param prMerged - Whether the PR was merged (true) or closed (false)
 */
export async function updateAgentStatusOnPRClose(
  issueId: string,
  agentName: string,
  prMerged: boolean
): Promise<void> {
  if (prMerged) {
    // Check if there's already an accepted agent for this issue
    const existingAccepted = await db
      .select()
      .from(issueAgents)
      .where(
        and(
          eq(issueAgents.issueId, issueId),
          eq(issueAgents.status, 'accepted')
        )
      )

    if (existingAccepted.length === 0) {
      // This is the first merge - this agent wins
      await db
        .update(issueAgents)
        .set({ status: 'accepted' })
        .where(
          and(
            eq(issueAgents.issueId, issueId),
            eq(issueAgents.agentName, agentName)
          )
        )

      // Mark all other submitted agents as rejected
      await db
        .update(issueAgents)
        .set({ status: 'rejected' })
        .where(
          and(
            eq(issueAgents.issueId, issueId),
            eq(issueAgents.status, 'submitted'),
            sql`${issueAgents.agentName} != ${agentName}`
          )
        )
    } else {
      // Another agent already won - this one is rejected
      await db
        .update(issueAgents)
        .set({ status: 'rejected' })
        .where(
          and(
            eq(issueAgents.issueId, issueId),
            eq(issueAgents.agentName, agentName)
          )
        )
    }
  } else {
    // PR closed without merge - rejected
    await db
      .update(issueAgents)
      .set({ status: 'rejected' })
      .where(
        and(
          eq(issueAgents.issueId, issueId),
          eq(issueAgents.agentName, agentName)
        )
      )
  }
}
