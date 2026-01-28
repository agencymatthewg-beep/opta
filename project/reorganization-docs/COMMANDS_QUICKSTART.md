# 🚀 CUSTOM COMMANDS - QUICK START GUIDE

**How to use your hierarchical custom command system**

---

## ✅ What's Been Set Up

I've created a **three-level custom command system** for you:

### 1️⃣ Global Commands (`~/.claude/commands.json`)
Available everywhere on your Mac

| Command | What It Does |
|---------|--------------|
| `/note [text]` | Save quick note to ~/.personal/notes.md |
| `/cal` | Show today's calendar |
| `/hw` | Show hardware info |

**Aliases:** `/n`, `/c`, `/h`

---

### 2️⃣ Folder Commands (`/Opta/.claude/commands.json`)
Available in all Opta projects

| Command | What It Does |
|---------|--------------|
| `/gu [topic]` | Generate visual Mermaid diagram with Gemini |
| `/design` | Show Opta design system |
| `/status` | Check git status + planning state |
| `/rust` | Navigate to Rust core and show workspace |
| `/apps` | List all Opta apps |
| `/research` | Search Gemini Deep Research files |

**Aliases:** `/g`, `/s`, `/d`, `/r`, `/a`

---

### 3️⃣ Project Commands (`/Opta MacOS/.claude/commands.json`)
Only in Opta MacOS project

| Command | What It Does |
|---------|--------------|
| `/dev` | Start Tauri dev server (background) |
| `/build` | Build .dmg installer (with confirmation) |
| `/build:app` | Build .app only (faster) |
| `/test` | Run frontend tests |
| `/lint` | Lint and auto-fix code |
| `/clean` | Clean build artifacts |
| `/ring` | Show Opta Ring animation spec |
| `/mcp` | Check MCP server status |
| `/versions` | Show dependency versions |

**Aliases:** `/b`, `/l`, `/t`, `/c`, `/v`

---

## 🎯 How to Use Commands

### Method 1: Via Command Runner (Works Now)

```bash
# Navigate to any Opta project
cd /Users/matthewbyrden/Documents/Opta/"Opta MacOS"

# Run a command
./../.claude/command-runner.sh /build

# With arguments
./../.claude/command-runner.sh /gu "folder structure for Opta"
```

### Method 2: Create Shell Aliases (Recommended)

Add to your `~/.zshrc`:

```bash
# Opta custom commands
alias /gu='~/.claude/command-runner.sh /gu'
alias /build='~/.claude/command-runner.sh /build'
alias /status='~/.claude/command-runner.sh /status'
alias /note='~/.claude/command-runner.sh /note'
# Add more as needed

# Generic runner
opta() {
    ~/.claude/command-runner.sh "$@"
}
```

Then reload:
```bash
source ~/.zshrc
```

Now you can type:
```bash
/gu folder structure
/build
/status
```

---

### Method 3: Via Claude (Future)

When Claude Code natively supports custom commands, you'll type directly in Claude:

```
/gu show me the Opta app structure
```

Claude will:
1. Read your commands.json files
2. Find `/gu` definition
3. Execute: Invoke Gemini with your prompt
4. Return: Visual Mermaid diagram

---

## 📊 Command Resolution Example

You're in: `/Opta/Opta MacOS/src/`

You type: `/build`

**Resolution order:**
```
1. Check: ./Opta MacOS/.claude/commands.json  ✅ FOUND
   → /build: "npm run build:dmg"

2. Would check: /Opta/.claude/commands.json (skipped)
3. Would check: ~/.claude/commands.json (skipped)

Result: Executes Opta MacOS project-specific build
```

---

You type: `/gu folder structure`

**Resolution order:**
```
1. Check: ./Opta MacOS/.claude/commands.json  ❌ Not found
2. Check: /Opta/.claude/commands.json          ✅ FOUND
   → /gu: Invoke Gemini with Mermaid diagram

3. Would check: ~/.claude/commands.json (skipped)

Result: Executes Opta folder-level visual guide
```

---

You type: `/note buy milk`

**Resolution order:**
```
1. Check: ./Opta MacOS/.claude/commands.json  ❌ Not found
2. Check: /Opta/.claude/commands.json          ❌ Not found
3. Check: ~/.claude/commands.json              ✅ FOUND
   → /note: Echo to ~/.personal/notes.md

Result: Executes global note command
```

---

## 🎨 Test Your Commands

### 1. Test Global Command

```bash
cd ~
/Users/matthewbyrden/Documents/Opta/.claude/command-runner.sh /note "Testing custom commands"

# Check result
tail ~/.personal/notes.md
```

---

### 2. Test Folder Command

```bash
cd /Users/matthewbyrden/Documents/Opta

# Show all apps
./.claude/command-runner.sh /apps

# Check status
./.claude/command-runner.sh /status
```

---

### 3. Test Project Command

```bash
cd "/Users/matthewbyrden/Documents/Opta/Opta MacOS"

# List versions
../.claude/command-runner.sh /versions

# Clean build (safe test)
../.claude/command-runner.sh /clean
```

---

### 4. Test Visual Guide Generation

```bash
cd /Users/matthewbyrden/Documents/Opta

# This will show what WOULD happen (requires Claude integration)
./.claude/command-runner.sh /gu "Opta folder structure with dependencies"
```

