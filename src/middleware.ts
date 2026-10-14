import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Compares credentials without leaking their contents through timing.
 * @param actual - Supplied authorization value
 * @param expected - Configured authorization value
 * @returns Whether the values match
 */
function matchesCredential(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

/**
 * Applies the operator access boundary before route handlers execute.
 * @param request - Incoming Next.js request
 * @returns Authentication denial or a response allowing route execution
 */
export function middleware(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname
  const isAgentApi = path === '/api/agents' || path.startsWith('/api/agents/')
  const isReconcile = path === '/api/linear/reconcile'
  const isCallback = path === '/api/github/app/callback'
  const isOperator =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    isAgentApi ||
    isReconcile ||
    isCallback
  if (!isOperator) return NextResponse.next()

  const authorization = request.headers.get('authorization') ?? ''
  const cronSecret = process.env['CRON_SECRET']
  if (
    isReconcile &&
    cronSecret &&
    matchesCredential(authorization, `Bearer ${cronSecret}`)
  ) {
    return NextResponse.next()
  }

  const username = process.env['OPERATOR_USERNAME']
  const password = process.env['OPERATOR_PASSWORD']
  if (!username || !password) {
    return NextResponse.json(
      { error: 'Operator access is not configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    )
  }
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  if (!matchesCredential(authorization, expected)) {
    return NextResponse.json(
      { error: 'Operator authentication required' },
      {
        status: 401,
        headers: {
          'www-authenticate': 'Basic realm="Arena operator", charset="UTF-8"',
          'cache-control': 'no-store',
        },
      }
    )
  }

  // A provider redirect is cross-site. Ask for an explicit local navigation
  // before recording it, rather than treating cached Basic credentials as CSRF consent.
  if (isCallback && request.headers.get('sec-fetch-site') === 'cross-site') {
    const query = request.nextUrl.searchParams
      .toString()
      .replaceAll('&', '&amp;')
    return new NextResponse(
      [
        '<!doctype html><html lang="en">',
        '<meta charset="utf-8">',
        '<title>Confirm installation</title>',
        '<h1>Confirm GitHub App installation</h1>',
        '<p>Continue only if you just installed or updated your GitHub App.</p>',
        `<a href="/api/github/app/callback?${query}">Confirm installation</a></html>`,
      ].join(''),
      {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'content-security-policy':
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
          'x-content-type-options': 'nosniff',
        },
      }
    )
  }

  const origin = request.headers.get('origin')
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin !== null && origin !== request.nextUrl.origin)
  ) {
    return NextResponse.json(
      { error: 'Cross-origin operator requests are forbidden' },
      { status: 403, headers: { 'cache-control': 'no-store' } }
    )
  }
  const response = NextResponse.next()
  response.headers.set('cache-control', 'no-store')
  return response
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/admin/:path*',
    '/api/agents/:path*',
    '/api/github/app/callback',
    '/api/linear/reconcile',
  ],
}
