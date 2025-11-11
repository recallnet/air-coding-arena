#!/usr/bin/env tsx
/**
 * Seeds the database with demo data for Milestone 1.
 * Loads issues from Linear export fixture and generates synthetic PR attempts.
 *
 * ⚠️ WARNING: This script generates synthetic demo data.
 * Real GitHub webhooks will replace this in Milestone 2.
 *
 * @example
 * ```bash
 * npm run db:seed
 * ```
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { db } from '../src/db/client'
import { attempts, issues } from '../src/db/schema'
import type { NewAttempt, NewIssue } from '../src/types'

const AGENTS = ['cursor', 'engine', 'cyrus'] as const
const REPOS = ['org/frontend', 'org/api'] as const

type ExportedIssue = {
  linearId: string
  linearKey: string
  title: string
  url: string
  status: string
  arenaReadyLabeledAt: string
}

/**
 * Loads issue fixtures from linear-export.json.
 *
 * @returns Array of exported issues
 */
function loadFixtures(): ExportedIssue[] {
  const fixturePath = join(
    process.cwd(),
    'src',
    '__tests__',
    'fixtures',
    'linear-export.json'
  )
  const data = readFileSync(fixturePath, 'utf-8')
  return JSON.parse(data) as ExportedIssue[]
}

/**
 * Generates a random date between two dates.
 *
 * @param start - Start date
 * @param end - End date
 * @returns Random date between start and end
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  )
}

/**
 * Generates synthetic PR attempt data for an issue.
 * ⚠️ WARNING: This is demo data - real webhooks will provide actual PRs.
 *
 * @param issueId - Database UUID of the issue
 * @param arenaReadyLabeledAt - When the issue was labeled as arena:ready
 * @returns Array of synthetic attempts
 */
function generateSyntheticAttempts(
  issueId: string,
  arenaReadyLabeledAt: Date
): NewAttempt[] {
  const attemptsList: NewAttempt[] = []
  const now = new Date()

  // Randomly assign 1-3 agents to this issue
  const agentCount = Math.floor(Math.random() * 3) + 1
  const selectedAgents = [...AGENTS]
    .sort(() => Math.random() - 0.5)
    .slice(0, agentCount)

  for (const agent of selectedAgents) {
    const repo = REPOS[Math.floor(Math.random() * REPOS.length)]

    if (repo === undefined) {
      continue
    }

    const prNumber = Math.floor(Math.random() * 900) + 100
    const openedAt = randomDate(arenaReadyLabeledAt, now)

    // 60% chance the PR is merged, 30% open, 10% closed without merge
    const statusRand = Math.random()
    let status: 'open' | 'merged' | 'closed'
    let mergedAt: Date | null = null
    let closedAt: Date | null = null

    if (statusRand < 0.6) {
      status = 'merged'
      mergedAt = randomDate(openedAt, now)
    } else if (statusRand < 0.9) {
      status = 'open'
    } else {
      status = 'closed'
      closedAt = randomDate(openedAt, now)
    }

    attemptsList.push({
      issueId,
      agentName: agent,
      repo,
      prNumber,
      prUrl: `https://github.com/${repo}/pull/${prNumber}`,
      branch: `${agent}/fix-issue-${prNumber}`,
      openedAt,
      mergedAt,
      closedAt,
      status,
      commitCount: Math.floor(Math.random() * 10) + 1,
      lastCommitSha: `abc${Math.random().toString(36).slice(2, 9)}`,
    })
  }

  console.log(
    `   ⚠️  Generated ${attemptsList.length} synthetic PR(s) for issue (DEMO DATA)`
  )

  return attemptsList
}

/**
 * Main seeding function.
 */
async function seed(): Promise<void> {
  console.log('\n🌱 Seeding database with demo data...\n')
  console.log('⚠️  WARNING: This is synthetic demo data for Milestone 1')
  console.log('⚠️  Real GitHub webhooks will replace this in Milestone 2\n')

  try {
    const exportedIssues = loadFixtures()

    if (exportedIssues.length === 0) {
      console.log('⚠️  No issues found in linear-export.json')
      console.log('   Run: npm run export:linear\n')
      return
    }

    console.log(`📋 Found ${exportedIssues.length} issues in fixtures\n`)

    for (const exported of exportedIssues) {
      // Insert issue
      const repo = REPOS[Math.floor(Math.random() * REPOS.length)]

      if (repo === undefined) {
        continue
      }

      const newIssue: NewIssue = {
        linearId: exported.linearId,
        linearKey: exported.linearKey,
        title: exported.title,
        url: exported.url,
        repo,
        status: exported.status,
        arenaReadyLabeledAt: new Date(exported.arenaReadyLabeledAt),
      }

      const [insertedIssue] = await db
        .insert(issues)
        .values(newIssue)
        .returning()

      if (!insertedIssue) {
        console.error(`   ❌ Failed to insert issue: ${exported.linearKey}`)
        continue
      }

      console.log(
        `   ✅ Inserted issue: ${exported.linearKey} - ${exported.title}`
      )

      // Generate synthetic attempts
      const syntheticAttempts = generateSyntheticAttempts(
        insertedIssue.id,
        new Date(exported.arenaReadyLabeledAt)
      )

      if (syntheticAttempts.length > 0) {
        await db.insert(attempts).values(syntheticAttempts)
      }

      console.log('')
    }

    console.log('✅ Seeding complete!\n')
  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

void seed()
