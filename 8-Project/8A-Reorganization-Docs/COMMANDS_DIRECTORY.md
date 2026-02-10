# 📖 OPTA COMMANDS DIRECTORY

**Central registry of all custom commands across Global, Folder, and Project levels**

**Last Auto-Updated:** 2026-01-28 17:18:30

---

## 📊 COMMAND COUNT SUMMARY

| Level | Commands | Aliases | Config File |
|-------|----------|---------|-------------|
| Global | 3 | 3 | `~/.claude/commands.json` |
| Folder (Opta) | 6 | 5 | `/Opta/.claude/commands.json` |
| Opta MacOS | 9 | 5 | `/Opta MacOS/.claude/commands.json` |

**Total Commands:** 18

---

## 🌍 GLOBAL COMMANDS

**Config:** `~/.claude/commands.json`
**Scope:** Available everywhere on this Mac

| Command | Alias | Description | Type | Action |
|---------|-------|-------------|------|--------|
| `//note` | `-` | Quick note to personal notes file | bash | echo '## $(date +"%Y-%m-%d %H:%M")\n{{prompt}}\n' >> ~/.personal/notes.md && echo '✅ Note saved to ~/.personal/notes.md' |
| `//cal` | `-` | Check today's calendar | tool | Read |
| `//hw` | `-` | Check hardware info | tool | Read |

### Quick Copy-Paste for Import

#### Command: /cal
    {
      "description": "Check today's calendar",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": "~/.personal/calendar.md"
      }
    }

#### Command: /hw
    {
      "description": "Check hardware info",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": "~/.personal/hardware.md"
      }
    }

#### Command: /note
    {
      "description": "Quick note to personal notes file",
      "type": "bash",
      "action": "echo '## $(date +\"%Y-%m-%d %H:%M\")\\n{{prompt}}\\n' >> ~/.personal/notes.md && echo '✅ Note saved to ~/.personal/notes.md'"
    }


---

## 📁 FOLDER COMMANDS (OPTA)

**Config:** `/Opta/.claude/commands.json`
**Scope:** All projects within Opta folder

| Command | Alias | Description | Type | Action |
|---------|-------|-------------|------|--------|
| `//gu` | `-` | Generate visual guide with Gemini (Mermaid diagram) | skill | gemini |
| `//design` | `-` | Show Opta design system | tool | Read |
| `//status` | `-` | Check Opta project status across all apps | composite | null |
| `//rust` | `-` | Navigate to Rust core and show info | bash | cd opta-native && pwd && echo '\n=== Workspace Members ===' && cargo metadata --no-deps --format-version 1 | jq -r '.workspace_members[]' 2>/dev/null || ls -la |
| `//apps` | `-` | List all Opta apps | bash | echo '=== iOS Apps ===' && ls -1 'Opta iOS' 2>/dev/null | grep -E '\.xcodeproj$|\.xcworkspace$' | sed 's/\..*$//' && echo '\n=== Desktop Apps ===' && ls -1 'Opta MacOS' 'Opta Mini' 2>/dev/null && echo '\n=== Web Apps ===' && ls -1 'opta-life-manager' 'optamize-website' 2>/dev/null |
| `//research` | `-` | Search Gemini Deep Research files | bash | find 'Gemini Deep Research' -name '*.html' -o -name '*.md' 2>/dev/null | head -20 |

### Quick Copy-Paste for Import

#### Command: /apps
    {
      "description": "List all Opta apps",
      "type": "bash",
      "action": "echo '=== iOS Apps ===' && ls -1 'Opta iOS' 2>/dev/null | grep -E '\\.xcodeproj$|\\.xcworkspace$' | sed 's/\\..*$//' && echo '\\n=== Desktop Apps ===' && ls -1 'Opta MacOS' 'Opta Mini' 2>/dev/null && echo '\\n=== Web Apps ===' && ls -1 'opta-life-manager' 'optamize-website' 2>/dev/null"
    }

#### Command: /design
    {
      "description": "Show Opta design system",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": "Opta MacOS/DESIGN_SYSTEM.md"
      }
    }

