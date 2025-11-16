/**
 * Linear API synchronization functions
 * @packageDocumentation
 */

import { LinearClient } from '@linear/sdk'
import { eq, and } from 'drizzle-orm'

import { db } from '@/db/client'
import { issues, issueAgents, attempts } from '@/db/schema'

import { getAgentConfigs } from './agent-config'
import { extractIssueMetadata } from './linear-metadata'

/**
 * Syncs issue state from Linear API
 * Fetches comments and attachments to capture mid-flight activity
 * Extracts and stores full issue metadata
 *
 * @param linearIssueId - Linear issue UUID
 */
export async function syncIssueFromLinear(
  linearIssueId: string
): Promise<void> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  // 1. Get issue from database
  const dbIssue = await db
    .select()
    .from(issues)
    .where(eq(issues.linearId, linearIssueId))
    .limit(1)

  if (!dbIssue[0]) {
    return // Issue not in database, nothing to sync
  }

  const issueId = dbIssue[0].id

  // 2. Fetch from Linear API
  const client = new LinearClient({ apiKey })
  const issue = await client.issue(linearIssueId)

  // Fetch ALL comments (handle pagination)
  let commentsPage = await issue.comments()
  let allComments = [...commentsPage.nodes]

  // Keep fetching until we have all comments
  while (commentsPage.pageInfo.hasNextPage) {
    const nextPage = await commentsPage.fetchNext()
    if (nextPage) {
      allComments = [...allComments, ...nextPage.nodes]
      commentsPage = nextPage
    } else {
      break
    }
  }

  console.log(
    `[syncIssue] Fetched ${allComments.length} comments from Linear API for issue ${linearIssueId}`
  )

  // Transform Linear SDK comments to include parentId
  // Linear SDK comments have a lazy-loading 'parent' promise, not a direct 'parentId' field
  const commentsWithParentId: CommentWithParent[] = await Promise.all(
    allComments.map(async (comment) => {
      const parent = await comment.parent
      return {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        parentId: parent?.id ?? null,
      }
    })
  )

  console.log(
    `[syncIssue] Resolved parent relationships for ${commentsWithParentId.length} comments`
  )

  const attachments = await issue.attachments()
  const labels = await issue.labels()
  const assignee = await issue.assignee
  const creator = await issue.creator
  const project = await issue.project
  const cycle = await issue.cycle
  const parent = await issue.parent
  const team = await issue.team
  const state = await issue.state

  // 3. Extract and update issue metadata
  const metadata = extractIssueMetadata({
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? null,
    descriptionData: null,
    url: issue.url,
    estimate: issue.estimate ?? null,
    priority: issue.priority ?? null,
    labels: labels.nodes,
    assignee: assignee
      ? {
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
        }
      : null,
    creator: creator
      ? {
          id: creator.id,
          name: creator.name,
          email: creator.email,
        }
      : null,
    project: project
      ? {
          id: project.id,
          name: project.name,
        }
      : null,
    cycle: cycle?.name
      ? {
          id: cycle.id,
          name: cycle.name,
          number: cycle.number,
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    dueDate: issue.dueDate,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    parent: parent
      ? {
          id: parent.id,
          identifier: parent.identifier,
        }
      : null,
    team: team
      ? {
          id: team.id,
          key: team.key,
          name: team.name,
        }
      : null,
    state: state
      ? {
          id: state.id,
          name: state.name,
          type: state.type,
        }
      : null,
  })
  await db.update(issues).set(metadata).where(eq(issues.id, issueId))

  // 4. Sync comments → agent mentions
  await syncComments(issueId, commentsWithParentId)

  // 5. Sync attachments → attempts
  await syncAttachments(issueId, attachments.nodes)

  // 6. Dispatch missing agents (Milestone 3)
  // This is idempotent - only dispatches agents not already in issue_agents table
  // Only dispatches to open/in_progress issues
  try {
    const { dispatchMissingAgents } = await import('./agent-dispatch')
    await dispatchMissingAgents(issueId)
  } catch (error) {
    // Log but don't fail sync if dispatch fails
    console.error('Failed to dispatch missing agents:', error)
  }
}

/**
 * Determines which agent submitted a PR based on comment thread
 * Walks up the parent chain to find the root @mention comment
 * @param commentId - ID of the PR comment
 * @param mentionedAgents - Agents mentioned in the PR comment itself
 * @param commentAgents - Map of comment IDs to agent mentions
 * @param commentParents - Map of comment IDs to parent comment IDs
 * @returns Agent name or "unknown"
 */
