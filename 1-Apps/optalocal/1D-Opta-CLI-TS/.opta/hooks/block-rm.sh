#!/bin/bash
# Hook: tool.pre | matcher: run_command
# Blocks destructive rm commands from being executed by the agent.
#
# Config example:
#   { "event": "tool.pre", "matcher": "run_command", "command": ".opta/hooks/block-rm.sh" }

CMD=$(echo "$OPTA_TOOL_ARGS" | jq -r '.command // empty' 2>/dev/null)
echo "$CMD" | grep -qE 'rm\s+(-rf?|--recursive)' && echo "Blocked: destructive rm" >&2 && exit 1
exit 0
