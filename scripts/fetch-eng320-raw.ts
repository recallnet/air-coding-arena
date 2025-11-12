#!/usr/bin/env tsx
/**
 * Fetch Complete Raw JSON for ENG-320
 *
 * This script queries ALL available data from Linear's GraphQL API
 * for issue ENG-320 including complete comment history, attachments,
 * state history, and full metadata.
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
  console.error('❌ LINEAR_API_KEY not found in .env.local');
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

async function fetchCompleteIssueData(issueKey: string) {
  const query = `
    query GetIssueComplete($issueId: String!) {
      issue(id: $issueId) {
        id
        identifier
        title
        description
        url
        priority
        priorityLabel
        estimate
        state {
          id
          name
          type
          color
        }
        team {
          id
          key
          name
        }
        assignee {
          id
          name
          email
          displayName
        }
        creator {
          id
          name
          email
          displayName
        }
        labels {
          nodes {
            id
            name
            color
            createdAt
          }
        }
        comments {
          nodes {
            id
            body
            createdAt
            updatedAt
            editedAt
            user {
              id
              name
              email
              displayName
            }
            parent {
              id
            }
          }
        }
        attachments {
          nodes {
            id
            title
            subtitle
            url
            sourceType
            metadata
            groupBySource
            createdAt
            updatedAt
            creator {
              id
              name
              email
            }
          }
        }
        history {
          nodes {
            id
            createdAt
            updatedAt
            fromState {
              id
              name
              type
            }
            toState {
              id
              name
              type
            }
            fromAssignee {
              id
              name
            }
            toAssignee {
              id
              name
            }
            actor {
              id
              name
              email
            }
          }
        }
        subscribers {
          nodes {
            id
            name
            email
          }
        }
        relations {
          nodes {
            id
            type
            relatedIssue {
              id
              identifier
              title
            }
          }
        }
        createdAt
        updatedAt
        archivedAt
        canceledAt
        completedAt
        startedAt
        autoArchivedAt
        autoClosedAt
        snoozedUntilAt
        triagedAt
      }
    }
  `;

  return await queryLinear(query, { issueId: issueKey });
}

async function main() {
  console.log('🔍 Fetching COMPLETE raw data for ENG-320...\n');

  try {
    const data = await fetchCompleteIssueData('ENG-320');

    console.log('═══════════════════════════════════════════════════════');
    console.log('RAW JSON DATA (Copy this entire block)');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(JSON.stringify(data, null, 2));

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('END OF RAW JSON DATA');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error fetching issue details:', error);
    process.exit(1);
  }
}

main();
