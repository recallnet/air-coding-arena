/**
 * Script to fix attempts with agentName='unknown'
 *
 * Attempts to determine the correct agent by:
 * 1. Checking if only one agent was dispatched to the issue
 * 2. Looking at Linear comments to find @mentions near the PR link
 * 3. Manual mapping if needed
 *
 * Usage: npx tsx scripts/fix-unknown-agents.ts
 */

import { LinearClient } from '@linear/sdk'
import { eq, and } from 'drizzle-orm'

import { db } from '../src/db/client'
import { attempts, issueAgents, issues } from '../src/db/schema'

async function fixUnknownAgents(): Promise<void> {
  console.log('🔍 Finding attempts with agentName="unknown"...')

  // Find all unknown attempts
  const unknownAttempts = await db
    .select({
      attemptId: attempts.id,
      issueId: attempts.issueId,
      prUrl: attempts.prUrl,
      prNumber: attempts.prNumber,
      repo: attempts.repo,
      openedAt: attempts.openedAt,
    })
    .from(attempts)
    .where(eq(attempts.agentName, 'unknown'))

  console.log(`Found ${unknownAttempts.length} attempts with unknown agent\n`)

  if (unknownAttempts.length === 0) {
    console.log('✅ No unknown agents to fix!')
    return
  }

  const apiKey = process.env['LINEAR_API_KEY']
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY not configured')
  }

  const client = new LinearClient({ apiKey })

  let fixedCount = 0
  let skippedCount = 0

  for (const attempt of unknownAttempts) {
    console.log(`\n📌 Processing PR: ${attempt.prUrl}`)

    // Get the issue details
    const issueResult = await db
      .select({
        linearId: issues.linearId,
        linearKey: issues.linearKey,
      })
      .from(issues)
      .where(eq(issues.id, attempt.issueId))
      .limit(1)

    if (!issueResult[0]) {
      console.log('   ⚠️  Issue not found in database, skipping')
      skippedCount++
      continue
    }

    const issue = issueResult[0]
    console.log(`   Issue: ${issue.linearKey}`)

    // Strategy 1: Check if only one agent was dispatched to this issue
    const dispatchedAgents = await db
      .select({ agentName: issueAgents.agentName })
      .from(issueAgents)
      .where(eq(issueAgents.issueId, attempt.issueId))

    if (dispatchedAgents.length === 1 && dispatchedAgents[0]) {
      const correctAgent = dispatchedAgents[0].agentName
      console.log(`   ✅ Only one agent dispatched: ${correctAgent}`)

      await fixAttempt(attempt.attemptId, attempt.issueId, correctAgent)
      fixedCount++
      continue
    }

    // Strategy 2: Look at Linear comments near the PR link
    console.log(`   🔎 Multiple agents (${dispatchedAgents.length}), checking Linear comments...`)

    try {
      const linearIssue = await client.issue(issue.linearId)
      const commentsPage = await linearIssue.comments({ first: 100 })
      const allComments = commentsPage.nodes

      // Find comments with this PR URL
      const prComments = allComments.filter(
        (c) => c.body && c.body.includes(`pull/${attempt.prNumber}`)
      )

      if (prComments.length === 0) {
        console.log('   ⚠️  No comments found with this PR link, skipping')
        skippedCount++
        continue
      }

      // Check each PR comment and its thread for @mentions
      for (const prComment of prComments) {
        const body = prComment.body?.toLowerCase() ?? ''

        // Check for agent mentions in this comment or parent
        for (const { agentName } of dispatchedAgents) {
          if (
            body.includes(`@${agentName}`) ||
            body.includes(`@[${agentName}]`)
          ) {
            console.log(`   ✅ Found @${agentName} in comment with PR link`)
            await fixAttempt(attempt.attemptId, attempt.issueId, agentName)
            fixedCount++
            break
          }
        }
      }

      if (fixedCount === 0) {
        console.log('   ⚠️  Could not determine agent from comments, skipping')
        skippedCount++
      }
    } catch (error) {
      console.error(`   ❌ Error fetching Linear comments:`, error)
      skippedCount++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Fixed: ${fixedCount}`)
  console.log(`   Skipped: ${skippedCount}`)
  console.log(`   Total: ${unknownAttempts.length}`)
}

async function fixAttempt(
  attemptId: string,
  issueId: string,
  correctAgent: string
): Promise<void> {
  // Update the attempt with the correct agent
  await db
    .update(attempts)
    .set({ agentName: correctAgent })
    .where(eq(attempts.id, attemptId))

  // Update agent status to submitted
  await db
    .update(issueAgents)
    .set({ status: 'submitted' })
    .where(
      and(
        eq(issueAgents.issueId, issueId),
        eq(issueAgents.agentName, correctAgent)
      )
    )

  console.log(`   ✅ Fixed: updated to agent="${correctAgent}"`)
}

// Run the fix
fixUnknownAgents()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
