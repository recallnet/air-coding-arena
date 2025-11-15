/**
 * GET /api/og/leaderboard - OpenGraph image endpoint for leaderboard.
 * Generates dynamic OG images showing top 3 agents in podium layout.
 *
 * @packageDocumentation
 */

import { ImageResponse } from 'next/og'

import { getAgentStats } from '@/lib/queries'

// Image metadata
export const runtime = 'edge'

/**
 * GET handler for leaderboard OG image endpoint.
 * Returns an ImageResponse with top 3 agents in podium layout.
 *
 * @returns ImageResponse with OG image
 */
export async function GET(): Promise<Response> {
  try {
    // Fetch agent stats and take top 3
    const agentStats = await getAgentStats()
    const topThree = agentStats.slice(0, 3)

    // Handle empty state
    if (topThree.length === 0) {
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
              backgroundColor: '#0a0a0a',
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
              Air Coding Arena
            </div>
            <div
              style={{
                fontSize: 40,
                color: '#a3a3a3',
                marginTop: '20px',
                textAlign: 'center',
              }}
            >
              No agents competing yet
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      )
    }

    // Podium colors
    const borderColors = {
      0: '#f59e0b', // gold
      1: '#9ca3af', // silver
      2: '#ea580c', // bronze
    }

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
            backgroundColor: '#0a0a0a',
            padding: '40px',
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 'bold',
              color: '#fff',
              marginBottom: '40px',
              textAlign: 'center',
            }}
          >
            Air Coding Arena Leaderboard
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '20px',
            }}
          >
            {topThree.map((agent, index) => (
              <div
                key={agent.agentName}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px',
                  border: `4px solid ${borderColors[index as keyof typeof borderColors]}`,
                  borderRadius: '12px',
                  backgroundColor: '#1a1a1a',
                  minWidth: '280px',
                }}
              >
                {agent.avatarUrl ? (
                  <img
                    src={agent.avatarUrl}
                    alt={agent.displayName ?? agent.agentName}
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '60px',
                      marginBottom: '16px',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '60px',
                      backgroundColor: '#333',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                      fontWeight: 'bold',
                      color: '#fff',
                    }}
                  >
                    {(agent.displayName ?? agent.agentName)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: '#fff',
                    marginBottom: '8px',
                    textAlign: 'center',
                  }}
                >
                  {agent.displayName ?? agent.agentName}
                </div>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 'bold',
                    color: borderColors[index as keyof typeof borderColors],
                    marginBottom: '8px',
                  }}
                >
                  {agent.ordinal > 0 ? agent.ordinal.toFixed(0) : '-'}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: '#a3a3a3',
                  }}
                >
                  #{index + 1}
                </div>
              </div>
            ))}
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
