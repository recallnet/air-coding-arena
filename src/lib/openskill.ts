/**
 * OpenSkill rating service for agent skill calculations.
 * Uses Plackett-Luce model to update ratings after each completed issue.
 *
 * @packageDocumentation
 */

import { rating, rate, ordinal } from 'openskill'
import type { Rating } from 'openskill'

/**
 * Default OpenSkill rating configuration.
 * mu = 25 (mean skill), sigma = 8.333 (uncertainty/spread)
 */
const DEFAULT_MU = 25.0
const DEFAULT_SIGMA = 8.333

/**
 * Ordinal score calculation parameters.
 * z = 3 (conservative estimate, 3-sigma, 99.7% confidence)
 * target = 1500 (baseline score for display, similar to ELO)
 */
const ORDINAL_Z = 3
const ORDINAL_TARGET = 1500

/**
 * Initializes a new agent with default OpenSkill rating.
 *
 * @returns Default Rating object with mu=25, sigma=8.333
 */
export function initializeAgentRating(): Rating {
  return rating({ mu: DEFAULT_MU, sigma: DEFAULT_SIGMA })
}

/**
 * Calculates ordinal score from OpenSkill Rating using OpenSkill's ordinal function.
 * Uses z=3 (3-sigma, 99.7% confidence) to give a conservative estimate
 * where we're 99.7% confident the agent's true skill is at least this value.
 *
 * Ordinal = target + ordinal(rating, z=3)
 * where ordinal(rating, z=3) = mu - 3 * sigma
 *
 * @param agentRating - OpenSkill Rating object
 * @returns Ordinal score (display score, similar to ELO)
 */
export function calculateOrdinal(agentRating: Rating): number {
  return ORDINAL_TARGET + ordinal(agentRating, { z: ORDINAL_Z })
}

/**
 * Updates agent ratings after a completed issue.
 * Uses Plackett-Luce model where ranking determines rating changes.
 *
 * @param currentRatings - Map of agentName to current Rating
 * @param ranking - Array of agent names in finish order (1st = winner, last = worst)
 * @returns Updated ratings for agents who participated (DNF agents excluded)
 */
export function updateRatingsForCompletedIssue(
  currentRatings: Record<string, Rating>,
  ranking: string[]
): Record<string, Rating> {
  // Build teams array: each agent is a "team" of one
  // Order matters: teams[0] = 1st place, teams[1] = 2nd place, etc.
  const teams = ranking.map((agentName) => {
    const agentRating = currentRatings[agentName]
    if (!agentRating) {
      throw new Error(`Agent ${agentName} not found in currentRatings`)
    }
    return [agentRating]
  })

  // Calculate new ratings using Plackett-Luce
  const updatedTeams = rate(teams)

  // Build result map: agentName -> updated Rating
  const result: Record<string, Rating> = {}
  for (let i = 0; i < ranking.length; i++) {
    const agentName = ranking[i]
    const updatedRating = updatedTeams[i]?.[0]
    if (agentName !== undefined && updatedRating !== undefined) {
      result[agentName] = updatedRating
    }
  }

  return result
}
