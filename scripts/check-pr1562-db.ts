/**
 * Check database for PR #1562 attribution
 */

import postgres from 'postgres'

const DATABASE_URL = process.env['DATABASE_URL']
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL not found')
}

async function checkDatabase(): Promise<void> {
  const sql = postgres(DATABASE_URL, { max: 1 })

  try {
    console.log('🔍 Checking database for PR #1562...\n')

    // Check attempts table for PR #1562
    const attempts = await sql`
      SELECT
        id,
        issue_id,
        agent_name,
        pr_number,
        pr_url,
        status,
        opened_at
      FROM attempts
      WHERE pr_number = 1562
      ORDER BY opened_at DESC
    `

    if (attempts.length === 0) {
      console.log('❌ No records found for PR #1562 in attempts table')
    } else {
      console.log(`✅ Found ${attempts.length} record(s) for PR #1562:\n`)

      for (const attempt of attempts) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`Attempt ID: ${attempt.id}`)
        console.log(`Issue ID: ${attempt.issue_id}`)
        console.log(`Agent Name: ${attempt.agent_name}`)
        console.log(`PR URL: ${attempt.pr_url}`)
        console.log(`Status: ${attempt.status}`)
        console.log(`Opened At: ${attempt.opened_at}`)
        console.log()
      }
    }

    // Check the issue details
    if (attempts.length > 0) {
      const issueId = attempts[0].issue_id
      const issues = await sql`
        SELECT
          id,
          linear_id,
          linear_key,
          title,
          status
        FROM issues
        WHERE id = ${issueId}
      `

      if (issues.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📋 Associated Issue Details:')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`Issue: ${issues[0].linear_key}`)
        console.log(`Title: ${issues[0].title}`)
        console.log(`Linear ID: ${issues[0].linear_id}`)
        console.log(`Status: ${issues[0].status}`)
        console.log()
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 DIAGNOSIS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    if (attempts.length > 0 && attempts[0].agent_name === 'unknown') {
      console.log(
        '⚠️  PR #1562 is attributed to "unknown" agent in the database'
      )
      console.log(
        '\nPossible reasons:'
      )
      console.log(
        '1. The PR comment is a reply to a Linear user mention (@[username])'
      )
      console.log(
        '   but the code only looks for plain text agent handles (@cursor, @aider)'
      )
      console.log(
        '2. No agent handle was found in the comment or its parent chain'
      )
      console.log('3. The parent relationship detection is not working properly')
    }
  } finally {
    await sql.end()
  }
}

checkDatabase().catch((error: Error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
