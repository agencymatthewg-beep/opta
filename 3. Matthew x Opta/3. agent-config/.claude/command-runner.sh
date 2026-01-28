#!/bin/bash
# Opta Custom Command Runner
# Executes commands defined in hierarchical commands.json files

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Command resolution order
resolve_command() {
    local cmd="$1"
    local current_dir="$(pwd)"

    # 1. Project level (./.claude/commands.json)
    if [[ -f "./.claude/commands.json" ]]; then
        local project_cmd=$(jq -r ".commands[\"$cmd\"] // .aliases[\"$cmd\"] // empty" "./.claude/commands.json" 2>/dev/null)
        if [[ -n "$project_cmd" ]]; then
            echo "project:./.claude/commands.json"
            return 0
        fi
    fi

    # 2. Folder level (search upwards for .claude/commands.json)
    local search_dir="$current_dir"
    while [[ "$search_dir" != "/" ]]; do
        if [[ -f "$search_dir/.claude/commands.json" ]]; then
            local folder_cmd=$(jq -r ".commands[\"$cmd\"] // .aliases[\"$cmd\"] // empty" "$search_dir/.claude/commands.json" 2>/dev/null)
            if [[ -n "$folder_cmd" ]]; then
                echo "folder:$search_dir/.claude/commands.json"
                return 0
            fi
        fi
        search_dir="$(dirname "$search_dir")"
    done

    # 3. Global level (~/.claude/commands.json)
    if [[ -f "$HOME/.claude/commands.json" ]]; then
        local global_cmd=$(jq -r ".commands[\"$cmd\"] // .aliases[\"$cmd\"] // empty" "$HOME/.claude/commands.json" 2>/dev/null)
        if [[ -n "$global_cmd" ]]; then
            echo "global:$HOME/.claude/commands.json"
            return 0
        fi
    fi

    echo "notfound"
    return 1
}

# Execute command
execute_command() {
    local cmd="$1"
    local config_file="$2"
    shift 2
    local args="$*"

    # Resolve alias if needed
    local resolved_cmd=$(jq -r ".aliases[\"$cmd\"] // \"$cmd\"" "$config_file" 2>/dev/null)

    # Get command definition
    local cmd_def=$(jq -r ".commands[\"$resolved_cmd\"]" "$config_file" 2>/dev/null)

    if [[ "$cmd_def" == "null" ]]; then
        echo -e "${RED}❌ Command not found: $cmd${NC}"
        return 1
    fi

    # Extract command properties
    local description=$(echo "$cmd_def" | jq -r '.description // "No description"')
    local type=$(echo "$cmd_def" | jq -r '.type')
    local action=$(echo "$cmd_def" | jq -r '.action')
    local confirmation=$(echo "$cmd_def" | jq -r '.confirmation // false')

    echo -e "${BLUE}📝 Command: $cmd${NC}"
    echo -e "${YELLOW}   $description${NC}"
    echo -e "${GREEN}   Source: $config_file${NC}"
    echo ""

    # Handle confirmation
    if [[ "$confirmation" == "true" ]]; then
        local confirm_msg=$(echo "$cmd_def" | jq -r '.confirmMessage // "Execute this command?"')
        echo -e "${YELLOW}⚠️  $confirm_msg${NC}"
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}❌ Cancelled${NC}"
            return 1
        fi
    fi

    # Substitute variables
    action=$(echo "$action" | sed "s|{{prompt}}|$args|g")
    action=$(echo "$action" | sed "s|{{cwd}}|$(pwd)|g")
    action=$(echo "$action" | sed "s|{{project}}|$(basename $(pwd))|g")

    # Execute based on type
    case "$type" in
        "bash")
            echo -e "${GREEN}▶️  Executing: $action${NC}"
            eval "$action"
            ;;
        "skill")
            echo -e "${BLUE}🤖 This would invoke Claude skill: $action${NC}"
            echo -e "${YELLOW}   (Skill execution requires Claude Code integration)${NC}"
            ;;
        "tool")
            echo -e "${BLUE}🔧 This would invoke Claude tool: $action${NC}"
            echo -e "${YELLOW}   (Tool execution requires Claude Code integration)${NC}"
            ;;
        "agent")
            echo -e "${BLUE}🤖 This would launch agent: $action${NC}"
            echo -e "${YELLOW}   (Agent execution requires Claude Code integration)${NC}"
            ;;
        "composite")
            echo -e "${BLUE}🔗 Composite command (multiple steps)${NC}"
            echo -e "${YELLOW}   (Composite execution not yet implemented)${NC}"
            ;;
        *)
            echo -e "${RED}❌ Unknown command type: $type${NC}"
            return 1
            ;;
    esac
}

# Main
main() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: command-runner.sh /command [args...]"
        echo ""
        echo "Example: command-runner.sh /build"
        echo "         command-runner.sh /gu folder structure"
        exit 1
    fi

    local cmd="$1"
    shift
    local args="$*"

    # Ensure command starts with /
    if [[ ! "$cmd" =~ ^/ ]]; then
        cmd="/$cmd"
    fi

    # Resolve command location
    local resolution=$(resolve_command "$cmd")

    if [[ "$resolution" == "notfound" ]]; then
        echo -e "${RED}❌ Command not found: $cmd${NC}"
        echo ""
        echo "Searched locations:"
        echo "  1. Project: ./.claude/commands.json"
        echo "  2. Folder:  (searching upwards)"
        echo "  3. Global:  ~/.claude/commands.json"
        exit 1
    fi

    # Extract level and config file
    local level="${resolution%%:*}"
    local config_file="${resolution#*:}"

    # Execute command
    execute_command "$cmd" "$config_file" "$args"
}

main "$@"