#### Command: /gu
    {
      "description": "Generate visual guide with Gemini (Mermaid diagram)",
      "type": "skill",
      "action": "gemini",
      "args": "Create a comprehensive visual diagram using Mermaid syntax showing: {{prompt}}. Use graph TD format with color coding, clear hierarchy, and detailed labels. Output ONLY the mermaid code block.",
      "options": {
        "model": "gemini-2.5-flash"
      }
    }

#### Command: /research
    {
      "description": "Search Gemini Deep Research files",
      "type": "bash",
      "action": "find 'Gemini Deep Research' -name '*.html' -o -name '*.md' 2>/dev/null | head -20"
    }

#### Command: /rust
    {
      "description": "Navigate to Rust core and show info",
      "type": "bash",
      "action": "cd opta-native && pwd && echo '\\n=== Workspace Members ===' && cargo metadata --no-deps --format-version 1 | jq -r '.workspace_members[]' 2>/dev/null || ls -la"
    }

#### Command: /status
    {
      "description": "Check Opta project status across all apps",
      "type": "composite",
      "steps": [
        {
          "type": "bash",
          "action": "echo '=== Git Status ===' && git status -s"
        },
        {
          "type": "bash",
          "action": "echo '\\n=== Planning Status ===' && cat .planning/STATE.md 2>/dev/null || echo 'No STATE.md found'"
        }
      ]
    }


---

## 🖥️ PROJECT COMMANDS


### Opta MacOS

**Config:** `/Users/matthewbyrden/Documents/Opta/Opta MacOS/.claude/commands.json`
**Scope:** Only within Opta MacOS project

| Command | Alias | Description | Type | Action |
|---------|-------|-------------|------|--------|
| `//dev` | `-` | Start Tauri dev server | bash | npm run dev |
| `//build` | `-` | Build macOS .dmg installer | bash | npm run build:dmg |
| `//build:app` | `-` | Build .app bundle only (faster) | bash | npm run build:app |
| `//test` | `-` | Run frontend tests | bash | npm test |
| `//lint` | `-` | Lint and auto-fix code | bash | npm run lint -- --fix |
| `//clean` | `-` | Clean build artifacts | bash | rm -rf dist/ src-tauri/target/ node_modules/.cache/ && echo '✅ Cleaned build artifacts' |
| `//ring` | `-` | Show Opta Ring animation spec | tool | Read |
| `//mcp` | `-` | Check MCP server status | bash | cd mcp-server && uv run python -c 'from opta_mcp.telemetry import get_system_snapshot; print(get_system_snapshot())' |
| `//versions` | `-` | Show version info for all dependencies | bash | ./scripts/run-version.sh |

#### Quick Copy-Paste for Import

##### Command: /build
    {
      "description": "Build macOS .dmg installer",
      "type": "bash",
      "action": "npm run build:dmg",
      "confirmation": true,
      "confirmMessage": "Build production .dmg? (takes ~5 min)",
      "workingDirectory": "."
    }

##### Command: /build:app
    {
      "description": "Build .app bundle only (faster)",
      "type": "bash",
      "action": "npm run build:app",
      "workingDirectory": "."
    }

##### Command: /clean
    {
      "description": "Clean build artifacts",
      "type": "bash",
      "action": "rm -rf dist/ src-tauri/target/ node_modules/.cache/ && echo '✅ Cleaned build artifacts'",
      "workingDirectory": "."
    }

##### Command: /dev
    {
      "description": "Start Tauri dev server",
      "type": "bash",
      "action": "npm run dev",
      "background": true,
      "workingDirectory": "."
    }

##### Command: /lint
    {
      "description": "Lint and auto-fix code",
      "type": "bash",
      "action": "npm run lint -- --fix",
      "workingDirectory": "."
    }

##### Command: /mcp
    {
      "description": "Check MCP server status",
      "type": "bash",
      "action": "cd mcp-server && uv run python -c 'from opta_mcp.telemetry import get_system_snapshot; print(get_system_snapshot())'"
    }

##### Command: /ring
    {
      "description": "Show Opta Ring animation spec",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": ".claude/skills/opta-ring-animation.md"
      }
    }

##### Command: /test
    {
      "description": "Run frontend tests",
      "type": "bash",
      "action": "npm test",
      "workingDirectory": "."
    }

##### Command: /versions
    {
      "description": "Show version info for all dependencies",
      "type": "bash",
      "action": "./scripts/run-version.sh",
      "workingDirectory": "."
    }


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
