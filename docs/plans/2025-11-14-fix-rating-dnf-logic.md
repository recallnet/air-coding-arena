# Fix Rating DNF Logic Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix ratings to properly count Engine's closed PR as a loss and recalculate all ratings with the corrected DNF logic.

**Architecture:** The DNF fix is already committed in `src/lib/update-ratings.ts`. Need to: (1) Fix runtime error in TemporalLeaderboard.tsx, (2) Run backfill script to recalculate all ratings from scratch using new logic, (3) Verify both agents have correct ratings.

**Tech Stack:** Next.js, Drizzle ORM, Neon Postgres, OpenSkill rating system, TypeScript

**Current State:**
- DNF fix committed: Closed PRs now always count as losses regardless of commit count
- Bug: Ratings were already calculated with old logic (only Cursor got rated, Engine excluded)
- Bug: TemporalLeaderboard.tsx has runtime error: `ReferenceError: yScale is not defined`
- Expected: Both Cursor (winner) and Engine (loser) should have ratings after recalculation

---

## Task 1: Fix TemporalLeaderboard Runtime Error

**Files:**
- Modify: `src/components/TemporalLeaderboard.tsx`

**Problem:** Reference error at line 306/309: `yScale is not defined`. The component uses dual Y-axis with `yScaleRating` (left, for ordinal ratings) and `yScaleCount` (right, for cumulative counts). Someone's edit introduced a reference to non-existent `yScale`.

**Step 1: Read TemporalLeaderboard.tsx and identify the bug**

Run: `grep -n "yScale" src/components/TemporalLeaderboard.tsx`

Expected: Find lines referencing `yScale` (incorrect) vs `yScaleRating`/`yScaleCount` (correct)

**Step 2: Fix the yScale references**

Based on the chart design (see lines 196-220 in existing file):
- `yScaleRating` (line 217-218): For rating/ordinal values (left Y-axis)
- `yScaleCount` (line 219-220): For cumulative counts (right Y-axis)

Around line 306-312, the grid lines should use `yScaleRating` since they're positioned based on the rating scale. Change:

```typescript
// WRONG - line ~306-309
{[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
  const y = padding.top + yScale(maxValue * fraction)
  // ...
})}
```

To:

```typescript
// CORRECT
{[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
  const y = padding.top + yScaleRating(maxRating * fraction)
  // ...
})}
```

**Step 3: Verify the fix compiles**

Run: `npm run build`

Expected: No TypeScript errors, build succeeds

**Step 4: Commit the fix**

```bash
git add src/components/TemporalLeaderboard.tsx
git commit -m "fix: use yScaleRating instead of undefined yScale in grid lines"
```

---

## Task 2: Investigate Current Database State

**Files:**
- Read: `src/db/schema.ts`
- Script: `scripts/backfill-agent-ratings.ts` (already exists)

**Purpose:** Understand current state before backfill to confirm the problem

**Step 1: Check existing backfill script**

File: `scripts/backfill-agent-ratings.ts`

The script already exists and does:
1. Clears `agent_score_history` table
2. Clears and resets `agent_scores` to defaults (mu=25, sigma=8.333, ordinal=0)
3. Fetches all completed issues (with merged PRs) in chronological order
4. Calls `updateRatingsForIssue()` for each (which now uses the fixed DNF logic)
5. Displays final ratings

**Step 2: Verify the script imports the fixed update-ratings logic**

Check line 10 of `scripts/backfill-agent-ratings.ts`:

```typescript
import { updateRatingsForIssue } from '../src/lib/update-ratings'
```

This imports the function that uses `determineRanking()` which we fixed. ✅

**Step 3: No changes needed**

The existing script is perfect for our needs. It will recalculate all ratings from scratch using the new DNF logic.

---

## Task 3: Run Backfill Script to Recalculate Ratings

**Files:**
- Execute: `scripts/backfill-agent-ratings.ts`

**Purpose:** Recalculate all ratings from scratch using the corrected DNF logic

**Step 1: Run the backfill script**

Run: `tsx scripts/backfill-agent-ratings.ts`

