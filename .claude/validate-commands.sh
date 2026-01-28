#!/bin/bash
# Validate all commands.json files
# Checks JSON syntax, required fields, and command definitions

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

GLOBAL_CONFIG="$HOME/.claude/commands.json"
OPTA_ROOT="/Users/matthewbyrden/Documents/Opta"
FOLDER_CONFIG="$OPTA_ROOT/3. Matthew x Opta/3. agent-config/.claude/commands.json"

# Find all project configs
PROJECT_CONFIGS=()
while IFS= read -r -d '' config; do
    PROJECT_CONFIGS+=("$config")
done < <(find "$OPTA_ROOT" -name "commands.json" -path "*/.claude/*" -print0 2>/dev/null)

echo -e "${BLUE}🔍 Validating Command Configurations...${NC}\n"

# Track overall status
ALL_VALID=true

validate_config() {
    local config_file="$1"
    local config_name="$2"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📄 $config_name${NC}"
    echo -e "   Path: $config_file"

    if [[ ! -f "$config_file" ]]; then
        echo -e "   ${RED}❌ File not found${NC}\n"
        return 1
    fi

    # Test 1: Valid JSON
    if ! jq empty "$config_file" 2>/dev/null; then
        echo -e "   ${RED}❌ INVALID JSON${NC}"
        echo -e "   ${YELLOW}Error:${NC}"
        jq empty "$config_file" 2>&1 | head -3 | sed 's/^/      /'
        echo ""
        ALL_VALID=false
        return 1
    fi
    echo -e "   ${GREEN}✅ Valid JSON${NC}"

    # Test 2: Has required fields
    if ! jq -e '.version' "$config_file" &>/dev/null; then
        echo -e "   ${RED}❌ Missing 'version' field${NC}"
        ALL_VALID=false
    else
        local version=$(jq -r '.version' "$config_file")
        echo -e "   ${GREEN}✅ Version: $version${NC}"
    fi

    if ! jq -e '.commands' "$config_file" &>/dev/null; then
        echo -e "   ${RED}❌ Missing 'commands' object${NC}"
        ALL_VALID=false
    else
        local cmd_count=$(jq '.commands | length' "$config_file")
        echo -e "   ${GREEN}✅ Commands: $cmd_count defined${NC}"

        # Test 3: Validate each command
        local invalid_cmds=0
        while IFS= read -r cmd_name; do
            # Check required fields for each command
            if ! jq -e ".commands[\"$cmd_name\"].description" "$config_file" &>/dev/null; then
                echo -e "   ${RED}   ❌ $cmd_name: Missing 'description'${NC}"
                ((invalid_cmds++))
            fi
            if ! jq -e ".commands[\"$cmd_name\"].type" "$config_file" &>/dev/null; then
                echo -e "   ${RED}   ❌ $cmd_name: Missing 'type'${NC}"
                ((invalid_cmds++))
            fi
            if ! jq -e ".commands[\"$cmd_name\"].action" "$config_file" &>/dev/null; then
                echo -e "   ${RED}   ❌ $cmd_name: Missing 'action'${NC}"
                ((invalid_cmds++))
            fi

            # Validate command type
            local cmd_type=$(jq -r ".commands[\"$cmd_name\"].type // \"none\"" "$config_file")
            if [[ ! "$cmd_type" =~ ^(bash|skill|tool|agent|composite)$ ]]; then
                echo -e "   ${RED}   ❌ $cmd_name: Invalid type '$cmd_type'${NC}"
                ((invalid_cmds++))
            fi
        done < <(jq -r '.commands | keys[]' "$config_file" 2>/dev/null)

        if [[ $invalid_cmds -gt 0 ]]; then
            echo -e "   ${RED}❌ $invalid_cmds invalid command(s)${NC}"
            ALL_VALID=false
        else
            echo -e "   ${GREEN}✅ All commands valid${NC}"
        fi
    fi

    # Test 4: Check aliases
    if jq -e '.aliases' "$config_file" &>/dev/null; then
        local alias_count=$(jq '.aliases | length' "$config_file")
        echo -e "   ${GREEN}✅ Aliases: $alias_count defined${NC}"

        # Validate aliases point to existing commands
        local invalid_aliases=0
        while IFS= read -r alias; do
            local target=$(jq -r ".aliases[\"$alias\"]" "$config_file")
            if ! jq -e ".commands[\"$target\"]" "$config_file" &>/dev/null; then
                echo -e "   ${RED}   ❌ Alias $alias → $target (command not found)${NC}"
                ((invalid_aliases++))
            fi
        done < <(jq -r '.aliases | keys[]' "$config_file" 2>/dev/null)

        if [[ $invalid_aliases -gt 0 ]]; then
            echo -e "   ${RED}❌ $invalid_aliases invalid alias(es)${NC}"
            ALL_VALID=false
        fi
    fi

    # Test 5: Check for duplicate command names across aliases
    local all_cmds=$(jq -r '(.commands | keys[]), (.aliases | keys[])' "$config_file" 2>/dev/null | sort)
    local duplicates=$(echo "$all_cmds" | uniq -d)
    if [[ -n "$duplicates" ]]; then
        echo -e "   ${YELLOW}⚠️  Duplicate names (command exists as both command and alias):${NC}"
        echo "$duplicates" | sed 's/^/      /'
    fi

    echo ""
}

# Validate global config
if [[ -f "$GLOBAL_CONFIG" ]]; then
    validate_config "$GLOBAL_CONFIG" "Global Commands"
fi

# Validate folder config
if [[ -f "$FOLDER_CONFIG" ]]; then
    validate_config "$FOLDER_CONFIG" "Opta Folder Commands"
fi

# Validate project configs
for project_config in "${PROJECT_CONFIGS[@]}"; do
    project_name=$(basename "$(dirname "$(dirname "$project_config")")")
    validate_config "$project_config" "Project: $project_name"
done

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [[ "$ALL_VALID" == true ]]; then
    echo -e "${GREEN}✅ ALL CONFIGURATIONS VALID${NC}\n"
    exit 0
else
    echo -e "${RED}❌ VALIDATION FAILED - Fix errors above${NC}\n"
    exit 1
fi
