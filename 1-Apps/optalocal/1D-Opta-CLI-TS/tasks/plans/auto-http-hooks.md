# Auto Task: Add lightweight HTTP hooks (webhook callbacks)

## Why now
Claude Code added HTTP hooks and Gemini supports runtime hooks. Hook/webhook support is becoming baseline automation capability. HIGH gap (score 3).

## Scope (target <200 LOC)
- Add optional hook config in user settings:
  - `hooks.pre_tool_url`
  - `hooks.post_tool_url`
- On tool execution, POST compact JSON payload:
  - `event` (`pre_tool|post_tool`)
  - `tool_name`
  - `session_id`
  - `timestamp`
  - `status` (post only)
- Fire-and-forget with short timeout (e.g., 800ms); never block core execution.

## Constraints
- No retries in v1.
- Ignore hook failures; log debug only.
- No sensitive payload by default (no full file contents).

## Context files
- `src/config/*`
- `src/core/tools/*`
- `src/core/events/*`

## Validation checklist
- Local webhook receives `pre_tool` and `post_tool` events
- Tool execution unaffected when webhook is down
- Disabled by default
- No sensitive content leakage in payload

## Definition of done
- Config + dispatcher implemented under 200 LOC (excluding tests)
- 1 integration-style test using local mock HTTP server
- Docs note in config reference
