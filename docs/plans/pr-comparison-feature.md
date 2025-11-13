# PR Comparison Feature - Technical Specification

## Overview
Build a side-by-side PR comparison interface on issue detail pages that allows users to compare pull requests from different agents, similar to phone comparison websites. Users can select any 2 agents to view their PRs side-by-side with file-by-file aligned diffs.

## Milestones

### Milestone 1: UI Shell with Mock Data
**Status:** Not Started
**Goal:** Build complete UI with fake data, inactive buttons, "Coming Soon" messaging

#### Deliverables
- Full comparison UI layout on issue detail page
- Mock/placeholder diff data rendered in side-by-side columns
- Agent selector interface (2+ agents, toggle between them)
- Column headers with CI status indicators (mock data)
- Column footers with review interface (inactive)
- "Coming in Milestone 2/3" messaging where appropriate

#### Components to Build

##### 1. Agent Selector
- Located at bottom of issue detail page
- Allows selecting exactly 2 agents to compare
- If 2 agents: Show both automatically
- If 3+ agents: Show toggle/selector to pick which 2 to display
- Visual design:
  ```
  [Agent Selector]
  ┌──────────────────────────────────────────┐
  │ Compare PRs:                             │
  │ [✓ cursor] [✓ engine] [ ] cyrus [ ] factory │
  │                                          │
  │ Select 2 agents to compare              │
  └──────────────────────────────────────────┘
  ```

##### 2. Side-by-Side Comparison Layout
```
┌─────────────────────────┬─────────────────────────┐
│ Agent 1: cursor         │ Agent 2: engine         │
├─────────────────────────┼─────────────────────────┤
│ ● CI: Passing (MOCK)    │ ● CI: Failed (MOCK)     │
│                         │                         │
│ [Mock File List]        │ [Mock File List]        │
│                         │                         │
│ file1.ts (Modified)     │ file1.ts (Modified)     │
│ ┌─────────────────────┐ │ ┌─────────────────────┐ │
│ │ Mock diff content   │ │ │ Mock diff content   │ │
│ │ - old line          │ │ │ - different old     │ │
│ │ + new line          │ │ │ + different new     │ │
│ └─────────────────────┘ │ └─────────────────────┘ │
│                         │                         │
│ file2.ts (Added)        │ file2.ts (Not changed)  │
│ ┌─────────────────────┐ │ ┌─────────────────────┐ │
│ │ Mock new file       │ │ │ No changes          │ │
│ └─────────────────────┘ │ └─────────────────────┘ │
│                         │                         │
│ ┌─────────────────────┐ │ ┌─────────────────────┐ │
│ │ @cursor-agent       │ │ │ @engine-agent       │ │
│ │ [Comment textarea]  │ │ │ [Comment textarea]  │ │
│ │ (INACTIVE)          │ │ │ (INACTIVE)          │ │
│ │                     │ │ │                     │ │
│ │ [Approve] [Request  │ │ │ [Approve] [Request  │ │
│ │  Changes] (DISABLED)│ │ │  Changes] (DISABLED)│ │
│ │                     │ │ │                     │ │
│ │ 🔒 Sign in to review│ │ │ 🔒 Sign in to review│ │
│ └─────────────────────┘ │ └─────────────────────┘ │
└─────────────────────────┴─────────────────────────┘
```

##### 3. Column Header - CI Status Indicator
**Location:** Top of each agent column

**Elements:**
- Status dot/badge with color coding:
  - 🟢 Green: All checks passed
  - 🔴 Red: Checks failed
  - 🟡 Yellow: Checks pending
  - ⚪ Gray: No checks configured
- Agent name and GitHub handle
- PR number and status (Open/Merged/Closed)
- Mock data for Milestone 1

**Example:**
```
┌─────────────────────────────────┐
│ cursor (@cursor-agent)          │
│ PR #1234 • Open                 │
│ ● Checks: Passing (MOCK)        │
└─────────────────────────────────┘
```

##### 4. Column Footer - Review Interface (Inactive)
**Location:** Bottom of each agent column (floating/sticky)

**Elements:**
- Comment textarea
  - Pre-filled with agent's GitHub handle (e.g., `@cursor-agent`)
  - Disabled in Milestone 1
- Action buttons (side-by-side):
  - **"Approve"** button (green/success variant, disabled)
  - **"Request Changes"** button (default variant, disabled)
