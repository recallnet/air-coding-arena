import {db} from '../src/db/client'
import {attempts} from '../src/db/schema'
import {eq} from 'drizzle-orm'

async function check() {
  const results = await db.select().from(attempts).where(eq(attempts.agentName, 'unknown'))
  console.log('Unknown agent attempts:', results.length)
  console.log(JSON.stringify(results, null, 2))
  process.exit(0)
}

check().catch(console.error)
