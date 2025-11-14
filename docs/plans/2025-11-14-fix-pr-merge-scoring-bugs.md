# Fix PR Merge → Scoring Flow Bugs

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 critical bugs in the PR merge → winner selection → rating update flow

**Architecture:** Linear webhook drives winner selection atomically, updates issue status, marks non-participants as ignored, then triggers rating updates using simplified win/loss model (not multi-place ranking)

**Tech Stack:** Drizzle ORM, PostgreSQL transactions, OpenSkill (Plackett-Luce), Vitest

---

## Bug Summary

1. **Bug #1**: Issue status not updated to 'completed' when winner selected
2. **Bug #5**: Agents who never submit PRs not marked as 'ignored'
3. **Bug #4**: Ranking uses close time instead of simple win/loss (CRITICAL - breaks OpenSkill model)
4. **Bug #3**: GitHub API fallback violates error philosophy
5. **Bug #2**: Race condition in GitHub webhook agent status updates

---

## Task 1: Fix Issue Status and Mark Ignored Agents (Bugs #1 + #5)

**Files:**
- Modify: `src/app/api/linear/webhook/route.ts:419-431`
- Test: `src/app/api/linear/webhook/route.test.ts`

**Step 1: Write failing test for issue status completed**

Add to `src/app/api/linear/webhook/route.test.ts` after existing tests:

```typescript
it('should mark issue as completed when winner is set', async () => {
  // Setup: Create issue in 'in_progress' status
  const [issue] = await db.insert(issues).values({
    linearId: 'issue-123',
    linearKey: 'TEST-1',
    title: 'Test Issue',
    url: 'https://linear.app/test/issue/TEST-1',
    status: 'in_progress',
    arenaReadyLabeledAt: new Date(),
  }).returning()

  // Create merged attempt
  await db.insert(attempts).values({
    issueId: issue.id,
    agentName: 'agent-winner',
    prNumber: 1,
    repo: 'test/repo',
    status: 'merged',
    mergedAt: new Date(),
    openedAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    commitCount: 5,
  })

  // Call updateWinner (need to export it or call via webhook)
  // For now, trigger via webhook payload
  const payload = {
    action: 'update',
    type: 'Issue',
    data: {
      id: 'issue-123',
      identifier: 'TEST-1',
      state: { name: 'Done' }
    }
  }

  await POST(new Request('http://localhost/api/linear/webhook', {
    method: 'POST',
    headers: { 'linear-signature': 'valid-sig' },
    body: JSON.stringify(payload)
  }))

  // Verify issue status is completed
  const [updatedIssue] = await db.select()
    .from(issues)
    .where(eq(issues.id, issue.id))

  expect(updatedIssue.status).toBe('completed')
  expect(updatedIssue.winnerAttemptId).toBeTruthy()
})
```

**Step 2: Write failing test for ignored agents**

Add to same test file:

