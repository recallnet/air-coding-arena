import { rating, ordinal } from 'openskill'
import { describe, it, expect } from 'vitest'

import {
  updateRatingsForCompletedIssue,
  initializeAgentRating,
  calculateOrdinal,
} from './openskill'

describe('openskill rating service', () => {
  describe('initializeAgentRating', () => {
    it('should return default rating with mu=25 and sigma=8.333', () => {
      const result = initializeAgentRating()
      expect(result.mu).toBe(25)
      expect(result.sigma).toBeCloseTo(8.333, 2)
    })
  })

  describe('calculateOrdinal', () => {
    it('should use OpenSkill ordinal function with z=3 and target=1500', () => {
      const testRating = rating({ mu: 25, sigma: 8.333 })
      const result = calculateOrdinal(testRating)

      // Should match OpenSkill's ordinal(rating, z=3) + 1500 target
      const expected = 1500 + ordinal(testRating, { z: 3 })
      expect(result).toBeCloseTo(expected, 5)
    })

    it('should calculate correct ordinal for default rating', () => {
      const testRating = rating({ mu: 25, sigma: 8.333 })
      const result = calculateOrdinal(testRating)

      // Default rating: ordinal = 1500 + (25 - 3 * 8.333) = 1500 + 0 = 1500
      expect(result).toBeCloseTo(1500, 0)
    })

    it('should return higher ordinal for better ratings', () => {
      const weakRating = rating({ mu: 20, sigma: 8 })
      const strongRating = rating({ mu: 30, sigma: 5 })

      const weakOrdinal = calculateOrdinal(weakRating)
      const strongOrdinal = calculateOrdinal(strongRating)

      expect(strongOrdinal).toBeGreaterThan(weakOrdinal)

      // Verify both use OpenSkill ordinal function
      expect(weakOrdinal).toBeCloseTo(1500 + ordinal(weakRating, { z: 3 }), 5)
      expect(strongOrdinal).toBeCloseTo(
        1500 + ordinal(strongRating, { z: 3 }),
        5
      )
    })

    it('should handle high uncertainty ratings with lower ordinal', () => {
      const uncertainRating = rating({ mu: 30, sigma: 10 })
      const certainRating = rating({ mu: 30, sigma: 5 })

      const uncertainOrdinal = calculateOrdinal(uncertainRating)
      const certainOrdinal = calculateOrdinal(certainRating)

      // Higher uncertainty (sigma) means lower conservative estimate
      expect(certainOrdinal).toBeGreaterThan(uncertainOrdinal)
    })
  })

  describe('updateRatingsForCompletedIssue', () => {
    it('should update ratings based on grouped ranking (win/loss model)', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      // Grouped ranking: cursor wins, engine and cyrus tied for 2nd
      const ranking = [['cursor'], ['engine', 'cyrus']]

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Winner's mu should increase
      expect(result['cursor']?.mu).toBeGreaterThan(beforeRatings['cursor'].mu)
      // Winner's sigma should decrease (more certain)
      expect(result['cursor']?.sigma).toBeLessThan(
        beforeRatings['cursor'].sigma
      )

      // Loser's mu should decrease
      expect(result['cyrus']?.mu).toBeLessThan(beforeRatings['cyrus'].mu)
      expect(result['engine']?.mu).toBeLessThan(beforeRatings['engine'].mu)
    })

    it('should handle single agent (no competition)', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
      }

      const ranking = [['cursor']]

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Single agent: rating shouldn't change much
      expect(result['cursor']?.mu).toBeCloseTo(beforeRatings['cursor'].mu, 1)
    })

    it('should not include DNF agents in rating calculation', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      // Only cursor and engine finished (cyrus DNF)
      const ranking = [['cursor'], ['engine']]

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Cyrus not in ranking, should not be in result
      expect(result['cyrus']).toBeUndefined()
      expect(result['cursor']).toBeDefined()
      expect(result['engine']).toBeDefined()
    })

    it('should use fallback rating when agent not in currentRatings', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
      }

      // 'engine' is in ranking but not in beforeRatings - should use default
      const ranking = [['cursor'], ['engine']]

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Should not throw, should use default rating for engine
      expect(result['cursor']).toBeDefined()
      expect(result['engine']).toBeDefined()
      expect(result['engine']?.mu).toBeLessThan(25) // New agent loses, mu decreases
    })

    it('should handle all agents in same group (tied)', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      // All agents tied for first place
      const ranking = [['cursor', 'engine', 'cyrus']]

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // All agents should have similar ratings (tied)
      expect(result['cursor']).toBeDefined()
      expect(result['engine']).toBeDefined()
      expect(result['cyrus']).toBeDefined()
    })
  })
})
