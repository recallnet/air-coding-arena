# Implementation Plan: GitHub-Style Activity Table

**Date:** 2025-11-12
**Status:** Planning
**Methodology:** TDD (RED-GREEN-REFACTOR)

## Overview

Transform the home page "Recent Activity" table to match GitHub Issues styling:
- One row per issue (not per attempt/PR)
- Agent avatars showing who's working or completed
- Filter by issue status
- Dark mode only with Vercel/GitHub aesthetics
- Collapse attempts into issue rows with visual indicators

## User Requirements

From conversation:
> "we should style that table very similar to the Issues table on GH https://github.com/recallnet/js-recall/issues
> where you can filter by issue type. on the right are the little avatars per agent working on it (or done)
> and probably collapse the rows. right now you have a row per agent PR or something. but do a row per issue and have some minimal visual (like agent avatars) per each agent working or complete in the row"

> "please use your planning skill and subagent skill to do this efficiently and awesome. tdd it if you can.
> i have to pop to a meeting, so i trust you can do it. make decisions on your own and make sure to QA the website visuals too. i think aiming for vercel or gh style, darkmode only, and very close visual look to those is the ideal"

## Design Decisions

### Data Structure
**Decision:** Create new query `getIssuesWithAgents()` that returns:
- Issue data (id, linearKey, title, status, arenaReadyLabeledAt)
- Array of agents working on issue with their status (pending, submitted, accepted, rejected, ignored)
- Count of PRs per status (open, merged, closed)

**Rationale:** Need to group by issue, not by attempt. Current `getRecentActivity()` returns one row per PR.

### Visual Design
**Decision:** Match GitHub Issues list styling:
- Issue title + linearKey as main identifier
- Status badges (open, in progress, completed, cancelled)
- Agent avatars on right side (colored circles with initials)
- Timestamp showing "opened X days ago" or last activity
- Hover states showing tooltip with agent name + status

**Rationale:** User explicitly wants GH-style. Dark mode only per user preference.

### Filtering
**Decision:** Add filter buttons above table:
- All issues
- Open
- In Progress
- Completed
- Cancelled

**Rationale:** User mentioned "filter by issue type" - interpreting as issue status filtering like GH.