```typescript
it('should mark non-submitting agents as ignored when winner is set', async () => {
  // Setup issue
  const [issue] = await db.insert(issues).values({
    linearId: 'issue-456',
    linearKey: 'TEST-2',
    title: 'Test Issue 2',
    url: 'https://linear.app/test/issue/TEST-2',
    status: 'in_progress',
    arenaReadyLabeledAt: new Date(),
  }).returning()

  // Create merged attempt (winner)
  await db.insert(attempts).values({
    issueId: issue.id,
    agentName: 'agent-winner',
    prNumber: 1,
    repo: 'test/repo',
    status: 'merged',
    mergedAt: new Date(),
    openedAt: new Date(),
    commitCount: 5,
  })

  // Create agent records: winner (submitted), loser (submitted), non-participant (pending)
  await db.insert(issueAgents).values([
    { issueId: issue.id, agentName: 'agent-winner', status: 'submitted', triggeredAt: new Date() },
    { issueId: issue.id, agentName: 'agent-loser', status: 'submitted', triggeredAt: new Date() },
    { issueId: issue.id, agentName: 'agent-never-submitted', status: 'pending', triggeredAt: new Date() }
  ])

  // Create losing attempt
  await db.insert(attempts).values({
    issueId: issue.id,
    agentName: 'agent-loser',
    prNumber: 2,
    repo: 'test/repo',
    status: 'open',
    openedAt: new Date(),
    commitCount: 3,
  })

  // Trigger updateWinner via webhook
  const payload = {
    action: 'update',
    type: 'Issue',
    data: {
      id: 'issue-456',
      identifier: 'TEST-2',
      state: { name: 'Done' }
    }
  }

  await POST(new Request('http://localhost/api/linear/webhook', {
    method: 'POST',
    headers: { 'linear-signature': 'valid-sig' },
    body: JSON.stringify(payload)
  }))

  // Verify agent statuses
  const agents = await db.select()
    .from(issueAgents)
    .where(eq(issueAgents.issueId, issue.id))

  const winner = agents.find(a => a.agentName === 'agent-winner')
  const loser = agents.find(a => a.agentName === 'agent-loser')
  const ignored = agents.find(a => a.agentName === 'agent-never-submitted')

  expect(winner?.status).toBe('accepted')
  expect(loser?.status).toBe('rejected')
  expect(ignored?.status).toBe('ignored')
})
```

**Step 3: Run tests to verify they fail**

Run: `npm test -- route.test.ts -t "should mark issue as completed"`

Expected: FAIL - issue status remains 'in_progress'

Run: `npm test -- route.test.ts -t "should mark non-submitting agents as ignored"`

Expected: FAIL - agent status remains 'pending'

**Step 4: Fix updateWinner to set status completed**

In `src/app/api/linear/webhook/route.ts`, modify the `updateWinner` function at lines 419-422:

```typescript
// 4. Set winner and mark issue as completed (atomic with lock)
await tx
  .update(issues)
  .set({
    winnerAttemptId: winner.id,
    status: 'completed'  // ADD THIS LINE
  })
  .where(eq(issues.id, issueId))
```

**Step 5: Import markIgnoredOnIssueClosed at top of file**

Add to imports at top of `src/app/api/linear/webhook/route.ts`:

```typescript
import {
  updateAgentStatusOnPR,
  updateAgentStatusOnPRClose,
  markIgnoredOnIssueClosed,  // ADD THIS
} from '@/lib/agent-status'
```

**Step 6: Call markIgnoredOnIssueClosed after winner is set**

In `src/app/api/linear/webhook/route.ts`, add after line 430 (after the transaction completes):

```typescript
console.log(`Winner set for issue ${issueId}: ${winner.agentName}`)
})

// 7. Mark agents who never submitted as ignored
await markIgnoredOnIssueClosed(issueId)

// 6. Calculate ratings after transaction (separate error boundary)
```

**Step 7: Run tests to verify they pass**

Run: `npm test -- route.test.ts -t "should mark issue as completed"`

Expected: PASS

Run: `npm test -- route.test.ts -t "should mark non-submitting agents as ignored"`

Expected: PASS

**Step 8: Commit**

```bash
git add src/app/api/linear/webhook/route.ts src/app/api/linear/webhook/route.test.ts
git commit -m "fix: set issue status to completed and mark non-participants as ignored when winner selected"
```

---

## Task 2: Fix OpenSkill Ranking to Use Win/Loss Model (Bug #4)

**Files:**
- Modify: `src/lib/update-ratings.ts:29-72`
- Modify: `src/lib/openskill.ts`
- Test: `src/lib/update-ratings.unit.test.ts`

**Step 1: Write failing test for win/loss ranking**

Add to `src/lib/update-ratings.unit.test.ts`:

