# Planning Session Summary: GitHub Webhook Integration

**Date:** 2025-11-12
**Duration:** ~1 hour
**Participants:** Andrew (Product), Claude (Planning Agent)

---

## Session Goals

1. ✅ Design GitHub webhook integration for PR iteration tracking
2. ✅ Verify current state machine handles PR acceptance correctly
3. ✅ Check edge case: multiple PRs merged
4. ✅ Create comprehensive implementation plan
5. ✅ Cleanup and organize docs/plans directory

---

## Key Decisions

### 1. Priority: Option 1 (Iteration Quality Metrics)
**Focus on tracking:**
- Total commits pushed (including after review feedback)
- Updated `commitCount` on every push
- `lastCommitSha` tracking
- PR synchronize events

**Deferred to Phase 2:**
- Review comment tracking
- Human vs bot filtering
- Approval/rejection status
- Collaboration depth metrics

**Rationale:** Fix the broken `commitCount` field first, add review tracking later.

### 2. Edge Case Confirmed: Multiple PRs Merged ✅
**Scenario:** Two agents both merge PRs for same issue

**Current behavior:**
- First merged PR becomes winner (`winner_attempt_id`)
- Second merged PR also shows `status: 'merged'` in attempts table
- Both agents get `accepted` status in queries
- **This is correct!** Both completed the work successfully

**No changes needed** - system handles this gracefully.

### 3. State Machine Verification ✅
**Current implementation working correctly:**
- Winner selection picks first merged PR by timestamp
- Agent status derived from PR states
- Linear webhook handles PR attachments
- Need GitHub webhook to track iteration (commits)

---

## Deliverables Created