async function determineAgentOwnershipFromThread(
  commentId: string,
  mentionedAgents: string[],
  commentAgents: Map<string, string[]>,
  commentParents: Map<string, string | null>
): Promise<string> {
  console.log(
    `[determineOwnership] Starting for comment ${commentId.substring(0, 8)}...`
  )

  // First, check if agent is mentioned in this comment
  if (mentionedAgents.length > 0 && mentionedAgents[0]) {
    console.log(
      `[determineOwnership]   ✓ Found agent in current comment: ${mentionedAgents[0]}`
    )
    return mentionedAgents[0]
  }

  console.log(
    `[determineOwnership]   No agent in current comment, walking parent chain...`
  )

  // Walk up the parent chain to find @mentions
  // NO GUESSING - agent must be explicitly mentioned
  let currentId: string | null = commentId
  const visited = new Set<string>()
  let depth = 0

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    depth++

    // Check if this comment has an agent mention
    const agents = commentAgents.get(currentId) ?? []
    console.log(
      `[determineOwnership]   Depth ${depth}: comment ${currentId.substring(0, 8)}... has ${agents.length} agents: ${agents.join(', ') || 'none'}`
    )

    if (agents.length > 0 && agents[0]) {
      console.log(
        `[determineOwnership]   ✓ Found agent at depth ${depth}: ${agents[0]}`
      )
      return agents[0]
    }

    // Move to parent
    const parentId = commentParents.get(currentId)
    console.log(
      `[determineOwnership]   Parent of ${currentId.substring(0, 8)}... is ${parentId ? parentId.substring(0, 8) + '...' : 'null'}`
    )
    currentId = parentId ?? null

    if (!currentId) {
      console.log(
        `[determineOwnership]   ✗ Reached end of parent chain (no more parents)`
      )
    }
  }

  if (currentId && visited.has(currentId)) {
    console.log(
      `[determineOwnership]   ✗ Detected cycle in comment chain at ${currentId.substring(0, 8)}...`
    )
  }

  console.log(
    `[determineOwnership]   ✗ No agent found in entire chain - returning 'unknown'`
  )
  return 'unknown'
}

type CommentWithParent = {
  id: string
  body?: string | null
  createdAt: Date
  parentId?: string | null
}

/**
 * Builds maps of comment agents and parent relationships
 * @param issueId - Database issue ID
 * @param comments - Comment nodes to process
 * @returns Maps of comment agents and parent IDs
 */
async function buildCommentMaps(
  issueId: string,
  comments: CommentWithParent[]
): Promise<{
  commentAgents: Map<string, string[]>
  commentParents: Map<string, string | null>
}> {
  const commentAgents: Map<string, string[]> = new Map()
  const commentParents: Map<string, string | null> = new Map()

  for (const comment of comments) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt
    const commentId = comment.id
    const mentionedAgents: string[] = []
    const parentId = comment.parentId ?? null

    commentParents.set(commentId, parentId)

    console.log(
      `[syncComments] Comment ${commentId.substring(0, 8)}... ` +
        `parentId: ${parentId ? parentId.substring(0, 8) + '...' : 'null'}, ` +
        `body preview: ${body.substring(0, 50)}...`
    )

    // Find agent mentions in comment
    // Get full agent configs to map from displayName to agent name
    const agentConfigs = await getAgentConfigs()
    for (const agent of agentConfigs) {
      const displayName = agent.displayName.toLowerCase()
      const lowerBody = body.toLowerCase()

      // Match both @displayName and @[displayName] formats
      if (
        lowerBody.includes(`@${displayName}`) ||
        lowerBody.includes(`@[${displayName}]`)
      ) {
        // Use the actual agent name (not displayName) for database insertion
        mentionedAgents.push(agent.name)

        await db
          .insert(issueAgents)
          .values({
            issueId,
            agentName: agent.name, // Use agent.name, not displayName
            status: 'pending',
            triggeredAt: createdAt,
          })
          .onConflictDoUpdate({
            target: [issueAgents.issueId, issueAgents.agentName],
            set: { triggeredAt: createdAt },
          })
      }
    }

    if (mentionedAgents.length > 0) {
      console.log(
        `[syncComments]   ✓ Found agent mentions: ${mentionedAgents.join(', ')}`
      )
    }

    commentAgents.set(commentId, mentionedAgents)
  }

  return { commentAgents, commentParents }
}

