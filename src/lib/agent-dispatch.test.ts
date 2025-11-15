/**
 * Tests for agent dispatch functionality
 * @packageDocumentation
 */

/* eslint-disable sonarjs/no-duplicate-string */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  dispatchMissingAgents,
  dispatchAgentsToIssue,
  generateBranchName,
} from './agent-dispatch'

// Mock database client
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock schema
vi.mock('@/db/schema', () => ({
  issues: 'issues',
  issueAgents: 'issue_agents',
  agents: 'agents',
}))

// Mock agent config
vi.mock('./agent-config', () => ({
  getAgentConfigs: vi.fn(),
  getAgentNames: vi.fn(),
}))

// Mock Linear SDK
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn(),
}))

describe('generateBranchName', () => {
  it('should generate proper branch name from issue key, title, and agent name', () => {
    const branchName = generateBranchName(
      'ENG-320',
      'Fix authentication bug',
      'factory'
    )
    expect(branchName).toBe('ENG-320--fix-authentication-bug--agent-factory')
  })

  it('should handle titles with special characters', () => {
    const branchName = generateBranchName(
      'ENG-123',
      'Add @mentions & notifications!',
      'cursor'
    )
    expect(branchName).toBe('ENG-123--add-mentions-notifications--agent-cursor')
  })

  it('should truncate long titles to 50 characters', () => {
    const longTitle =
      'This is a very long issue title that should be truncated to fit in the branch name'
    const branchName = generateBranchName('ENG-456', longTitle, 'engine')
    const slug = branchName.split('--')[1]
    expect(slug?.length).toBeLessThanOrEqual(50)
  })

  it('should handle titles with consecutive special characters', () => {
    const branchName = generateBranchName(
      'ENG-789',
      'Fix!!!   Multiple   Spaces',
      'factory'
    )
    expect(branchName).toBe('ENG-789--fix-multiple-spaces--agent-factory')
  })

  it('should handle titles with leading/trailing special characters', () => {
    const branchName = generateBranchName(
      'ENG-999',
      '   Fix issue   ',
      'cursor'
    )
    expect(branchName).toBe('ENG-999--fix-issue--agent-cursor')
  })

  it('should lowercase everything in the slug', () => {
    const branchName = generateBranchName(
      'ENG-100',
      'FIX UPPERCASE TITLE',
      'cursor'
    )
    expect(branchName).toBe('ENG-100--fix-uppercase-title--agent-cursor')
  })

  it('should handle empty title gracefully', () => {
    const branchName = generateBranchName('ENG-200', '', 'cursor')
    expect(branchName).toBe('ENG-200----agent-cursor')
  })

  it('should handle numbers in title', () => {
    const branchName = generateBranchName(
      'ENG-300',
      'Fix bug 123 in v2.0',
      'engine'
    )
    expect(branchName).toBe('ENG-300--fix-bug-123-in-v2-0--agent-engine')
  })
})

