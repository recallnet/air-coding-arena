import { Buffer } from 'node:buffer'

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { middleware } from './middleware'

const reconcilePath = '/api/linear/reconcile'
const discoverPath = '/api/agents/discover'
const origin = 'https://arena.example'
const basic = `Basic ${Buffer.from('operator:test-password').toString('base64')}`

function request(path: string, authorization?: string, method = 'GET') {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: authorization ? { authorization } : {},
  })
}

describe('operator access boundary', () => {
  beforeEach(() => {
    vi.stubEnv('OPERATOR_USERNAME', 'operator')
    vi.stubEnv('OPERATOR_PASSWORD', 'test-password')
    vi.stubEnv('CRON_SECRET', 'cron-test-secret')
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['/admin', 'GET'],
    ['/admin/agents', 'GET'],
    ['/api/agents', 'GET'],
    ['/api/agents/config', 'GET'],
    ['/api/agents/agent-id', 'PATCH'],
    [discoverPath, 'POST'],
    ['/api/github/app/callback?installation_id=42', 'GET'],
    [reconcilePath, 'GET'],
  ])('denies anonymous %s before side effects', (path, method) => {
    const response = middleware(request(path, undefined, method))
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('Basic')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it.each(['OPERATOR_USERNAME', 'OPERATOR_PASSWORD'])(
    'fails closed without %s',
    (key) => {
      vi.stubEnv(key, '')
      expect(middleware(request('/admin', basic)).status).toBe(503)
    }
  )

  it.each([
    'Bearer test-password',
    'Basic !!!',
    'Basic ' + Buffer.from('operator:wrong').toString('base64'),
  ])('denies invalid credentials %s', (authorization) => {
    expect(middleware(request('/api/agents', authorization)).status).toBe(401)
  })

  it('allows authenticated browser and API requests', () => {
    expect(middleware(request('/admin/agents', basic)).status).toBe(200)
    expect(middleware(request('/api/agents/id', basic, 'PATCH')).status).toBe(
      200
    )
    expect(middleware(request('/api/github/app/callback', basic)).status).toBe(
      200
    )
  })

  it('accepts cron bearer only for reconciliation, independently of operator setup', () => {
    vi.stubEnv('OPERATOR_USERNAME', '')
    vi.stubEnv('OPERATOR_PASSWORD', '')
    expect(
      middleware(request(reconcilePath, 'Bearer cron-test-secret')).status
    ).toBe(200)
    expect(
      middleware(request(discoverPath, 'Bearer cron-test-secret', 'POST'))
        .status
    ).toBe(503)
  })

  it('does not accept missing, empty or incorrect cron credentials', () => {
    expect(middleware(request(reconcilePath, 'Bearer wrong')).status).toBe(401)
    vi.stubEnv('CRON_SECRET', '')
    expect(middleware(request(reconcilePath, 'Bearer ')).status).toBe(401)
  })

  it('rejects cross-site requests even with cached browser credentials', () => {
    const crossOrigin = request('/api/agents/id', basic, 'PATCH')
    crossOrigin.headers.set('origin', 'https://untrusted.example')
    expect(middleware(crossOrigin).status).toBe(403)
    const crossSite = request(reconcilePath, basic)
    crossSite.headers.set('sec-fetch-site', 'cross-site')
    expect(middleware(crossSite).status).toBe(403)
    const sameOrigin = request(discoverPath, basic, 'POST')
    sameOrigin.headers.set('origin', origin)
    expect(middleware(sameOrigin).status).toBe(200)
  })

  it('requires explicit same-origin confirmation for a GitHub callback navigation', () => {
    const callback = request(
      '/api/github/app/callback?installation_id=42&setup_action=install',
      basic
    )
    callback.headers.set('sec-fetch-site', 'cross-site')
    const response = middleware(callback)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('x-middleware-next')).toBeNull()
    expect(
      middleware(
        request('/api/github/app/callback?installation_id=42', basic)
      ).headers.get('x-middleware-next')
    ).toBe('1')
  })

  it.each([
    '/',
    '/issues',
    '/agents/example',
    '/api/og/leaderboard',
    '/api/linear/webhook',
    '/api/github/webhook',
  ])('preserves public access to %s', (path) => {
    vi.stubEnv('OPERATOR_USERNAME', '')
    vi.stubEnv('OPERATOR_PASSWORD', '')
    expect(middleware(request(path)).status).toBe(200)
  })
})
