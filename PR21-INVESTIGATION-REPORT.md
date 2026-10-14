# PR #21 Investigation Report

**Issue**: PR #21 showing for both `cursor` and `engine` agents
**Linear Issue**: ENG-980 - Parallel Validation Execution
**Investigation Date**: 2025-11-17
**Production Database**: Neon PostgreSQL

---

## Executive Summary

PR #21 is incorrectly displayed for both `cursor` and `engine` agents because **two separate attempt records exist in the database** for the same PR. This occurred because two different comments posted the same PR #21 URL, each in a different agent's comment thread.

**Root Cause**: The comment sync logic (`syncComments()`) processes PR URLs found in comments and creates attempt records based on the comment's parent thread. When the same PR URL appears in multiple comments with different parent chains (one tracing to `@engine`, one to `@cursor`), it creates multiple attempt records.

---

## Evidence from Production Database

### 1. Attempt Records

Query revealed **2 distinct attempt records** for PR #21:

#### Attempt 1 - Cursor

```
ID: 55597a67-fdcd-4f99-9fda-1266adaaec14
Issue ID: 180e2cf9-f4a8-4c66-ab63-38b995e89f2c
Agent Name: cursor
Repo: recallnet/air-coding-arena
PR Number: 21
PR URL: https://github.com/recallnet/air-coding-arena/pull/21
Status: open
Opened At: Mon Nov 17 2025 09:08:23 GMT-0700
Source Attachment ID: null
Source Attachment URL: null
```

#### Attempt 2 - Engine

```
ID: 2b029633-d02d-464a-b870-b1b1cfb97c5c
Issue ID: 180e2cf9-f4a8-4c66-ab63-38b995e89f2c
Agent Name: engine
Repo: recallnet/air-coding-arena
PR Number: 21
PR URL: https://github.com/recallnet/air-coding-arena/pull/21
Status: open
Opened At: Sun Nov 16 2025 18:07:58 GMT-0700
Source Attachment ID: null
Source Attachment URL: null
```

**Key Observations**:

- Both records have the **same PR URL** and **same issue ID**
- Different `agentName` values (cursor vs engine)
- Different `openedAt` timestamps (15+ hours apart)
- Both have `null` for `sourceAttachmentId` (indicating they were created from comment sync, not attachment webhook)

### 2. Issue Agents

The issue has 4 agents assigned:

- `github copilot` - status: pending
- `factory` - status: pending
- `engine` - status: submitted
- `cursor` - status: submitted

### 3. All Attempts for Issue ENG-980

The issue has 4 total attempts:

- PR #19 (cursor) - open
- PR #20 (engine) - open
- PR #21 (cursor) - open ⚠️
- PR #21 (engine) - open ⚠️

---

## Comment Thread Analysis

### Comment 1 - Engine's Thread

```
Comment ID: 79d117cf-79d0-4bd0-86de-51a6afe6676b
Created: Sun Nov 16 2025 18:07:58 GMT-0700
Parent ID: 52f0fb5d-bd5a-4ccc-862b-d3e6105533e4

Body:
I've started a task to fix the CI failures on PR #20. The task will:
[...]
The fix is being worked on in PR #21: https://github.com/recallnet/air-coding-arena/pull/21

Parent Comment:
@[engine] please work on this issue and submit a PR.
```

**Thread Chain**:

1. Root: `@engine` mention
2. Child: Comment with PR #21 URL

**Agent Determination**: `determineAgentOwnershipFromThread()` walks up to parent and finds `@engine` → creates attempt for `engine`

### Comment 2 - Cursor's Thread

```
Comment ID: 84dcce1d-5e3b-4eb1-8e9d-a990479de1de
Created: Mon Nov 17 2025 09:08:24 GMT-0700
Parent ID: f80ac8f3-0994-42a8-ae5d-0734ae66e2e7

Body:
[**Parallelize validation script execution**]
[...]
The PR is now up to date with main and the lockfile is synchronized!
[...]
[View PR](https://github.com/recallnet/air-coding-arena/pull/21)

Parent Comment:
@[cursor] please work on this issue and submit a PR.
```

