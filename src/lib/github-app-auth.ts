/**
 * GitHub App authentication utilities
 * @packageDocumentation
 */

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