```typescript
describe('determineRanking - win/loss model', () => {
  it('should rank winner first, all losers tied for second (no close time sorting)', () => {
    const attempts = [
      {
        agentName: 'agent-winner',
        status: 'merged',
        mergedAt: new Date('2024-01-01T12:00:00Z'),
        closedAt: null,
        openedAt: new Date('2024-01-01T10:00:00Z'),
        commitCount: 5
      },
      {
        agentName: 'agent-loser-closed-early',
        status: 'closed',
        mergedAt: null,
        closedAt: new Date('2024-01-01T11:00:00Z'), // Closed BEFORE winner merged
        openedAt: new Date('2024-01-01T10:00:00Z'),
        commitCount: 3
      },
      {
        agentName: 'agent-loser-closed-late',
        status: 'closed',
        mergedAt: null,
        closedAt: new Date('2024-01-01T14:00:00Z'), // Closed AFTER winner merged
        openedAt: new Date('2024-01-01T10:00:00Z'),
        commitCount: 4
      }
    ]

    const ranking = determineRanking(attempts)

    // Winner should be position 1 (index 0)
    expect(ranking[0]).toEqual(['agent-winner'])

    // ALL losers should be position 2 (index 1) - order within doesn't matter
    expect(ranking[1]).toHaveLength(2)
    expect(ranking[1]).toContain('agent-loser-closed-early')
    expect(ranking[1]).toContain('agent-loser-closed-late')
  })

  it('should exclude DNF agents (< 2 commits) from all ranking positions', () => {
    const attempts = [
      {
        agentName: 'agent-winner',
        status: 'merged',
        mergedAt: new Date(),
        closedAt: null,
        openedAt: new Date(),
        commitCount: 5
      },
      {
        agentName: 'agent-loser',
        status: 'closed',
        mergedAt: null,
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 3
      },
      {
        agentName: 'agent-dnf',
        status: 'closed',
        mergedAt: null,
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 1  // DNF
      }
    ]

    const ranking = determineRanking(attempts)

    expect(ranking).toHaveLength(2) // Only 2 positions: [winner], [loser]
    expect(ranking[0]).toEqual(['agent-winner'])
    expect(ranking[1]).toEqual(['agent-loser'])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- update-ratings.unit.test.ts -t "win/loss model"`

Expected: FAIL - current implementation returns flat array, not grouped by position

**Step 3: Refactor determineRanking to return grouped ranking**

In `src/lib/update-ratings.ts`, replace the `determineRanking` function (lines 29-72):

```typescript
/**
 * Determines ranking of agents based on attempt outcomes.
 * Returns grouped ranking: [[winners], [losers]]
 *
 * Winner = agent whose PR was merged
 * Losers = ALL other agents who submitted PRs (tied for 2nd place)
 * DNF = agents with < 2 commits (excluded entirely)
 *
 * @param issueAttempts - All attempts for the issue
 * @returns Array of arrays: [[winner], [loser1, loser2, ...]]
 */
function determineRanking(
  issueAttempts: Array<{
    agentName: string
    status: string
    mergedAt: Date | null
    closedAt: Date | null
    openedAt: Date
    commitCount: number
  }>
): string[][] {
  // Find winner (merged PR)
  const winner = issueAttempts.find(a => a.status === 'merged')

  // Find losers (non-merged PRs with sufficient effort)
  const losers = issueAttempts.filter((attempt) => {
    // Skip winner
    if (attempt.status === 'merged') return false

    // Skip DNF (< 2 commits = minimal effort)
    if (attempt.commitCount < 2) return false

    // Must be closed
    if (attempt.status !== 'closed') return false

    return true
  })

  // Build grouped ranking
  const ranking: string[][] = []

  if (winner) {
    ranking.push([winner.agentName]) // Position 1: winner
  }

  if (losers.length > 0) {
    ranking.push(losers.map(l => l.agentName)) // Position 2: all losers tied
  }

  return ranking
}
```

**Step 4: Update updateRatingsForCompletedIssue signature**

In `src/lib/openskill.ts`, update the function to accept grouped ranking:

