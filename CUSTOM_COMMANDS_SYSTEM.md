# 🎯 CUSTOM COMMANDS SYSTEM

**Hierarchical Command Definition & Enforcement for Claude Code**

Define custom slash commands at three levels: Global, Folder, and Project

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMAND RESOLUTION                        │
├─────────────────────────────────────────────────────────────┤
│  User types: /gu                                            │
│                                                              │
│  1. Check Project Level   (./.claude/commands.json)        │
│  2. Check Folder Level    (../../.claude/commands.json)    │
│  3. Check Global Level    (~/.claude/commands.json)        │
│  4. Check Built-in Skills (Claude Code defaults)           │
│                                                              │
│  → Execute first match found                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ File Locations

### 1. Global Commands
**Path:** `~/.claude/commands.json`
**Scope:** All projects on this machine
**Example Use:** Personal shortcuts, machine-specific tools

### 2. Folder Commands
**Path:** `/Users/matthewbyrden/Documents/Opta/.claude/commands.json`
**Scope:** All projects within the Opta folder
**Example Use:** Opta-specific workflows

### 3. Project Commands
**Path:** `/Users/matthewbyrden/Documents/Opta/Opta MacOS/.claude/commands.json`
**Scope:** Only the Opta MacOS project
**Example Use:** Project-specific build commands

---

## 📋 Command Configuration Format

### `commands.json` Structure

```json
{
  "$schema": "https://claude.ai/schemas/commands-v1.json",
  "version": "1.0",
  "commands": {
    "/gu": {
      "description": "Generate visual guide or diagram",
      "type": "skill",
      "action": "gemini",
      "args": "generate a comprehensive visual diagram showing: {{prompt}}",
      "options": {
        "model": "gemini-2.5-flash",
        "outputFormat": "mermaid"
      }
    },
    "/build": {
      "description": "Build current project",
      "type": "bash",
      "action": "npm run build",
      "workingDirectory": ".",
      "confirmation": false
    },
    "/deploy": {
      "description": "Deploy to production",
      "type": "bash",
      "action": "./scripts/deploy.sh",
      "confirmation": true,
      "confirmMessage": "Deploy to PRODUCTION?"
    },
    "/optimize": {
      "description": "Run Opta optimizer agent",
      "type": "agent",
      "action": "opta-optimizer",
      "context": [
        ".planning/STATE.md",
        "DESIGN_SYSTEM.md"
      ]
    }
  },
  "aliases": {
    "/g": "/gu",
    "/b": "/build",
    "/d": "/deploy"
  }
}
```

---

## 🎨 Command Types

### 1. **Skill Commands**
Execute existing or custom Claude Code skills

```json
{
  "/gu": {
    "description": "Generate visual guide",
    "type": "skill",
    "action": "gemini",
    "args": "create visual diagram: {{prompt}}"
  }
}
```

**Variables:**
- `{{prompt}}` - User input after command
- `{{cwd}}` - Current working directory
- `{{project}}` - Project name

---

### 2. **Bash Commands**
Execute shell commands

```json
{
  "/test": {
    "description": "Run tests",
    "type": "bash",
    "action": "npm test",
    "workingDirectory": ".",
    "env": {
      "NODE_ENV": "test"
    }
  }
}
```

**Options:**
- `workingDirectory` - Where to run (`.` = current dir)
- `env` - Environment variables
- `confirmation` - Require user confirmation (default: false)
- `background` - Run in background (default: false)

---

### 3. **Agent Commands**
Launch specialized agents

```json
{
  "/plan": {
    "description": "Create implementation plan",
    "type": "agent",
    "action": "Plan",
    "prompt": "Create a plan for: {{prompt}}",
    "context": [
      ".planning/ROADMAP.md",
      "CLAUDE.md"
    ]
  }
}
```

**Options:**
- `action` - Agent type (Plan, Explore, general-purpose, etc.)
- `context` - Files to provide as context
- `model` - Override model (sonnet, opus, haiku)

---

### 4. **Tool Commands**
Direct tool invocations

```json
{
  "/search": {
    "description": "Search codebase",
    "type": "tool",
    "action": "Grep",
    "params": {
      "pattern": "{{prompt}}",
      "output_mode": "content"
    }
  }
}
```

---

### 5. **Composite Commands**
Chain multiple actions

```json
{
  "/ship": {
    "description": "Build, test, and deploy",
    "type": "composite",
    "steps": [
      {
        "type": "bash",
        "action": "npm run build",
        "continueOnError": false
      },
      {
        "type": "bash",
        "action": "npm test",
        "continueOnError": false
      },
      {
        "type": "bash",
        "action": "./scripts/deploy.sh",
        "confirmation": true
      }
    ]
  }
}
```

---

## 🔗 Command Aliases

Define short aliases for frequently-used commands:

```json
{
  "aliases": {
    "/g": "/gu",
    "/b": "/build",
    "/t": "/test",
    "/d": "/deploy",
    "/p": "/plan"
  }
}
```

**Rules:**
- Aliases must start with `/`
- Aliases resolve to full command names
- Aliases inherit scope (project aliases override folder aliases)