- Lock icon + "Sign in to review" message
- Each column has independent review interface

**Example:**
```
┌───────────────────────────────────┐
│ Review for @cursor-agent          │
│ ┌───────────────────────────────┐ │
│ │ @cursor-agent                 │ │
│ │ Add your review comment...    │ │
│ │ (grayed out/disabled)         │ │
│ └───────────────────────────────┘ │
│                                   │
│ [Approve (disabled)] [Request     │
│                      Changes      │
│                      (disabled)]  │
│                                   │
│ 🔒 Sign in with GitHub to review  │
└───────────────────────────────────┘
```

#### Mock Data Structure
```typescript
const mockComparison = {
  agents: [
    {
      name: 'cursor',
      githubHandle: 'cursor-agent',
      prNumber: 1234,
      prStatus: 'open',
      ciStatus: 'passing',
      files: [
        {
          filename: 'src/lib/queries.ts',
          status: 'modified',
          additions: 15,
          deletions: 3,
          patch: '... mock unified diff ...'
        }
      ]
    },
    {
      name: 'engine',
      githubHandle: 'engine-agent',
      prNumber: 1235,
      prStatus: 'open',
      ciStatus: 'failed',
      files: [
        {
          filename: 'src/lib/queries.ts',
          status: 'modified',
          additions: 20,
          deletions: 5,
          patch: '... mock unified diff ...'
        }
      ]
    }
  ]
}
```

#### Technical Notes
- Use placeholder CSS for diff highlighting
- All interactive elements should have `disabled` state
- Include "Coming Soon" badges/tooltips
- Ensure layout is responsive and handles long diffs
- Consider using `react-diff-viewer` with mock data for visual fidelity

#### Success Criteria
- [ ] UI looks production-ready with mock data
- [ ] Agent selector works (UI only, no real data)
- [ ] Layout handles 2+ agents gracefully
- [ ] CI status indicators display correctly (mock)
- [ ] Review interface is visible but clearly inactive
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] "Coming Soon" messaging is clear and professional

---

### Milestone 2: Real Data Integration & Comparison Logic
**Status:** Not Started
**Goal:** Replace mock data with real GitHub API calls, implement diff parsing and rendering

#### Dependencies
- GitHub API client setup (`@octokit/rest`)
- Diff parsing library (`parse-diff`)
- React diff viewer (`react-diff-view` or `react-diff-viewer`)

#### GitHub API Integration

##### Required Endpoints
1. **List PR Files**
   ```typescript
   GET /repos/{owner}/{repo}/pulls/{pull_number}/files
   ```
   Returns array of file objects with `patch` field (unified diff)

2. **Get PR Details** (for CI status)
   ```typescript
   GET /repos/{owner}/{repo}/pulls/{pull_number}
   ```
   Combined with:
   ```typescript
   GET /repos/{owner}/{repo}/commits/{ref}/check-runs
   ```

##### API Response Structure
```typescript
interface GitHubPRFile {
  sha: string
  filename: string
  status: 'modified' | 'added' | 'removed' | 'renamed'
  additions: number
  deletions: number
  changes: number
  blob_url: string
  raw_url: string
  contents_url: string
  patch: string  // ← Critical: unified diff format
}
```

#### File Alignment Logic

**Challenge:** Two PRs may modify different sets of files
**Solution:** Create unified file list with null handling

```typescript
type AlignedFile = {
  filename: string
  agent1File: GitHubPRFile | null
  agent2File: GitHubPRFile | null
}

function alignFiles(
  agent1Files: GitHubPRFile[],
  agent2Files: GitHubPRFile[]
): AlignedFile[] {
  const fileMap = new Map<string, AlignedFile>()

  // Add all files from agent 1
  agent1Files.forEach(file => {
    fileMap.set(file.filename, {
      filename: file.filename,
      agent1File: file,
      agent2File: null
    })
  })

  // Merge files from agent 2
  agent2Files.forEach(file => {
    const existing = fileMap.get(file.filename)
    if (existing) {
      existing.agent2File = file
    } else {
      fileMap.set(file.filename, {
        filename: file.filename,
        agent1File: null,
        agent2File: file
      })
    }
  })

  return Array.from(fileMap.values()).sort((a, b) =>
    a.filename.localeCompare(b.filename)
  )
}
```

#### Diff Parsing & Rendering

