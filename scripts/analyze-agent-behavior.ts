#!/usr/bin/env tsx
/**
 * Analyze Agent Behavior on ENG-320
 *
 * Deep dive into how agents respond to Linear issues and post PRs.
 * This helps us understand what we can parse and what gaps exist.
 */

import { readFileSync } from 'fs';

// Load .env.local manually
function loadEnvLocal(): Record<string, string> {
  try {
    const envContent = readFileSync('.env.local', 'utf-8');
    const vars: Record<string, string> = {};

    envContent.split('\n').forEach(line => {
      if (line.trim().startsWith('#') || !line.includes('=')) return;
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      vars[key.trim()] = value;
    });

    return vars;
  } catch {
    return {};
  }
}

const env = loadEnvLocal();
const LINEAR_API_KEY = process.env.LINEAR_API_KEY || env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY not found');
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

async function analyzeIssue(issueKey: string) {
  const query = `
    query GetIssueDetailed($issueId: String!) {
      issue(id: $issueId) {
        id
        identifier
        title
        description
        url
        state { name type }
        team { key name }
        labels { nodes { id name color } }
        assignee { name email }
        createdAt
        updatedAt

        # Get ALL comments with full details
        comments(first: 50) {
          nodes {
            id
            body
            createdAt
            updatedAt
            user {
              name
              email
              displayName
              isMe
            }
            url
          }
        }

        # Get ALL attachments
        attachments {
          nodes {
            id
            title
            subtitle
            url
            createdAt
            updatedAt
            metadata
            source
            sourceType
            creator {
              name
              email
            }
          }
        }
      }
    }
  `;

  return await queryLinear(query, { issueId: issueKey });
}

