#!/usr/bin/env tsx
import { LinearClient } from '@linear/sdk'

async function main() {
  // Use hardcoded API key from .env.local since env vars aren't loading properly
  const apiKey = 'REDACTED_REVOKE_BEFORE_USE'

  const client = new LinearClient({ apiKey })

  // ENG-901 Linear ID (from CURSOR_DISPATCH_INVESTIGATION_REPORT.md)
  const linearIssueId = 'ca76c613-cf9d-478c-beaa-ca17f4fc3f04'
  const issue = await client.issue(linearIssueId)
  const comments = await issue.comments()

  console.log(`\n${'='.repeat(80)}`)
  console.log(`Issue: ENG-901 (${linearIssueId})`)
  console.log(`Title: ${issue.title}`)
  console.log(`Found ${comments.nodes.length} comments`)
  console.log(`${'='.repeat(80)}\n`)

  // First, collect all comments and build a map
  const commentMap = new Map<string, any>()
  const pr1561Comments: any[] = []

  for (const comment of comments.nodes) {
    commentMap.set(comment.id, comment)

    // Check if this comment contains PR #1561
    if (comment.body?.includes('1561') || comment.body?.includes('/pull/1561')) {
      pr1561Comments.push(comment)
    }
  }

  console.log(`Found ${pr1561Comments.length} comment(s) mentioning PR #1561\n`)

  // For each PR #1561 comment, walk up the parent chain
  for (const comment of pr1561Comments) {
    console.log('━'.repeat(80))
    console.log(`\nComment containing PR #1561:`)
    console.log(`  ID: ${comment.id}`)
    console.log(`  Created: ${comment.createdAt}`)
    console.log(`  Body preview: ${comment.body?.substring(0, 200).replace(/\n/g, ' ')}`)

    // Check for parentId property
    const commentAny = comment as any
    console.log(`\n  Direct parentId property: ${commentAny.parentId ?? 'undefined'}`)

    // Try to await parent getter
    try {
      console.log(`\n  Attempting to call comment.parent getter...`)
      const parent = await comment.parent

      if (parent) {
        console.log(`  ✅ Parent found via getter!`)
        console.log(`     Parent ID: ${parent.id}`)
        console.log(`     Parent created: ${parent.createdAt}`)
        console.log(`     Parent body preview: ${parent.body?.substring(0, 200).replace(/\n/g, ' ')}`)

        // Check if parent contains agent mention (Linear format: @[agent](user-id))
        const linearMentions = parent.body?.match(/@\[(engine|cursor|cyrus|claude|factory)\]/gi)
        const simpleMentions = parent.body?.match(/@(engine|cursor|cyrus|claude|factory)/gi)

        if (linearMentions) {
          console.log(`     🎯 Agent mentions in parent (Linear format): ${linearMentions.join(', ')}`)
        }
        if (simpleMentions) {
          console.log(`     🎯 Agent mentions in parent (simple format): ${simpleMentions.join(', ')}`)
        }
        if (!linearMentions && !simpleMentions) {
          console.log(`     ⚠️  No agent mentions in parent`)
        }

        // Test if linear-sync.ts detection would work
        const agentHandles = ['@engine', '@cursor', '@cyrus', '@factory', '@claude']
        const detectedAgents = agentHandles.filter(handle =>
          parent.body?.toLowerCase().includes(handle.toLowerCase())
        )
        if (detectedAgents.length > 0) {
          console.log(`     ✅ linear-sync.ts would detect: ${detectedAgents.map(h => h.substring(1)).join(', ')}`)
        }

        // Walk up the parent chain
        let currentParent = parent
        let depth = 1
        const visited = new Set([comment.id, parent.id])

        while (currentParent && depth < 10) {
          try {
            const nextParent = await currentParent.parent
            if (!nextParent || visited.has(nextParent.id)) break

            depth++
            visited.add(nextParent.id)
            console.log(`\n  Level ${depth} parent:`)
            console.log(`     ID: ${nextParent.id}`)
            console.log(`     Created: ${nextParent.createdAt}`)
            console.log(`     Body preview: ${nextParent.body?.substring(0, 200).replace(/\n/g, ' ')}`)

            const linearMentions = nextParent.body?.match(/@\[(engine|cursor|cyrus|claude|factory)\]/gi)
            const simpleMentions = nextParent.body?.match(/@(engine|cursor|cyrus|claude|factory)/gi)
            if (linearMentions || simpleMentions) {
              console.log(`     🎯 Agent mentions: ${(linearMentions || simpleMentions)!.join(', ')}`)
            }

            // Test detection
            const agentHandles = ['@engine', '@cursor', '@cyrus', '@factory', '@claude']
            const detected = agentHandles.filter(h => nextParent.body?.toLowerCase().includes(h.toLowerCase()))
            if (detected.length > 0) {
              console.log(`     ✅ Would detect: ${detected.map(h => h.substring(1)).join(', ')}`)
            }

            currentParent = nextParent
          } catch (error) {
            console.log(`     ⚠️  Error getting next parent: ${error}`)
            break
          }
        }

        if (depth >= 10) {
          console.log(`\n  ⚠️  Stopped at depth 10 (max chain length)`)
        }

      } else {
        console.log(`  ❌ No parent (root comment)`)
      }
    } catch (error) {
      console.log(`  ⚠️  Error calling parent getter: ${error}`)
    }

    console.log('\n' + '━'.repeat(80))
  }

  // Also list ALL comments for context
  console.log(`\n\n${'='.repeat(80)}`)
  console.log(`ALL COMMENTS ON ENG-901 (for context):`)
  console.log(`${'='.repeat(80)}\n`)

  for (const comment of comments.nodes) {
    console.log(`Comment ID: ${comment.id}`)
    console.log(`  Created: ${comment.createdAt}`)
    console.log(`  Body preview: ${comment.body?.substring(0, 150).replace(/\n/g, ' ')}...`)

    const commentAny = comment as any
    if (commentAny.parentId) {
      console.log(`  ParentId: ${commentAny.parentId}`)
    }

    // Check for agent mentions
    const linearMentions = comment.body?.match(/@\[(engine|cursor|cyrus|claude|factory)\]/gi)
    const simpleMentions = comment.body?.match(/@(engine|cursor|cyrus|claude|factory)/gi)
    if (linearMentions || simpleMentions) {
      console.log(`  🎯 Agent mentions: ${(linearMentions || simpleMentions)!.join(', ')}`)
    }

    // Check for PR URLs
    const prUrls = comment.body?.match(/github\.com\/\S+\/pull\/\d+/gi)
    if (prUrls) {
      console.log(`  🔗 PR URLs: ${prUrls.join(', ')}`)
    }

    console.log('')
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`SUMMARY`)
  console.log(`${'='.repeat(80)}`)
  console.log(`Total comments: ${comments.nodes.length}`)
  console.log(`Comments mentioning PR #1561: ${pr1561Comments.length}`)
  console.log(`\nConclusion:`)

  if (pr1561Comments.length === 0) {
    console.log(`  ⚠️  No comments found containing PR #1561`)
    console.log(`  This suggests the PR URL might be formatted differently`)
  } else {
    console.log(`  ✅ Found PR #1561 references`)
    console.log(`  Check the parent chain analysis above to determine correct agent attribution`)
  }

  console.log(`${'='.repeat(80)}\n`)
}

main().catch(console.error)
