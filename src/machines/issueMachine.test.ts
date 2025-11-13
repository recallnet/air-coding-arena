import { getShortestPaths } from '@xstate/graph'
import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'

import { issueMachine } from './issueMachine'

describe('issueMachine', () => {
  it('starts in open state', () => {
    const actor = createActor(issueMachine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('open')
  })

  it('transitions from open to in_progress on FIRST_PR_SUBMITTED', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'FIRST_PR_SUBMITTED' })

    expect(actor.getSnapshot().value).toBe('in_progress')
  })

  it('transitions from open to cancelled on LABEL_REMOVED', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'LABEL_REMOVED' })

    expect(actor.getSnapshot().value).toBe('cancelled')
  })

  it('transitions from in_progress to completed on PR_MERGED', () => {
    const actor = createActor(issueMachine)
    actor.start()

    // Transition to in_progress first
    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress')

    actor.send({ type: 'PR_MERGED', agentName: 'agent1' })

    expect(actor.getSnapshot().value).toBe('completed')
  })

  it('transitions from in_progress to cancelled on ISSUE_CLOSED', () => {
    const actor = createActor(issueMachine)
    actor.start()

    // Transition to in_progress first
    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress')

    actor.send({ type: 'ISSUE_CLOSED' })

    expect(actor.getSnapshot().value).toBe('cancelled')
  })
})

describe('issueMachine - comprehensive path coverage', () => {
  it('covers all possible paths using @xstate/graph', () => {
    const paths = getShortestPaths(issueMachine)

    // Verify all terminal states are reachable
    const terminalStates = paths.map((p) => p.state.value)
    expect(terminalStates).toContain('completed')
    expect(terminalStates).toContain('cancelled')

    console.log('\nIssue State Machine Paths:')
    for (const [i, path] of paths.entries()) {
      console.log(`\nPath ${i} -> ${path.state.value}:`)
      for (const [j, step] of path.steps.entries()) {
        console.log(
          `  ${j + 1}. ${step.event?.type || 'initial'} → ${step.state.value}`
        )
      }
    }
  })

  it('path: open → in_progress → completed', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.send({ type: 'PR_MERGED', agentName: 'agent1' })
    expect(actor.getSnapshot().value).toBe('completed')
  })

  it('path: open → cancelled (label removed)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'LABEL_REMOVED' })
    expect(actor.getSnapshot().value).toBe('cancelled')
  })

  it('path: open → cancelled (issue closed)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('cancelled')
  })

  it('path: in_progress → cancelled (label removed)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.send({ type: 'LABEL_REMOVED' })
    expect(actor.getSnapshot().value).toBe('cancelled')
  })

  it('path: in_progress → cancelled (issue closed)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('cancelled')
  })
})

describe('issueMachine - invalid transitions', () => {
  it('rejects PR_MERGED from open state (no-op)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    // Can't merge PR without first PR being submitted
    actor.send({ type: 'PR_MERGED', agentName: 'agent1' })
    expect(actor.getSnapshot().value).toBe('open') // No transition
  })

  it('rejects FIRST_PR_SUBMITTED from in_progress state (no-op)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress')

    // Can't submit first PR again when already in progress
    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('in_progress') // No transition
  })

  it('rejects transitions from final state completed', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    actor.send({ type: 'PR_MERGED', agentName: 'agent1' })
    expect(actor.getSnapshot().value).toBe('completed')

    // Final state - no transitions allowed
    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('completed') // No transition
  })

  it('rejects transitions from final state cancelled', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'LABEL_REMOVED' })
    expect(actor.getSnapshot().value).toBe('cancelled')

    // Final state - no transitions allowed
    actor.send({ type: 'FIRST_PR_SUBMITTED' })
    expect(actor.getSnapshot().value).toBe('cancelled') // No transition
  })

  it('rejects PR_MERGED from cancelled state (no-op)', () => {
    const actor = createActor(issueMachine)
    actor.start()

    actor.send({ type: 'ISSUE_CLOSED' })
    expect(actor.getSnapshot().value).toBe('cancelled')

    // Final state - no transitions allowed
    actor.send({ type: 'PR_MERGED', agentName: 'agent1' })
    expect(actor.getSnapshot().value).toBe('cancelled') // No transition
  })
})
