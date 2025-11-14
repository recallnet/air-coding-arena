# Test Coverage Analysis: PR Merge → Scoring Flow

## Executive Summary

The PR merge → scoring flow has **moderate test coverage** with significant gaps in integration and full-flow testing. Tests cover individual components well (webhooks, rating calculations, DNF detection) but lack end-to-end tests that verify the entire flow from PR merge through to final rating updates.

## System Flow Overview

```
GitHub PR Merged
    ↓
GitHub Webhook: pull_request.closed (merged=true)
    ↓
[GitHub Webhook Handler] route.ts
    ├── Verify signature
    ├── Check idempotency
    ├── Find tracked attempt
    ├── Update attempt status to "merged"
    └── Call updateAgentStatusOnPRClose()
    ↓
Linear Issue State Changes to "Done"
    ↓
Linear Webhook: Issue update (status="Done")
    ↓
[Linear Webhook Handler] route.ts
    ├── Verify signature
    ├── Check idempotency
    ├── Create/update issue record
    └── Handle Attachment events (PR links)
         ├── Create/update attempt with status="merged"
         ├── Call updateAgentStatusOnPR()
         └── Call updateWinner() (if merged)
            ├── SELECT merged PRs
            ├── Determine winner
            └── UPDATE issue.winnerAttemptId
    ↓
[updateRatingsForIssue] lib/update-ratings.ts
    ├── Fetch issue
    ├── Fetch all attempts for issue
    ├── Filter out DNF attempts
    ├── Determine ranking
    ├── Fetch current agent scores
    ├── Call updateRatingsForCompletedIssue() (OpenSkill)
    ├── Update agent_scores
    ├── Create agent_score_history records
    └── Calculate ordinal scores
    ↓
Final State: Agent ratings updated in database
```

## Test Files Found

### 1. GitHub Webhook Tests

**File**: `/Users/andrewhill/Coding/coding-arena/src/app/api/github/webhook/route.test.ts`
**Type**: Unit tests (heavily mocked)
**Size**: ~1,766 lines

**Tested Scenarios**:

- Signature verification (valid, invalid, missing)
- Idempotency handling (duplicate events)
- PR synchronize event (commit count updates)
  - Tracked PRs
  - Untracked PRs
  - GitHub API errors
  - Missing tokens
  - Invalid repository format
  - Fetch exceptions
  - Non-array API responses
  - CI status resets (success→pending, failure→pending)
- Check suite completion (multiple conclusions)
  - success, failure, timed_out, cancelled, action_required, neutral, skipped
  - Multiple PRs in one check suite
  - Null conclusion (still running)
  - Missing repository or PRs
- PR closed event (merged and non-merged)
  - Merged: updates status, calls agent status update
  - Not merged: updates to closed, calls rejection status
  - Untracked PRs
  - CI status transitions (full state machine)
- Database error handling

**NOT Tested**:

