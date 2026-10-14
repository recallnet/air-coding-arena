import { describe, it, expect } from 'vitest'

import { generateMockPRComparison } from '@/__tests__/fixtures/mock-pr-data'

describe('generateMockPRComparison', () => {
  it('generates mock PR data for 2 agents', () => {
    const mock = generateMockPRComparison(['cursor', 'engine'])

    expect(mock.agents).toHaveLength(2)

    const firstAgent = mock.agents[0]
    const secondAgent = mock.agents[1]

    expect(firstAgent).toBeDefined()
    expect(secondAgent).toBeDefined()

    expect(firstAgent?.name).toBe('cursor')
    expect(secondAgent?.name).toBe('engine')
    expect(firstAgent?.githubHandle).toBe('cursor-agent')
    expect(secondAgent?.githubHandle).toBe('engine-agent')
  })

  it('includes mock file data with diffs', () => {
    const mock = generateMockPRComparison(['cursor', 'engine'])

    const firstAgent = mock.agents[0]
    expect(firstAgent).toBeDefined()
    expect(firstAgent?.files.length).toBeGreaterThan(0)

    const firstFile = firstAgent?.files[0]
    expect(firstFile).toBeDefined()
    expect(firstFile?.filename).toBeTruthy()
    expect(firstFile?.patch).toBeTruthy()
  })

  it('includes CI status for each agent', () => {
    const mock = generateMockPRComparison(['cursor', 'engine'])

    const firstAgent = mock.agents[0]
    expect(firstAgent).toBeDefined()
    expect(firstAgent?.ciStatus).toBeTruthy()
    expect(['passing', 'failing', 'pending', 'none']).toContain(
      firstAgent?.ciStatus
    )
  })
})
