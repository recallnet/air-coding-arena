/**
 * GitHub App OAuth callback endpoint
 * Handles installation, update, and suspend actions
 *
 * @packageDocumentation
 */

/* eslint-disable no-undef */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { db } from '@/db/client'
import { githubAppInstallations } from '@/db/schema'
import { generateAppJWT } from '@/lib/github-app-auth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action') // 'install' | 'update' | 'suspend'

  if (!installationId) {
    return NextResponse.json(
      { error: 'Missing installation_id' },
      { status: 400 }
    )
  }

  try {
    // Fetch installation details from GitHub
    const jwtToken = generateAppJWT()
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${jwtToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      )
    }

    const installation = (await response.json()) as {
      id: number
      account: {
        id: number
        login: string
        type: string
      }
      suspended_at?: string
    }

    // Upsert installation to database
    const isSuspended =
      setupAction === 'suspend' ||
      (setupAction !== 'install' &&
        setupAction !== 'update' &&
        !!installation.suspended_at)
    await db
      .insert(githubAppInstallations)
      .values({
        installationId: installation.id.toString(),
        accountId: installation.account.id.toString(),
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        isActive: !isSuspended,
        suspendedAt: isSuspended ? new Date() : null,
        installedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [githubAppInstallations.installationId],
        set: {
          accountId: installation.account.id.toString(),
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          isActive: !isSuspended,
          suspendedAt: isSuspended ? new Date() : null,
          updatedAt: new Date(),
        },
      })

    // Redirect to setup page with success
    const redirectUrl = new URL('/admin/github/setup', request.url)
    if (isSuspended) {
      redirectUrl.searchParams.set('suspended', 'true')
    } else {
      redirectUrl.searchParams.set('success', 'true')
    }

    // Add cache-busting timestamp to force page revalidation
    redirectUrl.searchParams.set('t', Date.now().toString())

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('GitHub App callback error:', error)

    // Redirect to setup page with error
    const redirectUrl = new URL('/admin/github/setup', request.url)
    redirectUrl.searchParams.set(
      'error',
      error instanceof Error ? error.message : 'Unknown error'
    )

    return NextResponse.redirect(redirectUrl)
  }
}