```typescript
/**
 * Updates ratings for agents after a completed issue.
 * Uses OpenSkill's rate() function with grouped ranking (teams).
 *
 * @param currentRatings - Map of agent name to current Rating
 * @param ranking - Grouped ranking: [[winner], [loser1, loser2, ...]]
 * @returns Map of agent name to updated Rating
 */
export function updateRatingsForCompletedIssue(
  currentRatings: Record<string, Rating>,
  ranking: string[][]  // Changed from string[] to string[][]
): Record<string, Rating> {
  // Build teams array for OpenSkill
  const teams = ranking.map(group =>
    group.map(agentName => currentRatings[agentName] ?? initializeAgentRating())
  )

  // Calculate new ratings
  const updatedTeams = rate(teams)

  // Map back to agent names
  const updatedRatings: Record<string, Rating> = {}
  for (let i = 0; i < ranking.length; i++) {
    const group = ranking[i]
    const updatedGroup = updatedTeams[i]

    if (!group || !updatedGroup) continue

    for (let j = 0; j < group.length; j++) {
      const agentName = group[j]
      const updatedRating = updatedGroup[j]

      if (agentName && updatedRating) {
        updatedRatings[agentName] = updatedRating
      }
    }
  }

  return updatedRatings
}
```

**Step 5: Update updateRatingsForIssue to handle grouped ranking**

In `src/lib/update-ratings.ts`, update lines 106-150:

```typescript
// Determine ranking (winner first, losers tied for second, DNF excluded)
const ranking = determineRanking(issueAttempts)

if (ranking.length === 0) {
  globalThis.console.log(
    `No finishers for issue ${issue.linearKey}, skipping rating update`
  )
  return
}

// Flatten ranking to get all participating agents
const allAgents = ranking.flat()

// Fetch current ratings for all participating agents
const currentScores = await db
  .select()
  .from(agentScores)
  .where(inArray(agentScores.agentName, allAgents))

// Build currentRatings map
const currentRatings: Record<string, Rating> = {}
for (const agentName of allAgents) {
  const score = currentScores.find((s) => s.agentName === agentName)
  if (score) {
    currentRatings[agentName] = rating({ mu: score.mu, sigma: score.sigma })
  } else {
    // Agent not in database yet, use default rating
    currentRatings[agentName] = initializeAgentRating()
  }
}

// Calculate new ratings using OpenSkill
const updatedRatings = updateRatingsForCompletedIssue(currentRatings, ranking)

// Determine completedAt timestamp (use mergedAt of winner)
const winner = issueAttempts.find((a) => a.status === 'merged')
const completedAt = winner?.mergedAt ?? new Date()

// Update database: agent_scores and agent_score_history
// Calculate rank based on position in grouped ranking
let currentRank = 0
for (const group of ranking) {
  currentRank++ // Increment rank for this group (1 = winner, 2 = all losers)

  for (const agentName of group) {
    const newRating = updatedRatings[agentName]
    if (!newRating) continue

    const newOrdinal = calculateOrdinal(newRating)

    // Update agent_scores (upsert)
    await db
      .insert(agentScores)
      .values({
        agentName,
        mu: newRating.mu,
        sigma: newRating.sigma,
        ordinal: newOrdinal,
        gamesPlayed: 1,
        lastUpdatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agentScores.agentName,
        set: {
          mu: newRating.mu,
          sigma: newRating.sigma,
          ordinal: newOrdinal,
          gamesPlayed: sql`${agentScores.gamesPlayed} + 1`,
          lastUpdatedAt: new Date(),
        },
      })

    // Insert agent_score_history
    await db.insert(agentScoreHistory).values({
      agentName,
      issueId,
      mu: newRating.mu,
      sigma: newRating.sigma,
      ordinal: newOrdinal,
      rank: currentRank, // All losers get rank 2
      completedAt,
    })
  }
}

globalThis.console.log(
  `Updated ratings for ${allAgents.length} agents on issue ${issue.linearKey}`
)
```