### 1. Implementation Plan ✅
**File:** `docs/plans/2025-11-12-github-webhook-pr-iteration-tracking.md`
**Length:** ~650 lines
**Contents:**
- Executive summary and problem statement
- Ground truth analysis (real PR #1559 from js-recall)
- Architecture design (webhook → API → DB)
- 10-task implementation plan
- Testing strategy (25+ unit tests)
- Security considerations
- Rollout plan (3-week timeline)
- Success metrics and acceptance criteria

### 2. Documentation Cleanup ✅
**Actions taken:**
- Created `docs/CHANGELOG.md` (300 lines)
- Created `docs/plans/archive/` directory
- Moved 6 completed plans to archive
- Documented 4 major milestones (v0.1.0 - v0.3.0)
- Preserved active reference docs

**Archived plans:**
- 2025-11-11-state-machine-sync.md
- 2025-11-11-arena-milestone-1.md
- 2025-11-11-nextjs-zero-tolerance-setup.md
- 2025-11-11-nextjs-zero-tolerance-setup-design.md
- project-2.md (alternative approach)
- project-3-linear-first.md (alternative approach)

---

## Technical Discoveries

### 1. Real PR Analysis (recallnet/js-recall#1559)
**Key findings:**
- Author: `engine-labs-app[bot]` (bot account)
- 1 commit initially
- 2 bot comments: `vercel[bot]`, `github-actions[bot]`
- No human reviews yet
- Bot identification: `user.type === "Bot"`

### 2. Bot Actors in Your Ecosystem
- `vercel[bot]` - Deployment status
- `github-actions[bot]` - CI/CD results
- `cto-new` - Bot that opens PRs
- `engine-labs-app[bot]` - Commit author

### 3. Commit Count Challenge
**Problem:** Webhook payload doesn't include total commits
**Solution:** Must call GitHub API: `GET /repos/{owner}/{repo}/pulls/{number}/commits`
**Impact:** Adds ~100-200ms per webhook, but necessary for accuracy

---

## Implementation Overview

### Phase 1: Infrastructure (2 days)
- Create `/api/github/webhook/route.ts`
- Implement HMAC SHA-256 signature verification
- Add idempotency via events table
- Write unit tests

### Phase 2: Synchronize Handler (2 days)
- Handle `pull_request.synchronize` events
- Integrate with GitHub API for commit counts
- Update `attempts` table (commitCount, lastCommitSha)
- Write unit tests

### Phase 3: Close Handler (1 day)
- Handle `pull_request.closed` events
- Update status/timestamps
- Trigger winner selection on merge
- Write unit tests

### Phase 4: Testing & Deployment (2 days)
- End-to-end testing script
- Documentation updates
- Staging deployment
- Production rollout

**Total timeline:** 2-3 weeks (1 developer)

---

## Security Considerations

1. **Signature Verification:** HMAC SHA-256 with timing-safe comparison
2. **Repository Allowlist:** Check `ALLOWED_REPOS` before processing
3. **Read-Only Token:** GitHub PAT with minimal permissions
4. **Idempotency:** Events table prevents duplicate processing
5. **Rate Limiting:** Monitor GitHub API usage (5000 req/hour limit)

---

## Environment Requirements

### New Variables
```bash
GITHUB_WEBHOOK_SECRET=<random 64+ chars>
GITHUB_TOKEN=<fine-grained PAT>
ALLOWED_REPOS=recallnet/js-recall
```

### GitHub Token Permissions
- Pull requests: Read
- Contents: Read
- Metadata: Read (automatic)

### Webhook Configuration (Per Repo)
- URL: `https://coding-arena.vercel.app/api/github/webhook`
- Content type: `application/json`
- Secret: Value of `GITHUB_WEBHOOK_SECRET`
- Events: Pull requests (only)
- Active: ✅

---

## Success Metrics

### Technical
- ✅ All unit tests pass (>90% coverage)
- ✅ Webhook processing <500ms
- ✅ Zero signature verification failures
- ✅ Idempotency working

### Functional
- ✅ commitCount increments on every push
- ✅ lastCommitSha matches GitHub UI
- ✅ PR close events update status
- ✅ Winner selection unchanged

### Business
- ✅ Can measure agent iteration quality
- ✅ Dashboard shows accurate commit counts
- ✅ Can identify agents that ignore feedback

---

## Known Limitations (Documented)

1. **No review comment tracking** - Phase 2 feature
2. **No bot filtering** - All commits count equally (for now)
3. **No force-push handling** - Edge case (rare)
4. **No branch tracking** - Field exists, just not populated

---

## Questions for Product Team

1. **Repo prioritization:** Start with js-recall only?
2. **Bot commits:** Count CI commits or filter them?
3. **Force push policy:** Do agents force-push?
4. **Review SLAs:** Acceptable time from PR open to review?
5. **Dashboard updates:** Show commitCount now or wait?

---

## Next Steps

### Immediate (This Week)
1. [ ] Review implementation plan with team
2. [ ] Provision GitHub webhook secrets
3. [ ] Get approval to proceed

### Week 1 (Implementation)
1. [ ] Task 1-3: Infrastructure
2. [ ] Task 4-6: Synchronize handler
3. [ ] Task 7: Close handler
4. [ ] Code review

### Week 2 (Testing)
1. [ ] Task 8: Environment setup
2. [ ] Task 9: End-to-end testing
3. [ ] Task 10: Documentation
4. [ ] Staging deployment

### Week 3 (Production)
1. [ ] Production deployment
2. [ ] Monitor webhook processing
3. [ ] Validate metrics
4. [ ] Update CHANGELOG

---

## Related Documents

**Created during session:**
- `docs/plans/2025-11-12-github-webhook-pr-iteration-tracking.md` (implementation plan)
- `docs/CHANGELOG.md` (project history)
- `docs/plans/archive/README.md` (archived plans index)
- `docs/plans/2025-11-12-planning-session-summary.md` (this file)

**Referenced documents:**
- `docs/arena-state-machine.md` - State machine spec
- `docs/IMPLEMENTATION-COMPLETE.md` - Linear webhooks v0.2.0
- `docs/INDEX-ENG320.md` - Real-world workflow analysis
- `docs/plans/project.md` - Original baseline

---

## Session Artifacts

**Code examined:**
- `src/app/api/linear/webhook/route.ts` (winner selection)
- `src/lib/agent-status.ts` (status transitions)
- `src/lib/queries.ts` (status derivation)
- `src/db/schema.ts` (attempts table)

**APIs explored:**
- GitHub REST API (PR commits endpoint)
- Real PR #1559 (recallnet/js-recall)
- Bot actor patterns

**Tests verified:**
- Edge case: multiple PRs merged (✅ handled)
- Winner selection logic (✅ correct)
- Agent status transitions (✅ working)

---

**Status:** Planning complete, ready for implementation
**Confidence:** High (based on similar completed Linear webhook work)
**Estimated effort:** 96 hours (2-3 weeks, 1 developer)
