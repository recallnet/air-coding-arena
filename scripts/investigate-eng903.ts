/**
 * Script to investigate Linear issue ENG-903 comment structure
 * Checks PR #1562 attribution and parent relationships
 */

import { LinearClient } from '@linear/sdk'

const LINEAR_ISSUE_IDENTIFIER = 'ENG-903'
const PR_NUMBER = '1562'

async function investigateIssue(): Promise<void> {
  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not found in environment')
  }

  console.log('🔍 Investigating Linear issue ENG-903...\n')

  const client = new LinearClient({ apiKey })

  try {
    // Fetch the issue by number (903) and team key (ENG)
    const issuesResult = await client.issues({
      filter: {
        number: { eq: 903 },
        team: { key: { eq: 'ENG' } },
      },
    })

    const issue = issuesResult.nodes[0]
    if (!issue) {
      throw new Error(`Issue ${LINEAR_ISSUE_IDENTIFIER} not found`)
    }
    console.log(`✅ Found issue: ${issue.identifier} - ${issue.title}`)
    console.log(`   URL: ${issue.url}\n`)

    // Fetch all comments
    const commentsResult = await issue.comments()
    const comments = commentsResult.nodes

    console.log(`📝 Total comments: ${comments.length}\n`)

    // Build parent chain map
    const commentMap = new Map<
      string,
      {
        id: string
        body: string
        createdAt: Date
        parentId: string | null
        url?: string | null
      }
    >()

    console.log('🔗 Building comment parent relationships...')
    for (const comment of comments) {
      const parent = await comment.parent
      commentMap.set(comment.id, {
        id: comment.id,
        body: comment.body ?? '',
        createdAt: comment.createdAt,
        parentId: parent?.id ?? null,
        url: comment.url,
      })
    }
    console.log('✅ Parent relationships mapped\n')

    // Find comments containing PR #1562
    const pr1562Comments = Array.from(commentMap.values()).filter(
      (c) =>
        c.body.includes(PR_NUMBER) ||
        c.body.includes(`pull/${PR_NUMBER}`) ||
        c.body.includes(`/1562`)
    )

    console.log(
      `🎯 Found ${pr1562Comments.length} comment(s) mentioning PR #${PR_NUMBER}:\n`
    )

    for (const comment of pr1562Comments) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`Comment ID: ${comment.id}`)
      console.log(`Created: ${comment.createdAt.toISOString()}`)
      console.log(`URL: ${comment.url ?? 'N/A'}`)
      console.log(`\nBody:\n${comment.body.substring(0, 200)}${comment.body.length > 200 ? '...' : ''}`)

      // Check for agent mentions in this comment
      const agentMentions = extractAgentMentions(comment.body)
      if (agentMentions.length > 0) {
        console.log(`\n🤖 Agent mentions in this comment: ${agentMentions.join(', ')}`)
      } else {
        console.log(`\n❌ No agent mentions in this comment`)
      }

      // Walk up the parent chain
      console.log(`\n🔼 Walking up parent chain:`)
      let currentId: string | null = comment.parentId
      let depth = 1
      const visited = new Set<string>([comment.id])

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        const parentComment = commentMap.get(currentId)

        if (!parentComment) {
          console.log(`   └─ [${depth}] Parent ID ${currentId} not found in comment list`)
          break
        }

        const parentMentions = extractAgentMentions(parentComment.body)
        const parentUserMentions = extractUserMentions(parentComment.body)
        const mentionsText =
          parentMentions.length > 0
            ? ` 🤖 MENTIONS: ${parentMentions.join(', ')}`
            : ''
        const userMentionsText =
          parentUserMentions.length > 0
            ? ` 👤 USER MENTIONS: ${parentUserMentions.join(', ')}`
            : ''

        console.log(
          `   └─ [${depth}] Parent: ${currentId}${mentionsText}${userMentionsText}`
        )
        console.log(
          `      Created: ${parentComment.createdAt.toISOString()}`
        )
        console.log(`      Full body: ${parentComment.body}`)
        console.log()

        if (parentMentions.length > 0) {
          console.log(
            `      ✨ FOUND AGENT MENTION: This PR should be attributed to "${parentMentions[0]}"`
          )
          break
        }

        currentId = parentComment.parentId
        depth++
      }

      if (!comment.parentId) {
        console.log(`   └─ This is a root comment (no parent)`)
      }

      console.log()
    }

    // Check all comments for any agent mentions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 ALL AGENT MENTIONS IN ALL COMMENTS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    let foundAnyAgentMentions = false
    for (const [commentId, commentData] of commentMap.entries()) {
      const agentMentions = extractAgentMentions(commentData.body)
      const userMentions = extractUserMentions(commentData.body)

      if (agentMentions.length > 0 || userMentions.length > 0) {
        console.log(`\nComment ID: ${commentId}`)
        console.log(`Created: ${commentData.createdAt.toISOString()}`)
        if (agentMentions.length > 0) {
          console.log(`  🤖 Agent mentions: ${agentMentions.join(', ')}`)
          foundAnyAgentMentions = true
        }
        if (userMentions.length > 0) {
          console.log(`  👤 User mentions: ${userMentions.join(', ')}`)
        }
        console.log(
          `  Body preview: ${commentData.body.substring(0, 150).replace(/\n/g, ' ')}...`
        )
      }
    }

    if (!foundAnyAgentMentions) {
      console.log(
        '\n❌ NO AGENT HANDLES (@cursor, @aider, etc.) found in ANY comment'
      )
      console.log('   Only Linear user mentions (@[username](id)) were found')
      console.log('   This explains why PR #1562 is marked as "unknown" agent')
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 SUMMARY')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    if (pr1562Comments.length === 0) {
      console.log('❌ No comments found containing PR #1562')
      console.log('   This PR may not be linked in Linear comments.')
    } else {
      for (const comment of pr1562Comments) {
        const agentInComment = extractAgentMentions(comment.body)
        let attributedAgent = 'unknown'

        if (agentInComment.length > 0) {
          attributedAgent = agentInComment[0] as string
        } else {
          // Walk up parent chain to find agent
          let currentId: string | null = comment.parentId
          const visited = new Set<string>([comment.id])

          while (currentId && !visited.has(currentId)) {
            visited.add(currentId)
            const parentComment = commentMap.get(currentId)
            if (!parentComment) break

            const parentMentions = extractAgentMentions(parentComment.body)
            if (parentMentions.length > 0) {
              attributedAgent = parentMentions[0] as string
              break
            }

            currentId = parentComment.parentId
          }
        }

        console.log(`\nPR #${PR_NUMBER} (Comment ${comment.id}):`)
        console.log(`  ✅ Correct attribution: ${attributedAgent}`)
        console.log(
          `  🔗 Has parent: ${comment.parentId ? 'YES' : 'NO (root comment)'}`
        )
        console.log(`  📝 Direct mention: ${agentInComment.length > 0 ? 'YES' : 'NO'}`)

        if (
          attributedAgent === 'unknown' &&
          agentInComment.length === 0 &&
          comment.parentId
        ) {
          console.log(
            '  ⚠️  WARNING: Has parent but no agent mention found in chain!'
          )
        }
      }
    }

    console.log()
  } catch (error) {
    console.error('❌ Error investigating issue:', error)
    throw error
  }
}

/**
 * Extract agent mentions from comment body
 */
function extractAgentMentions(body: string): string[] {
  const mentions: string[] = []
  const agentHandles = [
    '@aider',
    '@cursor',
    '@claude',
    '@windsurf',
    '@copilot',
    '@cline',
    '@bolt',
    '@v0',
    '@lovable',
    '@replit',
  ]

  for (const handle of agentHandles) {
    if (body.toLowerCase().includes(handle.toLowerCase())) {
      mentions.push(handle.substring(1).toLowerCase())
    }
  }

  return mentions
}

/**
 * Extract Linear user mentions from comment body
 * Format: @[username](user-id)
 */
function extractUserMentions(body: string): string[] {
  const mentions: string[] = []
  const mentionRegex = /@\[([^\]]+)\]\([^)]+\)/g
  let match: RegExpExecArray | null

  while ((match = mentionRegex.exec(body)) !== null) {
    if (match[1]) {
      mentions.push(match[1])
    }
  }

  return mentions
}

// Run the investigation
investigateIssue().catch((error: Error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
