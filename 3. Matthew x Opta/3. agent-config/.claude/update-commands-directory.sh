#!/bin/bash
# Auto-update COMMANDS_DIRECTORY.md from all commands.json files
# Usage: ./update-commands-directory.sh

set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

OPTA_ROOT="/Users/matthewbyrden/Documents/Opta"
OUTPUT="$OPTA_ROOT/COMMANDS_DIRECTORY.md"
TEMP="/tmp/commands-directory-update.md"

# Config files to scan
GLOBAL_CONFIG="$HOME/.claude/commands.json"
FOLDER_CONFIG="$OPTA_ROOT/.claude/commands.json"
PROJECT_CONFIGS=(
    "$OPTA_ROOT/Opta MacOS/.claude/commands.json"
    "$OPTA_ROOT/Opta Mini/.claude/commands.json"
    "$OPTA_ROOT/Opta iOS/.claude/commands.json"
)

echo -e "${BLUE}📝 Updating Commands Directory...${NC}"

# Function to generate command table from JSON
generate_command_table() {
    local config_file="$1"
    local level_name="$2"

    if [[ ! -f "$config_file" ]]; then
        echo "| - | - | No commands defined yet | - | - |"
        return
    fi

    # Extract commands and format as table
    jq -r '
        .commands | to_entries[] |
        "| `/\(.key)` | `\(.value.alias // "-")` | \(.value.description) | \(.value.type) | \(.value.action) |"
    ' "$config_file" 2>/dev/null || echo "| - | - | Error reading config | - | - |"
}

# Function to extract command definition for copy-paste
extract_command_def() {
    local config_file="$1"
    local cmd_name="$2"

    if [[ ! -f "$config_file" ]]; then
        return
    fi

    echo '```json'
    jq ".commands[\"$cmd_name\"]" "$config_file" 2>/dev/null
    echo '```'
}

# Start generating document
cat > "$TEMP" << EOF
# 📖 OPTA COMMANDS DIRECTORY

**Central registry of all custom commands across Global, Folder, and Project levels**

**Last Auto-Updated:** $(date +"%Y-%m-%d %H:%M:%S")

---

## 📊 COMMAND COUNT SUMMARY

