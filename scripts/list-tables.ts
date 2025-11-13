import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL not set')
}

const client = postgres(process.env['DATABASE_URL'], { max: 1 })

async function listTables() {
  const tables = await client<Array<{tablename: string}>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  console.log('Tables:', tables.map(t => t.tablename))
  await client.end()
}

listTables().catch(console.error)
