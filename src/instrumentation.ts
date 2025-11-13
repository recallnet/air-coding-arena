/**
 * Next.js instrumentation hook for server startup
 * Runs once when the server starts
 * @packageDocumentation
 */

/**
 * Registers startup hooks for the application
 * Called once when the Next.js server initializes
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    // Only run on server, not edge runtime
    const { discoverAgents } = await import('./lib/agent-discovery')
    const { reconcileLinearIssues } = await import('./lib/linear-reconcile')

    // Discover agents first so they exist before reconciling issues
    console.log('[Startup] Discovering agents from Linear...')
    try {
      const agentResults = await discoverAgents()
      console.log(
        `[Startup] Agent discovery complete: ${agentResults.discovered} discovered, ${agentResults.updated} updated, ${agentResults.deactivated} deactivated`
      )
    } catch (error) {
      console.error('[Startup] Agent discovery failed:', error)
      // Continue anyway - reconciliation can still work with existing agents
    }

    console.log('[Startup] Running Linear reconciliation...')

    try {
      const count = await reconcileLinearIssues()
      console.log(`[Startup] Reconciled ${count} issues from Linear`)
    } catch (error) {
      console.error('[Startup] Reconciliation failed:', error)
      // Don't crash the server on reconciliation failure
    }
  }
}
