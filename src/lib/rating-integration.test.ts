/**
 * End-to-end integration tests for OpenSkill rating update flow.
 * Tests the complete flow from issue completion to rating updates.
 */

import { eq, inArray } from 'drizzle-orm'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

import { db } from '@/db/client'
import { issues, attempts, agentScores, agentScoreHistory } from '@/db/schema'

import { initializeAgentRating, calculateOrdinal } from './openskill'
import { updateRatingsForIssue } from './update-ratings'

/**
 * Check if we're using a real database for integration tests.
 * Skip these tests if we're using the dummy test URL.
 */
const isRealDatabase = process.env['IS_TEST_DB_URL'] !== 'true'

// Test agent names
const TEST_AGENT_1 = 'test-agent-1'
const TEST_AGENT_2 = 'test-agent-2'
const TEST_AGENT_3 = 'test-agent-3'
const TEST_AGENT_4 = 'test-agent-4'
const TEST_AGENT_5 = 'test-agent-5'

// Test constants
const TEST_REPO = 'test/repo'
const SKIP_MESSAGE = 'Skipping: dummy database'
const BRANCH_AGENT_1_TEST = 'agent-1/test'
const BRANCH_AGENT_2_TEST = 'agent-2/test'

describe('Rating Integration E2E Tests', () => {
  // Test will be skipped if not using real database
  beforeAll(() => {
    if (!isRealDatabase) {
      console.log('Skipping integration tests: using dummy test database')
    }
  })

  afterAll(async () => {
    // Cleanup is handled by vitest-setup.ts
  })

  // Helper function to clean up test data
  async function cleanupTestData(issueIds: string[]) {
    if (!isRealDatabase || issueIds.length === 0) return

    // Delete attempts (cascades to agent_score_history via issue deletion)
    await db.delete(attempts).where(inArray(attempts.issueId, issueIds))

    // Delete issues
    await db.delete(issues).where(inArray(issues.id, issueIds))

    // Clean up test agents from agent_scores
    await db
      .delete(agentScores)
      .where(
        inArray(agentScores.agentName, [
          TEST_AGENT_1,
          TEST_AGENT_2,
          TEST_AGENT_3,
          TEST_AGENT_4,
          TEST_AGENT_5,
        ])
      )
  }

  describe('Basic 1v1 scenario', () => {
    const testIssueId = '11111111-1111-1111-1111-111111111111'

    beforeEach(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    afterAll(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    it('should update ratings correctly for 1v1 competition (winner and loser)', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Create test issue
      await db.insert(issues).values({
        id: testIssueId,
        linearId: 'test-linear-1v1',
        linearKey: 'TEST-1V1',
        title: '1v1 Competition Test',
        url: 'https://linear.app/test/1v1',
        repo: TEST_REPO,
        status: 'Done',
        arenaReadyLabeledAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
      })

      // Create attempts: agent-1 wins, agent-2 loses
      const now = new Date()
      const mergedTime = new Date(now.getTime() + 1000 * 60 * 60) // 1 hour later
      const closedTime = new Date(now.getTime() + 1000 * 60 * 90) // 1.5 hours later

      await db.insert(attempts).values([
        {
          id: '11111111-2222-1111-1111-111111111111',
          issueId: testIssueId,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 1001,
          prUrl: 'https://github.com/test/repo/pull/1001',
          branch: BRANCH_AGENT_1_TEST,
          openedAt: now,
          mergedAt: mergedTime,
          status: 'merged',
          commitCount: 5,
          lastCommitSha: 'abc123',
        },
        {
          id: '11111111-3333-1111-1111-111111111111',
          issueId: testIssueId,
          agentName: TEST_AGENT_2,
          repo: TEST_REPO,
          prNumber: 1002,
          prUrl: 'https://github.com/test/repo/pull/1002',
          branch: BRANCH_AGENT_2_TEST,
          openedAt: now,
          closedAt: closedTime,
          status: 'closed',
          commitCount: 3,
          lastCommitSha: 'def456',
        },
      ])

      // Run rating update
      await updateRatingsForIssue(testIssueId)

      // Verify agent_scores updated
      const scores = await db
        .select()
        .from(agentScores)
        .where(inArray(agentScores.agentName, [TEST_AGENT_1, TEST_AGENT_2]))

      expect(scores).toHaveLength(2)

      const agent1Score = scores.find((s) => s.agentName === TEST_AGENT_1)
      const agent2Score = scores.find((s) => s.agentName === TEST_AGENT_2)

      expect(agent1Score).toBeDefined()
      expect(agent2Score).toBeDefined()

      // Winner should have higher mu than default
      const defaultRating = initializeAgentRating()
      if (agent1Score && agent2Score) {
        expect(agent1Score.mu).toBeGreaterThan(defaultRating.mu)

        // Loser should have lower mu than default
        expect(agent2Score.mu).toBeLessThan(defaultRating.mu)

        // Winner should have higher ordinal than loser
        expect(agent1Score.ordinal).toBeGreaterThan(agent2Score.ordinal)

        // Both should have sigma decreased (more certain)
        expect(agent1Score.sigma).toBeLessThan(defaultRating.sigma)
        expect(agent2Score.sigma).toBeLessThan(defaultRating.sigma)

        // Both should have gamesPlayed = 1
        expect(agent1Score.gamesPlayed).toBe(1)
        expect(agent2Score.gamesPlayed).toBe(1)

        // Verify ordinal scores calculated correctly
        expect(agent1Score.ordinal).toBeCloseTo(
          calculateOrdinal({ mu: agent1Score.mu, sigma: agent1Score.sigma }),
          2
        )
        expect(agent2Score.ordinal).toBeCloseTo(
          calculateOrdinal({ mu: agent2Score.mu, sigma: agent2Score.sigma }),
          2
        )
      }

      // Verify agent_score_history records
      const history = await db
        .select()
        .from(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, testIssueId))

      expect(history).toHaveLength(2)

      const agent1History = history.find((h) => h.agentName === TEST_AGENT_1)
      const agent2History = history.find((h) => h.agentName === TEST_AGENT_2)

      expect(agent1History).toBeDefined()
      expect(agent2History).toBeDefined()

      // Winner should be rank 1, loser rank 2
      if (agent1History && agent2History && agent1Score && agent2Score) {
        expect(agent1History.rank).toBe(1)
        expect(agent2History.rank).toBe(2)

        // History should match current scores
        expect(agent1History.mu).toBe(agent1Score.mu)
        expect(agent1History.sigma).toBe(agent1Score.sigma)
        expect(agent1History.ordinal).toBe(agent1Score.ordinal)
      }
    })
  })

  describe('Multi-agent scenario (5 agents, ranked)', () => {
    const testIssueId = '22222222-2222-2222-2222-222222222222'

    beforeEach(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    afterAll(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    it('should handle 5-agent competition with ranked outcomes', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Create test issue
      await db.insert(issues).values({
        id: testIssueId,
        linearId: 'test-linear-5way',
        linearKey: 'TEST-5WAY',
        title: '5-Way Competition Test',
        url: 'https://linear.app/test/5way',
        repo: TEST_REPO,
        status: 'Done',
        arenaReadyLabeledAt: new Date('2025-01-02T00:00:00Z'),
        createdAt: new Date('2025-01-02T00:00:00Z'),
      })

      // Create attempts with different finish times
      const baseTime = new Date('2025-01-02T10:00:00Z')

      await db.insert(attempts).values([
        {
          id: '22222222-1111-2222-2222-222222222222',
          issueId: testIssueId,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 2001,
          prUrl: 'https://github.com/test/repo/pull/2001',
          branch: BRANCH_AGENT_1_TEST,
          openedAt: baseTime,
          mergedAt: new Date(baseTime.getTime() + 1000 * 60 * 60), // Winner: 1 hour
          status: 'merged',
          commitCount: 10,
          lastCommitSha: 'winner123',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          issueId: testIssueId,
          agentName: TEST_AGENT_2,
          repo: TEST_REPO,
          prNumber: 2002,
          prUrl: 'https://github.com/test/repo/pull/2002',
          branch: BRANCH_AGENT_2_TEST,
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 70), // 2nd: 70 min
          status: 'closed',
          commitCount: 8,
          lastCommitSha: 'second123',
        },
        {
          id: '22222222-3333-2222-2222-222222222222',
          issueId: testIssueId,
          agentName: TEST_AGENT_3,
          repo: TEST_REPO,
          prNumber: 2003,
          prUrl: 'https://github.com/test/repo/pull/2003',
          branch: 'agent-3/test',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 80), // 3rd: 80 min
          status: 'closed',
          commitCount: 6,
          lastCommitSha: 'third123',
        },
        {
          id: '22222222-4444-2222-2222-222222222222',
          issueId: testIssueId,
          agentName: TEST_AGENT_4,
          repo: TEST_REPO,
          prNumber: 2004,
          prUrl: 'https://github.com/test/repo/pull/2004',
          branch: 'agent-4/test',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 90), // 4th: 90 min
          status: 'closed',
          commitCount: 5,
          lastCommitSha: 'fourth123',
        },
        {
          id: '22222222-5555-2222-2222-222222222222',
          issueId: testIssueId,
          agentName: TEST_AGENT_5,
          repo: TEST_REPO,
          prNumber: 2005,
          prUrl: 'https://github.com/test/repo/pull/2005',
          branch: 'agent-5/test',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 100), // 5th: 100 min
          status: 'closed',
          commitCount: 4,
          lastCommitSha: 'fifth123',
        },
      ])

      // Run rating update
      await updateRatingsForIssue(testIssueId)

      // Verify all 5 agents got scores
      const scores = await db
        .select()
        .from(agentScores)
        .where(
          inArray(agentScores.agentName, [
            TEST_AGENT_1,
            TEST_AGENT_2,
            TEST_AGENT_3,
            TEST_AGENT_4,
            TEST_AGENT_5,
          ])
        )

      expect(scores).toHaveLength(5)

      // Sort by ordinal descending
      const sortedScores = [...scores].sort((a, b) => b.ordinal - a.ordinal)

      // Winner should have highest ordinal
      if (sortedScores[0]) {
        expect(sortedScores[0].agentName).toBe(TEST_AGENT_1)
      }

      // Verify monotonic decrease in ordinals (winner > 2nd > 3rd > 4th > 5th)
      for (let i = 0; i < sortedScores.length - 1; i++) {
        const currentScore = sortedScores[i]
        const nextScore = sortedScores[i + 1]
        if (currentScore && nextScore) {
          expect(currentScore.ordinal).toBeGreaterThan(nextScore.ordinal)
        }
      }

      // Verify history ranks match finish order
      const history = await db
        .select()
        .from(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, testIssueId))

      expect(history).toHaveLength(5)

      const agent1History = history.find((h) => h.agentName === TEST_AGENT_1)
      const agent5History = history.find((h) => h.agentName === TEST_AGENT_5)

      if (agent1History && agent5History) {
        expect(agent1History.rank).toBe(1) // Winner
        expect(agent5History.rank).toBe(5) // Last place
      }

      // All agents should have gamesPlayed = 1
      for (const score of scores) {
        expect(score.gamesPlayed).toBe(1)
      }
    })
  })

  describe('DNF detection', () => {
    const testIssueId = '33333333-3333-3333-3333-333333333333'

    beforeEach(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    afterAll(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    it('should exclude DNF agents (minimal commits) from rating calculation', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Create test issue
      await db.insert(issues).values({
        id: testIssueId,
        linearId: 'test-linear-dnf',
        linearKey: 'TEST-DNF',
        title: 'DNF Detection Test',
        url: 'https://linear.app/test/dnf',
        repo: TEST_REPO,
        status: 'Done',
        arenaReadyLabeledAt: new Date('2025-01-03T00:00:00Z'),
        createdAt: new Date('2025-01-03T00:00:00Z'),
      })

      const baseTime = new Date('2025-01-03T10:00:00Z')

      await db.insert(attempts).values([
        {
          id: '33333333-1111-3333-3333-333333333333',
          issueId: testIssueId,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 3001,
          prUrl: 'https://github.com/test/repo/pull/3001',
          branch: BRANCH_AGENT_1_TEST,
          openedAt: baseTime,
          mergedAt: new Date(baseTime.getTime() + 1000 * 60 * 60),
          status: 'merged',
          commitCount: 5,
          lastCommitSha: 'winner123',
        },
        {
          id: '33333333-2222-3333-3333-333333333333',
          issueId: testIssueId,
          agentName: TEST_AGENT_2,
          repo: TEST_REPO,
          prNumber: 3002,
          prUrl: 'https://github.com/test/repo/pull/3002',
          branch: BRANCH_AGENT_2_TEST,
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 70),
          status: 'closed',
          commitCount: 3, // Legitimate attempt
          lastCommitSha: 'second123',
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          issueId: testIssueId,
          agentName: TEST_AGENT_3,
          repo: TEST_REPO,
          prNumber: 3003,
          prUrl: 'https://github.com/test/repo/pull/3003',
          branch: 'agent-3/test',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 30), // 30 min
          status: 'closed',
          commitCount: 1, // DNF: only 1 commit (< 2 threshold)
          lastCommitSha: 'dnf123',
        },
      ])

      // Run rating update
      await updateRatingsForIssue(testIssueId)

      // Only agents 1 and 2 should have scores (agent-3 is DNF)
      const scores = await db
        .select()
        .from(agentScores)
        .where(
          inArray(agentScores.agentName, [
            TEST_AGENT_1,
            TEST_AGENT_2,
            TEST_AGENT_3,
          ])
        )

      // Only 2 agents should have ratings (DNF excluded)
      expect(scores).toHaveLength(2)
      expect(scores.find((s) => s.agentName === TEST_AGENT_1)).toBeDefined()
      expect(scores.find((s) => s.agentName === TEST_AGENT_2)).toBeDefined()
      expect(scores.find((s) => s.agentName === TEST_AGENT_3)).toBeUndefined()

      // Verify history only has 2 records
      const history = await db
        .select()
        .from(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, testIssueId))

      expect(history).toHaveLength(2)
      expect(history.find((h) => h.agentName === TEST_AGENT_1)).toBeDefined()
      expect(history.find((h) => h.agentName === TEST_AGENT_2)).toBeDefined()
      expect(history.find((h) => h.agentName === TEST_AGENT_3)).toBeUndefined()
    })

    it('should exclude DNF agents (very short lifespan < 5 minutes)', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Clean up previous test data first
      await cleanupTestData([testIssueId])

      // Create test issue
      await db.insert(issues).values({
        id: testIssueId,
        linearId: 'test-linear-dnf-quick',
        linearKey: 'TEST-DNF-QUICK',
        title: 'DNF Quick Close Test',
        url: 'https://linear.app/test/dnf-quick',
        repo: TEST_REPO,
        status: 'Done',
        arenaReadyLabeledAt: new Date('2025-01-04T00:00:00Z'),
        createdAt: new Date('2025-01-04T00:00:00Z'),
      })

      const baseTime = new Date('2025-01-04T10:00:00Z')

      await db.insert(attempts).values([
        {
          id: '33333333-4444-3333-3333-333333333333',
          issueId: testIssueId,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 3101,
          prUrl: 'https://github.com/test/repo/pull/3101',
          branch: BRANCH_AGENT_1_TEST,
          openedAt: baseTime,
          mergedAt: new Date(baseTime.getTime() + 1000 * 60 * 60),
          status: 'merged',
          commitCount: 5,
          lastCommitSha: 'winner456',
        },
        {
          id: '33333333-5555-3333-3333-333333333333',
          issueId: testIssueId,
          agentName: TEST_AGENT_4,
          repo: TEST_REPO,
          prNumber: 3102,
          prUrl: 'https://github.com/test/repo/pull/3102',
          branch: 'agent-4/test',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 3), // DNF: 3 min lifespan (< 5 min)
          status: 'closed',
          commitCount: 5, // Has commits, but closed too quickly
          lastCommitSha: 'quick-close',
        },
      ])

      // Run rating update
      await updateRatingsForIssue(testIssueId)

      // Only agent-1 should have score (agent-4 is DNF due to quick close)
      const scores = await db
        .select()
        .from(agentScores)
        .where(inArray(agentScores.agentName, [TEST_AGENT_1, TEST_AGENT_4]))

      expect(scores).toHaveLength(1)
      if (scores[0]) {
        expect(scores[0].agentName).toBe(TEST_AGENT_1)
      }
    })
  })

  describe('Rating convergence (multiple rounds)', () => {
    const issue1Id = '44444444-4444-4444-4444-444444444444'
    const issue2Id = '44444444-5555-4444-4444-444444444444'

    beforeEach(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([issue1Id, issue2Id])
    })

    afterAll(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([issue1Id, issue2Id])
    })

    it('should converge ratings over multiple rounds (sigma decreases, gamesPlayed increments)', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Round 1: agent-1 wins
      await db.insert(issues).values({
        id: issue1Id,
        linearId: 'test-linear-round1',
        linearKey: 'TEST-R1',
        title: 'Round 1',
        url: 'https://linear.app/test/r1',
        repo: TEST_REPO,
        status: 'Done',
        arenaReadyLabeledAt: new Date('2025-01-05T00:00:00Z'),
        createdAt: new Date('2025-01-05T00:00:00Z'),
      })

      const round1Time = new Date('2025-01-05T10:00:00Z')

      await db.insert(attempts).values([
        {
          id: '44444444-1111-4444-4444-444444444444',
          issueId: issue1Id,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 4001,
          prUrl: 'https://github.com/test/repo/pull/4001',
          branch: 'agent-1/r1',
          openedAt: round1Time,
          mergedAt: new Date(round1Time.getTime() + 1000 * 60 * 60),
          status: 'merged',
          commitCount: 5,
          lastCommitSha: 'r1-winner',
        },
        {
          id: '44444444-2222-4444-4444-444444444444',
          issueId: issue1Id,
          agentName: TEST_AGENT_2,
          repo: TEST_REPO,
          prNumber: 4002,
          prUrl: 'https://github.com/test/repo/pull/4002',
          branch: 'agent-2/r1',
          openedAt: round1Time,
          closedAt: new Date(round1Time.getTime() + 1000 * 60 * 70),
          status: 'closed',
          commitCount: 4,
          lastCommitSha: 'r1-loser',
        },
      ])

      await updateRatingsForIssue(issue1Id)

      // Get round 1 scores
      const round1Scores = await db
        .select()
        .from(agentScores)
        .where(inArray(agentScores.agentName, [TEST_AGENT_1, TEST_AGENT_2]))

      expect(round1Scores).toHaveLength(2)

      const agent1Round1 = round1Scores.find(
        (s) => s.agentName === TEST_AGENT_1
      )
      const agent2Round1 = round1Scores.find(
        (s) => s.agentName === TEST_AGENT_2
      )

      expect(agent1Round1).toBeDefined()
      expect(agent2Round1).toBeDefined()
      if (!agent1Round1 || !agent2Round1) return

      expect(agent1Round1.gamesPlayed).toBe(1)
      expect(agent2Round1.gamesPlayed).toBe(1)

      const round1Agent1Sigma = agent1Round1.sigma
      const round1Agent2Sigma = agent2Round1.sigma

      // Round 2: agent-1 wins again
      await db.insert(issues).values({
        id: issue2Id,
        linearId: 'test-linear-round2',
        linearKey: 'TEST-R2',
        title: 'Round 2',
        url: 'https://linear.app/test/r2',
        repo: TEST_REPO,
        status: 'Done',
        arenaReadyLabeledAt: new Date('2025-01-06T00:00:00Z'),
        createdAt: new Date('2025-01-06T00:00:00Z'),
      })

      const round2Time = new Date('2025-01-06T10:00:00Z')

      await db.insert(attempts).values([
        {
          id: '44444444-3333-4444-4444-444444444444',
          issueId: issue2Id,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 4003,
          prUrl: 'https://github.com/test/repo/pull/4003',
          branch: 'agent-1/r2',
          openedAt: round2Time,
          mergedAt: new Date(round2Time.getTime() + 1000 * 60 * 60),
          status: 'merged',
          commitCount: 5,
          lastCommitSha: 'r2-winner',
        },
        {
          id: '44444444-4444-4444-4444-444444444444',
          issueId: issue2Id,
          agentName: TEST_AGENT_2,
          repo: TEST_REPO,
          prNumber: 4004,
          prUrl: 'https://github.com/test/repo/pull/4004',
          branch: 'agent-2/r2',
          openedAt: round2Time,
          closedAt: new Date(round2Time.getTime() + 1000 * 60 * 70),
          status: 'closed',
          commitCount: 4,
          lastCommitSha: 'r2-loser',
        },
      ])

      await updateRatingsForIssue(issue2Id)

      // Get round 2 scores
      const round2Scores = await db
        .select()
        .from(agentScores)
        .where(inArray(agentScores.agentName, [TEST_AGENT_1, TEST_AGENT_2]))

      expect(round2Scores).toHaveLength(2)

      const agent1Round2 = round2Scores.find(
        (s) => s.agentName === TEST_AGENT_1
      )
      const agent2Round2 = round2Scores.find(
        (s) => s.agentName === TEST_AGENT_2
      )

      expect(agent1Round2).toBeDefined()
      expect(agent2Round2).toBeDefined()
      if (!agent1Round2 || !agent2Round2) return

      // Verify gamesPlayed incremented
      expect(agent1Round2.gamesPlayed).toBe(2)
      expect(agent2Round2.gamesPlayed).toBe(2)

      // Verify sigma decreased (convergence)
      expect(agent1Round2.sigma).toBeLessThan(round1Agent1Sigma)
      expect(agent2Round2.sigma).toBeLessThan(round1Agent2Sigma)

      // Verify agent-1 mu increased further (winning again)
      expect(agent1Round2.mu).toBeGreaterThan(agent1Round1.mu)

      // Verify agent-2 mu decreased further (losing again)
      expect(agent2Round2.mu).toBeLessThan(agent2Round1.mu)

      // Verify ordinal reflects new ratings
      expect(agent1Round2.ordinal).toBeCloseTo(
        calculateOrdinal({ mu: agent1Round2.mu, sigma: agent1Round2.sigma }),
        2
      )

      // Verify history has 2 entries per agent
      const agent1History = await db
        .select()
        .from(agentScoreHistory)
        .where(eq(agentScoreHistory.agentName, TEST_AGENT_1))

      expect(agent1History).toHaveLength(2)
      if (agent1History[0] && agent1History[1]) {
        expect(agent1History[0].rank).toBe(1)
        expect(agent1History[1].rank).toBe(1) // Winner both times
      }
    })
  })

  describe('Edge cases', () => {
    const testIssueId = '55555555-5555-5555-5555-555555555555'

    beforeEach(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    afterAll(async () => {
      if (!isRealDatabase) return
      await cleanupTestData([testIssueId])
    })

    it('should handle issue with no attempts gracefully', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Create issue with no attempts
      await db.insert(issues).values({
        id: testIssueId,
        linearId: 'test-linear-no-attempts',
        linearKey: 'TEST-NOATTEMPT',
        title: 'No Attempts Test',
        url: 'https://linear.app/test/noattempt',
        repo: TEST_REPO,
        status: 'Backlog',
        arenaReadyLabeledAt: new Date('2025-01-07T00:00:00Z'),
        createdAt: new Date('2025-01-07T00:00:00Z'),
      })

      // Should not throw
      await expect(updateRatingsForIssue(testIssueId)).resolves.not.toThrow()

      // Verify no new scores created from this issue
      const history = await db
        .select()
        .from(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, testIssueId))

      expect(history).toHaveLength(0)
    })

    it('should handle issue with only DNF attempts gracefully', async () => {
      if (!isRealDatabase) {
        console.log(SKIP_MESSAGE)
        return
      }

      // Clean up first
      await cleanupTestData([testIssueId])

      // Create issue
      await db.insert(issues).values({
        id: testIssueId,
        linearId: 'test-linear-all-dnf',
        linearKey: 'TEST-ALLDNF',
        title: 'All DNF Test',
        url: 'https://linear.app/test/alldnf',
        repo: TEST_REPO,
        status: 'Canceled',
        arenaReadyLabeledAt: new Date('2025-01-08T00:00:00Z'),
        createdAt: new Date('2025-01-08T00:00:00Z'),
      })

      const baseTime = new Date('2025-01-08T10:00:00Z')

      // Both attempts are DNF (1 commit each)
      await db.insert(attempts).values([
        {
          id: '55555555-1111-5555-5555-555555555555',
          issueId: testIssueId,
          agentName: TEST_AGENT_1,
          repo: TEST_REPO,
          prNumber: 5001,
          prUrl: 'https://github.com/test/repo/pull/5001',
          branch: 'agent-1/dnf',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 10),
          status: 'closed',
          commitCount: 1, // DNF
          lastCommitSha: 'dnf1',
        },
        {
          id: '55555555-2222-5555-5555-555555555555',
          issueId: testIssueId,
          agentName: TEST_AGENT_2,
          repo: TEST_REPO,
          prNumber: 5002,
          prUrl: 'https://github.com/test/repo/pull/5002',
          branch: 'agent-2/dnf',
          openedAt: baseTime,
          closedAt: new Date(baseTime.getTime() + 1000 * 60 * 15),
          status: 'closed',
          commitCount: 1, // DNF
          lastCommitSha: 'dnf2',
        },
      ])

      // Should not throw
      await expect(updateRatingsForIssue(testIssueId)).resolves.not.toThrow()

      // Verify no scores created for these agents from this issue
      const history = await db
        .select()
        .from(agentScoreHistory)
        .where(eq(agentScoreHistory.issueId, testIssueId))

      expect(history).toHaveLength(0)
    })
  })
})