| Level | Commands | Aliases | Config File |
|-------|----------|---------|-------------|
| Global | $(jq '.commands | length' "$GLOBAL_CONFIG" 2>/dev/null || echo 0) | $(jq '.aliases | length' "$GLOBAL_CONFIG" 2>/dev/null || echo 0) | \`~/.claude/commands.json\` |
| Folder (Opta) | $(jq '.commands | length' "$FOLDER_CONFIG" 2>/dev/null || echo 0) | $(jq '.aliases | length' "$FOLDER_CONFIG" 2>/dev/null || echo 0) | \`/Opta/.claude/commands.json\` |
| Opta MacOS | $(jq '.commands | length' "$OPTA_ROOT/Opta MacOS/.claude/commands.json" 2>/dev/null || echo 0) | $(jq '.aliases | length' "$OPTA_ROOT/Opta MacOS/.claude/commands.json" 2>/dev/null || echo 0) | \`/Opta MacOS/.claude/commands.json\` |

**Total Commands:** $(( $(jq '.commands | length' "$GLOBAL_CONFIG" 2>/dev/null || echo 0) + $(jq '.commands | length' "$FOLDER_CONFIG" 2>/dev/null || echo 0) + $(jq '.commands | length' "$OPTA_ROOT/Opta MacOS/.claude/commands.json" 2>/dev/null || echo 0) ))

---

## 🌍 GLOBAL COMMANDS

**Config:** \`~/.claude/commands.json\`
**Scope:** Available everywhere on this Mac

| Command | Alias | Description | Type | Action |
|---------|-------|-------------|------|--------|
EOF

generate_command_table "$GLOBAL_CONFIG" "Global" >> "$TEMP"

cat >> "$TEMP" << 'EOF'

### Quick Copy-Paste for Import

EOF

# Add each global command as a copy-pastable block
if [[ -f "$GLOBAL_CONFIG" ]]; then
    jq -r '.commands | keys[]' "$GLOBAL_CONFIG" 2>/dev/null | while read -r cmd; do
        echo "#### Command: $cmd" >> "$TEMP"
        jq ".commands[\"$cmd\"]" "$GLOBAL_CONFIG" 2>/dev/null | sed 's/^/    /' >> "$TEMP"
        echo "" >> "$TEMP"
    done
fi

cat >> "$TEMP" << 'EOF'

---

## 📁 FOLDER COMMANDS (OPTA)

**Config:** `/Opta/.claude/commands.json`
**Scope:** All projects within Opta folder

| Command | Alias | Description | Type | Action |
|---------|-------|-------------|------|--------|
EOF

generate_command_table "$FOLDER_CONFIG" "Folder" >> "$TEMP"

cat >> "$TEMP" << 'EOF'

### Quick Copy-Paste for Import

EOF

# Add each folder command
if [[ -f "$FOLDER_CONFIG" ]]; then
    jq -r '.commands | keys[]' "$FOLDER_CONFIG" 2>/dev/null | while read -r cmd; do
        echo "#### Command: $cmd" >> "$TEMP"
        jq ".commands[\"$cmd\"]" "$FOLDER_CONFIG" 2>/dev/null | sed 's/^/    /' >> "$TEMP"
        echo "" >> "$TEMP"
    done
fi

cat >> "$TEMP" << 'EOF'

---

## 🖥️ PROJECT COMMANDS

EOF

# Scan all project configs
for project_config in "${PROJECT_CONFIGS[@]}"; do
    if [[ -f "$project_config" ]]; then
        project_name=$(basename "$(dirname "$(dirname "$project_config")")")

        cat >> "$TEMP" << EOF

### $project_name

**Config:** \`$project_config\`
**Scope:** Only within $project_name project

| Command | Alias | Description | Type | Action |
|---------|-------|-------------|------|--------|
EOF

        generate_command_table "$project_config" "$project_name" >> "$TEMP"

        cat >> "$TEMP" << 'EOF'

#### Quick Copy-Paste for Import

EOF

        jq -r '.commands | keys[]' "$project_config" 2>/dev/null | while read -r cmd; do
            echo "##### Command: $cmd" >> "$TEMP"
            jq ".commands[\"$cmd\"]" "$project_config" 2>/dev/null | sed 's/^/    /' >> "$TEMP"
            echo "" >> "$TEMP"
        done
    fi
done

# Add import/export section
cat >> "$TEMP" << 'EOF'

---

## 🔄 IMPORT/EXPORT GUIDE

### Export Single Command

```bash
# Export /gu command from Opta folder
jq '.commands["/gu"]' /Users/matthewbyrden/Documents/Opta/.claude/commands.json \
  > /tmp/gu-command.json

# Now paste into another project's commands.json
```

### Import Command to Another Project

```bash
# Method 1: Manual paste
# Copy the command JSON from above sections
# Paste into target project's .claude/commands.json

# Method 2: Using jq
cd /path/to/target/project
jq '.commands["/gu"] = input' \
  .claude/commands.json \
  /tmp/gu-command.json \
  > .claude/commands-new.json
mv .claude/commands-new.json .claude/commands.json
```

### Export All Commands from a Level

```bash
# Export all Opta folder commands
jq '{version, commands, aliases}' \
  /Users/matthewbyrden/Documents/Opta/.claude/commands.json \
  > opta-commands-backup.json

# Import to another folder
cp opta-commands-backup.json /path/to/other/folder/.claude/commands.json
```

---

## 📝 COMMAND TEMPLATES

### Build Command Template

```json
{
  "/build": {
    "description": "Build production artifact",
    "type": "bash",
    "action": "npm run build",
    "confirmation": true,
    "confirmMessage": "Build production?"
  }
}
```

### Test Command Template

```json
{
  "/test": {
    "description": "Run test suite",
    "type": "bash",
    "action": "npm test"
  }
}
```

### Visual Guide Template

```json
{
  "/gu": {
    "description": "Generate visual guide",
    "type": "skill",
    "action": "gemini",
    "args": "Create visual diagram: {{prompt}}"
  }
}
```

---

## 🛠️ MAINTENANCE

### Regenerate This Document

```bash
cd /Users/matthewbyrden/Documents/Opta
./.claude/update-commands-directory.sh
```

### Validate All Configs

```bash
./.claude/validate-commands.sh
```

---

**Auto-generated by:** update-commands-directory.sh
**Manual edits:** Add them ABOVE this maintenance section
EOF

# Move temp file to output
mv "$TEMP" "$OUTPUT"

echo -e "${GREEN}✅ Updated: $OUTPUT${NC}"
echo -e "${YELLOW}📊 Total sections generated:${NC}"
echo "   - Global commands"
echo "   - Folder commands (Opta)"
echo "   - Project commands (per project)"
echo "   - Import/Export guide"
echo "   - Command templates"
