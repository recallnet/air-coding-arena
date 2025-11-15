/**
 * Reconciliation endpoint for Vercel Cron
 * Triggers full reconciliation with Linear API every hour
 */

import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { discoverAgents } from '@/lib/agent-discovery'
import { reconcileLinearIssues } from '@/lib/linear-reconcile'

/**
 * GET handler for reconciliation.
 * Called by Vercel Cron and available for manual testing.
 * Discovers agents first, then reconciles issues.
 *
 * @returns JSON response with reconciliation count and agent discovery stats
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Discover agents first so they exist before reconciling issues
    console.log('[Reconcile] Discovering agents from Linear...')
    const agentResults = await discoverAgents()
    console.log(
      `[Reconcile] Agent discovery complete: ${agentResults.discovered} discovered, ${agentResults.updated} updated, ${agentResults.deactivated} deactivated`
    )

    console.log('[Reconcile] Starting issue reconciliation...')
    const count = await reconcileLinearIssues()
    console.log(`[Reconcile] Complete: ${count} issues`)

    // Invalidate homepage cache after full reconciliation
    revalidatePath('/')
    console.log('[Linear Reconcile] Revalidated homepage after full sync')

    return NextResponse.json({
      success: true,
      issueCount: count,
      agentDiscovery: agentResults,
    })
  } catch (error) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
