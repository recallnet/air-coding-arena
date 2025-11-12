# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