##### Install Dependencies
```bash
pnpm add parse-diff react-diff-view
```

##### Parse Unified Diff
```typescript
import { parseDiff, File as ParsedFile } from 'parse-diff'

function parsePatch(patchString: string): ParsedFile[] {
  return parseDiff(patchString)
}
```

##### Render Side-by-Side Diff
```tsx
import { Diff, Hunk } from 'react-diff-view'
import 'react-diff-view/style/index.css'

function FileDiffComparison({
  filename,
  agent1File,
  agent2File
}: AlignedFile) {
  const agent1Diff = agent1File
    ? parseDiff(agent1File.patch)[0]
    : null
  const agent2Diff = agent2File
    ? parseDiff(agent2File.patch)[0]
    : null

  return (
    <div className="file-comparison">
      <div className="file-header">
        <h3>{filename}</h3>
        <div className="stats">
          {agent1File && (
            <span>Agent 1: +{agent1File.additions} -{agent1File.deletions}</span>
          )}
          {agent2File && (
            <span>Agent 2: +{agent2File.additions} -{agent2File.deletions}</span>
          )}
        </div>
      </div>

      <div className="side-by-side-diff">
        {/* Agent 1 Column */}
        <div className="diff-column">
          {agent1Diff ? (
            <Diff
              viewType="split"
              diffType={agent1File.status === 'added' ? 'add' : agent1File.status === 'removed' ? 'delete' : 'modify'}
              hunks={agent1Diff.hunks}
            >
              {hunks => hunks.map(hunk => (
                <Hunk key={hunk.content} hunk={hunk} />
              ))}
            </Diff>
          ) : (
            <div className="no-changes">No changes in this file</div>
          )}
        </div>

        {/* Agent 2 Column */}
        <div className="diff-column">
          {agent2Diff ? (
            <Diff
              viewType="split"
              diffType={agent2File.status === 'added' ? 'add' : agent2File.status === 'removed' ? 'delete' : 'modify'}
              hunks={agent2Diff.hunks}
            >
              {hunks => hunks.map(hunk => (
                <Hunk key={hunk.content} hunk={hunk} />
              ))}
            </Diff>
          ) : (
            <div className="no-changes">No changes in this file</div>
          )}
        </div>
      </div>
    </div>
  )
}
```

#### Minimal Context Calculation

**User Requirement:** Show minimal lines that capture both PRs' changes

**Algorithm:**
1. Parse both diffs to get changed line numbers
2. Calculate union of affected lines
3. Expand to include small context window (3 lines before/after)
4. Filter hunks to only show relevant sections

```typescript
function calculateMinimalContext(
  agent1Diff: ParsedFile | null,
  agent2Diff: ParsedFile | null,
  contextLines: number = 3
): Set<number> {
  const affectedLines = new Set<number>()

  // Collect changed lines from both diffs
  [agent1Diff, agent2Diff].forEach(diff => {
    diff?.hunks.forEach(hunk => {
      hunk.changes.forEach(change => {
        if (change.type !== 'normal') {
          // Add changed line and context
          const lineNum = change.lineNumber || change.oldLineNumber || 0
          for (let i = lineNum - contextLines; i <= lineNum + contextLines; i++) {
            if (i > 0) affectedLines.add(i)
          }
        }
      })
    })
  })

  return affectedLines
}
```

#### Agent Toggle Interface

**Scenario:** Issue has 3+ agents with PRs
**Requirement:** User can toggle which 2 to view

```tsx
function AgentSelector({
  agents,
  selectedAgents,
  onSelectionChange
}: {
  agents: Agent[]
  selectedAgents: [string, string]
  onSelectionChange: (agents: [string, string]) => void
}) {
  return (
    <div className="agent-selector">
      <h3>Compare PRs (select 2):</h3>
      <div className="agent-chips">
        {agents.map(agent => (
          <button
            key={agent.name}
            className={selectedAgents.includes(agent.name) ? 'selected' : ''}
            onClick={() => handleToggle(agent.name)}
            disabled={
              !selectedAgents.includes(agent.name) &&
              selectedAgents.length >= 2
            }
          >
            <AgentAvatar agent={agent} />
            {agent.displayName}
            {selectedAgents.includes(agent.name) && <CheckIcon />}
          </button>
        ))}
      </div>
    </div>
  )
}
```

#### CI Status Integration

Fetch CI status from GitHub Checks API:

