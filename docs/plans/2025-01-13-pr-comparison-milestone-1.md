# PR Comparison Feature - Milestone 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build complete UI shell with mock data for side-by-side PR comparison feature, with inactive buttons and "Coming Soon" messaging.

**Architecture:** Add PR comparison section to issue detail page. Create reusable components for agent selector, diff viewer columns, CI status indicators, and review interface. All data is mocked. All interactive elements are disabled with clear "Coming in Milestone 2/3" messaging.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, existing UI components (Card, Badge, Button)

---

## Task 1: Create Mock Data Types and Generators

**Files:**
- Create: `src/types/pr-comparison.ts`
- Create: `src/lib/mock-pr-data.ts`
- Create: `src/lib/mock-pr-data.test.ts`

**Step 1: Write failing test for mock data generator**

```typescript
// src/lib/mock-pr-data.test.ts
import { describe, it, expect } from 'vitest'
import { generateMockPRComparison } from './mock-pr-data'

describe('generateMockPRComparison', () => {
  it('generates mock PR data for 2 agents', () => {
    const mock = generateMockPRComparison(['cursor', 'engine'])

    expect(mock.agents).toHaveLength(2)
    expect(mock.agents[0].name).toBe('cursor')
    expect(mock.agents[1].name).toBe('engine')
    expect(mock.agents[0].githubHandle).toBe('cursor-agent')
    expect(mock.agents[1].githubHandle).toBe('engine-agent')
  })

  it('includes mock file data with diffs', () => {
    const mock = generateMockPRComparison(['cursor', 'engine'])

    expect(mock.agents[0].files.length).toBeGreaterThan(0)
    expect(mock.agents[0].files[0].filename).toBeTruthy()
    expect(mock.agents[0].files[0].patch).toBeTruthy()
  })

  it('includes CI status for each agent', () => {
    const mock = generateMockPRComparison(['cursor', 'engine'])

    expect(mock.agents[0].ciStatus).toBeTruthy()
    expect(['passing', 'failing', 'pending', 'none']).toContain(
      mock.agents[0].ciStatus
    )
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/mock-pr-data.test.ts
```

Expected: FAIL with "Cannot find module './mock-pr-data'"

**Step 3: Create PR comparison types**

```typescript
// src/types/pr-comparison.ts
/**
 * PR comparison types for Milestone 1 mock data.
 *
 * @packageDocumentation
 */

/**
 * CI check status for a PR.
 */
export type CIStatus = 'passing' | 'failing' | 'pending' | 'none'

/**
 * File status in a PR.
 */
export type FileStatus = 'modified' | 'added' | 'removed' | 'renamed'

/**
 * PR status.
 */
export type PRStatus = 'open' | 'merged' | 'closed'

/**
 * Single file change in a PR.
 */
export type PRFile = {
  filename: string
  status: FileStatus
  additions: number
  deletions: number
  changes: number
  patch: string
}

/**
 * Agent's PR data for comparison.
 */
export type AgentPRData = {
  name: string
  githubHandle: string
  prNumber: number
  prStatus: PRStatus
  ciStatus: CIStatus
  files: PRFile[]
}

/**
 * Complete PR comparison data structure.
 */
export type PRComparison = {
  agents: AgentPRData[]
}
```

**Step 4: Implement mock data generator**