---

## 🎯 Precedence Rules

When multiple levels define the same command:

```
Project > Folder > Global > Built-in
```

**Example:**
```
~/.claude/commands.json         → /build: npm run build
/Opta/.claude/commands.json     → /build: just build
/Opta MacOS/.claude/commands.json → /build: tauri build

User is in /Opta MacOS/
User types: /build
→ Executes: tauri build (Project level wins)
```

---

## 📝 Example Configurations

### Global (`~/.claude/commands.json`)

```json
{
  "version": "1.0",
  "commands": {
    "/note": {
      "description": "Quick note to personal/notes.md",
      "type": "bash",
      "action": "echo '## $(date)\\n{{prompt}}\\n' >> ~/Documents/notes.md"
    },
    "/cal": {
      "description": "Check today's calendar",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": "~/.personal/calendar.md"
      }
    },
    "/gemini": {
      "description": "Quick Gemini query",
      "type": "skill",
      "action": "gemini",
      "args": "{{prompt}}"
    }
  },
  "aliases": {
    "/g": "/gemini",
    "/n": "/note"
  }
}
```

---

### Folder (`/Opta/.claude/commands.json`)

```json
{
  "version": "1.0",
  "commands": {
    "/gu": {
      "description": "Generate visual guide with Gemini",
      "type": "skill",
      "action": "gemini",
      "args": "Create a comprehensive visual diagram (Mermaid format) showing: {{prompt}}. Use color coding and clear hierarchy.",
      "options": {
        "model": "gemini-2.5-flash"
      }
    },
    "/design": {
      "description": "Reference Opta design system",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": "Opta MacOS/DESIGN_SYSTEM.md"
      }
    },
    "/status": {
      "description": "Check Opta project status",
      "type": "composite",
      "steps": [
        {
          "type": "tool",
          "action": "Read",
          "params": {
            "file_path": ".planning/STATE.md"
          }
        },
        {
          "type": "bash",
          "action": "git status -s"
        }
      ]
    },
    "/rust": {
      "description": "Navigate to Rust core",
      "type": "bash",
      "action": "cd opta-native && pwd && ls -la"
    }
  },
  "aliases": {
    "/g": "/gu",
    "/s": "/status",
    "/d": "/design"
  }
}
```

---

### Project (`/Opta MacOS/.claude/commands.json`)

```json
{
  "version": "1.0",
  "commands": {
    "/dev": {
      "description": "Start Tauri dev server",
      "type": "bash",
      "action": "npm run dev",
      "background": true
    },
    "/build": {
      "description": "Build macOS .dmg",
      "type": "bash",
      "action": "npm run build:dmg",
      "confirmation": true,
      "confirmMessage": "Build production .dmg? (takes ~5 min)"
    },
    "/test": {
      "description": "Run frontend tests",
      "type": "bash",
      "action": "npm test"
    },
    "/lint": {
      "description": "Lint and fix code",
      "type": "bash",
      "action": "npm run lint -- --fix"
    },
    "/ring": {
      "description": "Reference Opta Ring spec",
      "type": "tool",
      "action": "Read",
      "params": {
        "file_path": ".claude/skills/opta-ring-animation.md"
      }
    }
  },
  "aliases": {
    "/b": "/build",
    "/l": "/lint",
    "/t": "/test"
  }
}
```

---

## 🛠️ Implementation Options

### Option A: Pure Configuration (Recommended)
Store in `.claude/commands.json`, Claude Code reads and executes

**Pros:**
- No code needed
- Version controllable
- Shareable across team
- IDE-agnostic

**Cons:**
- Requires Claude Code support (may not exist yet)

---

### Option B: Shell Function Wrapper
Create a shell function that parses commands

```bash
# Add to ~/.zshrc or ~/.bashrc

# Load command configs from hierarchy
opta-cmd() {
    local cmd="$1"
    shift
    local args="$*"

    # Try project level
    if [[ -f "./.claude/commands.json" ]]; then
        # Parse and execute
    fi

    # Try folder level
    if [[ -f "../../.claude/commands.json" ]]; then
        # Parse and execute
    fi

    # Try global level
    if [[ -f "$HOME/.claude/commands.json" ]]; then
        # Parse and execute
    fi

    echo "Command not found: $cmd"
}

alias /gu='opta-cmd gu'
alias /build='opta-cmd build'
# etc.
```

---

### Option C: Claude Code Skill Extension
Create a meta-skill that reads configs

**File:** `.claude/skills/custom-commands.md`

```markdown
# Custom Commands

When the user types a command starting with `/`, check for custom command definitions in this order:

1. `./.claude/commands.json` (project)
2. `../../.claude/commands.json` (folder)
3. `~/.claude/commands.json` (global)

Parse the JSON and execute the defined action.
```

---

## 🔐 Enforcement & Validation

