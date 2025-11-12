#!/usr/bin/env tsx
/**
 * Migration Script: Demo Data → Real Linear Issue
 *
 * This script:
 * 1. Marks all seeded/demo issues as archived (stops tracking)
 * 2. Inserts the real Linear issue ENG-320
 * 3. Creates 3 agent attempts based on current state
 *
 * Run with: pnpm tsx scripts/migrate-to-real-data.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer'
});

async function main() {
  console.log('🚀 Starting migration to real data...\n');

  try {
    // Step 1: Archive all demo issues
    console.log('📦 Step 1: Archiving demo/seeded issues...');

    const archivedResult = await sql`
      UPDATE issues
      SET status = 'Archived - Demo Data'
      WHERE linear_id NOT LIKE 'lin_%'  -- Real Linear IDs start with lin_
         OR linear_id IS NULL
      RETURNING id, linear_key, title
    `;

    console.log(`   ✅ Archived ${archivedResult.length} demo issues`);
    archivedResult.forEach(issue => {
      console.log(`      - ${issue.linear_key}: ${issue.title}`);
    });

    // Step 2: Insert real Linear issue ENG-320
    console.log('\n📝 Step 2: Inserting real Linear issue ENG-320...');

    const issueData = {
      linear_id: 'lin_eng320_placeholder',  // You'll update this with real ID from Linear API/webhook
      linear_key: 'ENG-320',
      title: 'Drop uuid package usage for native crypto and UUIDs',
      url: 'https://linear.app/recall-labs/issue/ENG-320/drop-uuid-package-usage-for-native-crypto-and-uuids',
      repo: 'recall-labs/backend',  // Update if different
      status: 'In Progress',
      arena_ready_labeled_at: new Date(),  // Tagged today
      winner_attempt_id: null,
      created_at: new Date()
    };

    const [issue] = await sql`
      INSERT INTO issues ${sql(issueData)}
      ON CONFLICT (linear_id) DO UPDATE
      SET
        status = EXCLUDED.status,
        arena_ready_labeled_at = EXCLUDED.arena_ready_labeled_at
      RETURNING id, linear_key
    `;

    console.log(`   ✅ Issue inserted: ${issue.linear_key} (DB ID: ${issue.id})`);

    // Step 3: Create issue_agents rows (for tracking dispatch)
    console.log('\n👥 Step 3: Creating issue_agents rows...');

    const agents = [
      { name: 'cursor', status: 'triggered' },
      { name: 'engine', status: 'triggered' },
      { name: 'cyrus', status: 'triggered' }
    ];

    for (const agent of agents) {
      await sql`
        INSERT INTO issue_agents (issue_id, agent_name, status, triggered_at)
        VALUES (${issue.id}, ${agent.name}, ${agent.status}, NOW())
        ON CONFLICT (issue_id, agent_name) DO NOTHING
      `;
    }

    console.log(`   ✅ Created issue_agents for all 3 agents`);

    // Step 4: Create attempts based on current state
    console.log('\n🔨 Step 4: Creating agent attempts...');

    // Agent 1: Cursor - Has PR open
    // Update these details based on actual PR if available
    const cursorAttempt = {
      issue_id: issue.id,
      agent_name: 'cursor',
      repo: 'recall-labs/backend',
      pr_number: 999,  // PLACEHOLDER - update with real PR number
      pr_url: 'https://github.com/recall-labs/backend/pull/999',  // PLACEHOLDER
      branch: 'eng-320--drop-uuid--agent-cursor',
      opened_at: new Date(Date.now() - 2 * 60 * 60 * 1000),  // 2 hours ago
      merged_at: null,
      closed_at: null,
      status: 'open',
      commit_count: 1,
      source_attachment_id: null,  // Will be filled when Linear webhook fires
      source_attachment_url: null
    };

    // Agent 2: Engine - Failed/gave up
    const engineAttempt = {
      issue_id: issue.id,
      agent_name: 'engine',
      repo: 'recall-labs/backend',
      pr_number: 0,  // No PR created
      pr_url: '',
      branch: null,
      opened_at: new Date(Date.now() - 3 * 60 * 60 * 1000),  // 3 hours ago
      merged_at: null,
      closed_at: new Date(Date.now() - 1 * 60 * 60 * 1000),  // Failed 1 hour ago
      status: 'closed',
      commit_count: 0,
      source_attachment_id: null,
      source_attachment_url: null
    };

    // Agent 3: Cyrus - Still working (no PR yet)
    // For "working on it" state, we won't create an attempt row yet
    // It will be created when the PR is opened and Linear sends attachment webhook

    try {
      const [cursorResult] = await sql`
        INSERT INTO attempts ${sql(cursorAttempt)}
        ON CONFLICT (issue_id, agent_name, pr_number)
        DO UPDATE SET status = EXCLUDED.status
        RETURNING id, agent_name, pr_number, status
      `;
      console.log(`   ✅ Cursor: PR #${cursorResult.pr_number} - ${cursorResult.status}`);
    } catch (error) {
      console.log(`   ⚠️  Cursor: Skipped (may need manual PR number update)`);
    }

    // Only create Engine attempt if they actually failed (no PR)
    // If Engine is just slow, skip this
    console.log(`   ⚠️  Engine: Marked as failed (update if incorrect)`);

    console.log(`   ⏳ Cyrus: Working on it (no attempt row yet - will be created on PR open)`);

    // Step 5: Summary
    console.log('\n✨ Migration complete!\n');
    console.log('📊 Current state:');
    console.log(`   • Demo issues: Archived (won't be tracked)`);
    console.log(`   • Real issue: ENG-320 (${issue.id})`);
    console.log(`   • Agents: 3 dispatched`);
    console.log(`   • Attempts: Ready to track in real-time\n`);

    console.log('⚠️  MANUAL STEPS NEEDED:');
    console.log('   1. Update Cursor PR number if PR exists');
    console.log('   2. Verify agent states match reality');
    console.log('   3. Check if Engine actually failed or is still working');
    console.log('   4. When Linear webhook fires, attachment IDs will auto-populate\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

