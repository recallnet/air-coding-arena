/**
 * Test factories for creating mock database entities.
 * Provides sensible defaults for all required fields.
 */

import type { Issue, Attempt } from '@/types/database'

/**
 * Creates a mock Issue with all required fields and sensible defaults.
 * Override any field by passing it in the partial parameter.
 * @param partial - Partial Issue object to override defaults
 * @returns A complete Issue object with default values merged with partial overrides
 */
export function createMockIssue(partial: Partial<Issue> = {}): Issue {
  return {
    /** Issue unique identifier (UUID format) */
    id: '123e4567-e89b-12d3-a456-426614174000',
    /** Linear issue unique identifier */
    linearId: 'linear-123',
    /** Linear issue key in format TEAM-123 */
    linearKey: 'ENG-101',
    /** Issue title from Linear */
    title: 'Test Issue',
    /** Linear issue URL */
    url: 'https://linear.app/issue/123',
    /** GitHub repository in format org/repo */
    repo: 'org/repo',
    /** Current status from Linear workspace */
    status: 'In Progress',
    /** Issue description (plain text) */
    description: null,
    /** Issue description in Markdown format */
    descriptionMarkdown: null,
    /** Story point estimate from Linear */
    estimate: null,
    /** Priority level from Linear */
    priority: null,
    /** JSON array of label objects from Linear */
    labelsJson: null,
    /** Linear assignee unique identifier */
    assigneeId: null,
    /** Linear assignee display name */
    assigneeName: null,
    /** Linear assignee email address */
    assigneeEmail: null,
    /** Linear issue creator unique identifier */
    creatorId: null,
    /** Linear issue creator display name */
    creatorName: null,
    /** Linear issue creator email address */
    creatorEmail: null,
    /** Linear project unique identifier */
    projectId: null,
    /** Linear project display name */
    projectName: null,
    /** Linear cycle unique identifier */
    cycleId: null,
    /** Linear cycle display name */
    cycleName: null,
    /** Linear cycle number */
    cycleNumber: null,
    /** Due date from Linear (ISO 8601 format) */
    dueDate: null,
    /** Timestamp when issue was created in Linear */
    linearCreatedAt: null,
    /** Timestamp when issue was last updated in Linear */
    linearUpdatedAt: null,
    /** Parent issue ID if this is a sub-issue */
    parentId: null,
    /** Timestamp when arena:ready label was added */
    arenaReadyLabeledAt: new Date('2025-01-15T10:00:00Z'),
    /** UUID of the winning attempt (PR that was merged) */
    winnerAttemptId: null,
    /** Timestamp when this record was created in our database */
    createdAt: new Date('2025-01-10T10:00:00Z'),
    ...partial,
  }
}

/**
 * Creates a mock Attempt with all required fields and sensible defaults.
 * Override any field by passing it in the partial parameter.
 * @param partial - Partial Attempt object to override defaults
 * @returns A complete Attempt object with default values merged with partial overrides
 */
export function createMockAttempt(partial: Partial<Attempt> = {}): Attempt {
  return {
    /** Attempt unique identifier (UUID format) */
    id: '456e4567-e89b-12d3-a456-426614174001',
    /** Foreign key to parent issue (UUID) */
    issueId: '123e4567-e89b-12d3-a456-426614174000',
    /** Name of the agent that made this attempt */
    agentName: 'cursor',
    /** GitHub repository in format org/repo */
    repo: 'org/repo',
    /** GitHub pull request number */
    prNumber: 123,
    /** GitHub pull request URL */
    prUrl: 'https://github.com/org/repo/pull/123',
    /** Git branch name for this PR */
    branch: 'feature/test',
    /** Timestamp when PR was opened */
    openedAt: new Date('2025-01-16T10:00:00Z'),
    /** Timestamp when PR was merged (null if not merged) */
    mergedAt: null,
    /** Timestamp when PR was closed (null if still open) */
    closedAt: null,
    /** PR status (open, merged, or closed) */
    status: 'open',
    /** Total number of commits in this PR */
    commitCount: 1,
    /** SHA hash of the most recent commit */
    lastCommitSha: 'abc123',
    /** Last known CI status (success, failure, pending) */
    ciStatus: null,
    /** Timestamp of last CI status check */
    ciLastCheckedAt: null,
    /** Linear attachment ID that linked this PR to the issue */
    sourceAttachmentId: null,
    /** Linear attachment URL for this PR link */
    sourceAttachmentUrl: null,
    ...partial,
  }
}
