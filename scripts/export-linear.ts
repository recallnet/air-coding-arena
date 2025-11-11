#!/usr/bin/env tsx
/**
 * Exports issues from Linear workspace to JSON fixture file.
 * Fetches issues with the arena:ready label from specified teams.
 *
 * @example
 * ```bash
 * LINEAR_API_KEY=lin_xxx LINEAR_TEAM_KEYS=ENG,APP npm run export:linear
 * ```
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LINEAR_API_KEY = process.env['LINEAR_API_KEY']
const LINEAR_TEAM_KEYS = process.env['LINEAR_TEAM_KEYS'] ?? 'ENG'
const ARENA_LABEL = process.env['ARENA_LABEL'] ?? 'arena:ready'
const SEED_DAYS = Number.parseInt(process.env['SEED_DAYS'] ?? '30', 10)

type LinearIssue = {
  id: string
  identifier: string
  title: string
  url: string
  state: {
    name: string
  }
  labels: {
    nodes: Array<{
      name: string
    }>
  }
  createdAt: string
}

type LinearResponse = {
  data: {
    issues: {
      nodes: LinearIssue[]
      pageInfo: {
        hasNextPage: boolean
        endCursor: string | null
      }
    }
  }
}

type ExportedIssue = {
  linearId: string
  linearKey: string
  title: string
  url: string
  status: string
  arenaReadyLabeledAt: string
}

/**
 * Executes a GraphQL query against Linear API.
 *
 * @param query - GraphQL query string
 * @param apiKey - Linear API key for authorization
 * @returns Promise resolving to Linear API response
 */
async function queryLinear(
  query: string,
  apiKey: string
): Promise<LinearResponse> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.statusText}`)
  }

  return response.json() as Promise<LinearResponse>
}

/**
 * Fetches all issues with the arena:ready label from specified teams.
 *
 * @param apiKey - Linear API key for authorization
 * @returns Promise resolving to array of exported issues
 */
async function fetchArenaIssues(apiKey: string): Promise<ExportedIssue[]> {
  const teamKeys = LINEAR_TEAM_KEYS.split(',').map((key) => key.trim())
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - SEED_DAYS)

  console.log(`\n🔍 Fetching issues from Linear...`)
  console.log(`   Teams: ${teamKeys.join(', ')}`)
  console.log(`   Label: ${ARENA_LABEL}`)
  console.log(`   Since: ${cutoffDate.toISOString()}\n`)

  const allIssues: ExportedIssue[] = []

  for (const teamKey of teamKeys) {
    let hasNextPage = true
    let cursor: string | null = null

    while (hasNextPage) {
      const query = `
        query {
          issues(
            first: 50
            ${cursor ? `after: "${cursor}"` : ''}
            filter: {
              team: { key: { eq: "${teamKey}" } }
              labels: { name: { eq: "${ARENA_LABEL}" } }
              createdAt: { gte: "${cutoffDate.toISOString()}" }
            }
          ) {
            nodes {
              id
              identifier
              title
              url
              state {
                name
              }
              labels {
                nodes {
                  name
                }
              }
              createdAt
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      const response = await queryLinear(query, apiKey)
      const { nodes, pageInfo } = response.data.issues

      for (const issue of nodes) {
        allIssues.push({
          linearId: issue.id,
          linearKey: issue.identifier,
          title: issue.title,
          url: issue.url,
          status: issue.state.name,
          arenaReadyLabeledAt: issue.createdAt,
        })
      }

      console.log(
        `   Fetched ${nodes.length} issues from ${teamKey} (total: ${allIssues.length})`
      )

      hasNextPage = pageInfo.hasNextPage
      cursor = pageInfo.endCursor
    }
  }

  return allIssues
}

/**
 * Main export function.
 */
async function main(): Promise<void> {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY environment variable is required')
  }

  try {
    const issues = await fetchArenaIssues(LINEAR_API_KEY)

    const outputPath = join(
      process.cwd(),
      'src',
      '__tests__',
      'fixtures',
      'linear-export.json'
    )

    writeFileSync(outputPath, JSON.stringify(issues, null, 2))

    console.log(`\n✅ Export complete!`)
    console.log(`   Total issues: ${issues.length}`)
    console.log(`   Saved to: ${outputPath}\n`)
  } catch (error) {
    console.error(`\n❌ Export failed:`, error)
    process.exit(1)
  }
}

void main()
