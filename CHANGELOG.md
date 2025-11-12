# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Comprehensive State Machine Tests**: Added comprehensive test coverage for XState machines
  - Added path coverage tests using `@xstate/graph`'s `getShortestPaths()` to verify all states are reachable
  - Added all state path tests (not just happy path) for both agent and issue machines
  - Added invalid transition tests to verify no-op behavior on illegal state changes
  - Added missing PR_CLOSED transition test for agent machine
  - Total: 34 tests (18 agent tests + 16 issue tests) - all passing
  - Coverage: 100% statements, 100% branches, 100% functions, 100% lines on both machines
  - Files: `src/machines/agentMachine.test.ts`, `src/machines/issueMachine.test.ts`

- **Milestone 3: Automatic Agent Dispatch** 🎉
  - Integrated idempotent agent dispatch into state machine sync flow
  - Automatically dispatches configured agents to issues with `arena:ready` label
  - Only dispatches agents not already mentioned in Linear comments (idempotent)
  - Only dispatches to open/in_progress issues (status-aware)
  - Generates branch names following pattern: `<ISSUE-KEY>--<title-slug>--agent-<name>`
  - Posts Linear comments with branch template and PR body instructions
  - Self-healing: catches mid-flight issues where agents were mentioned before webhook
  - End-to-end tested with ENG-320: detected 3 existing agents + dispatched 1 missing agent
  - Architecture: dispatch happens during `syncIssueFromLinear()` API sync, not webhooks
  - Files: `src/lib/agent-dispatch.ts`, integrated into `src/lib/linear-sync.ts`

### Fixed

- **Linear Sync PR Extraction**: Fixed `syncIssueFromLinear` to extract GitHub PR links from Linear comment bodies. Previously only processed PR attachments, but agents (Cursor, Engine, Cyrus) post PR links directly in comment bodies, not as separate attachments.
  - Implemented two-phase comment processing: build agent mention map, then extract PRs with full context
  - Added intelligent agent detection with fallback chain: same comment → body analysis → nearby older comments → nearby newer comments → "unknown"
  - Automatically updates agent status from "pending" to "submitted" when PR is detected
  - See `docs/LINEAR_SYNC.md` for technical details

### Added

- **GitHub-Style Issue Activity Table**: Enhanced main page table with richer UX
  - Clickable rows navigate to issue detail pages
  - External link icon for direct Linear navigation (shows on hover)
  - Agent progress indicators ("2/3 in progress", "1/3 complete", etc.)
  - Colored left borders distinguish open (green) vs closed (purple) issues
  - Full keyboard accessibility (Enter/Space to activate rows)
  - Test coverage maintained at 94.94% statements, 90% branches

## [1.0.0] - 2025-11-11

### Added

- Initial release with Linear integration
- GitHub webhook processing
- Agent leaderboard
- Issue and attempt tracking