/**
 * Processes PR URLs found in comments and creates attempts
 * @param issueId - Database issue ID
 * @param comments - Comment nodes to search for PR URLs
 * @param commentAgents - Map of comment IDs to agent mentions
 * @param commentParents - Map of comment IDs to parent IDs
 */
async function processPRURLs(
  issueId: string,
  comments: CommentWithParent[],
  commentAgents: Map<string, string[]>,
  commentParents: Map<string, string | null>
): Promise<void> {
  for (const comment of comments) {
    const body = comment.body ?? ''
    const createdAt = comment.createdAt
    const commentId = comment.id
    const mentionedAgents = commentAgents.get(commentId) ?? []

    const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
    let prMatch: RegExpExecArray | null

    while ((prMatch = prRegex.exec(body)) !== null) {
      const [, org, repoName, prNumber] = prMatch
      if (!org || !repoName || !prNumber) continue

      const repo = `${org}/${repoName}`
      const prUrl = `https://github.com/${org}/${repoName}/pull/${prNumber}`

      console.log(
        `[syncComments] Found PR URL in comment ${commentId.substring(0, 8)}...: ${prUrl}`
      )
      console.log(
        `[syncComments]   This comment has ${mentionedAgents.length} agent mentions: ${mentionedAgents.join(', ') || 'none'}`
      )
      console.log(
        `[syncComments]   Parent ID: ${commentParents.get(commentId) ?? 'null'}`
      )

      const agentName = await determineAgentOwnershipFromThread(
        commentId,
        mentionedAgents,
        commentAgents,
        commentParents
      )

      console.log(
        `[syncComments]   ✓ Determined agent: ${agentName}${agentName === 'unknown' ? ' ⚠️  UNKNOWN!' : ''}`
      )

      await db
        .insert(attempts)
        .values({
          issueId,
          agentName,
          repo,
          prNumber: Number.parseInt(prNumber, 10),
          prUrl,
          branch: null,
          openedAt: createdAt,
          mergedAt: undefined,
          status: 'open',
          commitCount: 1,
          sourceAttachmentId: null,
          sourceAttachmentUrl: null,
        })
        .onConflictDoUpdate({
          target: [attempts.issueId, attempts.agentName, attempts.prNumber],
          set: { prUrl }, // Preserve status - GitHub webhook is source of truth
        })

      if (agentName !== 'unknown') {
        // Only update to 'submitted' if currently 'pending'
        // Preserve 'accepted'/'rejected' statuses set by updateWinner()
        await db
          .update(issueAgents)
          .set({ status: 'submitted' })
          .where(
            and(
              eq(issueAgents.issueId, issueId),
              eq(issueAgents.agentName, agentName),
              eq(issueAgents.status, 'pending')
            )
          )
      }
    }
  }
}

/**
 * Syncs comments to find agent mentions and PR links
 * @param issueId - Database issue ID
 * @param comments - Comment nodes from Linear API
 */
async function syncComments(
  issueId: string,
  comments: CommentWithParent[]
): Promise<void> {
  console.log(`[syncComments] Starting sync for issue ${issueId}`)
  console.log(`[syncComments] Total comments to process: ${comments.length}`)

  // PHASE 1: Build agent mentions map and parent relationships
  const { commentAgents, commentParents } = await buildCommentMaps(
    issueId,
    comments
  )

  console.log(
    `[syncComments] Phase 1 complete. Built maps with ${commentAgents.size} comments, ${commentParents.size} parent relationships`
  )

  // PHASE 2: Extract PR URLs and create attempts
  await processPRURLs(issueId, comments, commentAgents, commentParents)
}

/**
 * Syncs attachments to find PR links
 * @param _issueId - Database issue ID (unused - attachments are skipped)
 * @param attachments - Attachment nodes from Linear API
 */
async function syncAttachments(
  _issueId: string,
  attachments: Array<{
    url?: string | null
    title?: string | null
    subtitle?: string | null
    createdAt: Date
    id: string
  }>
): Promise<void> {
  for (const attachment of attachments) {
    const url = attachment.url
    if (!url) continue

    const prMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!prMatch) continue

    const [, org, repoName, prNumber] = prMatch
    if (!org || !repoName || !prNumber) continue

    // Orphaned attachments (created outside comment thread) are skipped
    // Agent tracking requires PRs to be linked via comments with @mentions
    // These attachments will be picked up by comment sync when agent posts PR link
    console.log(
      `Skipping orphaned attachment ${attachment.id} for PR ${url} - ` +
        `agent tracking requires PR links in comments with @mentions`
    )
    continue
  }
}
