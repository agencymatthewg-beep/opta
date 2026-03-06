# Changelog — Opta Help

## v1.0.2 (2026-03-06)
- Aligned Help home messaging with current Opta activation model and removed stale hero language.
- Fixed dead internal routes from homepage CTAs by linking to live docs pages.
- Added missing `LMX -> Voice & Audio` route implementation at `/docs/lmx/voice/` to match navigation/search entries.
- Updated installation docs to current CLI package name (`@opta/opta-cli`) and corrected update-check command (`opta version --check`).
- Updated CLI platform compatibility to reflect current native Windows support and current `opta serve`/`opta update` constraints.
- Updated daemon lifecycle and troubleshooting docs for cross-platform config paths, Windows service mode (`schtasks`), and current stop/restart semantics.
- Updated Code Desktop docs to match current Tauri-native architecture and secure token storage model.

## v1.0.1 (2026-03-04)
- Added `Support -> FAQ` page and fixed nav route coverage for `/docs/support/faq/`
- Added new high-priority guide sections and pages:
  - `Ecosystem` (`/docs/ecosystem/*`)
  - `Accounts` (`/docs/accounts/*`)
  - `Status` (`/docs/status/*`)
- Added synergy coverage assessment:
  - `docs/SYNERGY-ASSESSMENT-2026-03-04.md`
- Updated roadmap with synergy-driven documentation expansion backlog and P0 completion state

## v1.0.0 (2026-03-01)
- Initial release with 42 documentation pages
- 10 sections: Getting Started, CLI, Daemon, LMX, Local Web, Code Desktop, Browser Automation, Security, Developer, Feature Status
- Client-side search via flexsearch
- Obsidian glass design system from 1T-Opta-Home
