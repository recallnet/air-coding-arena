/**
 * Issue metadata query helpers
 * packageDocumentation
 */

import { eq, gte, lte, and, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { issues } from '@/db/schema'

/**
 * Get issues with a specific label
 * Uses JSONB containment query
 *
 * param labelName - Label name to search for
 * returns Issues with the label
 */
export async function getIssuesByLabel(labelName: string) {
  return db
    .select()
    .from(issues)
    .where(
      sql`${issues.labelsJson} @> ${JSON.stringify([{ name: labelName }])}`
    )
}

/**
 * Get issues with a specific priority
 * Priority levels: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
 *
 * param priority - Priority number (0-4)
 * returns Issues with the priority
 */
export async function getIssuesByPriority(priority: number) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.priority, priority))
}

/**
 * Get issues within an estimate range
 *
 * param minEstimate - Minimum estimate points
 * param maxEstimate - Maximum estimate points
 * returns Issues within the estimate range
 */
export async function getIssuesByEstimate(
  minEstimate: number,
  maxEstimate: number
) {
  return db
    .select()
    .from(issues)
    .where(
      and(
        gte(issues.estimate, minEstimate),
        lte(issues.estimate, maxEstimate)
      )
    )
}

/**
 * Get issues assigned to a specific user
 *
 * param assigneeId - Linear user ID
 * returns Issues assigned to the user
 */
export async function getIssuesByAssignee(assigneeId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.assigneeId, assigneeId))
}

/**
 * Get issues in a specific cycle
 *
 * param cycleId - Linear cycle ID
 * returns Issues in the cycle
 */
export async function getIssuesInCycle(cycleId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.cycleId, cycleId))
}

/**
 * Get issues in a specific project
 *
 * param projectId - Linear project ID
 * returns Issues in the project
 */
export async function getIssuesInProject(projectId: string) {
  return db
    .select()
    .from(issues)
    .where(eq(issues.projectId, projectId))
}

/**
 * Get overdue issues
 *
 * returns Issues past their due date
 */
export async function getOverdueIssues() {
  return db
    .select()
    .from(issues)
    .where(
      and(
        sql`${issues.dueDate} IS NOT NULL`,
        sql`${issues.dueDate} < NOW()`
      )
    )
}