### Schema Validation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "commands"],
  "properties": {
    "version": {
      "type": "string",
      "enum": ["1.0"]
    },
    "commands": {
      "type": "object",
      "patternProperties": {
        "^/[a-z-]+$": {
          "type": "object",
          "required": ["description", "type", "action"],
          "properties": {
            "description": { "type": "string" },
            "type": {
              "type": "string",
              "enum": ["skill", "bash", "agent", "tool", "composite"]
            },
            "action": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

### Validation Script

```bash
#!/bin/bash
# validate-commands.sh

PROJECT_DIR="${1:-.}"
SCHEMA="$HOME/.claude/schemas/commands-v1.schema.json"

for config in \
    "$HOME/.claude/commands.json" \
    "$PROJECT_DIR/.claude/commands.json" \
    "$PROJECT_DIR/../../.claude/commands.json"
do
    if [[ -f "$config" ]]; then
        echo "Validating: $config"
        jq empty "$config" 2>/dev/null || {
            echo "❌ Invalid JSON: $config"
            exit 1
        }
        echo "✅ Valid: $config"
    fi
done
```

---

## 📚 Usage Examples

### Define a Visual Guide Command

**File:** `/Opta/.claude/commands.json`

```json
{
  "commands": {
    "/gu": {
      "description": "Generate visual guide with Mermaid diagram",
      "type": "skill",
      "action": "gemini",
      "args": "Create a Mermaid diagram showing: {{prompt}}. Use graph TD format with color coding.",
      "options": {
        "model": "gemini-2.5-flash",
        "outputFormat": "mermaid"
      }
    }
  }
}
```

**Usage:**
```
/gu folder structure for Opta project
```

**Result:**
- Claude invokes Gemini skill
- Generates Mermaid diagram
- Returns visual output

---

### Define a Build Pipeline

**File:** `/Opta MacOS/.claude/commands.json`

```json
{
  "commands": {
    "/ship": {
      "description": "Full build and deploy pipeline",
      "type": "composite",
      "steps": [
        {
          "type": "bash",
          "action": "npm run lint",
          "description": "Linting code"
        },
        {
          "type": "bash",
          "action": "npm test",
          "description": "Running tests"
        },
        {
          "type": "bash",
          "action": "npm run build:dmg",
          "description": "Building .dmg"
        },
        {
          "type": "bash",
          "action": "./scripts/notarize.sh",
          "description": "Notarizing with Apple",
          "confirmation": true
        }
      ]
    }
  }
}
```

---

## 🎯 Quick Start Guide

### 1. Create Global Commands

```bash
mkdir -p ~/.claude
cat > ~/.claude/commands.json << 'EOF'
{
  "version": "1.0",
  "commands": {
    "/note": {
      "description": "Quick note",
      "type": "bash",
      "action": "echo '{{prompt}}' >> ~/notes.md"
    }
  }
}
EOF
```

### 2. Create Opta Folder Commands

```bash
cd /Users/matthewbyrden/Documents/Opta
mkdir -p .claude
cat > .claude/commands.json << 'EOF'
{
  "version": "1.0",
  "commands": {
    "/gu": {
      "description": "Generate visual guide",
      "type": "skill",
      "action": "gemini",
      "args": "Create visual diagram: {{prompt}}"
    }
  }
}
EOF
```

### 3. Create Project Commands

```bash
cd "Opta MacOS"
mkdir -p .claude
cat > .claude/commands.json << 'EOF'
{
  "version": "1.0",
  "commands": {
    "/build": {
      "description": "Build .dmg",
      "type": "bash",
      "action": "npm run build:dmg"
    }
  }
}
EOF
```

---

## 🔄 Command Lifecycle

### Discovery
```
1. User types: /gu folder structure
2. Claude scans for commands.json files
3. Finds /gu definition in Opta/.claude/commands.json
4. Loads command configuration
```

### Execution
```
1. Parse command type (skill)
2. Substitute variables ({{prompt}})
3. Invoke skill with processed args
4. Return result to user
```

### Override
```
If /gu defined in multiple levels:
- Project: /gu → Generate UI mockup
- Folder:  /gu → Generate Mermaid diagram
- Global:  /gu → General guide

In project directory:
/gu → Uses project definition (UI mockup)
```

---

## 📊 Command Hierarchy Example

```
~/.claude/commands.json
├── /note     (global quick note)
├── /cal      (global calendar check)
└── /gemini   (global Gemini query)

/Opta/.claude/commands.json
├── /gu       (Opta visual guide) ← OVERRIDES global
├── /design   (Opta design system)
├── /status   (Opta project status)
└── /rust     (Navigate to opta-native)

/Opta MacOS/.claude/commands.json
├── /build    (macOS build) ← OVERRIDES folder/global
├── /dev      (Tauri dev server)
├── /test     (Frontend tests)
└── /ring     (Opta Ring spec)

Resolution for user in /Opta MacOS/:
/build  → Project level (tauri build)
/gu     → Folder level (visual guide)
/note   → Global level (quick note)
```

---

## 🚀 Next Steps

1. **Create command configs** at each level
2. **Validate JSON** with schema
3. **Test commands** in different directories
4. **Document team commands** in README
5. **Version control** `.claude/commands.json` files

---

**Created by:** opta-optimizer
**Last Updated:** 2026-01-28
