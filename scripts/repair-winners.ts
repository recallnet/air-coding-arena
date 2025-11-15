#!/usr/bin/env tsx
/**
 * Repair script - finds issues with merged PRs but no winner, and fixes them
 * This repairs database state from before the Linear sync fix was deployed
 */
import 'dotenv/config'
import { db } from '../src/db/client'
import { issues, attempts } from '../src/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { updateWinner } from '../src/lib/update-winner'

async function main() {
  console.log('🔧 Repairing issues with merged PRs but no winner...\n')

  // Step 1: Fix attempts that have mergedAt set but status='closed' (should be 'merged')
  console.log('Step 1: Fixing attempts with mergedAt but status=closed...')
  const wrongStatusAttempts = await db
    .select({
      id: attempts.id,
      agentName: attempts.agentName,
      prNumber: attempts.prNumber,
    })
    .from(attempts)
    .where(
      and(
        sql`${attempts.mergedAt} IS NOT NULL`,
        eq(attempts.status, 'closed')
      )
    )

  if (wrongStatusAttempts.length > 0) {
    console.log(`Found ${wrongStatusAttempts.length} attempts with wrong status:`)
    for (const attempt of wrongStatusAttempts) {
      console.log(`  PR #${attempt.prNumber} (${attempt.agentName}): closed → merged`)
      await db
        .update(attempts)
        .set({ status: 'merged' })
        .where(eq(attempts.id, attempt.id))
    }
    console.log('✅ Fixed attempt statuses\n')
  } else {
    console.log('✅ No wrong status attempts found\n')
  }

  // Step 2: Find all issues that have merged attempts but no winner set
  console.log('Step 2: Finding issues with merged PRs but no winner...')
  const brokenIssues = await db
    .select({
      issueId: issues.id,
      linearKey: issues.linearKey,
      title: issues.title,
    })
    .from(issues)
    .innerJoin(attempts, eq(attempts.issueId, issues.id))
    .where(and(isNull(issues.winnerAttemptId), eq(attempts.status, 'merged')))
    .groupBy(issues.id, issues.linearKey, issues.title)

  if (brokenIssues.length === 0) {
    console.log('✅ No broken issues found - database is healthy!')
    return
  }

  console.log(`Found ${brokenIssues.length} issues to repair:\n`)

  for (const issue of brokenIssues) {
    console.log(`\n📋 ${issue.linearKey}: ${issue.title}`)
    console.log(`   Calling updateWinner()...`)

    try {
      await updateWinner(issue.issueId)
      console.log(`   ✅ Winner determined and ratings calculated`)
    } catch (error) {
      console.error(`   ❌ Failed to repair:`, error)
    }
  }

  console.log(`\n🎉 Repair complete!`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
