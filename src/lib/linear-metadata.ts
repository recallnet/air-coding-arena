/**
 * Linear issue metadata extraction utilities
 * @packageDocumentation
 */

/**
 * Linear SDK Issue type (simplified for our extraction needs)
 */
export type LinearIssue = {
  id: string
  identifier: string
  title: string
  description?: string | null
  descriptionData?: string | null
  url: string
  estimate?: number | null
  priority?: number | null
  labels?: Array<{
    id: string
    name: string
    color?: string | null
    description?: string | null
  }> | null
  assignee?: {
    id: string
    name: string
    email?: string | null
  } | null
  creator?: {
    id: string
    name: string
    email?: string | null
  } | null
  project?: {
    id: string
    name: string
  } | null
  cycle?: {
    id: string
    name: string
    number?: number | null
  } | null
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  parent?: {
    id: string
    identifier: string
  } | null
  team?: {
    id: string
    key: string
    name: string
  } | null
  state?: {
    id: string
    name: string
    type: string
  } | null
}

/**
 * Extracts issue metadata from Linear SDK Issue object
 * Converts to database-compatible format
 *
 * @param issue - Issue object from @linear/sdk
 * @returns Database-compatible metadata object
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function extractIssueMetadata(issue: LinearIssue): {
  linearId: string
  linearKey: string
  title: string
  url: string
  repo?: string
  status?: string
  description?: string
  descriptionMarkdown?: string
  estimate?: number
  priority?: number
  labelsJson?: Array<{
    id: string
    name: string
    color?: string | null
    description?: string | null
  }>
  assigneeId?: string
  assigneeName?: string
  assigneeEmail?: string
  creatorId?: string
  creatorName?: string
  creatorEmail?: string
  projectId?: string
  projectName?: string
  cycleId?: string
  cycleName?: string
  cycleNumber?: number
  dueDate?: Date
  linearCreatedAt: Date
  linearUpdatedAt: Date
  parentId?: string
} {
  // Core fields (always present)
  const metadata: {
    linearId: string
    linearKey: string
    title: string
    url: string
    linearCreatedAt: Date
    linearUpdatedAt: Date
    repo?: string
    status?: string
    description?: string
    descriptionMarkdown?: string
    estimate?: number
    priority?: number
    labelsJson?: Array<{
      id: string
      name: string
      color: string | null
      description: string | null
    }>
    assigneeId?: string
    assigneeName?: string
    assigneeEmail?: string
    creatorId?: string
    creatorName?: string
    creatorEmail?: string
    projectId?: string
    projectName?: string
    cycleId?: string
    cycleName?: string
    cycleNumber?: number
    dueDate?: Date
    parentId?: string
  } = {
    linearId: issue.id,
    linearKey: issue.identifier,
    title: issue.title,
    url: issue.url,
    linearCreatedAt: new Date(issue.createdAt),
    linearUpdatedAt: new Date(issue.updatedAt),
  }

  // Optional: team (repo)
  if (issue.team?.key) {
    metadata.repo = issue.team.key
  }

  // Optional: state (status)
  if (issue.state?.name) {
    metadata.status = issue.state.name
  }

  // Optional: description
  if (issue.description) {
    metadata.description = issue.description
  }

  // Optional: description markdown data
  if (issue.descriptionData) {
    metadata.descriptionMarkdown = issue.descriptionData
  }

  // Optional: estimate
  if (typeof issue.estimate === 'number') {
    metadata.estimate = issue.estimate
  }

  // Optional: priority
  if (typeof issue.priority === 'number') {
    metadata.priority = issue.priority
  }

  // Optional: labels (store as JSONB with full metadata)
  if (issue.labels && Array.isArray(issue.labels)) {
    metadata.labelsJson = issue.labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? null,
      description: label.description ?? null,
    }))
  }

  // Optional: assignee
  if (issue.assignee) {
    metadata.assigneeId = issue.assignee.id
    metadata.assigneeName = issue.assignee.name
    if (issue.assignee.email) {
      metadata.assigneeEmail = issue.assignee.email
    }
  }

  // Optional: creator
  if (issue.creator) {
    metadata.creatorId = issue.creator.id
    metadata.creatorName = issue.creator.name
    if (issue.creator.email) {
      metadata.creatorEmail = issue.creator.email
    }
  }

  // Optional: project
  if (issue.project) {
    metadata.projectId = issue.project.id
    metadata.projectName = issue.project.name
  }

  // Optional: cycle
  if (issue.cycle) {
    metadata.cycleId = issue.cycle.id
    metadata.cycleName = issue.cycle.name
    if (typeof issue.cycle.number === 'number') {
      metadata.cycleNumber = issue.cycle.number
    }
  }

  // Optional: due date
  if (issue.dueDate) {
    metadata.dueDate = new Date(issue.dueDate)
  }

  // Optional: parent (epic/sub-issue relationship)
  if (issue.parent?.id) {
    metadata.parentId = issue.parent.id
  }

  return metadata
}