```typescript
async function getPRCheckStatus(
  owner: string,
  repo: string,
  prNumber: number
): Promise<'passing' | 'failing' | 'pending' | 'none'> {
  // Get PR to get head SHA
  const pr = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber
  })

  // Get check runs for that SHA
  const checks = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref: pr.data.head.sha
  })

  if (checks.data.total_count === 0) return 'none'

  const allPassed = checks.data.check_runs.every(
    run => run.conclusion === 'success'
  )
  const anyFailed = checks.data.check_runs.some(
    run => run.conclusion === 'failure'
  )
  const anyPending = checks.data.check_runs.some(
    run => run.status === 'in_progress' || run.status === 'queued'
  )

  if (allPassed) return 'passing'
  if (anyFailed) return 'failing'
  if (anyPending) return 'pending'

  return 'none'
}
```

#### Success Criteria
- [ ] Real PR data loads from GitHub API
- [ ] File alignment works for mismatched file lists
- [ ] Diffs render correctly with syntax highlighting
- [ ] Agent toggle allows selecting any 2 agents (when 3+)
- [ ] CI status indicators show real check results
- [ ] Minimal context calculation reduces visible lines appropriately
- [ ] Performance is acceptable for large PRs (100+ files)
- [ ] Error handling for API failures
- [ ] Loading states during data fetch

#### Technical Debt & Optimizations
- Consider caching PR data to reduce API calls
- Implement virtual scrolling for large file lists
- Add diff collapse/expand for unchanged sections
- Lazy load file diffs on scroll

---

### Milestone 3: GitHub Authentication & Review Submission
**Status:** Not Started
**Goal:** Enable user authentication and PR review submission

#### Authentication Requirements

##### Why Authentication is Needed
To submit PR reviews via GitHub API, the application must:
1. Authenticate users via GitHub OAuth
2. Obtain an access token with `repo` scope
3. Use that token to submit reviews on user's behalf

##### Authentication Flow
```
User clicks "Sign in with GitHub"
  ↓
Redirect to GitHub OAuth
  ↓
User authorizes app
  ↓
GitHub redirects back with code
  ↓
Exchange code for access token
  ↓
Store token securely
  ↓
User can now submit reviews
```

#### Recommended Solution: NextAuth.js v5

**Why NextAuth.js:**
- Official Next.js integration
- Built-in GitHub provider
- Session management included
- Works with Server Components
- Handles token refresh automatically

##### Installation
```bash
pnpm add next-auth@beta @auth/core
```

##### Configuration

**1. Create `auth.ts`**
```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'repo read:user user:email'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist OAuth access token to JWT
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      // Make access token available in session
      session.accessToken = token.accessToken as string
      return session
    }
  }
})
```

**2. Create API Route `app/api/auth/[...nextauth]/route.ts`**
```typescript
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

**3. Add Environment Variables**
```bash
# .env.local
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3109
```

**4. Register GitHub OAuth App**
- Go to GitHub Settings → Developer settings → OAuth Apps
- Create new OAuth App
- Homepage URL: `http://localhost:3109` (dev) / `https://your-domain.com` (prod)
- Authorization callback URL: `http://localhost:3109/api/auth/callback/github`
- Copy Client ID and Client Secret to `.env.local`

##### Database Schema Updates

Add `users` and `sessions` tables:

```typescript
// src/db/schema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubId: text('github_id').notNull().unique(),
  githubUsername: text('github_username').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token'), // Encrypted
  accessTokenExpiry: timestamp('access_token_expiry'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionToken: text('session_token').notNull().unique(),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})
```

#### UI Updates for Authentication

##### 1. Add Sign In Button (Global Header)
```tsx
// src/components/AuthButton.tsx
import { auth, signIn, signOut } from "@/auth"

export async function AuthButton() {
  const session = await auth()

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={session.user.image}
          alt={session.user.name}
          className="w-8 h-8 rounded-full"
        />
        <span>{session.user.name}</span>
        <form action={async () => {
          'use server'
          await signOut()
        }}>
          <button type="submit">Sign Out</button>
        </form>
      </div>
    )
  }

  return (
    <form action={async () => {
      'use server'
      await signIn('github')
    }}>
      <button type="submit" className="btn-primary">
        Sign in with GitHub
      </button>
    </form>
  )
}
```

