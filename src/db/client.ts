import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is not set')
}

/**
 * Postgres client connection.
 * Uses connection pooling via Neon.
 */
const client = postgres(process.env['DATABASE_URL'], {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

/**
 * Drizzle database instance.
 * Singleton pattern - only one instance created.
 */
export const db = drizzle(client)
