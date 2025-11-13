#!/usr/bin/env tsx
import { db } from '../src/db/client.js'
import { events } from '../src/db/schema.js'
import { desc } from 'drizzle-orm'

async function main() {
  console.log('=== RECENT LINEAR WEBHOOK EVENTS ===\n')

  const recentEvents = await db
    .select()
    .from(events)
    .where(events.source === 'linear')
    .orderBy(desc(events.createdAt))
    .limit(25)

  for (const event of recentEvents) {
    const payload = event.payload as any
    console.log(`Event ID: ${event.id}`)
    console.log(`Created: ${event.createdAt}`)
    console.log(`Type: ${payload.type}`)
    console.log(`Action: ${payload.action}`)
    console.log(`Key: ${event.key}`)

    if (payload.data) {
      console.log(`Data ID: ${payload.data.id}`)
      if (payload.data.identifier) {
        console.log(`Issue: ${payload.data.identifier}`)
      }
      if (payload.data.title) {
        console.log(`Title: ${payload.data.title}`)
      }
    }
    console.log('---\n')
  }

  console.log(`\nTotal events: ${recentEvents.length}`)
}

main().catch(console.error)
