#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { issues } from '../src/db/schema.js'
import { like, or } from 'drizzle-orm'

async function main() {
  const result = await db.select().from(issues).where(
    or(
      like(issues.linearKey, '%901%'),
      like(issues.linearKey, 'ENG-%')
    )
  )

  console.log('Issues in database:')
  result.forEach(i => {
    console.log(`  ${i.linearKey}: ${i.linearId}`)
    console.log(`    Title: ${i.title}`)
    console.log(`    URL: ${i.url}`)
    console.log('')
  })

  process.exit(0)
}

main().catch(console.error)
