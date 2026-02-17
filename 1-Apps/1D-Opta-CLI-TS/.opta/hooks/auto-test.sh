#!/bin/bash
# Hook: tool.post | matcher: edit_file|write_file | background: true
# Runs tests in the background after file modifications.
#
# Config example:
#   { "event": "tool.post", "matcher": "edit_file|write_file", "command": ".opta/hooks/auto-test.sh", "background": true }

FILE=$(echo "$OPTA_TOOL_ARGS" | jq -r '.path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0
case "${FILE##*.}" in
  ts|tsx) npm test -- --run --reporter=dot 2>&1 | tail -5 ;;
esac
exit 0
