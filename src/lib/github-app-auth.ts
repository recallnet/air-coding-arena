/**
 * GitHub App authentication utilities
 * @packageDocumentation
 */

/* eslint-disable no-undef */
import jwt from 'jsonwebtoken'

/**
 * Generates a JWT for authenticating as the GitHub App
 * Valid for 10 minutes (GitHub's maximum)
 *
 * @returns JWT token string
 * @throws Error if GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY not configured
 */
export function generateAppJWT(): string {
  const appId = process.env['GITHUB_APP_ID']
  const privateKey = process.env['GITHUB_APP_PRIVATE_KEY']

  if (!appId) {
    throw new Error('GITHUB_APP_ID not configured')
  }

  if (!privateKey) {
    throw new Error('GITHUB_APP_PRIVATE_KEY not configured')
  }

  // Replace literal \n with actual newlines (env vars store it escaped)
  const formattedKey = privateKey.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)

  const payload = {
    iat: now - 60, // Issued 60 seconds in past for clock skew tolerance
    exp: now + 600, // Expires in 10 minutes (GitHub's max)
    iss: appId,
  }

  return jwt.sign(payload, formattedKey, { algorithm: 'RS256' })
}

/**
 * In-memory cache for installation tokens
 * Key: installation ID, Value: { token, expiresAt }
 */
const tokenCache = new Map<
  string,
  {
    token: string
    expiresAt: Date
  }
>()

/**
 * Fetches an installation access token for a specific installation
 * Tokens are cached in-memory and refreshed 5 minutes before expiry
 *
 * @param installationId - GitHub installation ID
 * @returns Installation access token
 * @throws Error if API call fails
 */
export async function getInstallationToken(
  installationId: string
): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(installationId)
  if (cached) {
    // Refresh if less than 5 minutes remaining
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    if (cached.expiresAt > fiveMinutesFromNow) {
      return cached.token
    }
  }

  // Generate app JWT
  const jwtToken = generateAppJWT()

  // Fetch installation token
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwtToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!response.ok) {
    throw new Error(
      `Failed to get installation token: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as {
    token: string
    expires_at: string
  }

  // Cache token
  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: new Date(data.expires_at),
  })

  return data.token
}

/**
 * Clears the token cache (useful for testing)
 */
export function clearTokenCache(): void {
  tokenCache.clear()
}