##### 2. Update Review Interface (Column Footer)
```tsx
// src/components/PRReviewInterface.tsx
import { auth } from "@/auth"

export async function PRReviewInterface({
  agentGithubHandle,
  prNumber,
  owner,
  repo
}) {
  const session = await auth()

  return (
    <div className="review-interface">
      <textarea
        placeholder={`@${agentGithubHandle}`}
        disabled={!session}
        className={!session ? 'opacity-50' : ''}
      />

      {session ? (
        <div className="review-actions">
          <button
            className="btn-success"
            onClick={() => submitReview('APPROVE')}
          >
            Approve
          </button>
          <button
            className="btn-default"
            onClick={() => submitReview('REQUEST_CHANGES')}
          >
            Request Changes
          </button>
        </div>
      ) : (
        <div className="sign-in-prompt">
          <LockIcon />
          <p>Sign in with GitHub to submit reviews</p>
          <form action={async () => {
            'use server'
            await signIn('github', {
              callbackUrl: `/issues/${issueId}?scrollTo=comparison`
            })
          }}>
            <button type="submit" className="btn-primary">
              Sign in with GitHub
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
```

#### PR Review Submission

##### GitHub API Call
```typescript
// src/lib/github-reviews.ts
import { Octokit } from '@octokit/rest'

export async function submitPRReview({
  accessToken,
  owner,
  repo,
  pullNumber,
  event, // 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  body
}: {
  accessToken: string
  owner: string
  repo: string
  pullNumber: number
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  body: string
}) {
  const octokit = new Octokit({ auth: accessToken })

  const response = await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event,
    body
  })

  return response.data
}
```

##### Server Action for Review Submission
```typescript
// src/app/actions/submit-review.ts
'use server'

import { auth } from '@/auth'
import { submitPRReview } from '@/lib/github-reviews'
import { revalidatePath } from 'next/cache'

export async function submitReview(
  owner: string,
  repo: string,
  pullNumber: number,
  event: 'APPROVE' | 'REQUEST_CHANGES',
  comment: string
) {
  const session = await auth()

  if (!session?.accessToken) {
    throw new Error('Not authenticated')
  }

  try {
    const review = await submitPRReview({
      accessToken: session.accessToken,
      owner,
      repo,
      pullNumber,
      event,
      body: comment
    })

    // Revalidate the issue page to show updated review status
    revalidatePath(`/issues/[id]`)

    return { success: true, review }
  } catch (error) {
    console.error('Failed to submit review:', error)
    throw new Error('Failed to submit review')
  }
}
```

##### Client Component for Review Form
```tsx
'use client'

import { useState } from 'react'
import { submitReview } from '@/app/actions/submit-review'

export function ReviewForm({
  owner,
  repo,
  pullNumber,
  defaultComment,
  issueId
}) {
  const [comment, setComment] = useState(defaultComment)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: 'APPROVE' | 'REQUEST_CHANGES') {
    setIsSubmitting(true)
    try {
      await submitReview(owner, repo, pullNumber, event, comment)
      // Show success message
      alert('Review submitted successfully!')
    } catch (error) {
      alert('Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="review-form">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add your review comment..."
        disabled={isSubmitting}
      />
      <div className="actions">
        <button
          onClick={() => handleSubmit('APPROVE')}
          disabled={isSubmitting}
          className="btn-success"
        >
          {isSubmitting ? 'Submitting...' : 'Approve'}
        </button>
        <button
          onClick={() => handleSubmit('REQUEST_CHANGES')}
          disabled={isSubmitting}
          className="btn-default"
        >
          {isSubmitting ? 'Submitting...' : 'Request Changes'}
        </button>
      </div>
    </div>
  )
}
```

#### Security Considerations

1. **Token Storage**
   - Store access tokens encrypted in database
   - Use environment variable for encryption key
   - Never expose tokens to client

2. **Scope Limitation**
   - Only request `repo` scope (required for reviews)
   - Don't request unnecessary permissions

3. **CSRF Protection**
   - NextAuth.js handles this automatically
   - Ensure `NEXTAUTH_SECRET` is set

4. **Rate Limiting**
   - GitHub API has rate limits (5000/hour for authenticated)
   - Implement client-side debouncing for review submissions
   - Show error messages for rate limit errors

