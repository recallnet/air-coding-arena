/**
 * Tests for PATCH /api/agents/[id] endpoint.
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/db/client'
import { agents } from '@/db/schema'

import { PATCH } from './route'

// Mock database
vi.mock('@/db/client', () => ({
  db: {
    update: vi.fn(),
  },
}))

describe('PATCH /api/agents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should update agent enabled status', async () => {
    const agentId = 'agent-123'
    const mockUpdatedAgent = {
      id: agentId,
      name: 'cursor',
      displayName: 'Cursor',
      linearUserId: 'linear-user-1',
      email: 'cursor@oauthapp.linear.app',
      avatarUrl: null,
      isActive: true,
      isEnabled: false, // Updated to false
      discoveredAt: new Date('2025-01-01T00:00:00Z'),
      lastSeenAt: new Date('2025-01-02T00:00:00Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date(),
    }

    // Mock database update
    const mockReturning = vi.fn().mockResolvedValue([mockUpdatedAgent])
    const mockWhere = vi.fn().mockReturnValue({
      returning: mockReturning,
    })
    const mockSet = vi.fn().mockReturnValue({
      where: mockWhere,
    })
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
    } as never)

    // Create request with valid body
    const request = new Request('http://localhost/api/agents/agent-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: false }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: agentId }),
    })
    const data = (await response.json()) as {
      id: string
      name: string
      displayName: string
      linearUserId: string
      email: string | null
      avatarUrl: string | null
      isActive: boolean
      isEnabled: boolean
    }

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      id: agentId,
      name: 'cursor',
      displayName: 'Cursor',
      linearUserId: 'linear-user-1',
      email: 'cursor@oauthapp.linear.app',
      avatarUrl: null,
      isActive: true,
      isEnabled: false,
    })
    expect(db.update).toHaveBeenCalledWith(agents)
  })

  it('should return 400 if isEnabled is missing', async () => {
    const request = new Request('http://localhost/api/agents/agent-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'agent-123' }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('isEnabled is required')
  })

  it('should return 400 if isEnabled is not a boolean', async () => {
    const request = new Request('http://localhost/api/agents/agent-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: 'true' }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'agent-123' }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('isEnabled must be a boolean')
  })

  it('should return 404 if agent not found', async () => {
    // Mock database update returning empty array
    const mockReturning = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn().mockReturnValue({
      returning: mockReturning,
    })
    const mockSet = vi.fn().mockReturnValue({
      where: mockWhere,
    })
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
    } as never)

    const request = new Request('http://localhost/api/agents/agent-999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: false }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'agent-999' }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(404)
    expect(data.error).toBe('Agent not found')
  })

  it('should return 400 if body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/agents/agent-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'agent-123' }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request body')
  })

  it('should return 400 if body is null', async () => {
    const request = new Request('http://localhost/api/agents/agent-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'agent-123' }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request body')
  })

  it('should return 500 on database error', async () => {
    // Mock database error
    const mockSet = vi.fn().mockImplementation(() => {
      throw new Error('Database connection failed')
    })
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
    } as never)

    const request = new Request('http://localhost/api/agents/agent-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: false }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'agent-123' }),
    })
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data.error).toBe('Database connection failed')
  })

  it('should enable an agent', async () => {
    const agentId = 'agent-456'
    const mockUpdatedAgent = {
      id: agentId,
      name: 'engine',
      displayName: 'Engine',
      linearUserId: 'linear-user-2',
      email: 'engine@oauthapp.linear.app',
      avatarUrl: null,
      isActive: true,
      isEnabled: true, // Updated to true
      discoveredAt: new Date('2025-01-01T00:00:00Z'),
      lastSeenAt: new Date('2025-01-02T00:00:00Z'),
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date(),
    }

    // Mock database update
    const mockReturning = vi.fn().mockResolvedValue([mockUpdatedAgent])
    const mockWhere = vi.fn().mockReturnValue({
      returning: mockReturning,
    })
    const mockSet = vi.fn().mockReturnValue({
      where: mockWhere,
    })
    vi.mocked(db.update).mockReturnValue({
      set: mockSet,
    } as never)

    const request = new Request('http://localhost/api/agents/agent-456', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: true }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: agentId }),
    })
    const data = (await response.json()) as {
      id: string
      isEnabled: boolean
    }

    expect(response.status).toBe(200)
    expect(data.isEnabled).toBe(true)
  })
})