Expected output:
```
🔄 Backfilling agent ratings for completed issues...

Clearing existing ratings...
✅ Reset agent scores to defaults

Found N completed issues

Processing ENG-954...
✅ ENG-954 ratings updated

...

📊 Backfill complete!
   Processed: N
   Errors: 0

🏆 Final Agent Ratings:
   cursor: XXXX (mu=XX.XX, sigma=X.XX, games=1)
   engine: XXXX (mu=XX.XX, sigma=X.XX, games=1)
   ...
```

**Key verification:** Both `cursor` AND `engine` should have `games=1` since they both participated in ENG-954 (cursor won, engine lost).

**Step 2: Verify the backfill succeeded**

Check the output for:
- ✅ No errors
- ✅ Both agents have ratings
- ✅ Cursor's rating is higher than Engine's (winner should rank higher)

**Step 3: Check the dev server logs**

The dev server (running at localhost:3109) should show no more rating errors. Refresh the homepage to see updated ratings.

---

## Task 4: Verify Results in UI

**Files:**
- Navigate: `http://localhost:3109/`
- Navigate: `http://localhost:3109/issues/[ENG-954-issue-id]`

**Purpose:** Confirm both agents display ratings in the leaderboard and charts

**Step 1: Check homepage leaderboard**

Navigate to: `http://localhost:3109/`

Expected:
- ✅ Leaderboard shows multiple agents (not just 1)
- ✅ Both Cursor and Engine have ordinal ratings displayed
- ✅ Cursor ranks higher than Engine (winner > loser)
- ✅ Games played shows correctly for both

**Step 2: Check Activity Timeline chart**

On homepage, scroll to "Activity Timeline" section

Expected:
- ✅ Chart renders without errors (no more `yScale is not defined`)
- ✅ Multiple agent lines visible
- ✅ Rating lines and cumulative count lines both render

**Step 3: Check ENG-954 issue page**

Navigate to the ENG-954 issue detail page

Expected:
- ✅ Winner badge on Cursor's PR #8
- ✅ Both agents listed with attempt status
- ✅ No console errors

**Step 4: Document verification**

Take screenshots or note:
- Current ratings for Cursor
- Current ratings for Engine
- Games played count
- Confirmation both were rated

---

## Task 5: Commit and Push

**Files:**
- All modified files

**Purpose:** Commit the TemporalLeaderboard fix (backfill is data-only, no code commit needed)

**Step 1: Check git status**

Run: `git status`

Expected: Only `src/components/TemporalLeaderboard.tsx` should be modified

**Step 2: Commit the fix**

```bash
git add src/components/TemporalLeaderboard.tsx
git commit -m "fix: correct yScale reference in TemporalLeaderboard grid lines

The grid lines were referencing undefined 'yScale' variable.
Changed to use 'yScaleRating' to match the dual-axis chart design.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 3: Push to origin**

```bash
git push origin main
```

**Step 4: Verify push succeeded**

Expected: No conflicts, clean push

---

## Success Criteria

✅ TemporalLeaderboard.tsx renders without errors
✅ Both Cursor and Engine have ratings in agent_scores table
✅ Both agents show games_played = 1 (or more if other issues completed)
✅ Cursor's ordinal rating > Engine's ordinal rating (winner ranks higher)
✅ Homepage leaderboard displays multiple agents
✅ Activity Timeline chart renders correctly with dual Y-axis
✅ No console errors or rating calculation warnings

---

## Parallel Execution Strategy

These tasks can be parallelized:

**Parallel Group 1 (Independent):**
- Task 1: Fix TemporalLeaderboard error ← Can run immediately
- Task 2: Investigate database state ← Can run immediately (read-only)

**Sequential Group 2 (Depends on Group 1):**
- Task 3: Run backfill script ← Depends on Task 1 (need working UI)
- Task 4: Verify results ← Depends on Task 3
- Task 5: Commit ← Depends on Task 1

**Recommended:** Run Task 1 and Task 2 in parallel, then Task 3, 4, 5 sequentially.
