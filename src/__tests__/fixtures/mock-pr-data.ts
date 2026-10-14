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
export function generateMockPRComparison(agentNames: string[]): PRComparison {
  const agents: AgentPRData[] = agentNames.map((name, index) => {
    const ciStatuses: CIStatus[] = ['passing', 'failing', 'pending', 'none']

    return {
      name,
      githubHandle: `${name}-agent`,
      prNumber: 1234 + index,
      prStatus: 'open', // Milestone 1: All PRs shown as "open" for consistency
      ciStatus: ciStatuses[index % 4] as CIStatus,
      // Vary files slightly between agents
      files: MOCK_FILES.map((file) => ({
        ...file,
        additions: file.additions + index * 2,
        deletions: file.deletions + index,
        changes: file.changes + index * 3,
      })),
    }
  })

  return { agents }
}
