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
 * Updates ratings for agents after a completed issue.
 * Uses OpenSkill's rate() function with grouped ranking (teams).
 *
 * @param currentRatings - Map of agent name to current Rating
 * @param ranking - Grouped ranking: [[winner], [loser1, loser2, ...]]
 * @returns Map of agent name to updated Rating
 */
export function updateRatingsForCompletedIssue(
  currentRatings: Record<string, Rating>,
  ranking: string[][]
): Record<string, Rating> {
  // Build teams array for OpenSkill
  const teams = ranking.map((group) =>
    group.map(
      (agentName) => currentRatings[agentName] ?? initializeAgentRating()
    )
  )

  // Calculate new ratings
  const updatedTeams = rate(teams)

  // Map back to agent names
  const updatedRatings: Record<string, Rating> = {}
  for (let i = 0; i < ranking.length; i++) {
    const group = ranking[i]
    const updatedGroup = updatedTeams[i]

    if (!group || !updatedGroup) continue

    for (let j = 0; j < group.length; j++) {
      const agentName = group[j]
      const updatedRating = updatedGroup[j]

      if (agentName && updatedRating) {
        updatedRatings[agentName] = updatedRating
      }
    }
  }

  return updatedRatings
}