describe('dispatchMissingAgents', () => {
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env['LINEAR_API_KEY']
    process.env['LINEAR_API_KEY'] = 'test-api-key'
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env['LINEAR_API_KEY'] = originalApiKey
    } else {
      delete process.env['LINEAR_API_KEY']
    }
  })

  it('should throw error if LINEAR_API_KEY not configured', async () => {
    delete process.env['LINEAR_API_KEY']

    await expect(dispatchMissingAgents('test-id')).rejects.toThrow(
      'LINEAR_API_KEY not configured'
    )
  })

  it('should throw error if issue not found', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    await expect(dispatchMissingAgents('nonexistent-id')).rejects.toThrow(
      'Issue not found'
    )
  })

  it('should throw error if issue has no Linear ID', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              linearId: null,
              linearKey: 'ENG-123',
              title: 'Test',
              url: 'https://test.com',
              status: 'Open',
            },
          ]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    await expect(dispatchMissingAgents('test-id')).rejects.toThrow(
      'Issue has no Linear ID'
    )
  })

  it('should return 0 for closed issues', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              linearId: 'linear-123',
              linearKey: 'ENG-123',
              title: 'Test',
              url: 'https://test.com',
              status: 'Done',
            },
          ]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    const count = await dispatchMissingAgents('test-id')
    expect(count).toBe(0)
  })

  it('should return 0 for canceled issues', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              linearId: 'linear-123',
              linearKey: 'ENG-123',
              title: 'Test',
              url: 'https://test.com',
              status: 'Canceled',
            },
          ]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    const count = await dispatchMissingAgents('test-id')
    expect(count).toBe(0)
  })

  it('should handle null status as closed', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              linearId: 'linear-123',
              linearKey: 'ENG-123',
              title: 'Test',
              url: 'https://test.com',
              status: null,
            },
          ]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    const count = await dispatchMissingAgents('test-id')
    expect(count).toBe(0)
  })

  it('should return 0 when no enabled agents', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const { getAgentNames } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue([])

    const count = await dispatchMissingAgents('test-id')
    expect(count).toBe(0)
  })

  it('should dispatch agents to open issue', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'agent-id-1' }]),
        }),
      }),
    })
    vi.mocked(db).insert = mockInsert

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['cursor'])
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'cursor',
        handle: '@Cursor',
        displayName: 'Cursor',
        linearUserId: 'user-1',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi.fn().mockResolvedValue({})
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    expect(count).toBe(1)
    expect(mockCreateComment).toHaveBeenCalledWith({
      issueId: 'linear-123',
      body: '@[Cursor](user-1) please work on this issue and submit a PR.',
    })
    expect(mockInsert).toHaveBeenCalled()
  })

  it('should only dispatch missing agents', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ agentName: 'cursor' }]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'agent-id-1' }]),
        }),
      }),
    })
    vi.mocked(db).insert = mockInsert

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['cursor', 'engine'])
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'cursor',
        handle: '@Cursor',
        displayName: 'Cursor',
        linearUserId: 'user-1',
      },
      {
        name: 'engine',
        handle: '@Engine',
        displayName: 'Engine',
        linearUserId: 'user-2',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi.fn().mockResolvedValue({})
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    expect(count).toBe(1)
    expect(mockCreateComment).toHaveBeenCalledTimes(1)
    expect(mockCreateComment).toHaveBeenCalledWith({
      issueId: 'linear-123',
      body: '@[Engine](user-2) please work on this issue and submit a PR.',
    })
  })

  it('should dispatch agent successfully with linearUserId from config', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'agent-id-1' }]),
        }),
      }),
    })
    vi.mocked(db).insert = mockInsert

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['unknown'])
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'unknown',
        handle: '@Unknown',
        displayName: 'Unknown',
        linearUserId: 'user-unknown',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi.fn().mockResolvedValue({})
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    expect(count).toBe(1)
    expect(mockCreateComment).toHaveBeenCalledWith({
      issueId: 'linear-123',
      body: '@[Unknown](user-unknown) please work on this issue and submit a PR.',
    })
    expect(mockInsert).toHaveBeenCalledWith('issue_agents')
  })

  it('should continue dispatching other agents if one fails', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'agent-id-1' }]),
        }),
      }),
    })
    vi.mocked(db).insert = mockInsert

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['cursor', 'engine'])
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'cursor',
        handle: '@Cursor',
        displayName: 'Cursor',
        linearUserId: 'user-1',
      },
      {
        name: 'engine',
        handle: '@Engine',
        displayName: 'Engine',
        linearUserId: 'user-2',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi
      .fn()
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({})
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    expect(count).toBe(1)
    expect(mockCreateComment).toHaveBeenCalledTimes(2)
  })

  it('should skip agent when config not found', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['phantom'])
    vi.mocked(getAgentConfigs).mockResolvedValue([])

    const { LinearClient } = await import('@linear/sdk')
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          users: vi.fn(),
          createComment: vi.fn(),
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    expect(count).toBe(0)
  })

  it('should skip agents already mentioned in Linear comments', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'agent-id-1' }]),
        }),
      }),
    })
    vi.mocked(db).insert = mockInsert

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['cursor', 'engine'])
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'cursor',
        handle: '@Cursor',
        displayName: 'Cursor',
        linearUserId: 'user-1',
      },
      {
        name: 'engine',
        handle: '@Engine',
        displayName: 'Engine',
        linearUserId: 'user-2',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi.fn().mockResolvedValue({})
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [
          { body: '@cursor is already working on this' },
          { body: 'Some other comment' },
        ],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    // Should only dispatch engine, not cursor (already mentioned)
    expect(count).toBe(1)
    expect(mockCreateComment).toHaveBeenCalledTimes(1)
    expect(mockCreateComment).toHaveBeenCalledWith({
      issueId: 'linear-123',
      body: '@[Engine](user-2) please work on this issue and submit a PR.',
    })
  })

  it('should return 0 when all agents already mentioned in Linear comments', async () => {
    const { db } = await import('@/db/client')
    let selectCallCount = 0
    const mockSelect = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'test-id',
                  linearId: 'linear-123',
                  linearKey: 'ENG-123',
                  title: 'Test',
                  url: 'https://test.com',
                  status: 'In Progress',
                },
              ]),
            }),
          }),
        }
      } else {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }
    })
    vi.mocked(db).select = mockSelect

    const { getAgentNames, getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentNames).mockResolvedValue(['cursor', 'engine'])
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'cursor',
        handle: '@Cursor',
        displayName: 'Cursor',
        linearUserId: 'user-1',
      },
      {
        name: 'engine',
        handle: '@Engine',
        displayName: 'Engine',
        linearUserId: 'user-2',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi.fn()
    const mockIssue = vi.fn().mockResolvedValue({
      comments: vi.fn().mockResolvedValue({
        nodes: [
          { body: '@[cursor] please work on this' },
          { body: '@[engine] already assigned' },
        ],
        pageInfo: { hasNextPage: false },
      }),
    })
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
          issue: mockIssue,
        }) as never
    )

    const count = await dispatchMissingAgents('test-id')

    // Should not dispatch any agents
    expect(count).toBe(0)
    expect(mockCreateComment).not.toHaveBeenCalled()
  })
})