**Thread Chain**:

1. Root: `@cursor` mention
2. Child: Comment with PR #21 URL

**Agent Determination**: `determineAgentOwnershipFromThread()` walks up to parent and finds `@cursor` → creates attempt for `cursor`

---

## Root Cause: Misattributed PR Ownership

### What Happened

1. **Engine** opened PR #21 first and posted it in its own comment thread (child of `@engine` mention)
2. **Cursor** later referenced the same PR #21 in its own comment thread (child of `@cursor` mention)
3. The `syncComments()` function processed both comments:
   - Found PR #21 in Engine's thread → created attempt for `engine`
   - Found PR #21 in Cursor's thread → created attempt for `cursor`
4. The unique constraint `(issueId, agentName, prNumber)` allowed both records because `agentName` differs

### Why This Happened

The comment sync logic assumes that **PR URLs found in a comment thread belong to the agent mentioned at the root of that thread**. This works correctly when:

- Each agent posts their own PR in their own thread

But it **fails when**:

- An agent references another agent's PR in their own thread
- The same PR URL appears in multiple comment threads

### The Actual Situation

Looking at the comment bodies:

- **Engine's comment**: "I've started a task to fix the CI failures on PR #20. The fix is being worked on in PR #21"
- **Cursor's comment**: "Perfect! All fixes are complete... [View PR](https://github.com/recallnet/air-coding-arena/pull/21)"

**Engine actually created PR #21**, but Cursor posted an update about it in Cursor's own thread. The sync logic incorrectly attributed the PR to both agents.

---

## Code Analysis

### File: `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.ts`

The `processPRURLs()` function creates attempts for every PR URL found:

```typescript
async function processPRURLs(
  issueId: string,
  comments: CommentWithParent[],
  commentAgents: Map<string, string[]>,
  commentParents: Map<string, string | null>
): Promise<void> {
  for (const comment of comments) {
    const body = comment.body ?? ''
    // ...
    const prRegex = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g
    let prMatch: RegExpExecArray | null

    while ((prMatch = prRegex.exec(body)) !== null) {
      // Extract PR info
      const agentName = await determineAgentOwnershipFromThread(
        commentId,
        mentionedAgents,
        commentAgents,
        commentParents
      )

      await db
        .insert(attempts)
        .values({
          issueId,
          agentName, // ← Determined from comment thread
          repo,
          prNumber: Number.parseInt(prNumber, 10),
          prUrl,
          // ...
        })
        .onConflictDoUpdate({
          target: [attempts.issueId, attempts.agentName, attempts.prNumber],
          set: { prUrl }, // Preserve status
        })
    }
  }
}
```

The `onConflictDoUpdate` prevents duplicates **only when** `(issueId, agentName, prNumber)` match. Since `agentName` differs between the two comments, both inserts succeed.

---

## Impact

1. **UI displays PR #21 twice** - once for cursor, once for engine
2. **Data integrity issue** - multiple attempt records for the same PR
3. **Agent scoring impact** - if PR #21 gets merged, both agents might be incorrectly credited
4. **Progress tracking confusion** - issue appears to have more PRs than it actually does

---

## Recommended Solutions

### Option 1: PR URL Deduplication (Immediate Fix)

Add a check in `processPRURLs()` to see if an attempt already exists for the same `(issueId, prNumber)` regardless of agent:

```typescript
// Before creating attempt, check if PR already exists for this issue
const existingAttempt = await db
  .select()
  .from(attempts)
  .where(and(eq(attempts.issueId, issueId), eq(attempts.prNumber, prNumber)))
  .limit(1)

if (existingAttempt.length > 0) {
  console.log(`PR #${prNumber} already exists for issue, skipping duplicate`)
  continue
}
```

**Pros**: Simple, prevents duplicates
**Cons**: Doesn't fix existing bad data, might miss legitimate resubmissions

### Option 2: GitHub API Validation (Robust Fix)

Query GitHub API to determine the actual PR author:

```typescript
// Fetch PR from GitHub to get real author
const octokit = new Octokit({ auth: GITHUB_TOKEN })
const prData = await octokit.rest.pulls.get({
  owner: org,
  repo: repoName,
  pull_number: prNumber,
})

