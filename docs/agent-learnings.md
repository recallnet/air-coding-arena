# Agent Behavioral Learnings

**Last Updated:** 2025-11-12

This document captures observed behaviors, edge cases, and learnings about AI coding agents in the Arena system.

## Agent Response Patterns

### Observed Response Times (ENG-320)

| Agent | Mentioned At | PR Submitted At | Response Time | Status |
|-------|-------------|-----------------|---------------|--------|
| Cursor | 00:07:15 | 00:16:31 | **9 minutes** | ✅ Responded |
| Engine | 00:07:28 | 00:38:48 | **31 minutes** | ✅ Responded |
| Cyrus | 00:06:59, 00:08:04 | Never | N/A | ❌ Ignored (2x) |

**Key Insights:**
- Response times vary 3x between agents (9min vs 31min)
- Some agents ignore mentions entirely (Cyrus)
- Multiple mentions don't improve response rate

### Response Rate by Agent

| Agent | Total Mentions | Responded | Ignored | Response Rate |
|-------|---------------|-----------|---------|---------------|
| Cursor | 1 | 1 | 0 | **100%** |
| Engine | 1 | 1 | 0 | **100%** |
| Cyrus | 2 | 0 | 2 | **0%** |

**Overall:** 67% response rate (2/3 agents responded)

## Agent Communication Patterns

### PR Link Formats

Agents don't always use formal Linear attachments. Observed formats:

**Cursor:**
```
https://www.cursor.com/agents?id=bc-b830d46b-5d08-4e41-a00d-a863303b82f4
```
- Uses Cursor-specific agent dashboard
- Not a GitHub PR link
- **Mystery:** How does this translate to actual code changes?

**Engine:**
```
https://github.com/recallnet/js-recall/pull/1559
```
- Standard GitHub PR link
- Can be tracked via GitHub API
- Linear may or may not create formal attachment

### Comment Patterns

**Agent Mention Format:**
```
@cursor can you create a PR to fix this?
@engine please implement this feature
@cyrus would you take a look at this?
```

**Potential Agent Responses** (to be observed):
- "Working on it" - Acknowledge mention
- Direct PR link - Skip acknowledgment
- No response - Ignore mention
- Comment with questions - Clarification needed

### Attachment Mystery: ENG-320

**Expected:** 2 Linear attachments (Cursor PR + Engine PR)
**Actual:** 0 attachments found via Linear API

**Hypotheses:**
1. **Agents comment with links but don't create formal attachments**
   - Linear's GitHub integration may not auto-link these
   - Need to manually link PRs in Linear
2. **Attachments added after our API query**
   - Timing issue with API call
   - Need to re-check periodically
3. **External tracking only**
   - Cursor uses own dashboard
   - Engine PR may be in different repo than Linear project

**Action Item:** Manually check Linear UI for ENG-320 attachments

## Edge Cases & Failure Modes

### 1. Multiple Mentions of Same Agent

**Scenario:** Cyrus was mentioned twice on ENG-320 (00:06:59 and 00:08:04)

**Question:** Does this improve response rate or confuse the agent?

**Observed:** No response despite 2 mentions

**Rule:** Keep earliest mention timestamp, track mention count for analytics

### 2. Agent Mentions in Edited Comments

**Scenario:** User mentions agent, then edits comment to remove mention

**Questions:**
- Do we get a Comment update webhook?
- Should we retract the agent dispatch?
- What if agent already started work?

**Rule:** (TBD - need to test)

### 3. Issue Closed Before Agents Respond

**Scenario:** Issue has `ar` label, agents mentioned, then issue closed

**Rule:** Mark all pending agents as `ignored` (no score)
- Issue may have been cancelled
- Not the agent's fault they didn't respond
- Don't penalize in win rate

### 4. Multiple PRs from Same Agent

**Scenario:** Agent submits PR, it's rejected, then submits another PR

**Question:** How do we track multiple attempts?

**Current Schema:** `UNIQUE(issue_id, agent_name, pr_number)`
- Allows multiple PRs from same agent (different PR numbers)
- All PRs tracked separately

**Rule:** (TBD - need to observe this scenario)

### 5. PR Submitted Before ar Label Added

**Scenario:** PR exists, then issue gets `ar` label later

**Rule:** Full sync on label add catches existing PRs
- Attachment sync will find the PR
- Mark as `submitted` with PR timestamp
- **Note:** PR timestamp may be before mention timestamp!

### 6. Agent Self-Assigns Without Mention

**Scenario:** Agent creates PR without being @mentioned

**Question:** Should we track this?

**Rule:** (TBD - does this happen?)

## Agent-Specific Behaviors

### Cursor

