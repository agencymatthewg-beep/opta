# Auto Task: Add JSON output mode to Opta CLI

## Why now
JSON output is now standard across Claude Code, OpenCode, and Gemini CLI. This is a HIGH gap (score 3) and small-scope implementation.

## Scope (target <200 LOC)
- Add `--output-format json` and short alias `-o json` to non-interactive commands (`opta do`)
- Output structured JSON envelope:
  - `status` (`ok|error`)
  - `model`
  - `text`
  - `tool_calls` (optional)
  - `timings_ms` (optional)
- Keep default human-readable output unchanged.

## Constraints
- No breaking changes to existing CLI flags.
- Do not alter interactive REPL rendering.
- Preserve exit codes.

## Context files
- `src/cli/commands/do.ts`
- `src/cli/args.ts`
- `src/core/session/*` (response shape)

## Validation checklist
- `opta do "hello" --output-format json` emits valid JSON
- `opta do "hello" -o json` emits valid JSON
- `opta do "hello"` unchanged text output
- Error path returns valid JSON + non-zero exit code

## Definition of done
- Feature implemented under 200 LOC (excluding tests)
- Unit test for output formatter
- Docs snippet added to command help