// Use PR branch name to determine agent (e.g., "cursor/ENG-980-...")
const branchAgentMatch = prData.data.head.ref.match(/^([^/]+)\//)
const realAgent = branchAgentMatch?.[1]?.toLowerCase()

if (realAgent && realAgent !== agentName) {
  console.log(
    `PR #${prNumber} actually belongs to ${realAgent}, not ${agentName}`
  )
  agentName = realAgent
}
```

**Pros**: Accurate, source of truth from GitHub
**Cons**: API rate limits, requires GitHub token, more complex

### Option 3: Unique Constraint Change (Prevention)

Add a unique constraint on `(issueId, prNumber)` to the schema:

```typescript
export const attempts = pgTable('attempts', {/* ... */}, (table) => ({
  uniqueAttempt: unique().on(table.issueId, table.prNumber), // ← Remove agentName
}))
```

**Pros**: Database-level prevention, guaranteed no duplicates
**Cons**: Breaking change, needs migration, doesn't handle resubmissions

### Option 4: Comment Source Validation (Smart Fix)

Only create attempts from the **first comment** that posts a PR URL:

```typescript
// Track which PRs we've already processed
const processedPRs = new Set<string>()

while ((prMatch = prRegex.exec(body)) !== null) {
  const prKey = `${issueId}:${prNumber}`

  if (processedPRs.has(prKey)) {
    console.log(`PR #${prNumber} already processed from earlier comment`)
    continue
  }
  processedPRs.add(prKey)

  // Create attempt...
}
```

**Pros**: Respects chronological order, simple
**Cons**: Doesn't fix race conditions if comments arrive out of order

---

## Data Cleanup Required

To fix the existing bad data for PR #21:

```sql
-- Identify the correct owner (check GitHub PR branch name or earlier timestamp)
-- Assuming engine is correct (earlier timestamp):

DELETE FROM attempts
WHERE id = '55597a67-fdcd-4f99-9fda-1266adaaec14';  -- Remove cursor's incorrect attempt

-- Or if cursor is correct:
-- DELETE FROM attempts WHERE id = '2b029633-d02d-464a-b870-b1b1cfb97c5c';
```

---

## Prevention Strategy

1. **Immediate**: Implement Option 1 (deduplication check) to prevent new duplicates
2. **Short-term**: Add monitoring/alerts for duplicate PRs in database
3. **Long-term**: Implement Option 2 (GitHub API validation) for authoritative source of truth
4. **Data quality**: Run periodic reconciliation job to detect and fix duplicates

---

## Questions for Product/Engineering

1. **Should we allow multiple agents to submit the same PR?**
   (e.g., if Cursor takes over Engine's PR)

2. **What's the source of truth for PR ownership?**
   - GitHub branch name?
   - First comment to post the PR?
   - GitHub PR author field?

3. **How should we handle PR resubmissions?**
   (Agent closes PR #21, opens PR #22 for same issue)

---

## Conclusion

The production database contains two attempt records for PR #21 because two different comments posted the same PR URL in different agent threads. The comment sync logic determined agent ownership from the parent thread chain, creating one attempt for `cursor` and one for `engine`.

**The actual PR #21 was created by Engine** (confirmed via GitHub API - author: `app/cto-new`, branch: `fix-ci-pr-20-parallel-validation`, created: 2025-11-17T01:07:41Z), but Cursor referenced it in a status update, causing the incorrect duplicate attribution.

**Immediate action needed**: Delete the cursor attempt record (ID: `55597a67-fdcd-4f99-9fda-1266adaaec14`) and keep the engine attempt record (ID: `2b029633-d02d-464a-b870-b1b1cfb97c5c`).
