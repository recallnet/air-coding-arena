#!/usr/bin/env tsx
/**
 * Fetch ENG-320 Details from Linear
 *
 * This script queries Linear's API to get the real state of issue ENG-320
 * including attachments (PRs), comments (agent activity), etc.
 *
 * Run with: pnpm tsx scripts/fetch-eng320-details.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not found in .env.local');
  console.error('   Add it temporarily to fetch issue details.');
  process.exit(1);
}

const GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';

async function queryLinear(query: string, variables: any = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY!
    },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Linear API Error: ${JSON.stringify(data.errors, null, 2)}`);
  }

  return data.data;
}

async function fetchIssueDetails(issueKey: string) {
  const query = `
    query GetIssue($issueId: String!) {
      issue(id: $issueId) {
        id
        identifier
        title
        description
        url
        state {
          name
          type
        }
        team {
          key
          name
        }
        labels {
          nodes {
            id
            name
          }
        }
        comments {
          nodes {
            id
            body
            createdAt
            user {
              name
              email
            }
          }
        }
        attachments {
          nodes {
            id
            title
            subtitle
            url
            createdAt
            updatedAt
            metadata
          }
        }
        createdAt
        updatedAt
      }
    }
  `;

  return await queryLinear(query, { issueId: issueKey });
}

async function main() {
  console.log('🔍 Fetching ENG-320 details from Linear...\n');

  try {
    const data = await fetchIssueDetails('ENG-320');
    const issue = data.issue;

    if (!issue) {
      console.error('❌ Issue ENG-320 not found');
      process.exit(1);
    }

    console.log('📋 Issue Details');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Linear ID:    ${issue.id}`);
    console.log(`Key:          ${issue.identifier}`);
    console.log(`Title:        ${issue.title}`);
    console.log(`URL:          ${issue.url}`);
    console.log(`Status:       ${issue.state.name} (${issue.state.type})`);
    console.log(`Team:         ${issue.team.key} (${issue.team.name})`);
    console.log(`Created:      ${new Date(issue.createdAt).toLocaleString()}`);

    console.log(`\n🏷️  Labels:     ${issue.labels.nodes.map((l: any) => l.name).join(', ') || 'None'}`);

    // Parse attachments (GitHub PRs)
    console.log('\n\n📎 Attachments (GitHub PRs)');
    console.log('═══════════════════════════════════════════════════════\n');

    const githubAttachments = issue.attachments.nodes.filter((a: any) =>
      a.url && a.url.includes('github.com')
    );

    if (githubAttachments.length === 0) {
      console.log('   No GitHub PR attachments found yet.');
    } else {
      githubAttachments.forEach((att: any, index: number) => {
        const prMatch = att.url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);

        console.log(`${index + 1}. ${att.title}`);
        console.log(`   Attachment ID: ${att.id}`);
        console.log(`   URL:           ${att.url}`);
        console.log(`   Subtitle:      ${att.subtitle || 'N/A'}`);
        console.log(`   Created:       ${new Date(att.createdAt).toLocaleString()}`);

        if (prMatch) {
          const [_, org, repo, prNumber] = prMatch;
          console.log(`   Parsed:        ${org}/${repo} #${prNumber}`);

          // Guess status from subtitle
          const subtitle = (att.subtitle || '').toLowerCase();
          let status = 'open';
          if (subtitle.includes('merged')) status = 'merged';
          if (subtitle.includes('closed')) status = 'closed';
          console.log(`   Status:        ${status} (guessed from subtitle)`);
        }

        console.log('');
      });
    }

    // Parse comments for agent activity
    console.log('\n💬 Agent Comments');
    console.log('═══════════════════════════════════════════════════════\n');

    const agentComments = issue.comments.nodes.filter((c: any) =>
      c.body.includes('@Cursor') ||
      c.body.includes('@Engine') ||
      c.body.includes('@Cyrus') ||
      c.user.name.toLowerCase().includes('cursor') ||
      c.user.name.toLowerCase().includes('engine') ||
      c.user.name.toLowerCase().includes('cyrus')
    );

    if (agentComments.length === 0) {
      console.log('   No agent comments found.');
    } else {
      agentComments.forEach((comment: any, index: number) => {
        console.log(`${index + 1}. ${comment.user.name} - ${new Date(comment.createdAt).toLocaleString()}`);
        console.log(`   ${comment.body.substring(0, 100)}...`);
        console.log('');
      });
    }

    // Generate SQL INSERT statement
    console.log('\n\n📝 SQL INSERT Statement (Copy & Paste Ready)');
    console.log('═══════════════════════════════════════════════════════\n');

    const hasArenaLabel = issue.labels.nodes.some((l: any) =>
      l.name.toLowerCase().includes('arena') || l.name.toLowerCase().includes('ready')
    );

    console.log('-- Step 1: Insert the issue');
    console.log(`INSERT INTO issues (linear_id, linear_key, title, url, repo, status, arena_ready_labeled_at, created_at)`);
    console.log(`VALUES (`);
    console.log(`  '${issue.id}',`);
    console.log(`  '${issue.identifier}',`);
    console.log(`  '${issue.title.replace(/'/g, "''")}',`);
    console.log(`  '${issue.url}',`);
    console.log(`  'recall-labs/backend',  -- TODO: Update if different`);
    console.log(`  '${issue.state.name}',`);
    console.log(`  ${hasArenaLabel ? 'NOW()' : 'NULL'},`);
    console.log(`  '${issue.createdAt}'`);
    console.log(`)`);
    console.log(`RETURNING id;  -- Save this ID!\n`);

    if (githubAttachments.length > 0) {
      console.log('\n-- Step 2: Insert attempts (replace <ISSUE_ID> with ID from Step 1)\n');

      githubAttachments.forEach((att: any, index: number) => {
        const prMatch = att.url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
        if (!prMatch) return;

        const [_, org, repo, prNumber] = prMatch;
        const subtitle = (att.subtitle || '').toLowerCase();
        let status = 'open';
        if (subtitle.includes('merged')) status = 'merged';
        if (subtitle.includes('closed')) status = 'closed';

        // Guess agent from title or branch
        const text = (att.title + ' ' + (att.metadata?.branch || '')).toLowerCase();
        let agent = 'unknown';
        if (text.includes('cursor')) agent = 'cursor';
        if (text.includes('engine')) agent = 'engine';
        if (text.includes('cyrus')) agent = 'cyrus';

        console.log(`-- Attempt ${index + 1}: ${agent} (${status})`);
        console.log(`INSERT INTO attempts (issue_id, agent_name, repo, pr_number, pr_url, branch, opened_at, status, commit_count, source_attachment_id, source_attachment_url)`);
        console.log(`VALUES (`);
        console.log(`  '<ISSUE_ID>',  -- Replace with actual UUID from Step 1`);
        console.log(`  '${agent}',`);
        console.log(`  '${org}/${repo}',`);
        console.log(`  ${prNumber},`);
        console.log(`  '${att.url}',`);
        console.log(`  ${att.metadata?.branch ? `'${att.metadata.branch}'` : 'NULL'},`);
        console.log(`  '${att.createdAt}',`);
        console.log(`  '${status}',`);
        console.log(`  1,  -- Will be updated by enrichment`);
        console.log(`  '${att.id}',`);
        console.log(`  '${att.url}'`);
        console.log(`);\n`);
      });
    }

    console.log('\n✨ Done! Copy the SQL above and run it against your database.\n');

  } catch (error) {
    console.error('❌ Error fetching issue details:', error);
    process.exit(1);
  }
}

main();

