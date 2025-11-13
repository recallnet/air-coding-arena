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
    id: '123e4567-e89b-12d3-a456-426614174000',
    linearId: 'linear-123',
    linearKey: 'ENG-101',
    title: 'Test Issue',
    url: 'https://linear.app/issue/123',
    repo: 'org/repo',
    status: 'In Progress',
    description: null,
    descriptionMarkdown: null,
    estimate: null,
    priority: null,
    labelsJson: null,
    assigneeId: null,
    assigneeName: null,
    assigneeEmail: null,
    creatorId: null,
    creatorName: null,
    creatorEmail: null,
    projectId: null,
    projectName: null,
    cycleId: null,
    cycleName: null,
    cycleNumber: null,
    dueDate: null,
    linearCreatedAt: null,
    linearUpdatedAt: null,
    parentId: null,
    arenaReadyLabeledAt: new Date('2025-01-15T10:00:00Z'),
    winnerAttemptId: null,
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
    id: '456e4567-e89b-12d3-a456-426614174001',
    issueId: '123e4567-e89b-12d3-a456-426614174000',
    agentName: 'cursor',
    repo: 'org/repo',
    prNumber: 123,
    prUrl: 'https://github.com/org/repo/pull/123',
    branch: 'feature/test',
    openedAt: new Date('2025-01-16T10:00:00Z'),
    mergedAt: null,
    closedAt: null,
    status: 'open',
    commitCount: 1,
    lastCommitSha: 'abc123',
    ciStatus: null,
    ciLastCheckedAt: null,
    sourceAttachmentId: null,
    sourceAttachmentUrl: null,
    ...partial,
  }
}