async function main() {
  console.log('🔬 Analyzing Agent Behavior on ENG-320...\n');
  console.log('═'.repeat(70));

  try {
    const data = await analyzeIssue('ENG-320');
    const issue = data.issue;

    // ANALYSIS 1: Agent Comment Patterns
    console.log('\n📝 AGENT COMMENTS ANALYSIS');
    console.log('═'.repeat(70));

    const agentComments = issue.comments.nodes.filter((c: any) => {
      const body = c.body.toLowerCase();
      const user = (c.user?.name || c.user?.displayName || '').toLowerCase();
      return body.includes('cursor') || body.includes('engine') || body.includes('cyrus') ||
             user.includes('cursor') || user.includes('engine') || user.includes('cyrus');
    });

    if (agentComments.length === 0) {
      console.log('⚠️  No agent comments found');
    } else {
      agentComments.forEach((comment: any, idx: number) => {
        console.log(`\n${idx + 1}. Agent: ${comment.user?.displayName || comment.user?.name || 'Unknown'}`);
        console.log(`   User Email: ${comment.user?.email || 'N/A'}`);
        console.log(`   Posted: ${new Date(comment.createdAt).toLocaleString()}`);
        console.log(`   Comment ID: ${comment.id}`);
        console.log(`   URL: ${comment.url || 'N/A'}`);
        console.log('\n   --- FULL COMMENT BODY ---');
        console.log(comment.body);
        console.log('   ' + '-'.repeat(60));

        // Parse for PR links
        const githubLinks = comment.body.match(/https?:\/\/github\.com\/[^\s)]+/g) || [];
        const prLinks = githubLinks.filter((link: string) => link.includes('/pull/'));

        if (prLinks.length > 0) {
          console.log(`\n   ✅ PR LINKS FOUND:`);
          prLinks.forEach((link: string) => {
            const match = link.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
            if (match) {
              console.log(`      → ${match[1]}/${match[2]} #${match[3]}`);
              console.log(`        ${link}`);
            }
          });
        } else {
          console.log(`\n   ⚠️  No GitHub PR links in comment`);
        }
      });
    }

    // ANALYSIS 2: Attachments (Linear's official PR tracking)
    console.log('\n\n📎 ATTACHMENTS ANALYSIS (Linear\'s Official PR Links)');
    console.log('═'.repeat(70));

    const attachments = issue.attachments.nodes;

    if (attachments.length === 0) {
      console.log('\n⚠️  NO ATTACHMENTS FOUND');
      console.log('\nThis means:');
      console.log('  • PRs are not linked to Linear yet');
      console.log('  • PRs need one of:');
      console.log('    1. Branch name containing "ENG-320"');
      console.log('    2. PR title containing "ENG-320"');
      console.log('    3. PR description with magic word + "ENG-320" (e.g., "Refs ENG-320")');
      console.log('\n  Without attachments, Linear webhooks won\'t fire for PR events!');
    } else {
      attachments.forEach((att: any, idx: number) => {
        console.log(`\n${idx + 1}. ${att.title}`);
        console.log(`   Attachment ID: ${att.id}`);
        console.log(`   URL: ${att.url}`);
        console.log(`   Subtitle: ${att.subtitle || 'N/A'}`);
        console.log(`   Source: ${att.source || 'N/A'} (${att.sourceType || 'N/A'})`);
        console.log(`   Creator: ${att.creator?.name || 'N/A'}`);
        console.log(`   Created: ${new Date(att.createdAt).toLocaleString()}`);
        console.log(`   Updated: ${new Date(att.updatedAt).toLocaleString()}`);

        if (att.metadata) {
          console.log('\n   Metadata:');
          console.log(JSON.stringify(att.metadata, null, 4));
        }
      });
    }

    // ANALYSIS 3: Gap Analysis
    console.log('\n\n🔍 GAP ANALYSIS: What We Can/Can\'t Track');
    console.log('═'.repeat(70));

    const hasAttachments = attachments.length > 0;
    const hasPRLinksInComments = agentComments.some((c: any) =>
      c.body.match(/https?:\/\/github\.com\/[^\s)]+\/pull\/\d+/)
    );

    console.log('\n✅ WHAT WE CAN TRACK (from Linear Webhooks):');
    console.log('   • Issues labeled "arena:ready" (via Issue webhook)');
    console.log('   • Agent dispatch via comments (we post them)');
    if (hasAttachments) {
      console.log('   • PRs via Attachments (when Linear auto-links them) ✅');
      console.log('   • PR status changes (merged/closed) via Attachment updates ✅');
    } else {
      console.log('   • PRs via Attachments... ⚠️  NOT HAPPENING YET');
    }

    console.log('\n⚠️  WHAT WE MIGHT MISS (if PRs aren\'t linked):');
    console.log('   • Agent PR activity if branch/title/description lacks issue key');
    console.log('   • PR commit counts (need GitHub API polling or webhook)');
    console.log('   • Exact merge timestamps (need GitHub API)');

    if (hasPRLinksInComments && !hasAttachments) {
      console.log('\n⚠️  CURRENT ISSUE DETECTED:');
      console.log('   • Agents ARE posting PR links in comments');
      console.log('   • But Linear is NOT creating attachments');
      console.log('   • This means: PRs aren\'t properly linked to issue');
      console.log('\n   SOLUTION: Agents need to add "Refs ENG-320" to PR descriptions');
      console.log('             OR use branch name like "eng-320--feature--agent-cursor"');
    }

    // ANALYSIS 4: What Info Is Available
    console.log('\n\n📊 DATA AVAILABILITY FOR TRACKING');
    console.log('═'.repeat(70));

    console.log('\nFrom LINEAR COMMENTS (agent responses):');
    console.log('   ✅ Agent name/identity');
    console.log('   ✅ Timestamp of response');
    console.log('   ✅ Agent message/status');
    if (hasPRLinksInComments) {
      console.log('   ✅ PR links (in comment text)');
      console.log('   ⚠️  But NOT official/trackable unless linked as attachments!');
    } else {
      console.log('   ❌ PR links (not in comments)');
    }

    console.log('\nFrom LINEAR ATTACHMENTS (official PR links):');
    if (hasAttachments) {
      console.log('   ✅ PR URL and number');
      console.log('   ✅ PR title');
      console.log('   ✅ PR status (from subtitle)');
      console.log('   ✅ Attachment ID (for webhook tracking)');
      console.log('   ⚠️  Commit count: Approximate (need GitHub API for exact)');
    } else {
      console.log('   ❌ None - no attachments created yet');
    }

    console.log('\nFrom GITHUB API (polling in M4):');
    console.log('   ✅ Exact commit count');
    console.log('   ✅ Precise merge/close timestamps');
    console.log('   ✅ CI status');
    console.log('   ✅ PR state verification');

    // ANALYSIS 5: Recommendations
    console.log('\n\n💡 RECOMMENDATIONS FOR MILESTONE 2');
    console.log('═'.repeat(70));

    if (!hasAttachments && hasPRLinksInComments) {
      console.log('\n⚠️  CRITICAL: Agents are posting PRs but not linking them!');
      console.log('\nOption 1: Parse PR links from agent comments');
      console.log('   Pros: Can track PRs even if not officially linked');
      console.log('   Cons: No Linear webhook updates, need more GitHub API calls');
      console.log('   Implementation: Add comment parsing to Linear webhook handler');
      console.log('\nOption 2: Enforce proper PR linking (RECOMMENDED)');
      console.log('   Pros: Uses Linear\'s native attachment system + webhooks');
      console.log('   Cons: Need to update agent dispatch template');
      console.log('   Implementation: Tell agents to use branch names or magic words');
      console.log('\nOption 3: Hybrid approach');
      console.log('   - Parse comments for immediate tracking');
      console.log('   - Update to official attachment when Linear links it');
      console.log('   - Use GitHub polling to enrich data');
    } else if (hasAttachments) {
      console.log('\n✅ PRs are properly linked via attachments!');
      console.log('   Current plan (M2 → Linear webhooks) will work perfectly.');
    } else {
      console.log('\n⏳ No PRs posted yet. Wait for agents to respond.');
    }

    console.log('\n\n✨ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

