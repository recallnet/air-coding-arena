import { getShortestPaths } from '@xstate/graph'
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'

import { agentMachine } from './agentMachine'

const TEST_PR_URL = 'https://github.com/org/repo/pull/1'

describe('agentMachine', () => {
  it('transitions from pending to submitted on PR_SUBMITTED', () => {
    const actor = createActor(agentMachine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('pending')

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })

    expect(actor.getSnapshot().value).toBe('submitted')
  })

  it('transitions from pending to ignored on ISSUE_CLOSED', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'ISSUE_CLOSED' })

    expect(actor.getSnapshot().value).toBe('ignored')
  })

  it('transitions from submitted to accepted on PR_MERGED', () => {
    const actor = createActor(agentMachine)
    actor.start()

    // First transition to submitted state
    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('submitted')

    // Then test transition to accepted
    actor.send({ type: 'PR_MERGED' })

    expect(actor.getSnapshot().value).toBe('accepted')
  })

  it('transitions from submitted to rejected on OTHER_AGENT_WON', () => {
    const actor = createActor(agentMachine)
    actor.start()

    // First transition to submitted state
    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('submitted')

    // Then test transition to rejected
    actor.send({ type: 'OTHER_AGENT_WON' })

    expect(actor.getSnapshot().value).toBe('rejected')
  })

  it('transitions from submitted to rejected on PR_CLOSED', () => {
    const actor = createActor(agentMachine)
    actor.start()

    // First transition to submitted state
    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('submitted')

    // Then test transition to rejected
    actor.send({ type: 'PR_CLOSED' })

    expect(actor.getSnapshot().value).toBe('rejected')
  })
})

describe('agentMachine - comprehensive path coverage', () => {
  it('covers all possible paths using @xstate/graph', () => {
    const paths = getShortestPaths(agentMachine)

    // Verify all terminal states are reachable
    const terminalStates = paths.map((p) => p.state.value)
    expect(terminalStates).toContain('accepted')
    expect(terminalStates).toContain('rejected')
    expect(terminalStates).toContain('ignored')

    // Log paths for documentation
    console.log('\nAgent State Machine Paths:')
    for (const [i, path] of paths.entries()) {
      console.log(`\nPath ${i} -> ${path.state.value}:`)
      for (const [j, step] of path.steps.entries()) {
        console.log(
          `  ${j + 1}. ${step.event?.type || 'initial'} → ${step.state.value}`
        )
      }
    }
  })

  it('path: pending → submitted → accepted', () => {
    const actor = createActor(agentMachine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('pending')
    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('submitted')
    actor.send({ type: 'PR_MERGED' })
    expect(actor.getSnapshot().value).toBe('accepted')
  })

  it('path: pending → submitted → rejected (other agent won)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    actor.send({ type: 'OTHER_AGENT_WON' })
    expect(actor.getSnapshot().value).toBe('rejected')
  })

  it('path: pending → submitted → rejected (PR closed)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    actor.send({ type: 'PR_CLOSED' })
    expect(actor.getSnapshot().value).toBe('rejected')
  })

  it('path: pending → ignored', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('ignored')
  })
})

describe('agentMachine - invalid transitions', () => {
  it('rejects PR_MERGED from pending state (no-op)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    // Can't merge PR before submitting it
    actor.send({ type: 'PR_MERGED' })
    expect(actor.getSnapshot().value).toBe('pending') // No transition
  })

  it('rejects OTHER_AGENT_WON from pending state (no-op)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    // Can't lose to another agent before submitting
    actor.send({ type: 'OTHER_AGENT_WON' })
    expect(actor.getSnapshot().value).toBe('pending') // No transition
  })

  it('rejects PR_CLOSED from pending state (no-op)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    // Can't close PR before submitting it
    actor.send({ type: 'PR_CLOSED' })
    expect(actor.getSnapshot().value).toBe('pending') // No transition
  })

  it('rejects PR_SUBMITTED from submitted state (no-op)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('submitted')

    // Can't submit PR again
    actor.send({
      type: 'PR_SUBMITTED',
      prUrl: 'https://github.com/org/repo/pull/2',
    })
    expect(actor.getSnapshot().value).toBe('submitted') // No transition
  })

  it('rejects ISSUE_CLOSED from submitted state (no-op)', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('submitted')

    // ISSUE_CLOSED only valid from pending state
    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('submitted') // No transition
  })

  it('rejects transitions from final state accepted', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    actor.send({ type: 'PR_MERGED' })
    expect(actor.getSnapshot().value).toBe('accepted')

    // Final state - no transitions allowed
    actor.send({ type: 'PR_CLOSED' })
    expect(actor.getSnapshot().value).toBe('accepted') // No transition
  })

  it('rejects transitions from final state rejected', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    actor.send({ type: 'OTHER_AGENT_WON' })
    expect(actor.getSnapshot().value).toBe('rejected')

    // Final state - no transitions allowed
    actor.send({ type: 'PR_MERGED' })
    expect(actor.getSnapshot().value).toBe('rejected') // No transition
  })

  it('rejects transitions from final state ignored', () => {
    const actor = createActor(agentMachine)
    actor.start()

    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('ignored')

    // Final state - no transitions allowed
    actor.send({ type: 'PR_SUBMITTED', prUrl: TEST_PR_URL })
    expect(actor.getSnapshot().value).toBe('ignored') // No transition
  })
})