### Agent Avatar Colors
**Decision:** Use consistent color scheme:
- Pending: Gray (#6b7280)
- Submitted (working): Blue (#3b82f6)
- Accepted (won): Green (#22c55e)
- Rejected: Red (#ef4444)
- Ignored: Gray with opacity (#6b7280 50%)

**Rationale:** Standard status colors, accessible in dark mode.

## Tasks

### Task 1: Create Query for Issues with Agents
**File:** `src/lib/queries.ts`
**Goal:** Add `getIssuesWithAgents()` function that returns issues grouped with their agents

**TDD Steps:**
1. **RED:** Write test in `src/lib/queries.test.ts`:
   ```typescript
   test('getIssuesWithAgents returns issues with agent data', async () => {
     // Setup: Insert issue + issue_agents + attempts
     // Assert: Returns issue with agents array
     // Assert: Agent status is correct (pending/submitted/accepted/rejected)
     // Assert: Issues ordered by most recent activity
   })
   ```

2. **GREEN:** Implement `getIssuesWithAgents()`:
   ```typescript
   export type IssueWithAgents = {
     id: string
     linearKey: string
     title: string
     status: string | null
     url: string
     arenaReadyLabeledAt: Date | null
     agents: Array<{
       agentName: string
       status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'ignored'
     }>
     lastActivityAt: Date
     openPRCount: number
     mergedPRCount: number
   }

   export async function getIssuesWithAgents(
     limit: number = 30
   ): Promise<IssueWithAgents[]> {
     // SQL query:
     // 1. Select from issues
     // 2. LEFT JOIN issue_agents for agent data
     // 3. LEFT JOIN attempts for PR counts and last activity
     // 4. GROUP BY issue.id
     // 5. ORDER BY MAX(COALESCE(attempts.opened_at, issues.arena_ready_labeled_at)) DESC
     // 6. LIMIT
   }
   ```

3. **REFACTOR:** Extract helper functions if query gets complex

**Verification:**
```bash
npm test -- src/lib/queries.test.ts
```

**Success Criteria:**
- Test passes
- Query returns correct data structure
- Agents grouped per issue
- Ordered by most recent activity

---

### Task 2: Create Agent Avatar Component
**File:** `src/components/AgentAvatar.tsx`
**Goal:** Reusable agent avatar component with status colors

**TDD Steps:**
1. **RED:** Write test in `src/components/AgentAvatar.test.tsx`:
   ```typescript
   test('renders agent initials', () => {
     render(<AgentAvatar name="cursor" status="submitted" />)
     expect(screen.getByText('C')).toBeInTheDocument()
   })

   test('applies correct color for pending status', () => {
     const { container } = render(<AgentAvatar name="engine" status="pending" />)
     expect(container.firstChild).toHaveClass('bg-gray-600')
   })

   test('applies correct color for submitted status', () => {
     const { container } = render(<AgentAvatar name="cyrus" status="submitted" />)
     expect(container.firstChild).toHaveClass('bg-blue-500')
   })

   test('applies correct color for accepted status', () => {
     const { container } = render(<AgentAvatar name="cursor" status="accepted" />)
     expect(container.firstChild).toHaveClass('bg-green-500')
   })

   test('applies correct color for rejected status', () => {
     const { container } = render(<AgentAvatar name="engine" status="rejected" />)
     expect(container.firstChild).toHaveClass('bg-red-500')
   })

   test('shows tooltip on hover with agent name and status', async () => {
     render(<AgentAvatar name="cursor" status="submitted" />)
     const avatar = screen.getByText('C')
     await userEvent.hover(avatar)
     expect(await screen.findByText('cursor - Submitted')).toBeInTheDocument()
   })
   ```

2. **GREEN:** Implement `AgentAvatar` component:
   ```typescript
   type AgentStatus = 'pending' | 'submitted' | 'accepted' | 'rejected' | 'ignored'

   export type AgentAvatarProps = {
     name: string
     status: AgentStatus
     size?: 'sm' | 'md' | 'lg'
   }

   export function AgentAvatar({ name, status, size = 'md' }: AgentAvatarProps) {
     const initial = name.charAt(0).toUpperCase()
     const colorClass = getStatusColorClass(status)
     const sizeClass = getSizeClass(size)

     return (
       <div
         className={cn(
           'flex items-center justify-center rounded-full',
           'font-semibold text-white',
           'transition-transform hover:scale-110',
           colorClass,
           sizeClass
         )}
         title={`${name} - ${formatStatus(status)}`}
       >
         {initial}
       </div>
     )
   }

   function getStatusColorClass(status: AgentStatus): string {
     switch (status) {
       case 'pending':
         return 'bg-gray-600'
       case 'submitted':
         return 'bg-blue-500'
       case 'accepted':
         return 'bg-green-500'
       case 'rejected':
         return 'bg-red-500'
       case 'ignored':
         return 'bg-gray-600 opacity-50'
     }
   }

   function getSizeClass(size: 'sm' | 'md' | 'lg'): string {
     switch (size) {
       case 'sm':
         return 'h-6 w-6 text-xs'
       case 'md':
         return 'h-8 w-8 text-sm'
       case 'lg':
         return 'h-10 w-10 text-base'
     }
   }

   function formatStatus(status: AgentStatus): string {
     return status.charAt(0).toUpperCase() + status.slice(1)
   }
   ```

3. **REFACTOR:** Clean up if needed

**Verification:**
```bash
npm test -- src/components/AgentAvatar.test.tsx
```

**Success Criteria:**
- All tests pass
- Component renders with correct colors
- Tooltip shows on hover
- Accessible (aria-label)

---

### Task 3: Create Agent Avatar Group Component
**File:** `src/components/AgentAvatarGroup.tsx`
**Goal:** Display multiple agent avatars in a group (overlapping style like GH)

**TDD Steps:**
1. **RED:** Write test in `src/components/AgentAvatarGroup.test.tsx`:
   ```typescript
   test('renders multiple avatars', () => {
     const agents = [
       { agentName: 'cursor', status: 'submitted' as const },
       { agentName: 'engine', status: 'accepted' as const },
     ]
     render(<AgentAvatarGroup agents={agents} />)
     expect(screen.getByText('C')).toBeInTheDocument()
     expect(screen.getByText('E')).toBeInTheDocument()
   })

   test('shows +N indicator when more than 3 agents', () => {
     const agents = [
       { agentName: 'cursor', status: 'submitted' as const },
       { agentName: 'engine', status: 'accepted' as const },
       { agentName: 'cyrus', status: 'pending' as const },
       { agentName: 'claude', status: 'pending' as const },
     ]
     render(<AgentAvatarGroup agents={agents} />)
     expect(screen.getByText('+1')).toBeInTheDocument()
   })

   test('renders empty state when no agents', () => {
     const { container } = render(<AgentAvatarGroup agents={[]} />)
     expect(container.firstChild).toHaveTextContent('-')
   })
   ```

2. **GREEN:** Implement `AgentAvatarGroup`:
   ```typescript
   export type AgentAvatarGroupProps = {
     agents: Array<{
       agentName: string
       status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'ignored'
     }>
     maxVisible?: number
   }

   export function AgentAvatarGroup({
     agents,
     maxVisible = 3
   }: AgentAvatarGroupProps) {
     if (agents.length === 0) {
       return <span className="text-foreground-secondary">-</span>
     }

     const visibleAgents = agents.slice(0, maxVisible)
     const remainingCount = agents.length - maxVisible

     return (
       <div className="flex -space-x-2">
         {visibleAgents.map((agent, index) => (
           <div key={agent.agentName} style={{ zIndex: visibleAgents.length - index }}>
             <AgentAvatar
               name={agent.agentName}
               status={agent.status}
               size="sm"
             />
           </div>
         ))}
         {remainingCount > 0 && (
           <div
             className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-white ring-2 ring-background"
             title={`+${remainingCount} more`}
           >
             +{remainingCount}
           </div>
         )}
       </div>
     )
   }
   ```

3. **REFACTOR:** Clean up if needed

**Verification:**
```bash
npm test -- src/components/AgentAvatarGroup.test.tsx
```

**Success Criteria:**
- All tests pass
- Avatars overlap correctly
- +N indicator shows when > maxVisible
- Empty state handled

---

### Task 4: Create Issue Status Filter Component
**File:** `src/components/IssueStatusFilter.tsx`
**Goal:** Filter buttons for issue statuses (client component for interactivity)

**TDD Steps:**
1. **RED:** Write test in `src/components/IssueStatusFilter.test.tsx`:
   ```typescript
   test('renders all filter buttons', () => {
     const onFilterChange = vi.fn()
     render(<IssueStatusFilter currentFilter="all" onFilterChange={onFilterChange} />)
     expect(screen.getByText('All')).toBeInTheDocument()
     expect(screen.getByText('Open')).toBeInTheDocument()
     expect(screen.getByText('In Progress')).toBeInTheDocument()
     expect(screen.getByText('Completed')).toBeInTheDocument()
     expect(screen.getByText('Cancelled')).toBeInTheDocument()
   })

   test('calls onFilterChange when button clicked', async () => {
     const onFilterChange = vi.fn()
     render(<IssueStatusFilter currentFilter="all" onFilterChange={onFilterChange} />)
     await userEvent.click(screen.getByText('Open'))
     expect(onFilterChange).toHaveBeenCalledWith('open')
   })

   test('highlights current filter', () => {
     const onFilterChange = vi.fn()
     const { rerender } = render(
       <IssueStatusFilter currentFilter="open" onFilterChange={onFilterChange} />
     )
     expect(screen.getByText('Open')).toHaveClass('bg-blue-600')
     expect(screen.getByText('All')).not.toHaveClass('bg-blue-600')
   })
   ```

2. **GREEN:** Implement `IssueStatusFilter`:
   ```typescript
   'use client'

   type IssueFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'

   export type IssueStatusFilterProps = {
     currentFilter: IssueFilter
     onFilterChange: (filter: IssueFilter) => void
   }

   const filters = [
     { value: 'all', label: 'All' },
     { value: 'open', label: 'Open' },
     { value: 'in_progress', label: 'In Progress' },
     { value: 'completed', label: 'Completed' },
     { value: 'cancelled', label: 'Cancelled' },
   ] as const

   export function IssueStatusFilter({
     currentFilter,
     onFilterChange
   }: IssueStatusFilterProps) {
     return (
       <div className="flex gap-2">
         {filters.map((filter) => (
           <button
             key={filter.value}
             onClick={() => onFilterChange(filter.value as IssueFilter)}
             className={cn(
               'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
               currentFilter === filter.value
                 ? 'bg-blue-600 text-white'
                 : 'bg-background-secondary text-foreground-secondary hover:bg-background-tertiary'
             )}
           >
             {filter.label}
           </button>
         ))}
       </div>
     )
   }
   ```

3. **REFACTOR:** Clean up if needed

**Verification:**
```bash
npm test -- src/components/IssueStatusFilter.test.tsx
```

**Success Criteria:**
- All tests pass
- Buttons render correctly
- Active filter highlighted
- Callback called on click

---

### Task 5: Create New IssueActivityTable Component
**File:** `src/components/IssueActivityTable.tsx`
**Goal:** GitHub-style table showing one row per issue with agent avatars

**TDD Steps:**
1. **RED:** Write test in `src/components/IssueActivityTable.test.tsx`:
   ```typescript
   test('renders issue rows', () => {
     const issues = [
       {
         id: '1',
         linearKey: 'ENG-320',
         title: 'Test issue',
         status: 'In Progress',
         url: 'https://linear.app/...',
         arenaReadyLabeledAt: new Date('2025-11-10'),
         agents: [
           { agentName: 'cursor', status: 'submitted' as const },
         ],
         lastActivityAt: new Date('2025-11-12'),
         openPRCount: 1,
         mergedPRCount: 0,
       },
     ]
     render(<IssueActivityTable issues={issues} />)
     expect(screen.getByText('ENG-320')).toBeInTheDocument()
     expect(screen.getByText('Test issue')).toBeInTheDocument()
     expect(screen.getByText('C')).toBeInTheDocument() // Avatar
   })

   test('renders empty state', () => {
     render(<IssueActivityTable issues={[]} />)
     expect(screen.getByText('No active issues')).toBeInTheDocument()
   })

   test('filters by status', () => {
     const issues = [
       {
         id: '1',
         linearKey: 'ENG-1',
         title: 'Open issue',
         status: 'Todo',
         // ...other fields
       },
       {
         id: '2',
         linearKey: 'ENG-2',
         title: 'In progress issue',
         status: 'In Progress',
         // ...other fields
       },
     ]
     render(<IssueActivityTable issues={issues} />)

     // Default: all visible
     expect(screen.getByText('ENG-1')).toBeInTheDocument()
     expect(screen.getByText('ENG-2')).toBeInTheDocument()

     // Click "In Progress" filter
     await userEvent.click(screen.getByText('In Progress'))
     expect(screen.queryByText('ENG-1')).not.toBeInTheDocument()
     expect(screen.getByText('ENG-2')).toBeInTheDocument()
   })
   ```

2. **GREEN:** Implement `IssueActivityTable`:
   ```typescript
   'use client'

   import { useState } from 'react'
   import Link from 'next/link'
   import { Badge } from '@/components/ui/Badge'
   import { AgentAvatarGroup } from '@/components/AgentAvatarGroup'
   import { IssueStatusFilter } from '@/components/IssueStatusFilter'
   import type { IssueWithAgents } from '@/lib/queries'

   export type IssueActivityTableProps = {
     issues: IssueWithAgents[]
   }

   export function IssueActivityTable({ issues }: IssueActivityTableProps) {
     const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'>('all')

     const filteredIssues = filterIssues(issues, filter)

     return (
       <div>
         <div className="mb-4">
           <IssueStatusFilter currentFilter={filter} onFilterChange={setFilter} />
         </div>

         {filteredIssues.length === 0 ? (
           <div className="py-8 text-center text-foreground-secondary">
             No active issues
           </div>
         ) : (
           <div className="divide-y divide-border rounded-lg border border-border">
             {filteredIssues.map((issue) => (
               <div
                 key={issue.id}
                 className="flex items-center gap-4 p-4 transition-colors hover:bg-background-secondary"
               >
                 <div className="flex-1">
                   <div className="flex items-center gap-2">
                     <Badge variant={getStatusBadgeVariant(issue.status)}>
                       {issue.status ?? 'Unknown'}
                     </Badge>
                     <Link
                       href={`/issues/${issue.id}`}
                       className="font-semibold text-foreground hover:text-blue-600"
                     >
                       {issue.linearKey}
                     </Link>
                     <span className="text-foreground">{issue.title}</span>
                   </div>
                   <div className="mt-1 flex items-center gap-3 text-sm text-foreground-secondary">
                     <span>{formatRelativeTime(issue.lastActivityAt)}</span>
                     {issue.openPRCount > 0 && (
                       <span>{issue.openPRCount} open PR{issue.openPRCount > 1 ? 's' : ''}</span>
                     )}
                     {issue.mergedPRCount > 0 && (
                       <span>{issue.mergedPRCount} merged</span>
                     )}
                   </div>
                 </div>

                 <div className="flex-shrink-0">
                   <AgentAvatarGroup agents={issue.agents} />
                 </div>
               </div>
             ))}
           </div>
         )}
       </div>
     )
   }

   function filterIssues(
     issues: IssueWithAgents[],
     filter: 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'
   ): IssueWithAgents[] {
     if (filter === 'all') return issues

     return issues.filter((issue) => {
       const status = (issue.status ?? '').toLowerCase()
       switch (filter) {
         case 'open':
           return status === 'todo' || status === 'backlog'
         case 'in_progress':
           return status === 'in progress' || status === 'in review'
         case 'completed':
           return status === 'done'
         case 'cancelled':
           return status === 'canceled'
         default:
           return true
       }
     })
   }

   function getStatusBadgeVariant(status: string | null): 'default' | 'secondary' | 'success' | 'error' | 'warning' | 'outline' {
     // Same as issues/page.tsx implementation
     if (!status) return 'outline'
     switch (status) {
       case 'Done': return 'success'
       case 'In Progress': return 'warning'
       case 'In Review': return 'secondary'
       case 'Todo':
       case 'Backlog': return 'outline'
       case 'Canceled': return 'error'
       default: return 'outline'
     }
   }

   function formatRelativeTime(date: Date): string {
     // Same implementation as ActivityLog.tsx
     const now = new Date()
     const diffMs = now.getTime() - date.getTime()
     const diffDays = Math.floor(diffMs / 86400000)

     if (diffDays === 0) return 'Today'
     if (diffDays === 1) return 'Yesterday'
     if (diffDays < 7) return `${diffDays} days ago`

     return date.toLocaleDateString('en-US', {
       month: 'short',
       day: 'numeric',
     })
   }
   ```

3. **REFACTOR:** Extract helper functions to shared utilities if duplicated

**Verification:**
```bash
npm test -- src/components/IssueActivityTable.test.tsx
```

**Success Criteria:**
- All tests pass
- Table renders correctly
- Filtering works
- GitHub-style layout
- Hover states work

---

### Task 6: Update Home Page
**File:** `src/app/page.tsx`
**Goal:** Replace `<ActivityLog>` with new `<IssueActivityTable>`

**TDD Steps:**
1. **RED:** Update test in `src/app/page.test.tsx` (if exists) or create new one:
   ```typescript
   test('renders issue activity table', async () => {
     // Mock getIssuesWithAgents to return test data
     render(<Home />)
     expect(await screen.findByText('ENG-320')).toBeInTheDocument()
   })
   ```

2. **GREEN:** Update `page.tsx`:
   ```typescript
   // Replace:
   const recentActivity = await getRecentActivity()

   // With:
   const recentIssues = await getIssuesWithAgents()

   // In JSX, replace:
   <div className="mb-8">
     <ActivityLog activities={recentActivity} />
   </div>

   // With:
   <Card>
     <CardHeader>
       <CardTitle>Active Issues</CardTitle>
       <CardDescription>
         Issues currently in the arena with agent activity
       </CardDescription>
     </CardHeader>
     <CardContent>
       <IssueActivityTable issues={recentIssues} />
     </CardContent>
   </Card>
   ```

3. **REFACTOR:** Clean up imports

**Verification:**
```bash
npm run dev
# Visit http://localhost:3000
# Verify visually that table matches GitHub style
```

**Success Criteria:**
- Home page compiles
- New table renders
- No console errors
- Visual QA passes

---

### Task 7: Visual QA and Dark Mode Polish
**Goal:** Ensure styling matches Vercel/GitHub dark mode aesthetics

**Steps:**
1. Compare with GitHub Issues:
   - Visit https://github.com/recallnet/js-recall/issues
   - Take screenshots
   - Match colors, spacing, hover states

2. Check all states:
   - Empty state
   - Single issue
   - Multiple issues
   - Filtered views
   - Hover states
   - Agent avatars overlap
   - Tooltip behavior

3. Test responsiveness:
   - Desktop (1920px)
   - Laptop (1440px)
   - Tablet (768px)
   - Mobile (375px)

4. Polish colors to match dark mode:
   - Background: `#0d1117` (GitHub dark)
   - Borders: `#30363d`
   - Text primary: `#c9d1d9`
   - Text secondary: `#8b949e`
   - Hover background: `#161b22`
   - Blue accent: `#58a6ff`
   - Green accent: `#3fb950`
   - Red accent: `#f85149`

**Verification:**
```bash
npm run dev
# Manual visual testing
```

**Success Criteria:**
- Matches GitHub/Vercel dark mode aesthetics
- All interactive states work
- Responsive on all screen sizes
- No accessibility issues
- User approves visual design

---

### Task 8: Integration Testing and Cleanup
**Goal:** Ensure end-to-end functionality works

**Steps:**
1. Run full test suite:
   ```bash
   npm test
   ```

2. Run type checking:
   ```bash
   npm run type-check
   ```

3. Run linter:
   ```bash
   npm run lint
   ```

4. Check coverage:
   ```bash
   npm test -- --coverage
   ```

5. Test with real data:
   - Trigger Linear webhook to create issue
   - Verify issue appears in table
   - Verify agents show up
   - Test filtering

6. Clean up old code:
   - Keep `ActivityLog` for now (might be used elsewhere)
   - Update `getRecentActivity` usage if needed
   - Remove any dead imports

**Verification:**
```bash
npm test
npm run build
```

**Success Criteria:**
- All tests pass (229+ tests)
- Coverage maintains >90%
- No type errors
- No linting warnings
- Production build succeeds
- Real data displays correctly

---

## Implementation Strategy

Use **subagent-driven-development** skill:
- Each task = one subagent
- Code review after each task
- TDD enforced (RED-GREEN-REFACTOR)
- Visual QA at end

## Estimated Effort

- Task 1: Query - 30 min
- Task 2: Avatar Component - 20 min
- Task 3: Avatar Group - 15 min
- Task 4: Filter Component - 20 min
- Task 5: Table Component - 45 min
- Task 6: Home Page Update - 10 min
- Task 7: Visual QA - 30 min
- Task 8: Integration - 20 min

**Total: ~3 hours**

## Success Criteria

- ✅ One row per issue (not per PR)
- ✅ Agent avatars showing status
- ✅ Filter by issue status
- ✅ Dark mode only
- ✅ GitHub/Vercel aesthetic
- ✅ All tests pass
- ✅ TDD methodology followed
- ✅ User visually approves

## Notes

- Keep existing `ActivityLog` component for backward compatibility
- Use existing Badge, Card, Table components
- Follow existing code patterns (TypeScript, Server/Client Components)
- Match existing color palette in `tailwind.config.ts`
- No emojis in code unless user requests
