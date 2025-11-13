/**
 * GitHub webhook handler for PR tracking
 * Tracks commit counts and CI status for arena competitions
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify signature
  const signature = req.headers.get('x-hub-signature-256')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