**Output:**
```
📝 Command: /gu
   Generate visual Mermaid diagram with Gemini
   Source: /Users/matthewbyrden/Documents/Opta/.claude/commands.json

🤖 This would invoke Claude skill: gemini
   (Skill execution requires Claude Code integration)
```

---

## ➕ Add New Commands

### Add a Global Command

Edit `~/.claude/commands.json`:

```json
{
  "commands": {
    "/deploy": {
      "description": "Deploy to production",
      "type": "bash",
      "action": "ssh server 'cd /app && git pull && pm2 restart app'",
      "confirmation": true
    }
  }
}
```

---

### Add an Opta Folder Command

Edit `/Opta/.claude/commands.json`:

```json
{
  "commands": {
    "/sync": {
      "description": "Check Syncthing status",
      "type": "bash",
      "action": "curl -s http://localhost:8384/rest/system/status | jq '.myID, .uptime'"
    }
  }
}
```

---

### Add a Project Command

Edit `/Opta MacOS/.claude/commands.json`:

```json
{
  "commands": {
    "/snapshot": {
      "description": "Create version snapshot",
      "type": "bash",
      "action": "./scripts/opta snapshot",
      "workingDirectory": "."
    }
  }
}
```

---

## 🔧 Customize `/gu` Command

Currently `/gu` generates Mermaid diagrams. You can customize it:

### Make it generate PNG images instead

Edit `/Opta/.claude/commands.json`:

```json
{
  "/gu": {
    "description": "Generate visual guide as PNG image",
    "type": "skill",
    "action": "gemini",
    "args": "Generate an image showing: {{prompt}}. Style: clean, professional, annotated diagram.",
    "options": {
      "model": "gemini-2.5-pro",
      "tool": "generate-image"
    }
  }
}
```

---

### Make it use different AI model

```json
{
  "/gu": {
    "description": "Generate visual guide with Claude",
    "type": "agent",
    "action": "general-purpose",
    "prompt": "Create a comprehensive visual diagram showing: {{prompt}}. Use ASCII art or describe it visually.",
    "options": {
      "model": "opus"
    }
  }
}
```

---

## 📚 Command Types Reference

### Bash Commands
```json
{
  "/mycmd": {
    "type": "bash",
    "action": "echo 'Hello {{prompt}}'",
    "confirmation": false,
    "background": false
  }
}
```

---

### Skill Commands (Requires Claude Integration)
```json
{
  "/mycmd": {
    "type": "skill",
    "action": "gemini",
    "args": "Do something with: {{prompt}}"
  }
}
```

---

### Tool Commands (Requires Claude Integration)
```json
{
  "/mycmd": {
    "type": "tool",
    "action": "Read",
    "params": {
      "file_path": "README.md"
    }
  }
}
```

---

### Agent Commands (Requires Claude Integration)
```json
{
  "/mycmd": {
    "type": "agent",
    "action": "Plan",
    "prompt": "Plan: {{prompt}}"
  }
}
```

---

## 🎯 Next Steps

### 1. Set Up Shell Aliases

```bash
# Add to ~/.zshrc
cat >> ~/.zshrc << 'EOF'

# Opta Custom Commands
export OPTA_COMMANDS="/Users/matthewbyrden/Documents/Opta/.claude/command-runner.sh"
alias opta='$OPTA_COMMANDS'
alias /gu='$OPTA_COMMANDS /gu'
alias /build='$OPTA_COMMANDS /build'
alias /status='$OPTA_COMMANDS /status'
alias /note='$OPTA_COMMANDS /note'

EOF

source ~/.zshrc
```

---

### 2. Test Each Command

```bash
cd "/Users/matthewbyrden/Documents/Opta/Opta MacOS"

# Test project command
/build

# Test folder command
/status

# Test global command
/note "Commands are working!"
```

---

### 3. Customize for Your Workflow

Add commands you use daily:
- `/screenshot` - Take and annotate screenshots
- `/pr` - Create pull request
- `/meeting` - Check next meeting
- `/focus` - Start focus mode

---

## 🐛 Troubleshooting

### Command Not Found

```bash
# Check if config files exist
ls -la ~/.claude/commands.json
ls -la /Users/matthewbyrden/Documents/Opta/.claude/commands.json

# Validate JSON
jq . ~/.claude/commands.json
```

---

### Command Runner Not Executable

```bash
chmod +x /Users/matthewbyrden/Documents/Opta/.claude/command-runner.sh
```

---

### Wrong Command Executed

Check which config file is being used:

```bash
# Run with verbose output
cd "/Users/matthewbyrden/Documents/Opta/Opta MacOS"
bash -x ../.claude/command-runner.sh /build
```

---

## 📋 Summary

✅ **Created:** 3 command config files (global, folder, project)
✅ **Created:** Command runner script
✅ **Defined:** 15+ custom commands
✅ **Ready:** Add more commands as needed

**Your custom `/gu` command:**
- Location: `/Opta/.claude/commands.json`
- Purpose: Generate visual Mermaid diagrams with Gemini
- Usage: `/gu [what to visualize]`
- Scope: Works in all Opta projects

---

**Need help?** Check `CUSTOM_COMMANDS_SYSTEM.md` for full documentation.
