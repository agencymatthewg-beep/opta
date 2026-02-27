#!/bin/bash
# Hook: tool.post | matcher: edit_file|write_file|multi_edit
# Auto-lints files after modification based on file extension.
#
# Config example:
#   { "event": "tool.post", "matcher": "edit_file|write_file|multi_edit", "command": ".opta/hooks/auto-lint.sh", "timeout": 15000 }

FILE=$(echo "$OPTA_TOOL_ARGS" | jq -r '.path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0
case "${FILE##*.}" in
  ts|tsx|js|jsx) npx eslint --fix "$FILE" 2>/dev/null ;;
  py) ruff check --fix "$FILE" 2>/dev/null ;;
esac
exit 0