**Step 6: Run tests to verify they pass**

Run: `npm test -- update-ratings.unit.test.ts -t "win/loss model"`

Expected: PASS

**Step 7: Run all rating tests to ensure no regressions**

Run: `npm test -- update-ratings`

Expected: All tests pass (may need to update other tests for new ranking format)

**Step 8: Commit**

```bash
git add src/lib/update-ratings.ts src/lib/openskill.ts src/lib/update-ratings.unit.test.ts
git commit -m "fix: use win/loss model for OpenSkill ranking instead of multi-place close time"
```

---

## Task 3: Remove GitHub API Fallback (Bug #3)

**Files:**
- Modify: `src/app/api/github/webhook/route.ts:96-105`
- Test: `src/app/api/github/webhook/route.test.ts`

**Step 1: Write test for installation not found error**

Add to `src/app/api/github/webhook/route.test.ts`:

```typescript
it('should throw error when GitHub App installation not found', async () => {
  // Mock getInstallationOctokit to throw installation not found
  vi.mocked(getInstallationOctokit).mockRejectedValue(
    new Error('GitHub App installation not found for repository test/repo')
  )

  const payload = {
    action: 'closed',
    pull_request: {
      number: 123,
      merged: true,
      merged_at: '2024-01-01T12:00:00Z',
      head: { repo: { full_name: 'test/repo' } }
    }
  }

  const request = new Request('http://localhost/api/github/webhook', {
    method: 'POST',
    headers: {
      'x-github-event': 'pull_request',
      'x-hub-signature-256': 'sha256=valid'
    },
    body: JSON.stringify(payload)
  })

  // Should throw error, not fall back to PAT
  await expect(POST(request)).rejects.toThrow('GitHub App installation not found')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- github/webhook/route.test.ts -t "installation not found"`

Expected: FAIL - currently falls back to PAT instead of throwing

**Step 3: Remove fallback logic**

In `src/app/api/github/webhook/route.ts`, replace lines 96-105:

