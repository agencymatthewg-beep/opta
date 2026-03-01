---
status: archived
---

# 2026-02-23 — YJS-Style Session + Update Log System (Opta CLI / "Opta LLM")

## Scope
Adopt the YJS logging conventions in Opta CLI so the project has:

1. Session logs (`12-Session-Logs/`) with consistent frontmatter and end-of-session summaries.
2. Numbered chronological update logs (`updates/{NNN}_{YYYY-MM-DD}_{slug}.md`).

This plan assumes **"Opta LLM" = `/Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS`**.

## YJS conventions to replicate
- Session filename: `YYYY-MM-DD-HHMM-{device}-{summary}.md`
- Session frontmatter: `date`, `time`, `device`, `user`, `model`, `duration`
- Session sections: `Summary`, `Files Changed`, `Status Changes`, `Decisions Made`, `Issues Encountered`, `Next Steps`, `Notes`
- Update filename: `{NNN}_{YYYY-MM-DD}_{slug}.md` (zero-padded)
- Update frontmatter: `id`, `date`, `time`, `author`, `version_before`, `version_after`, `commit`, `promoted`, `category`
- Numbering ranges:
  - `001-099` standard development updates
  - `200-299` promotion/sync updates

## Current state (already present)
- Session JSON persistence: `~/.config/opta/sessions/*.json`
- Daemon event persistence: `~/.config/opta/daemon/sessions/*/events.jsonl`
- Checkpoint metadata per session: `.opta/checkpoints/<sessionId>/index.json`
- No YJS-style markdown session/update logs today.

## Proposed architecture

### 1) Logging config block (new)
Add config section in `src/core/config.ts`:

- `journal.enabled: boolean` (default `true`)
- `journal.sessionLogsDir: string` (default `<repo>/12-Session-Logs`)
- `journal.updateLogsDir: string` (default `<repo>/updates`)
- `journal.timezone: string` (default local system TZ)
- `journal.author: string` (default from `$USER`)

### 2) Session log writer (new module)
Create `src/journal/session-log.ts`:

- Resolve target directory and ensure it exists.
- Build filename in YJS format.
- Render markdown + YAML frontmatter.
- Gather data from:
  - `Session` (`id`, `created`, `model`, `title`, `toolCallCount`, messages)
  - Checkpoint index (`.opta/checkpoints/<sessionId>/index.json`) for file list
  - Optional `git status --porcelain` snapshot for status fields
- Return written path for terminal feedback.

### 3) Update log writer (new module)
Create `src/journal/update-log.ts`:

- Determine next ID by scanning existing `updates/*.md`.
- Support ID ranges (`standard` => 001+, `promotion` => 200+).
- Generate slug + markdown template with YJS fields.
- Record command result summary (success/skip/fail counts) and components/targets.

### 4) Integrate in chat lifecycle
In `src/commands/chat.ts`:

- On all terminal session exits (`/exit`, Ctrl+C/EOF, TUI close), after `saveSession(session)`:
  - call `writeSessionLog(...)`
  - print saved path in CLI output
- Fail-open behavior: logging failure must not fail the chat exit.

### 5) Integrate in `opta do`
In `src/commands/do.ts`:

- Optional flag: `--session-log` (or config-driven auto for single-turn sessions).
- If enabled, emit a compact session log entry for one-shot tasks.

### 6) Integrate in `opta update`
In `src/commands/update.ts`:

- After results computed (JSON or human mode), write update log entry:
  - Default range: `200-299` for sync/update operations.
  - Include command options + per-step outcome table.
- If update command touched multiple components, create one summary file in CLI repo first (phase 1), and optionally fan-out per component in phase 2.

## File/folder additions
- `12-Session-Logs/README.md`
- `12-Session-Logs/SESSION_FORMAT.md`
- `updates/README.md`
- `src/journal/session-log.ts`
- `src/journal/update-log.ts`
- `tests/journal/session-log.test.ts`
- `tests/journal/update-log.test.ts`

## Test plan
- Unit tests (vitest):
  - Filename generation and frontmatter fields
  - Next-ID selection with gaps and mixed ranges
  - Slug normalization and truncation
  - Missing checkpoint/index handling
- Integration tests:
  - `chat` exit writes session log
  - `update` command writes update log in both success and failure cases

## Rollout plan
- Phase 1: CLI-only session logs + update logs in single repo (this repo)
- Phase 2: Optional cross-repo fan-out update logs for `lmx`, `plus`, `web`
- Phase 3: Add slash command surface (`/session-log`, `/update-log`) and `opta sessions export --markdown`

## Risks and mitigations
- Session end ambiguity in daemon/TUI: ensure logs are generated in top-level command handlers, not per-turn hook events.
- Dirty worktree noise in file-change section: prefer checkpoint-derived file list as primary source.
- Concurrent updates writing same ID: use atomic creation (`wx`) and retry ID allocation.

## Acceptance criteria
- Exiting `opta chat` always writes one YJS-style markdown log file.
- Running `opta update` writes one numbered update log file with monotonic IDs.
- Log directories and formats are consistent with YJS conventions.
- Existing CLI behavior is unchanged when journaling is disabled.
