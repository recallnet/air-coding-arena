#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'fs';
import { agentMachine } from '../src/machines/agentMachine';
import { issueMachine } from '../src/machines/issueMachine';
import type { AnyStateMachine } from 'xstate';

/**
 * Converts an XState machine to Mermaid stateDiagram-v2 format.
 */
function toMermaid(machine: AnyStateMachine): string {
  let mermaid = '```mermaid\n';
  mermaid += 'stateDiagram-v2\n';

  // Get the initial state
  const initialState = machine.config.initial;
  if (initialState) {
    mermaid += `  [*] --> ${initialState}\n`;
  }

  // Process all states and their transitions
  const states = machine.config.states || {};
  const edges = new Set<string>();

  Object.entries(states).forEach(([stateName, stateConfig]: [string, any]) => {
    // Process transitions for this state
    const transitions = stateConfig.on || {};

    Object.entries(transitions).forEach(([eventType, transition]: [string, any]) => {
      const target = transition.target;
      if (target) {
        edges.add(`  ${stateName} --> ${target} : ${eventType}`);
      }
    });

    // Mark final states
    if (stateConfig.type === 'final') {
      mermaid += `  ${stateName} --> [*]\n`;
    }
  });

  // Add unique edges
  edges.forEach(edge => {
    mermaid += edge + '\n';
  });

  mermaid += '```';
  return mermaid;
}

/**
 * Main execution
 */
function main() {
  console.log('Generating state machine diagrams...\n');

  // Create output directory
  mkdirSync('./docs/diagrams', { recursive: true });

  // Generate Agent Machine diagram
  const agentMermaid = toMermaid(agentMachine);

  const agentDoc = `# Agent Lifecycle State Machine

**Generated from:** \`src/machines/agentMachine.ts\`
**Last Updated:** ${new Date().toISOString()}

${agentMermaid}

## States

- **pending**: Agent mentioned in Linear comment, waiting for PR
- **submitted**: PR created and linked to issue
- **accepted**: Agent's PR was merged (winner)
- **rejected**: Another agent won OR PR closed without merge
- **ignored**: Issue closed before agent submitted PR

## Events

- \`PR_SUBMITTED\`: Agent creates PR
- \`PR_MERGED\`: Agent's PR is merged
- \`OTHER_AGENT_WON\`: Different agent's PR was merged
- \`PR_CLOSED\`: Agent's PR was closed without merge
- \`ISSUE_CLOSED\`: Issue closed before PR submitted
`;

  writeFileSync('./docs/diagrams/agent-state-machine.md', agentDoc);
  console.log('✅ Generated: docs/diagrams/agent-state-machine.md');

  // Generate Issue Machine diagram
  const issueMermaid = toMermaid(issueMachine);

  const issueDoc = `# Issue Lifecycle State Machine

**Generated from:** \`src/machines/issueMachine.ts\`
**Last Updated:** ${new Date().toISOString()}

${issueMermaid}

## States

- **open**: Issue has \`arena:ready\` label, agents may be dispatched
- **in_progress**: At least one agent has submitted a PR
- **completed**: Winner selected, PR merged
- **cancelled**: \`arena:ready\` label removed OR issue closed

## Events

- \`FIRST_PR_SUBMITTED\`: First agent submits PR (any agent)
- \`PR_MERGED\`: Winner's PR is merged
- \`LABEL_REMOVED\`: \`arena:ready\` label removed from issue
- \`ISSUE_CLOSED\`: Issue closed in Linear
`;

  writeFileSync('./docs/diagrams/issue-state-machine.md', issueDoc);
  console.log('✅ Generated: docs/diagrams/issue-state-machine.md');

  console.log('\n🎉 State machine diagrams generated successfully!\n');
}

main();
