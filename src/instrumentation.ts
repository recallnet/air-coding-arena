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
    const { reconcileLinearIssues } = await import('./lib/linear-reconcile')

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