#### Success Criteria
- [ ] Users can sign in with GitHub
- [ ] OAuth flow works correctly (dev and production)
- [ ] Access tokens stored securely and encrypted
- [ ] Session persists across page refreshes
- [ ] Review interface becomes active after sign in
- [ ] PR reviews submit successfully to GitHub
- [ ] Review appears on GitHub PR immediately
- [ ] Error handling for auth failures
- [ ] Error handling for API failures
- [ ] Sign out functionality works
- [ ] Unauthenticated users can still view comparison (read-only)
- [ ] Callback redirect works (returns user to comparison view)

---

## Dependencies & Installation

### npm Packages
```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.2",
    "parse-diff": "^0.11.1",
    "react-diff-view": "^3.2.1",
    "next-auth": "^5.0.0-beta",
    "@auth/core": "^0.18.0"
  }
}
```

### Environment Variables
```bash
# GitHub API
GITHUB_TOKEN=ghp_... # For server-side API calls (optional, for higher rate limits)

# GitHub OAuth (Milestone 3)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# NextAuth (Milestone 3)
NEXTAUTH_SECRET=your_random_32_char_secret
NEXTAUTH_URL=http://localhost:3109
```

## API Rate Limits

**GitHub REST API:**
- Unauthenticated: 60 requests/hour
- Authenticated: 5,000 requests/hour
- Secondary rate limit: 100 concurrent requests

**Mitigation Strategies:**
- Cache PR data client-side (React Query or SWR)
- Implement request debouncing
- Use conditional requests with ETags
- Consider GitHub GraphQL API for complex queries (single request for all data)

## Edge Cases to Handle

1. **PR doesn't exist** - Show "No PR found" message
2. **PR has no files changed** - Show "No changes in this PR"
3. **Agent modified file, other didn't** - Show empty/placeholder on other side
4. **Very large diffs (1000+ lines)** - Implement collapse/expand sections
5. **Binary files** - Show "Binary file" message, no diff
6. **More than 300 files** - GitHub API paginates, need to handle
7. **PR is from fork** - Handle cross-repo PRs correctly
8. **User revokes GitHub access** - Handle OAuth errors gracefully
9. **GitHub API downtime** - Show error message, retry mechanism

## Performance Considerations

- **Initial Load:** Fetch both PRs in parallel
- **Large PRs:** Virtual scrolling for file list
- **Diff Rendering:** Use `react-diff-view`'s web worker support
- **Syntax Highlighting:** Lazy load highlighter libraries
- **API Caching:** Cache responses for 5-10 minutes
- **Code Splitting:** Lazy load comparison component

## Testing Strategy

### Unit Tests
- File alignment logic
- Minimal context calculation
- Mock data generators
- Review submission validation

### Integration Tests
- GitHub API calls (with mocked Octokit)
- Auth flow (with mocked NextAuth)
- Server actions

### E2E Tests
- Complete comparison flow
- Agent selection
- Sign in and review submission
- Error states

## Future Enhancements (Post-MVP)

- **Three-way diff:** Original + Agent 1 + Agent 2
- **Diff statistics:** Visual comparison of additions/deletions
- **Conflict highlighting:** Show where both agents modified same lines
- **Export comparison:** Download as PDF or HTML
- **Inline comments:** Add line-specific comments (requires more complex UI)
- **Notification:** Email when agents complete PRs
- **Filter files:** Show only conflicting files or files changed by both

---

## Appendix: GitHub API Reference

### List Pull Request Files
```
GET /repos/{owner}/{repo}/pulls/{pull_number}/files
```

**Response:**
```json
[
  {
    "sha": "abc123",
    "filename": "src/file.ts",
    "status": "modified",
    "additions": 10,
    "deletions": 2,
    "changes": 12,
    "patch": "@@ -1,5 +1,15 @@\n-old line\n+new line"
  }
]
```

### Create Pull Request Review
```
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
```

**Request Body:**
```json
{
  "body": "Review comment",
  "event": "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
}
```

**Response:**
```json
{
  "id": 123456,
  "user": {
    "login": "reviewer-username"
  },
  "body": "Review comment",
  "state": "APPROVED",
  "submitted_at": "2025-01-01T00:00:00Z"
}
```

### List Check Runs for a Git Reference
```
GET /repos/{owner}/{repo}/commits/{ref}/check-runs
```

**Response:**
```json
{
  "total_count": 3,
  "check_runs": [
    {
      "id": 123,
      "name": "build",
      "status": "completed",
      "conclusion": "success"
    }
  ]
}
```