**Observed Behaviors:**
- ✅ Responds to mentions (100% rate, sample size: 1)
- ⏱️ Fast response (9 minutes)
- 🔗 Uses Cursor-specific PR tracking
- ❓ Unclear how Cursor PRs map to GitHub

**Questions:**
- Does Cursor create actual GitHub PRs?
- How do we track Cursor PR status (merged/closed)?
- Do Cursor PRs show up in GitHub webhooks?

### Engine

**Observed Behaviors:**
- ✅ Responds to mentions (100% rate, sample size: 1)
- ⏱️ Moderate response (31 minutes)
- 🔗 Creates standard GitHub PRs
- ✅ Trackable via GitHub API

**Questions:**
- None yet - standard workflow

### Cyrus

**Observed Behaviors:**
- ❌ Ignores mentions (0% rate, sample size: 2)
- 🔇 No acknowledgment
- 📉 Multiple mentions don't help

**Questions:**
- Is Cyrus even active/functional?
- Should we stop dispatching to Cyrus?
- Is there a specific mention format Cyrus requires?

**Action Item:** Test with fresh issue to confirm pattern

## Scoring Implications

### What Counts as a Win

✅ **Agent PR merged and closed issue**
- Agent status: `accepted`
- Issue status: `completed`
- Clear success metric

### What Counts as a Loss

❌ **Agent submitted PR but another agent won**
- Agent status: `rejected`
- Issue status: `completed` (someone else won)
- Agent tried but wasn't fast/good enough

❌ **Agent submitted PR but issue closed without merge**
- Agent status: `rejected`
- Issue status: `cancelled`
- PR wasn't accepted

### What Doesn't Count (No Score)

⚪ **Agent mentioned but issue cancelled before response**
- Agent status: `ignored`
- Issue status: `cancelled`
- Not the agent's fault

⚪ **Agent never responded to mention**
- Agent status: `ignored`
- Issue status: could be any
- Neutral - maybe agent was busy or didn't see it

## Analytics Insights

### Response Time Distribution

```
0-10 min:  █████████████████████████████ 33% (Cursor)
10-30 min: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
30-60 min: █████████████████████████████ 33% (Engine)
60+ min:   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%
No resp:   ████████████████████████████░ 33% (Cyrus x2)
```

**Median Response Time:** ~20 minutes (between Cursor and Engine)

### Win Rate Projections

**If current pattern holds:**
- Cursor: Fast responder, likely high win rate
- Engine: Slower but responsive, moderate win rate
- Cyrus: Non-responder, 0% win rate

**Need more data:** Only one issue observed (ENG-320)

## Testing Plan

### Test Cases to Execute

1. **Fresh Issue Test**
   - Create new issue
   - Add `ar` label
   - Mention @cyrus only
   - Observe: Does Cyrus respond? How long does it take?

2. **Multiple Agent Race**
   - Mention all 3 agents simultaneously
   - Observe: Who responds first? Do all respond?
   - Measure: Response time distribution

3. **Mid-Flight Issue**
   - Create issue
   - Mention agents (wait for responses)
   - THEN add `ar` label
   - Verify: System captures existing PRs

4. **Issue Cancellation**
   - Mention agents
   - Close issue before responses
   - Verify: Agents marked as `ignored`

5. **Winner Selection**
   - Multiple agents submit PRs
   - Merge one PR
   - Verify: Winner = accepted, others = rejected

6. **Edit Comment Behavior**
   - Mention agent in comment
   - Edit comment to remove mention
   - Observe: Does agent still respond? Do we get webhook?

## Open Research Questions

### Technical
1. How do Cursor agent links map to actual code?
2. Why doesn't ENG-320 have Linear attachments?
3. Do agents send webhooks/events we're not listening to?

### Behavioral
4. Does @mention case matter? (@Cursor vs @cursor)
5. Can agents be mentioned in issue description (not comments)?
6. Do agents respect issue assignment/status?

### Strategic
7. What's the optimal mention format to maximize response rate?
8. Should we timeout pending agents after X days?
9. How do we handle agent spam (multiple PRs from same agent)?

## Best Practices (Evolving)

### ✅ Do

- **Mention agents explicitly** in comments with @handle
- **Give clear context** in the issue description
- **Wait 24-48 hours** before re-mentioning
- **Track response patterns** to optimize agent selection
- **Close issues properly** to mark ignored agents correctly

### ❌ Don't

- **Spam agents** with multiple mentions in quick succession
- **Mention non-responsive agents** (until they prove reliable)
- **Remove ar label** while agents are still working
- **Close issues early** - give agents time to respond

## Changelog

### 2025-11-12
- Initial learnings from ENG-320 investigation
- Documented Cursor (9min), Engine (31min), Cyrus (0% response) behaviors
- Identified attachment mystery
- Created testing plan

### Future
- (Add new learnings as we observe more agent behavior)
