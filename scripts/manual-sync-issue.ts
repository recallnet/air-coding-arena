/**
 * Manual script to sync a specific Linear issue
 * Usage: pnpm tsx scripts/manual-sync-issue.ts <linear-issue-id>
 */

import { db } from '../src/db/client.js'
import { issues } from '../src/db/schema.js'
import { syncIssueFromLinear } from '../src/lib/linear-sync.js'

const linearIssueId = process.argv[2]

if (!linearIssueId) {
  console.error('Usage: pnpm tsx scripts/manual-sync-issue.ts <linear-issue-id>')
  console.error('Example: pnpm tsx scripts/manual-sync-issue.ts e7376814-a82e-48a4-bea7-55a263f88a09')
  process.exit(1)
}

console.log(`🔄 Syncing issue ${linearIssueId}...`)

// First, create the issue in the database so sync has something to work with
await db
  .insert(issues)
  .values({
    linearId: linearIssueId,
    linearKey: 'TEMP',  // Will be updated by sync
    title: 'Syncing...',
    url: 'https://linear.app',
    arenaReadyLabeledAt: new Date(),
  })
  .onConflictDoNothing()

// Now sync
await syncIssueFromLinear(linearIssueId)

console.log('✅ Sync complete!')

// Show results
const issue = await db.query.issues.findFirst({
  where: (issues, { eq }) => eq(issues.linearId, linearIssueId),
  with: {
    agents: true,
    attempts: true,
  },
})

console.log('\n📊 Results:')
console.log(`  Issue: ${issue?.linearKey} - ${issue?.title}`)
console.log(`  Status: ${issue?.status}`)
console.log(`  Agents: ${issue?.agents.length ?? 0}`)
for (const agent of issue?.agents ?? []) {
  console.log(`    - ${agent.agentName}: ${agent.status}`)
}
console.log(`  Attempts: ${issue?.attempts.length ?? 0}`)
for (const attempt of issue?.attempts ?? []) {
  console.log(`    - ${attempt.agentName}: ${attempt.status} (PR #${attempt.prNumber})`)
}

process.exit(0)