```typescript
// src/lib/mock-pr-data.ts
/**
 * Mock PR data generator for Milestone 1.
 * Generates realistic-looking fake PR data for UI development.
 *
 * @packageDocumentation
 */

import type {
  PRComparison,
  AgentPRData,
  PRFile,
  CIStatus,
  PRStatus,
} from '@/types/pr-comparison'

const MOCK_FILES: PRFile[] = [
  {
    filename: 'src/lib/queries.ts',
    status: 'modified',
    additions: 15,
    deletions: 3,
    changes: 18,
    patch: `@@ -36,7 +36,22 @@ export async function getAgentStats(): Promise<AgentStats[]> {
-export async function getAgentStats(): Promise<AgentStats[]> {
-  const result = await db.execute<{
+export async function getAgentStats(): Promise<AgentStats[]> {
+  'use cache'
+  const result = await db.execute<{
     agent_name: string
     attempts: number`,
  },
  {
    filename: 'src/app/page.tsx',
    status: 'modified',
    additions: 8,
    deletions: 2,
    changes: 10,
    patch: `@@ -40,6 +40,14 @@ export default async function Home(): Promise<React.JSX.Element> {
   const agentStats = await getAgentStats()
+  const agentTemporalStats = await getAgentTemporalStats()
   const recentIssues = await getIssuesWithAgents()

   return (`,
  },
  {
    filename: 'src/components/NewComponent.tsx',
    status: 'added',
    additions: 42,
    deletions: 0,
    changes: 42,
    patch: `@@ -0,0 +1,42 @@
+/**
+ * New component added in this PR.
+ */
+
+export function NewComponent() {
+  return (
+    <div>
+      <h1>New Feature</h1>
+    </div>
+  )
+}`,
  },
]

/**
 * Generates mock PR comparison data for specified agents.
 *
 * @param agentNames - Array of agent names (e.g., ['cursor', 'engine'])
 * @returns Mock PR comparison data structure
 *
 * @example
 * ```ts
 * const mock = generateMockPRComparison(['cursor', 'engine'])
 * // Returns comparison data with mock files and CI status
 * ```
 */
export function generateMockPRComparison(
  agentNames: string[]
): PRComparison {
  const agents: AgentPRData[] = agentNames.map((name, index) => {
    const ciStatuses: CIStatus[] = ['passing', 'failing', 'pending', 'none']
    const prStatuses: PRStatus[] = ['open', 'merged', 'closed']

    return {
      name,
      githubHandle: `${name}-agent`,
      prNumber: 1234 + index,
      prStatus: prStatuses[index % 3],
      ciStatus: ciStatuses[index % 4],
      // Vary files slightly between agents
      files: MOCK_FILES.map((file, fileIndex) => ({
        ...file,
        additions: file.additions + (index * 2),
        deletions: file.deletions + index,
        changes: file.changes + (index * 3),
      })),
    }
  })

  return { agents }
}
```

**Step 5: Run test to verify it passes**

```bash
pnpm test src/lib/mock-pr-data.test.ts
```

Expected: PASS - all tests pass

**Step 6: Commit**

```bash
git add src/types/pr-comparison.ts src/lib/mock-pr-data.ts src/lib/mock-pr-data.test.ts
git commit -m "feat(pr-comparison): add mock data types and generator

- Add PR comparison types (CIStatus, FileStatus, PRFile, etc)
- Implement generateMockPRComparison with realistic mock data
- Add comprehensive tests for mock data generator"
```

---

## Task 2: Create Agent Selector Component

**Files:**
- Create: `src/components/AgentSelector.tsx`
- Create: `src/components/AgentSelector.test.tsx`

**Step 1: Write failing test for AgentSelector**

```typescript
// src/components/AgentSelector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentSelector } from './AgentSelector'

describe('AgentSelector', () => {
  it('renders agent selection interface', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
      { name: 'cyrus', displayName: 'Cyrus', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    expect(screen.getByText('Compare PRs (select 2):')).toBeInTheDocument()
    expect(screen.getByText('Cursor')).toBeInTheDocument()
    expect(screen.getByText('Engine')).toBeInTheDocument()
    expect(screen.getByText('Cyrus')).toBeInTheDocument()
  })

  it('shows selected state for chosen agents', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('selected')
    expect(buttons[1]).toHaveClass('selected')
  })

  it('disables unselected agents when 2 are already selected', () => {
    const agents = [
      { name: 'cursor', displayName: 'Cursor', avatarUrl: null },
      { name: 'engine', displayName: 'Engine', avatarUrl: null },
      { name: 'cyrus', displayName: 'Cyrus', avatarUrl: null },
    ]

    render(
      <AgentSelector
        agents={agents}
        selectedAgents={['cursor', 'engine']}
        onSelectionChange={vi.fn()}
      />
    )

    const cyrusButton = screen.getByText('Cyrus').closest('button')
    expect(cyrusButton).toBeDisabled()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/components/AgentSelector.test.tsx
```

Expected: FAIL with "Cannot find module './AgentSelector'"

**Step 3: Implement AgentSelector component**

```typescript
// src/components/AgentSelector.tsx
'use client'

/**
 * Agent selector component for PR comparison.
 * Allows users to select 2 agents to compare side-by-side.
 *
 * @packageDocumentation
 */

import { AgentAvatar } from './AgentAvatar'
import { Badge } from './ui/Badge'

/**
 * Agent data for selector.
 */
type AgentOption = {
  name: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Props for AgentSelector component.
 */
type AgentSelectorProps = {
  agents: AgentOption[]
  selectedAgents: [string, string]
  onSelectionChange: (agents: [string, string]) => void
}

/**
 * Agent selector component.
 * Displays agent chips with ability to toggle selection.
 * Enforces exactly 2 agents selected at a time.
 *
 * @param props - Component props
 * @returns Agent selector UI
 */
export function AgentSelector({
  agents,
  selectedAgents,
  onSelectionChange,
}: AgentSelectorProps): React.JSX.Element {
  const handleToggle = (agentName: string): void => {
    const isSelected = selectedAgents.includes(agentName)

    if (isSelected) {
      // Can't deselect if only 2 selected (would break comparison)
      return
    }

    // Replace first selected agent with newly selected one
    onSelectionChange([selectedAgents[1], agentName])
  }

  return (
    <div className="agent-selector mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Compare PRs (select 2):
        </h3>
        <Badge variant="outline">Milestone 1: Mock Data Only</Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        {agents.map((agent) => {
          const isSelected = selectedAgents.includes(agent.name)
          const isDisabled = !isSelected && selectedAgents.length >= 2

          return (
            <button
              key={agent.name}
              onClick={() => handleToggle(agent.name)}
              disabled={isDisabled}
              className={`
                flex items-center gap-2 rounded-lg border px-4 py-2 transition-all
                ${
                  isSelected
                    ? 'selected border-blue-700 bg-blue-100'
                    : 'border-border bg-background hover:border-border-hover'
                }
                ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
            >
              <AgentAvatar
                name={agent.name}
                status="submitted"
                size="sm"
                avatarUrl={agent.avatarUrl}
                displayName={agent.displayName}
              />
              <span className="font-medium">
                {agent.displayName ?? agent.name}
              </span>
              {isSelected && (
                <svg
                  className="h-4 w-4 text-blue-700"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/components/AgentSelector.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/components/AgentSelector.tsx src/components/AgentSelector.test.tsx
git commit -m "feat(pr-comparison): add agent selector component

- Implement AgentSelector with toggle functionality
- Enforce exactly 2 agents selected
- Add visual selected state with checkmark icon
- Include \"Milestone 1\" badge to indicate mock data"
```

---

## Task 3: Create CI Status Indicator Component

**Files:**
- Create: `src/components/CIStatusIndicator.tsx`
- Create: `src/components/CIStatusIndicator.test.tsx`

**Step 1: Write failing test for CIStatusIndicator**

```typescript
// src/components/CIStatusIndicator.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CIStatusIndicator } from './CIStatusIndicator'

describe('CIStatusIndicator', () => {
  it('renders passing status with green indicator', () => {
    render(<CIStatusIndicator status="passing" />)

    const indicator = screen.getByText('Passing').previousElementSibling
    expect(indicator).toHaveClass('bg-green-700')
  })

  it('renders failing status with red indicator', () => {
    render(<CIStatusIndicator status="failing" />)

    const indicator = screen.getByText('Failing').previousElementSibling
    expect(indicator).toHaveClass('bg-red-700')
  })

  it('renders pending status with yellow indicator', () => {
    render(<CIStatusIndicator status="pending" />)

    const indicator = screen.getByText('Pending').previousElementSibling
    expect(indicator).toHaveClass('bg-amber-700')
  })

  it('renders none status with gray indicator', () => {
    render(<CIStatusIndicator status="none" />)

    const indicator = screen.getByText('No Checks').previousElementSibling
    expect(indicator).toHaveClass('bg-gray-400')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/components/CIStatusIndicator.test.tsx
```

Expected: FAIL with "Cannot find module './CIStatusIndicator'"

**Step 3: Implement CIStatusIndicator component**

```typescript
// src/components/CIStatusIndicator.tsx
/**
 * CI status indicator component.
 * Displays CI check status with colored dot indicator.
 *
 * @packageDocumentation
 */

import type { CIStatus } from '@/types/pr-comparison'

/**
 * Props for CIStatusIndicator component.
 */
type CIStatusIndicatorProps = {
  status: CIStatus
}

/**
 * Maps CI status to display text.
 */
function getStatusText(status: CIStatus): string {
  switch (status) {
    case 'passing':
      return 'Passing'
    case 'failing':
      return 'Failing'
    case 'pending':
      return 'Pending'
    case 'none':
      return 'No Checks'
  }
}

/**
 * Maps CI status to dot color class.
 */
function getStatusColor(status: CIStatus): string {
  switch (status) {
    case 'passing':
      return 'bg-green-700'
    case 'failing':
      return 'bg-red-700'
    case 'pending':
      return 'bg-amber-700'
    case 'none':
      return 'bg-gray-400'
  }
}

/**
 * CI status indicator component.
 * Shows colored dot and status text.
 *
 * @param props - Component props
 * @returns CI status indicator UI
 */
export function CIStatusIndicator({
  status,
}: CIStatusIndicatorProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2.5 w-2.5 rounded-full ${getStatusColor(status)}`}
        aria-label={`CI status: ${getStatusText(status)}`}
      />
      <span className="text-sm font-medium text-foreground-secondary">
        {getStatusText(status)}
      </span>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/components/CIStatusIndicator.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/components/CIStatusIndicator.tsx src/components/CIStatusIndicator.test.tsx
git commit -m "feat(pr-comparison): add CI status indicator component

- Implement CIStatusIndicator with colored dots
- Support passing/failing/pending/none states
- Use Geist design system colors"
```

---

## Task 4: Create PR Review Interface Component

**Files:**
- Create: `src/components/PRReviewInterface.tsx`
- Create: `src/components/PRReviewInterface.test.tsx`

**Step 1: Write failing test for PRReviewInterface**

```typescript
// src/components/PRReviewInterface.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PRReviewInterface } from './PRReviewInterface'

describe('PRReviewInterface', () => {
  it('renders review interface with agent handle', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    expect(screen.getByPlaceholderText('@cursor-agent')).toBeInTheDocument()
  })

  it('shows disabled approve button', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    const approveButton = screen.getByText('Approve')
    expect(approveButton).toBeDisabled()
  })

  it('shows disabled request changes button', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    const requestButton = screen.getByText('Request Changes')
    expect(requestButton).toBeDisabled()
  })

  it('displays sign in message', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    expect(
      screen.getByText('Sign in with GitHub to submit reviews')
    ).toBeInTheDocument()
  })

  it('shows milestone 3 badge', () => {
    render(<PRReviewInterface agentGithubHandle="cursor-agent" />)

    expect(screen.getByText('Coming in Milestone 3')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/components/PRReviewInterface.test.tsx
```

Expected: FAIL with "Cannot find module './PRReviewInterface'"

**Step 3: Implement PRReviewInterface component**

```typescript
// src/components/PRReviewInterface.tsx
/**
 * PR review interface component.
 * Displays comment textarea and approve/request changes buttons.
 * Milestone 1: All controls are disabled with "Coming Soon" messaging.
 *
 * @packageDocumentation
 */

import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

/**
 * Props for PRReviewInterface component.
 */
type PRReviewInterfaceProps = {
  agentGithubHandle: string
}

/**
 * PR review interface component.
 * Shows review UI in disabled state for Milestone 1.
 *
 * @param props - Component props
 * @returns PR review interface UI
 */
export function PRReviewInterface({
  agentGithubHandle,
}: PRReviewInterfaceProps): React.JSX.Element {
  return (
    <div className="sticky bottom-4 rounded-lg border border-border bg-background p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Review for @{agentGithubHandle}
        </h4>
        <Badge variant="warning">Coming in Milestone 3</Badge>
      </div>

      <textarea
        placeholder={`@${agentGithubHandle}`}
        disabled
        className="mb-3 w-full resize-none rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-foreground opacity-50"
        rows={3}
      />

      <div className="mb-3 flex gap-2">
        <Button variant="success" disabled className="flex-1">
          Approve
        </Button>
        <Button variant="default" disabled className="flex-1">
          Request Changes
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-foreground-secondary">
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Sign in with GitHub to submit reviews</span>
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/components/PRReviewInterface.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/components/PRReviewInterface.tsx src/components/PRReviewInterface.test.tsx
git commit -m "feat(pr-comparison): add PR review interface component

- Implement PRReviewInterface with disabled controls
- Include comment textarea and action buttons
- Show \"Coming in Milestone 3\" badge
- Add lock icon with sign-in message"
```

---

## Task 5: Create Mock Diff Viewer Component

**Files:**
- Create: `src/components/MockDiffViewer.tsx`
- Create: `src/components/MockDiffViewer.test.tsx`

**Step 1: Write failing test for MockDiffViewer**

```typescript
// src/components/MockDiffViewer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MockDiffViewer } from './MockDiffViewer'

describe('MockDiffViewer', () => {
  const mockFile = {
    filename: 'src/lib/queries.ts',
    status: 'modified' as const,
    additions: 15,
    deletions: 3,
    changes: 18,
    patch: '@@ -36,7 +36,22 @@\n-old line\n+new line',
  }

  it('renders file header with filename', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText('src/lib/queries.ts')).toBeInTheDocument()
  })

  it('displays file status badge', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText('modified')).toBeInTheDocument()
  })

  it('shows addition and deletion counts', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText('+15')).toBeInTheDocument()
    expect(screen.getByText('-3')).toBeInTheDocument()
  })

  it('renders patch content', () => {
    render(<MockDiffViewer file={mockFile} />)

    expect(screen.getByText(/-old line/)).toBeInTheDocument()
    expect(screen.getByText(/\+new line/)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/components/MockDiffViewer.test.tsx
```

Expected: FAIL with "Cannot find module './MockDiffViewer'"

**Step 3: Implement MockDiffViewer component**

```typescript
// src/components/MockDiffViewer.tsx
/**
 * Mock diff viewer component.
 * Displays file diffs in a GitHub-like format using mock data.
 * Milestone 1: Simple rendering without advanced diff parsing.
 *
 * @packageDocumentation
 */

import type { PRFile } from '@/types/pr-comparison'
import { Badge } from './ui/Badge'

/**
 * Props for MockDiffViewer component.
 */
type MockDiffViewerProps = {
  file: PRFile
}

/**
 * Gets badge variant for file status.
 */
function getStatusVariant(
  status: PRFile['status']
): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'added':
      return 'success'
    case 'removed':
      return 'error'
    case 'modified':
      return 'warning'
    case 'renamed':
      return 'default'
  }
}

/**
 * Mock diff viewer component.
 * Renders file header and patch content.
 *
 * @param props - Component props
 * @returns Mock diff viewer UI
 */
export function MockDiffViewer({
  file,
}: MockDiffViewerProps): React.JSX.Element {
  // Split patch into lines for rendering
  const patchLines = file.patch.split('\n')

  return (
    <div className="mock-diff-viewer mb-4 overflow-hidden rounded-lg border border-border">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-border bg-background-secondary px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground">
            {file.filename}
          </span>
          <Badge variant={getStatusVariant(file.status)}>{file.status}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="text-green-700">+{file.additions}</span>
          <span className="text-red-700">-{file.deletions}</span>
        </div>
      </div>

      {/* Patch Content */}
      <div className="bg-background font-mono text-xs">
        {patchLines.map((line, index) => {
          let bgColor = 'bg-background'
          let textColor = 'text-foreground'

          if (line.startsWith('+')) {
            bgColor = 'bg-green-100'
            textColor = 'text-green-900'
          } else if (line.startsWith('-')) {
            bgColor = 'bg-red-100'
            textColor = 'text-red-900'
          } else if (line.startsWith('@@')) {
            bgColor = 'bg-blue-100'
            textColor = 'text-blue-900'
          }

          return (
            <div
              key={index}
              className={`${bgColor} ${textColor} px-4 py-0.5`}
            >
              {line || ' '}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/components/MockDiffViewer.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/components/MockDiffViewer.tsx src/components/MockDiffViewer.test.tsx
git commit -m "feat(pr-comparison): add mock diff viewer component

- Implement MockDiffViewer with GitHub-style diff rendering
- Color code additions (green) and deletions (red)
- Show file status badge and change counts
- Use monospace font for code display"
```

---

## Task 6: Create PR Comparison Column Component

**Files:**
- Create: `src/components/PRComparisonColumn.tsx`
- Create: `src/components/PRComparisonColumn.test.tsx`

**Step 1: Write failing test for PRComparisonColumn**

```typescript
// src/components/PRComparisonColumn.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PRComparisonColumn } from './PRComparisonColumn'

describe('PRComparisonColumn', () => {
  const mockAgentData = {
    name: 'cursor',
    githubHandle: 'cursor-agent',
    prNumber: 1234,
    prStatus: 'open' as const,
    ciStatus: 'passing' as const,
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified' as const,
        additions: 10,
        deletions: 2,
        changes: 12,
        patch: '@@ -1,1 +1,1 @@\n-old\n+new',
      },
    ],
  }

  it('renders agent name and PR number', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText(/cursor/)).toBeInTheDocument()
    expect(screen.getByText(/#1234/)).toBeInTheDocument()
  })

  it('displays CI status indicator', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText('Passing')).toBeInTheDocument()
  })

  it('renders file diffs', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText('src/test.ts')).toBeInTheDocument()
  })

  it('includes review interface at bottom', () => {
    render(<PRComparisonColumn agentData={mockAgentData} />)

    expect(screen.getByText(/Review for @cursor-agent/)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/components/PRComparisonColumn.test.tsx
```

Expected: FAIL with "Cannot find module './PRComparisonColumn'"

**Step 3: Implement PRComparisonColumn component**

```typescript
// src/components/PRComparisonColumn.tsx
/**
 * PR comparison column component.
 * Displays a single agent's PR data in the side-by-side comparison.
 *
 * @packageDocumentation
 */

import type { AgentPRData } from '@/types/pr-comparison'
import { CIStatusIndicator } from './CIStatusIndicator'
import { MockDiffViewer } from './MockDiffViewer'
import { PRReviewInterface } from './PRReviewInterface'
import { Badge } from './ui/Badge'

/**
 * Props for PRComparisonColumn component.
 */
type PRComparisonColumnProps = {
  agentData: AgentPRData
}

/**
 * Maps PR status to badge variant.
 */
function getPRStatusVariant(
  status: AgentPRData['prStatus']
): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'merged':
      return 'success'
    case 'open':
      return 'warning'
    case 'closed':
      return 'error'
  }
}

/**
 * PR comparison column component.
 * Shows header with agent info, CI status, file diffs, and review interface.
 *
 * @param props - Component props
 * @returns PR comparison column UI
 */
export function PRComparisonColumn({
  agentData,
}: PRComparisonColumnProps): React.JSX.Element {
  return (
    <div className="pr-comparison-column flex flex-col">
      {/* Column Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background-secondary px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">
            {agentData.name}{' '}
            <span className="text-sm font-normal text-foreground-secondary">
              (@{agentData.githubHandle})
            </span>
          </h3>
          <Badge variant={getPRStatusVariant(agentData.prStatus)}>
            {agentData.prStatus}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground-secondary">
            PR #{agentData.prNumber}
          </span>
          <CIStatusIndicator status={agentData.ciStatus} />
        </div>
      </div>

      {/* File Diffs */}
      <div className="flex-1 overflow-y-auto p-4">
        {agentData.files.length === 0 ? (
          <div className="py-8 text-center text-foreground-secondary">
            No files changed
          </div>
        ) : (
          agentData.files.map((file) => (
            <MockDiffViewer key={file.filename} file={file} />
          ))
        )}
      </div>

      {/* Review Interface */}
      <div className="p-4">
        <PRReviewInterface agentGithubHandle={agentData.githubHandle} />
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/components/PRComparisonColumn.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/components/PRComparisonColumn.tsx src/components/PRComparisonColumn.test.tsx
git commit -m "feat(pr-comparison): add PR comparison column component

- Implement PRComparisonColumn with header, diffs, and review UI
- Show agent name, GitHub handle, and PR number
- Include CI status indicator in header
- Render all file diffs with MockDiffViewer
- Add PRReviewInterface at bottom (sticky)"
```

---

## Task 7: Create PR Comparison Container Component

**Files:**
- Create: `src/components/PRComparisonContainer.tsx`
- Create: `src/components/PRComparisonContainer.test.tsx`

**Step 1: Write failing test for PRComparisonContainer**

```typescript
// src/components/PRComparisonContainer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PRComparisonContainer } from './PRComparisonContainer'

describe('PRComparisonContainer', () => {
  const mockAgents = [
    {
      name: 'cursor',
      displayName: 'Cursor',
      avatarUrl: null,
      githubHandle: 'cursor-agent',
      prNumber: 1234,
      prStatus: 'open' as const,
      ciStatus: 'passing' as const,
      files: [],
    },
    {
      name: 'engine',
      displayName: 'Engine',
      avatarUrl: null,
      githubHandle: 'engine-agent',
      prNumber: 1235,
      prStatus: 'open' as const,
      ciStatus: 'failing' as const,
      files: [],
    },
  ]

  it('renders agent selector', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(screen.getByText('Compare PRs (select 2):')).toBeInTheDocument()
  })

  it('renders two comparison columns side by side', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(screen.getByText('cursor')).toBeInTheDocument()
    expect(screen.getByText('engine')).toBeInTheDocument()
  })

  it('shows coming soon message', () => {
    render(<PRComparisonContainer agents={mockAgents} />)

    expect(
      screen.getByText(/This feature is under development/)
    ).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/components/PRComparisonContainer.test.tsx
```

Expected: FAIL with "Cannot find module './PRComparisonContainer'"

**Step 3: Implement PRComparisonContainer component**

```typescript
// src/components/PRComparisonContainer.tsx
'use client'

/**
 * PR comparison container component.
 * Main container for the side-by-side PR comparison feature.
 * Manages agent selection state and renders comparison columns.
 *
 * @packageDocumentation
 */

import { useState } from 'react'
import type { AgentPRData } from '@/types/pr-comparison'
import { AgentSelector } from './AgentSelector'
import { PRComparisonColumn } from './PRComparisonColumn'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { Badge } from './ui/Badge'

/**
 * Agent data with display information.
 */
type AgentWithDisplay = AgentPRData & {
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Props for PRComparisonContainer component.
 */
type PRComparisonContainerProps = {
  agents: AgentWithDisplay[]
}

/**
 * PR comparison container component.
 * Allows selecting 2 agents and viewing their PRs side-by-side.
 *
 * @param props - Component props
 * @returns PR comparison container UI
 */
export function PRComparisonContainer({
  agents,
}: PRComparisonContainerProps): React.JSX.Element {
  // Default to first 2 agents if available
  const [selectedAgents, setSelectedAgents] = useState<[string, string]>([
    agents[0]?.name ?? '',
    agents[1]?.name ?? '',
  ])

  const selectedAgentData = agents.filter((agent) =>
    selectedAgents.includes(agent.name)
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>PR Comparison</CardTitle>
            <CardDescription>
              Compare pull requests from different agents side-by-side
            </CardDescription>
          </div>
          <Badge variant="warning">Milestone 1: Mock Data</Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Coming Soon Message */}
        <div className="mb-6 rounded-lg border border-blue-700 bg-blue-100 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-semibold text-blue-900">
                This feature is under development
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Milestone 1 displays the UI with mock data. Real GitHub data and
                interactive review functionality coming in Milestones 2 & 3.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Selector */}
        {agents.length >= 2 ? (
          <AgentSelector
            agents={agents.map((a) => ({
              name: a.name,
              displayName: a.displayName,
              avatarUrl: a.avatarUrl,
            }))}
            selectedAgents={selectedAgents}
            onSelectionChange={setSelectedAgents}
          />
        ) : null}

        {/* Side-by-Side Comparison */}
        {selectedAgentData.length === 2 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PRComparisonColumn agentData={selectedAgentData[0]} />
            <PRComparisonColumn agentData={selectedAgentData[1]} />
          </div>
        ) : (
          <div className="py-8 text-center text-foreground-secondary">
            Select 2 agents to compare their pull requests
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/components/PRComparisonContainer.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/components/PRComparisonContainer.tsx src/components/PRComparisonContainer.test.tsx
git commit -m "feat(pr-comparison): add PR comparison container component

- Implement PRComparisonContainer with agent selection
- Render two columns side-by-side in responsive grid
- Add info banner about milestone 1 mock data
- Include \"Milestone 1\" badge in card header"
```

---

## Task 8: Integrate PR Comparison into Issue Detail Page

**Files:**
- Modify: `src/app/issues/[id]/page.tsx`
- Modify: `src/app/issues/[id]/page.test.tsx`

**Step 1: Write failing test for issue page with comparison**

```typescript
// Add to existing src/app/issues/[id]/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import IssuePage from './page'
import * as queries from '@/lib/queries'

// ... existing tests ...

describe('IssuePage - PR Comparison', () => {
  it('renders PR comparison section when agents have PRs', async () => {
    const mockIssue = {
      id: 'test-id',
      linearId: 'linear-123',
      linearKey: 'ISSUE-123',
      title: 'Test Issue',
      url: 'https://linear.app/issue/123',
      repo: 'test-repo',
      status: 'In Progress',
      description: 'Test description',
      descriptionMarkdown: 'Test **markdown**',
      arenaReadyLabeledAt: new Date('2025-01-01'),
      resolvedAt: null,
      winnerAttemptId: null,
      agents: [
        {
          agentName: 'cursor',
          displayName: 'Cursor',
          avatarUrl: null,
          status: 'submitted' as const,
        },
        {
          agentName: 'engine',
          displayName: 'Engine',
          avatarUrl: null,
          status: 'submitted' as const,
        },
      ],
      attempts: [
        {
          id: 'attempt-1',
          agentName: 'cursor',
          prNumber: 1234,
          prUrl: 'https://github.com/pr/1234',
          status: 'open' as const,
          openedAt: new Date('2025-01-01'),
          mergedAt: null,
          commitCount: 5,
        },
        {
          id: 'attempt-2',
          agentName: 'engine',
          prNumber: 1235,
          prUrl: 'https://github.com/pr/1235',
          status: 'open' as const,
          openedAt: new Date('2025-01-01'),
          mergedAt: null,
          commitCount: 3,
        },
      ],
    }

    vi.spyOn(queries, 'getIssueById').mockResolvedValue(mockIssue)

    const params = Promise.resolve({ id: 'test-id' })
    const page = await IssuePage({ params })
    render(page)

    expect(screen.getByText('PR Comparison')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/app/issues/\[id\]/page.test.tsx
```

Expected: FAIL - "Unable to find element with text: PR Comparison"

**Step 3: Integrate PRComparisonContainer into issue page**

```typescript
// Modify src/app/issues/[id]/page.tsx
// Add these imports at the top:
import { PRComparisonContainer } from '@/components/PRComparisonContainer'
import { generateMockPRComparison } from '@/lib/mock-pr-data'

// Add this code after the Attempts Card (around line 358):

      {/* PR Comparison Section - Milestone 1 */}
      {issue.agents.length >= 2 && (
        <div className="mt-6">
          <PRComparisonContainer
            agents={(() => {
              // Generate mock PR data for agents with attempts
              const agentsWithAttempts = issue.agents.filter((agent) =>
                issue.attempts.some(
                  (attempt) => attempt.agentName === agent.agentName
                )
              )

              if (agentsWithAttempts.length < 2) {
                return []
              }

              const mockComparison = generateMockPRComparison(
                agentsWithAttempts.map((a) => a.agentName)
              )

              return mockComparison.agents.map((agentData, index) => ({
                ...agentData,
                displayName: agentsWithAttempts[index].displayName,
                avatarUrl: agentsWithAttempts[index].avatarUrl,
              }))
            })()}
          />
        </div>
      )}
    </main>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/app/issues/\[id\]/page.test.tsx
```

Expected: PASS - all tests pass

**Step 5: Run all tests to ensure no regressions**

```bash
pnpm test
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/app/issues/\[id\]/page.tsx src/app/issues/\[id\]/page.test.tsx
git commit -m "feat(pr-comparison): integrate comparison into issue detail page

- Add PRComparisonContainer below attempts table
- Generate mock PR data for agents with attempts
- Only show comparison when 2+ agents have PRs
- Pass agent display info to comparison container"
```

---

## Task 9: Manual Testing and Polish

**Files:**
- None (manual testing only)

**Step 1: Start dev server**

```bash
pnpm dev
```

Expected: Server starts on http://localhost:3109

**Step 2: Navigate to issue detail page**

Open browser to http://localhost:3109/issues/[any-valid-issue-id]

**Step 3: Visual inspection checklist**

- [ ] PR Comparison section appears at bottom of page
- [ ] Info banner explains "Milestone 1: Mock Data"
- [ ] Agent selector shows all agents with attempts
- [ ] Can toggle between agents (if 3+ available)
- [ ] Two columns display side-by-side
- [ ] Column headers show agent name, GitHub handle, PR number
- [ ] CI status indicators have correct colors
- [ ] Mock diffs render with syntax highlighting
- [ ] Review interface is at bottom of each column
- [ ] All buttons are disabled
- [ ] "Sign in with GitHub" message is visible
- [ ] Responsive: works on mobile (stacks vertically)

**Step 4: Check for console errors**

Open browser dev tools console.

Expected: No errors or warnings

**Step 5: Test different screen sizes**

Resize browser window to test responsive design.

Expected: Layout adapts gracefully, columns stack on mobile

**Step 6: Document any issues found**

If any visual bugs or issues are found, note them for fixes.

**Step 7: Stop dev server**

```bash
# Press Ctrl+C in terminal
```

---

## Task 10: Type Check and Lint

**Files:**
- None (validation only)

**Step 1: Run type check**

```bash
pnpm type-check
```

Expected: No type errors, type coverage meets threshold (99.9%)

**Step 2: Run linter**

```bash
pnpm lint
```

Expected: No lint errors or warnings (--max-warnings 0)

**Step 3: Run formatter check**

```bash
pnpm format:check
```

Expected: All files properly formatted

**Step 4: If any issues, fix them**

If type/lint/format issues exist:

```bash
pnpm lint:fix
pnpm format
```

Then re-run checks.

**Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve type/lint/format issues"
```

---

## Task 11: Final Test Run

**Files:**
- None (testing only)

**Step 1: Run full test suite with coverage**

```bash
pnpm test
```

Expected: All tests pass, coverage >= 90% for lines/functions/branches/statements

**Step 2: Verify no test snapshots need updating**

If any snapshot tests failed, review changes carefully.

Expected: All snapshot tests pass or legitimate updates committed

**Step 3: Check test output for warnings**

Review test output for any deprecation warnings or issues.

Expected: Clean test output

**Step 4: Run build to ensure production works**

```bash
pnpm build
```

Expected: Build succeeds without errors

**Step 5: Final commit if any changes**

```bash
git add .
git commit -m "chore: final milestone 1 polish"
```

---

## Task 12: Create Pull Request

**Files:**
- None (git operations only)

**Step 1: Push branch to remote**

```bash
git push -u origin feature/pr-comparison-milestone-1
```

Expected: Branch pushed successfully

**Step 2: Open GitHub and create PR**

1. Navigate to repository on GitHub
2. Click "Compare & pull request" button
3. Set base branch to `main`
4. Set compare branch to `feature/pr-comparison-milestone-1`

**Step 3: Fill out PR description**

```markdown
# PR Comparison Feature - Milestone 1: UI Shell with Mock Data

## Overview
Implements Milestone 1 of the PR comparison feature as specified in `docs/plans/pr-comparison-feature.md`.

## What's Included
- ✅ Complete UI shell for side-by-side PR comparison
- ✅ Mock data types and generators
- ✅ Agent selector component (toggle between 2 agents)
- ✅ CI status indicators (colored dots)
- ✅ Mock diff viewer (GitHub-style rendering)
- ✅ PR review interface (disabled, "Coming in Milestone 3")
- ✅ Integration into issue detail page
- ✅ "Milestone 1: Mock Data" badges and messaging throughout
- ✅ Responsive design (mobile-friendly)
- ✅ Comprehensive test coverage

## Testing
- All tests pass: `pnpm test`
- Type coverage: 99.9%
- Lint: Zero warnings
- Manual testing: Checked on multiple screen sizes

## What's NOT Included (Future Milestones)
- ❌ Real GitHub API integration (Milestone 2)
- ❌ User authentication (Milestone 3)
- ❌ Functional review submission (Milestone 3)

## Screenshots
[Add screenshots of the comparison UI here]

## Next Steps
After this PR is merged, proceed with Milestone 2: Real Data Integration.
```

**Step 4: Request reviewers**

Add team members as reviewers.

**Step 5: Verify CI checks pass**

Wait for automated CI checks to complete.

Expected: All checks pass (tests, lint, type-check, build)

---

## Success Criteria

**Milestone 1 is complete when:**

- [ ] All 12 tasks completed successfully
- [ ] All tests pass with >= 90% coverage
- [ ] Type check passes with >= 99.9% coverage
- [ ] Lint passes with zero warnings
- [ ] Build succeeds without errors
- [ ] PR comparison section visible on issue detail page
- [ ] UI matches design specifications from technical doc
- [ ] All interactive elements are disabled with clear "Coming Soon" messaging
- [ ] Responsive design works on mobile, tablet, and desktop
- [ ] Pull request created and CI checks pass

---

## Notes

**Technologies Used:**
- Next.js 16 App Router (Server Components)
- React 19
- TypeScript (strict mode)
- Tailwind CSS (Geist design system)
- Vitest + React Testing Library

**Code Quality Standards:**
- 90% test coverage minimum
- 99.9% type coverage
- Zero lint warnings
- DRY: Don't repeat yourself
- YAGNI: You ain't gonna need it
- TDD: Test-driven development

**Conventions:**
- Server Components by default
- Client Components marked with `'use client'`
- JSDoc comments on all public functions
- Tailwind for styling (no CSS modules)
- Component tests co-located with components
