import { describe, it, expect } from 'vitest'
import { rating } from 'openskill'
import { updateRatingsForCompletedIssue, initializeAgentRating, calculateOrdinal } from './openskill'

describe('openskill rating service', () => {
  describe('initializeAgentRating', () => {
    it('should return default rating with mu=25 and sigma=8.333', () => {
      const result = initializeAgentRating()
      expect(result.mu).toBe(25)
      expect(result.sigma).toBeCloseTo(8.333, 2)
    })
  })

  describe('calculateOrdinal', () => {
    it('should calculate ordinal score with alpha=24 and target=1500', () => {
      const testRating = rating({ mu: 25, sigma: 8.333 })
      const result = calculateOrdinal(testRating)
      // Default rating: ordinal ≈ 1500 - 24 * 8.333 ≈ 1300
      expect(result).toBeGreaterThan(1200)
      expect(result).toBeLessThan(1600)
    })

    it('should return higher ordinal for better ratings', () => {
      const weakRating = rating({ mu: 20, sigma: 8 })
      const strongRating = rating({ mu: 30, sigma: 5 })

      const weakOrdinal = calculateOrdinal(weakRating)
      const strongOrdinal = calculateOrdinal(strongRating)

      expect(strongOrdinal).toBeGreaterThan(weakOrdinal)
    })
  })

  describe('updateRatingsForCompletedIssue', () => {
    it('should update ratings based on ranking', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      const ranking = ['cursor', 'engine', 'cyrus'] // cursor wins

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Winner's mu should increase
      expect(result.cursor.mu).toBeGreaterThan(beforeRatings.cursor.mu)
      // Winner's sigma should decrease (more certain)
      expect(result.cursor.sigma).toBeLessThan(beforeRatings.cursor.sigma)

      // Loser's mu should decrease
      expect(result.cyrus.mu).toBeLessThan(beforeRatings.cyrus.mu)
    })

    it('should handle single agent (no competition)', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
      }

      const ranking = ['cursor']

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Single agent: rating shouldn't change much
      expect(result.cursor.mu).toBeCloseTo(beforeRatings.cursor.mu, 1)
    })

    it('should not include DNF agents in rating calculation', () => {
      const beforeRatings = {
        cursor: rating({ mu: 25, sigma: 8.333 }),
        engine: rating({ mu: 25, sigma: 8.333 }),
        cyrus: rating({ mu: 25, sigma: 8.333 }),
      }

      // Only cursor and engine finished (cyrus DNF)
      const ranking = ['cursor', 'engine']

      const result = updateRatingsForCompletedIssue(beforeRatings, ranking)

      // Cyrus not in ranking, should not be in result
      expect(result.cyrus).toBeUndefined()
      expect(result.cursor).toBeDefined()
      expect(result.engine).toBeDefined()
    })
  })
})
