/**
 * Reconciliation endpoint for Vercel Cron
 * Triggers full reconciliation with Linear API every hour
 */

import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

import { reconcileLinearIssues } from '@/lib/linear-reconcile'

/**
 * GET handler for reconciliation.
 * Called by Vercel Cron and available for manual testing.
 *
 * @returns JSON response with reconciliation count
 */
export async function GET(): Promise<NextResponse> {
  try {
    console.log('[Reconcile] Starting reconciliation...')
    const count = await reconcileLinearIssues()
    console.log(`[Reconcile] Complete: ${count} issues`)

    // Invalidate caches after full reconciliation
    revalidateTag('issues-list')
    revalidateTag('agent-stats')
    console.log('[Linear Reconcile] Invalidated cache after full sync')

    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