describe('dispatchAgentsToIssue (legacy)', () => {
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env['LINEAR_API_KEY']
    process.env['LINEAR_API_KEY'] = 'test-api-key'
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env['LINEAR_API_KEY'] = originalApiKey
    } else {
      delete process.env['LINEAR_API_KEY']
    }
  })

  it('should throw error if LINEAR_API_KEY not configured', async () => {
    delete process.env['LINEAR_API_KEY']

    await expect(dispatchAgentsToIssue('test-id')).rejects.toThrow(
      'LINEAR_API_KEY not configured'
    )
  })

  it('should throw error if issue not found', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    await expect(dispatchAgentsToIssue('nonexistent-id')).rejects.toThrow(
      'Issue not found'
    )
  })

  it('should throw error if issue has no Linear ID', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              linearId: null,
              linearKey: 'ENG-123',
              title: 'Test',
              url: 'https://test.com',
              status: 'Open',
            },
          ]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    await expect(dispatchAgentsToIssue('test-id')).rejects.toThrow(
      'Issue has no Linear ID'
    )
  })

  it('should create comment with agent mentions', async () => {
    const { db } = await import('@/db/client')
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'test-id',
              linearId: 'linear-123',
              linearKey: 'ENG-123',
              title: 'Test',
              url: 'https://test.com',
              status: 'Open',
            },
          ]),
        }),
      }),
    })
    vi.mocked(db).select = mockSelect

    const { getAgentConfigs } = await import('./agent-config')
    vi.mocked(getAgentConfigs).mockResolvedValue([
      {
        name: 'cursor',
        handle: '@Cursor',
        displayName: 'Cursor',
        linearUserId: 'user-1',
      },
      {
        name: 'engine',
        handle: '@Engine',
        displayName: 'Engine',
        linearUserId: 'user-2',
      },
    ])

    const { LinearClient } = await import('@linear/sdk')
    const mockCreateComment = vi.fn().mockResolvedValue({})
    vi.mocked(LinearClient).mockImplementation(
      () =>
        ({
          createComment: mockCreateComment,
        }) as never
    )

    await dispatchAgentsToIssue('test-id')

    expect(mockCreateComment).toHaveBeenCalledWith({
      issueId: 'linear-123',
      body: '@Cursor @Engine - Dispatching agents to work on this issue',
    })
  })
})