```typescript
// Get authenticated Octokit for this installation
let octokit: Octokit
try {
  octokit = await getInstallationOctokit(repo)
} catch (error) {
  // NO FALLBACK - fail fast
  console.error(`GitHub App installation not found for ${repo}:`, error)
  throw new Error(`GitHub App installation not found for repository ${repo}`)
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- github/webhook/route.test.ts -t "installation not found"`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/github/webhook/route.ts src/app/api/github/webhook/route.test.ts
git commit -m "fix: remove GitHub API fallback, fail fast per error philosophy"
```

---

## Task 4: Fix or Remove Race Condition in GitHub Webhook (Bug #2)

**Context:** The GitHub webhook's `updateAgentStatusOnPRClose` function has a race condition (two separate queries without transaction). However, the Linear webhook's `updateWinner` function ALSO updates agent statuses correctly within a transaction. We need to decide: remove GitHub's logic or fix it.

**Decision:** Remove the race-prone logic from GitHub webhook since Linear webhook handles it correctly.

**Files:**
- Modify: `src/app/api/github/webhook/route.ts:297-367`
- Modify: `src/lib/agent-status.ts` (remove unused function)
- Test: `src/app/api/github/webhook/route.test.ts`

**Step 1: Write test documenting current behavior**

Add to `src/app/api/github/webhook/route.test.ts`:

```typescript
it('should NOT update agent status on PR merge (Linear webhook handles this)', async () => {
  // Setup issue and agent
  const [issue] = await db.insert(issues).values({
    linearId: 'issue-123',
    linearKey: 'TEST-1',
    title: 'Test',
    url: 'https://linear.app/test/TEST-1',
    status: 'in_progress',
    arenaReadyLabeledAt: new Date(),
  }).returning()

  await db.insert(issueAgents).values({
    issueId: issue.id,
    agentName: 'test-agent',
    status: 'submitted',
    triggeredAt: new Date()
  })

  // GitHub webhook receives PR merged event
  const payload = {
    action: 'closed',
    pull_request: {
      number: 123,
      merged: true,
      merged_at: '2024-01-01T12:00:00Z',
      title: 'Fix bug',
      head: { repo: { full_name: 'test/repo' } }
    }
  }

  await POST(new Request('http://localhost/api/github/webhook', {
    method: 'POST',
    headers: {
      'x-github-event': 'pull_request',
      'x-hub-signature-256': 'sha256=valid'
    },
    body: JSON.stringify(payload)
  }))

  // Agent status should remain 'submitted' (not changed to 'accepted')
  // Linear webhook will handle the status change
  const [agent] = await db.select()
    .from(issueAgents)
    .where(eq(issueAgents.issueId, issue.id))

  expect(agent.status).toBe('submitted')
})
```

**Step 2: Remove updateAgentStatusOnPRClose call from GitHub webhook**

In `src/app/api/github/webhook/route.ts`, find the `handlePullRequestClosed` function (around line 297) and remove the agent status update call:

```typescript
async function handlePullRequestClosed(payload: GitHubWebhookPayload) {
  const pr = payload.pull_request
  if (!pr) return

  const repo = pr.head?.repo?.full_name
  if (!repo) return

  // Get attempt from database
  const attempt = await getAttemptByPR(repo, pr.number)
  if (!attempt) {
    console.warn(`No attempt found for PR ${repo}#${pr.number}`)
    return
  }

  const merged = pr.merged ?? false
  const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null

  if (merged && mergedAt) {
    // Update attempt status to merged
    await db.update(attempts)
      .set({ status: 'merged', mergedAt })
      .where(eq(attempts.id, attempt.id))

    console.log(`PR ${repo}#${pr.number} merged for issue ${attempt.issueId}`)

    // REMOVE THIS LINE - Linear webhook handles agent status
    // await updateAgentStatusOnPRClose(attempt.issueId, attempt.agentName, true)
  } else {
    // Update attempt status to closed
    const closedAt = new Date()
    await db.update(attempts)
      .set({ status: 'closed', closedAt })
      .where(eq(attempts.id, attempt.id))

    console.log(`PR ${repo}#${pr.number} closed without merge`)

    // REMOVE THIS LINE - Linear webhook handles agent status
    // await updateAgentStatusOnPRClose(attempt.issueId, attempt.agentName, false)
  }
}
```

**Step 3: Run test to verify behavior**

Run: `npm test -- github/webhook/route.test.ts -t "should NOT update agent status"`

Expected: PASS

**Step 4: Check if updateAgentStatusOnPRClose is used elsewhere**

Run: `git grep "updateAgentStatusOnPRClose"`

Expected: Should only appear in agent-status.ts (definition), agent-status.test.ts (tests), and possibly route.test.ts (mocks)

**Step 5: Add comment documenting why we don't update agent status here**

In `src/app/api/github/webhook/route.ts`, add comment in `handlePullRequestClosed`:

```typescript
if (merged && mergedAt) {
  await db.update(attempts)
    .set({ status: 'merged', mergedAt })
    .where(eq(attempts.id, attempt.id))

  console.log(`PR ${repo}#${pr.number} merged for issue ${attempt.issueId}`)

  // NOTE: Agent status updates are handled by Linear webhook's updateWinner()
  // which uses transactions to avoid race conditions. GitHub webhook only
  // tracks attempt status (merged/closed).
}
```

**Step 6: Commit**

```bash
git add src/app/api/github/webhook/route.ts src/app/api/github/webhook/route.test.ts
git commit -m "fix: remove race-prone agent status updates from GitHub webhook (Linear webhook handles atomically)"
```

---

## Task 5: Add End-to-End Integration Test

**Files:**
- Create: `src/__tests__/pr-merge-flow.integration.test.ts`

**Step 1: Write integration test for full flow**

Create `src/__tests__/pr-merge-flow.integration.test.ts`:

```typescript
/**
 * Integration test for PR merge → winner selection → rating update flow
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/client'
import { issues, attempts, issueAgents, agentScores, agentScoreHistory } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

describe('PR Merge Flow Integration', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(agentScoreHistory)
    await db.delete(agentScores)
    await db.delete(attempts)
    await db.delete(issueAgents)
    await db.delete(issues)
  })

  it('should complete full flow: PR merge → winner selected → agents updated → ratings calculated', async () => {
    // 1. Create issue in 'in_progress' state
    const [issue] = await db.insert(issues).values({
      linearId: 'test-issue-1',
      linearKey: 'TEST-1',
      title: 'Test Issue',
      url: 'https://linear.app/test/TEST-1',
      status: 'in_progress',
      arenaReadyLabeledAt: new Date(),
    }).returning()

    // 2. Create agents: 2 submitted PRs, 1 never submitted
    await db.insert(issueAgents).values([
      { issueId: issue.id, agentName: 'winner-agent', status: 'submitted', triggeredAt: new Date() },
      { issueId: issue.id, agentName: 'loser-agent', status: 'submitted', triggeredAt: new Date() },
      { issueId: issue.id, agentName: 'ignored-agent', status: 'pending', triggeredAt: new Date() }
    ])

    // 3. Create attempts: winner merged, loser closed
    const [winnerAttempt] = await db.insert(attempts).values({
      issueId: issue.id,
      agentName: 'winner-agent',
      prNumber: 1,
      repo: 'test/repo',
      status: 'merged',
      mergedAt: new Date('2024-01-01T12:00:00Z'),
      openedAt: new Date('2024-01-01T10:00:00Z'),
      commitCount: 10
    }).returning()

    await db.insert(attempts).values({
      issueId: issue.id,
      agentName: 'loser-agent',
      prNumber: 2,
      repo: 'test/repo',
      status: 'closed',
      closedAt: new Date('2024-01-01T13:00:00Z'),
      openedAt: new Date('2024-01-01T10:00:00Z'),
      commitCount: 5
    })

    // 4. Simulate Linear webhook calling updateWinner
    const { updateWinner } = await import('@/app/api/linear/webhook/route')
    await updateWinner(issue.id)

    // VERIFY: Issue status is 'completed'
    const [updatedIssue] = await db.select().from(issues).where(eq(issues.id, issue.id))
    expect(updatedIssue.status).toBe('completed')
    expect(updatedIssue.winnerAttemptId).toBe(winnerAttempt.id)

    // VERIFY: Agent statuses updated correctly
    const agents = await db.select().from(issueAgents).where(eq(issueAgents.issueId, issue.id))
    const winner = agents.find(a => a.agentName === 'winner-agent')
    const loser = agents.find(a => a.agentName === 'loser-agent')
    const ignored = agents.find(a => a.agentName === 'ignored-agent')

    expect(winner?.status).toBe('accepted')
    expect(loser?.status).toBe('rejected')
    expect(ignored?.status).toBe('ignored')

    // VERIFY: Losing attempt closed
    const [loserAttempt] = await db.select()
      .from(attempts)
      .where(eq(attempts.agentName, 'loser-agent'))
    expect(loserAttempt.status).toBe('closed')
    expect(loserAttempt.closedAt).toBeTruthy()

    // VERIFY: Ratings calculated for winner and loser (not ignored agent)
    const scores = await db.select().from(agentScores)
      .where(inArray(agentScores.agentName, ['winner-agent', 'loser-agent', 'ignored-agent']))

    expect(scores).toHaveLength(2) // Only winner and loser

    const winnerScore = scores.find(s => s.agentName === 'winner-agent')
    const loserScore = scores.find(s => s.agentName === 'loser-agent')

    expect(winnerScore).toBeDefined()
    expect(loserScore).toBeDefined()
    expect(winnerScore!.mu).toBeGreaterThan(25) // Winner rating increased
    expect(loserScore!.mu).toBeLessThan(25) // Loser rating decreased

    // VERIFY: Score history recorded with correct ranks
    const history = await db.select().from(agentScoreHistory)
      .where(eq(agentScoreHistory.issueId, issue.id))

    expect(history).toHaveLength(2)

    const winnerHistory = history.find(h => h.agentName === 'winner-agent')
    const loserHistory = history.find(h => h.agentName === 'loser-agent')

    expect(winnerHistory?.rank).toBe(1)
    expect(loserHistory?.rank).toBe(2)
  })

  it('should handle DNF agents correctly (< 2 commits excluded from ratings)', async () => {
    // Create issue
    const [issue] = await db.insert(issues).values({
      linearId: 'test-issue-2',
      linearKey: 'TEST-2',
      title: 'DNF Test',
      url: 'https://linear.app/test/TEST-2',
      status: 'in_progress',
      arenaReadyLabeledAt: new Date(),
    }).returning()

    // Create agents
    await db.insert(issueAgents).values([
      { issueId: issue.id, agentName: 'winner', status: 'submitted', triggeredAt: new Date() },
      { issueId: issue.id, agentName: 'dnf-agent', status: 'submitted', triggeredAt: new Date() }
    ])

    // Create attempts: winner merged, DNF closed with 1 commit
    await db.insert(attempts).values([
      {
        issueId: issue.id,
        agentName: 'winner',
        prNumber: 1,
        repo: 'test/repo',
        status: 'merged',
        mergedAt: new Date(),
        openedAt: new Date(),
        commitCount: 10
      },
      {
        issueId: issue.id,
        agentName: 'dnf-agent',
        prNumber: 2,
        repo: 'test/repo',
        status: 'closed',
        closedAt: new Date(),
        openedAt: new Date(),
        commitCount: 1  // DNF threshold
      }
    ])

    // Trigger updateWinner
    const { updateWinner } = await import('@/app/api/linear/webhook/route')
    await updateWinner(issue.id)

    // VERIFY: Only winner gets rating (DNF excluded)
    const scores = await db.select().from(agentScores)

    expect(scores).toHaveLength(1)
    expect(scores[0]?.agentName).toBe('winner')

    // VERIFY: DNF agent still marked as rejected (not ignored)
    const agents = await db.select().from(issueAgents)
      .where(eq(issueAgents.issueId, issue.id))

    const dnfAgent = agents.find(a => a.agentName === 'dnf-agent')
    expect(dnfAgent?.status).toBe('rejected')
  })
})
```

**Step 2: Export updateWinner for testing**

In `src/app/api/linear/webhook/route.ts`, add export:

```typescript
// Export for integration testing
export { updateWinner }
```

**Step 3: Run integration test**

Run: `npm test -- pr-merge-flow.integration.test.ts`

Expected: PASS (after all previous fixes are in place)

**Step 4: Commit**

```bash
git add src/__tests__/pr-merge-flow.integration.test.ts src/app/api/linear/webhook/route.ts
git commit -m "test: add end-to-end integration test for PR merge flow"
```

---

## Verification

After completing all tasks:

**Run full test suite:**
```bash
npm test
```

**Expected:** All tests pass, including:
- New integration test covering full flow
- Updated unit tests for win/loss ranking
- Existing tests still pass (no regressions)

**Manual verification (optional):**
1. Merge a PR on a real issue
2. Check issue status transitions to 'completed'
3. Check agent statuses: winner='accepted', losers='rejected', non-submitters='ignored'
4. Check ratings updated for winner and losers only

---

## Success Criteria

- ✅ Issue status updates to 'completed' when winner selected
- ✅ Non-submitting agents marked as 'ignored'
- ✅ OpenSkill uses win/loss model (not multi-place ranking)
- ✅ GitHub API fallback removed (fail fast)
- ✅ Race condition removed from GitHub webhook
- ✅ All tests pass
- ✅ Integration test proves end-to-end flow works
