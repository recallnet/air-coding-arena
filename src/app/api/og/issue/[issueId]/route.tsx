/**
 * GET /api/og/issue/[issueId] - OpenGraph image endpoint for issues.
 * Generates dynamic OG images showing issue competition results or status.
 *
 * @packageDocumentation
 */

import { count, eq } from 'drizzle-orm'
import { ImageResponse } from 'next/og'

import { db } from '@/db/client'
import { attempts, issues } from '@/db/schema'

/**
 * GET handler for issue OG image endpoint.
 * Returns an ImageResponse with competition status or error JSON.
 *
 * @param _request - Incoming request (unused)
 * @param root0 - Route parameters object
 * @param root0.params - Promise resolving to route params
 * @returns ImageResponse with OG image or JSON error response
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ issueId: string }> }
): Promise<Response> {
  try {
    const { issueId } = await params

    // Fetch issue with winner attempt
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        winnerAttempt: true,
      },
    })

    if (!issue) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get competitor count
    const competitors = await db
      .select({
        agentName: attempts.agentName,
        attemptCount: count(),
      })
      .from(attempts)
      .where(eq(attempts.issueId, issueId))
      .groupBy(attempts.agentName)

    const competitorCount = competitors.length

    // Render winner view
    if (issue.winnerAttemptId) {
      const winner = issue.winnerAttempt

      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              padding: '40px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 60,
                  fontWeight: 'bold',
                  color: '#fff',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                {issue.linearKey}: {issue.title}
              </div>
              <div
                style={{
                  fontSize: 40,
                  color: '#4ade80',
                  marginBottom: '10px',
                }}
              >
                Winner: {winner?.agentName}
              </div>
              <div
                style={{
                  fontSize: 30,
                  color: '#a3a3a3',
                }}
              >
                {competitorCount} competitor{competitorCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      )
    }

    // Render active competition view (placeholder for now)
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            padding: '40px',
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 'bold',
              color: '#fff',
              textAlign: 'center',
            }}
          >
            {issue.linearKey}: {issue.title}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
