#!/usr/bin/env tsx
import { reconcileLinearIssues } from '../src/lib/linear-reconcile.js'

async function main() {
  console.log('Running manual reconciliation...')
  const count = await reconcileLinearIssues()
  console.log(`Reconciled ${count} issues`)
}

main().catch(console.error)