- ❌ Rating updates on PR merge (test explicitly verifies it's NOT called)
- ❌ Communication between GitHub webhook and Linear webhook
- ❌ Actual commit count fetching from GitHub
- ❌ Real GitHub API interactions
- ❌ Installation token flow (only mocked)

---

### 2. Linear Webhook Tests

**File**: `/Users/andrewhill/Coding/coding-arena/src/app/api/linear/webhook/route.test.ts`
**Type**: Unit tests (heavily mocked)
**Size**: ~400+ lines (partial read)

**Tested Scenarios**:

- Signature verification
- Idempotency
- Issue creation with arena:ready label
- Issue ignore without label
- Arena label addition triggering sync
- Attachment/PR link handling
- Comment handling

**NOT Tested**:

- ❌ Full issue completion flow (status="Done")
- ❌ Winner determination logic
- ❌ Rating update trigger
- ❌ Multiple merged PRs (tiebreaker logic)
- ❌ DNF detection in Linear webhook
- ❌ Transaction/race condition handling for winner selection

---

### 3. Rating Update Tests

#### 3a. Unit Tests (Mocked)

**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/update-ratings.unit.test.ts`
**Type**: Unit tests (fully mocked)
**Size**: ~1,285 lines

**Tested Scenarios**:

- Missing issue error handling
- Issue with no attempts
- All DNF attempts (no finishers)
- Completed issue with merged PR winner
  - Cursor wins, engine loses, cyrus DNFs
  - Ratings properly updated (winner mu↑, loser mu↓)
  - History records created with correct ranks
- DNF detection: low-effort PRs (< 2 commits)
- DNF detection: short lifespan PRs (< 5 minutes)
- Multiple agents with proper ranking
- New agents without existing score (initialization)
- Single agent (no competition)
- Large number of agents (5 agents)
- Timestamp handling (mergedAt vs closedAt)
- Excluding open PRs
- Tie scenarios (same close time)
- No winner scenario (only closed PRs)

**Coverage**: ✅ Excellent for single issue rating calculation

---

#### 3b. Integration Tests (Real Database)

**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/rating-integration.test.ts`
**Type**: Integration tests (real database only)
**Size**: ~869 lines

**Tested Scenarios**:

- Basic 1v1 competition (winner and loser)
- Multi-agent scenario (5 agents, ranked)
- DNF detection (minimal commits)
- DNF detection (very short lifespan)
- Rating convergence over multiple rounds
- Edge case: issue with no attempts
- Edge case: issue with only DNF attempts

**Coverage**: ✅ Good for multi-round scenarios

---

#### 3c. Integration Tests (E2E)

**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/rating-integration.test.ts`
**Type**: Integration tests
**Note**: These tests skip when using test database

**What they test**:

- Real database operations
- Rating convergence over time
- Score history tracking

---

### 4. Linear Sync Tests

**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.test.ts`
**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/linear-sync.fixtures.test.ts`

**Tests**:

- Issue syncing from Linear API
- Attachment processing
- Comment parsing
- Agent attribution from @mentions

---

### 5. Database Query Tests

**File**: `/Users/andrewhill/Coding/coding-arena/src/lib/queries.test.ts`
**Type**: Unit tests (mocked)

**Tests**: Query functions for retrieving agents, issues, scores, history

---

## Coverage Gaps

### Critical Gaps (Missing End-to-End Tests)

1. **❌ Full PR Merge → Rating Flow**
   - No test that traces a PR from merge webhook through to final rating update
   - No test verifying the cross-system coordination (GitHub → Linear → Rating)
   - No test of timing between webhook events

2. **❌ Winner Determination in Linear Webhook**
   - Logic for selecting winner when multiple PRs merged
   - Tie-breaking when PRs finish simultaneously
   - Race condition protection (transaction testing)
   - The `updateWinner()` function is not tested in linear webhook context

3. **❌ Issue Status Transitions Triggering Ratings**
   - No test verifying that when Linear issue transitions to "Done", ratings are updated
   - No test of status: "In Progress" → "Done" flow
   - No test of status: "In Review" → "Done" flow

4. **❌ Communication Across System Boundaries**
   - GitHub webhook updates attempt status
   - Linear webhook processes attachment and calls updateWinner()
   - No test verifying this coordination

5. **❌ DNF Detection in Webhook Context**
   - DNF heuristics are tested in updateRatingsForIssue()
   - But not tested when called from Linear webhook after issue completion

6. **❌ Ranking with Multiple Finishers**
   - Unit tests cover ranking logic
   - But no test of full flow: multiple PRs → multiple attempts → ranking → rating updates

### High-Priority Gaps

7. **❌ Error Scenarios in Full Flow**
   - What happens if GitHub webhook succeeds but Linear webhook fails?
   - What happens if rating update fails after winner is set?
   - What if updateAgentStatusOnPRClose() fails?

8. **❌ Race Conditions**
   - GitHub webhook: pull_request.closed event
   - Linear webhook: Attachment event
   - Both might try to update same attempt
   - Linear webhook: multiple Attachment events for same PR
   - Only Linear webhook transaction is tested

9. **❌ Duplicate Event Handling Across Systems**
   - Idempotency tested in each webhook individually
   - Not tested when GitHub and Linear webhooks both fire for same event

10. **❌ CI Status Impact on Ratings**
    - PR merged but CI still running
    - CI fails after PR merged
    - No test of how ciStatus affects rating eligibility

### Moderate Gaps

11. **⚠️ OpenSkill Integration**
    - updateRatingsForCompletedIssue() is mocked in unit tests
    - Integration tests use real database but rely on mock implementation
    - No test of actual OpenSkill rating calculations

12. **⚠️ Issue State Completeness**
    - Rating update only called from updateWinner() in Linear webhook
    - Not directly called when issue status changes to "Done"
    - Current design relies on PR merge triggering the flow

13. **⚠️ Agent Status Updates**
    - updateAgentStatusOnPRClose() called in GitHub webhook
    - updateAgentStatusOnPR() called in Linear webhook
    - No test verifying these have consistent behavior

## Recommendations

### Tier 1: Critical (Do First)

1. **Create End-to-End Flow Test**

   ```
   Scenario: Create issue → Open PR → Merge PR → Verify ratings updated
   Steps:
   a) Create test issue in database
   b) Create test attempts (cursor merged, engine closed)
   c) Simulate GitHub webhook: pull_request.closed (merged)
   d) Simulate Linear webhook: issue status updated, attachment processed
   e) Verify:
      - Attempt statuses updated correctly
      - Winner selected correctly
      - Agent ratings updated
      - History records created
   ```

2. **Create Winner Determination Test in Linear Webhook**

   ```
   Scenario: Multiple PRs merged, verify winner selection
   Test cases:
   - First PR merged: selected as winner
   - Second PR merged later: original winner unchanged
   - Both PRs merged simultaneously: first by timestamp wins
   - Tie with same merge time: consistent ordering
   ```

3. **Create Issue Status → Rating Flow Test**
   ```
   Verify: Linear issue transitioning to "Done" triggers rating update
   ```

### Tier 2: Important (Should Do)

4. **Create Race Condition Tests**
   - Concurrent GitHub + Linear webhooks for same PR
   - Multiple Attachment events in parallel
   - Test transaction isolation in updateWinner()

5. **Create Error Handling Tests for Full Flow**
   - GitHub webhook succeeds, Linear webhook fails
   - Rating update fails after winner set
   - Idempotency: replaying failed events

6. **Create DNF Detection in Context Test**
   - Issue with mixed: merged, closed with effort, DNF
   - Verify only legitimate attempts affect ratings

### Tier 3: Nice-to-Have

7. Add OpenSkill calculation validation tests
8. Add CI status impact tests
9. Add agent status consistency tests

## Test Metrics Summary

| Category                         | Coverage     | Status                                  |
| -------------------------------- | ------------ | --------------------------------------- |
| GitHub Webhook                   | ✅ Good      | Signature, events, idempotency covered  |
| Linear Webhook                   | ⚠️ Partial   | Events covered, winner logic missing    |
| Rating Calculation (Single)      | ✅ Excellent | Unit + integration tests complete       |
| Rating Calculation (Multi-round) | ✅ Good      | Integration tests solid                 |
| DNF Detection                    | ✅ Good      | Logic well tested                       |
| Full Flow                        | ❌ Missing   | No end-to-end tests                     |
| Winner Determination             | ⚠️ Partial   | Logic exists, context tests missing     |
| Issue State Transitions          | ❌ Missing   | Status changes not tested               |
| Cross-System Coordination        | ❌ Missing   | GitHub ↔ Linear ↔ Ratings             |
| Error Scenarios                  | ⚠️ Partial   | Individual components only              |
| Race Conditions                  | ⚠️ Partial   | Linear transaction tested, webhooks not |

## Summary

**Current State**:

- Component-level tests are strong (webhooks, rating math, DNF detection)
- Integration between components is NOT tested
- Full PR merge → scoring flow is NOT tested as a single journey

**Risk Level**: **HIGH** for production issues that only appear when:

- Multiple webhooks fire in specific ordering
- Race conditions occur between systems
- Failures in one system affect others
- Status transitions don't trigger expected side effects

**Effort to Close Gaps**: **Medium** - The code works, but the blind spots are in system coordination and error resilience.
