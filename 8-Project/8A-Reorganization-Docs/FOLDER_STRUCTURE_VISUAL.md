# 🗂️ OPTA FOLDER STRUCTURE - VISUAL GUIDE

**Complete numbered hierarchy with descriptions**

---

```
/Opta/
│
├── 1. Apps/
│   │
│   ├── 1. iOS/
│   │   ├── 1. Opta/                         [React Native - AI Visual Scanner]
│   │   ├── 2. Opta Scan/                    [SwiftUI - Photo Scan Feature]
│   │   └── 3. Opta LM iOS/                  [SwiftUI - Life Manager Native App]
│   │
│   ├── 2. Desktop/
│   │   ├── 1. Opta Native/                  [Tauri - Main PC Optimizer]
│   │   └── 2. Opta Mini/                    [SwiftUI - Menu Bar Utility]
│   │
│   ├── 3. Web/
│   │   ├── 1. Opta Life Manager/            [Next.js - Productivity Dashboard]
│   │   ├── 2. Opta LM Edge/                 [Cloudflare Workers - Edge API]
│   │   └── 3. Optamize Website/             [Static HTML - Marketing Site]
│   │
│   └── 4. Shared/
│       ├── 1. opta-native/                  [Rust Workspace - Core Logic]
│       │   ├── opta-core/                   [Crux + UniFFI Bindings]
│       │   ├── opta-shared/                 [Common Types]
│       │   └── opta-render/                 [wgpu Graphics]
│       │
│       └── 2. design-assets/                [Centralized Brand Assets]
│           ├── logos/                       [App Logos - All Platforms]
│           ├── icons/                       [App Icons]
│           ├── animation-frames/            [Opta Ring Sequences]
│           └── design-specs/                [Technical Specifications]
│
├── 2. Gemini Deep Research/                 [AI Research Knowledge Base]
│   ├── [Research Reports]
│   ├── [Competitive Analysis]
│   └── [Technical Explorations]
│
└── 3. Matthew x Opta/                       [Personal & Project Context]
    │
    ├── 1. personal/                         [Matthew's Context]
    │   ├── calendar.md                      [📅 Events & Deadlines]
    │   ├── hardware.md                      [💻 Device Ecosystem]
    │   ├── workflows.md                     [⚙️ Cross-Device Patterns]
    │   ├── goals.md                         [🎯 Current Priorities]
    │   └── profile.md                       [👤 Preferences & Style]
    │
    ├── 2. project/                          [Opta Project Context]
    │   ├── opta-ai-personality.md           [🤖 AI Assistant Traits]
    │   ├── opta-vision.md                   [🔮 Product Vision]
    │   └── opta-brand-guidelines.md         [🎨 Brand Voice]
    │
    └── 3. agent-config/                     [AI Agent Configuration]
        ├── .claude/                         [Claude Configuration]
        │   ├── agents/
        │   │   ├── opta-optimizer.md        [Agent Behavior]
        │   │   └── opta-optimizer-training.md [Learned Patterns]
        │   └── skills/                      [Custom Skills]
        ├── .serena/                         [Serena MCP Config]
        └── .mcp.json                        [MCP Servers Setup]
```

---

## 🎨 COLOR-CODED CATEGORIES

### 🟦 **1. Apps** - User-Facing Applications
All software that end users interact with:
- 📱 iOS (3 apps)
- 🖥️ Desktop (2 apps)
- 🌐 Web (3 sites)
- 🔧 Shared (infrastructure)

### 🟪 **2. Gemini Deep Research** - Knowledge Base
AI-generated research and analysis documents

### 🟨 **3. Matthew x Opta** - Context & Configuration
- 👤 Personal (Matthew's info)
- 📋 Project (Opta vision)
- 🤖 Agent Config (AI setup)

---

## 🔗 DEPENDENCY MAP

### Who Uses `opta-native` (Rust Core)?
```
1. Apps/4. Shared/1. opta-native/
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
Opta Native    Opta Mini      All iOS Apps
 (Tauri)      (SwiftUI)      (via UniFFI)
```

### Who Uses `design-assets`?
```
1. Apps/4. Shared/2. design-assets/
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
All iOS        All Desktop      All Web
  (3)             (2)            (3)
```

---

## 📊 APP COUNT BY PLATFORM

| Platform | Apps | Names |
|----------|------|-------|
| **iOS** | 3 | Opta, Opta Scan, Opta LM iOS |
| **Desktop** | 2 | Opta Native, Opta Mini |
| **Web** | 3 | Opta Life Manager, Opta LM Edge, Optamize Website |
| **Shared** | 2 | opta-native (Rust), design-assets |
| **TOTAL** | **10** | 8 apps + 2 shared |

---

## 🚀 TECH STACK SUMMARY

### Languages
- **Rust** - Core logic (`opta-native`)
- **TypeScript** - React, Next.js apps
- **Swift** - Native iOS/macOS apps
- **JavaScript** - Edge functions, static sites

### Frameworks
- **Tauri v2** - Desktop wrapper
- **React 19** - Desktop UI
- **React Native (Expo)** - Mobile UI
- **SwiftUI** - Native Apple apps
- **Next.js 15** - Web app

### Graphics
- **wgpu** - GPU abstraction (Rust)
- **React Three Fiber** - 3D UI (Desktop)
- **Metal** - Apple GPU backend

### State Management
- **Crux Core** - Elm Architecture (Rust)
- **Zustand** - React state (Web/Mobile)
- **SwiftUI @State** - Native state

---

## 📁 FOLDER NAVIGATION SHORTCUTS

### Quick CD Commands
```bash
# Desktop App
cd "Opta/1. Apps/2. Desktop/1. Opta Native"

# Main iOS App
cd "Opta/1. Apps/1. iOS/1. Opta"

# Web Dashboard
cd "Opta/1. Apps/3. Web/1. Opta Life Manager"

# Rust Core
cd "Opta/1. Apps/4. Shared/1. opta-native"

# Design Assets
cd "Opta/1. Apps/4. Shared/2. design-assets"

# Personal Context
cd "Opta/3. Matthew x Opta/1. personal"
```

### Aliases (Optional)
```bash
# Add to ~/.zshrc or ~/.bashrc
alias opta-desktop="cd '$HOME/Documents/Opta/1. Apps/2. Desktop/1. Opta Native'"
alias opta-ios="cd '$HOME/Documents/Opta/1. Apps/1. iOS/1. Opta'"
alias opta-web="cd '$HOME/Documents/Opta/1. Apps/3. Web/1. Opta Life Manager'"
alias opta-rust="cd '$HOME/Documents/Opta/1. Apps/4. Shared/1. opta-native'"
alias opta-assets="cd '$HOME/Documents/Opta/1. Apps/4. Shared/2. design-assets'"
```

---

## 🎯 FOLDER PURPOSE AT A GLANCE

| Folder | Purpose | Main Users |
|--------|---------|------------|
| `1. Apps/1. iOS/` | Mobile applications | iOS Developers, End Users |
| `1. Apps/2. Desktop/` | Desktop applications | Desktop Devs, End Users |
| `1. Apps/3. Web/` | Web applications | Web Devs, End Users |
| `1. Apps/4. Shared/` | Common infrastructure | All Developers |
| `2. Gemini Deep Research/` | Research knowledge | Matthew, Planning |
| `3. Matthew x Opta/1. personal/` | Personal context | AI Agents, Matthew |
| `3. Matthew x Opta/2. project/` | Project vision | All Devs, AI Agents |
| `3. Matthew x Opta/3. agent-config/` | AI configuration | Claude, Serena |

---

## 📏 SIZE ESTIMATES (Post-Migration)

| Folder | Approx. Size | File Count |
|--------|--------------|------------|
| `1. Apps/` | ~2 GB | ~15,000 |
| `2. Gemini Deep Research/` | ~50 MB | ~100 |
| `3. Matthew x Opta/` | ~10 MB | ~50 |
| **Total** | **~2.1 GB** | **~15,150** |

---

## 🔢 NUMBERING RATIONALE

### Why Numbered Folders?

1. **Enforced Reading Order**
   - `1. Apps` → Primary focus (user-facing products)
   - `2. Gemini Deep Research` → Secondary (knowledge)
   - `3. Matthew x Opta` → Tertiary (context/config)

2. **Visual Hierarchy**
   - Numbered categories are instantly distinguishable
   - Sub-numbering within categories maintains organization

3. **Consistent Sorting**
   - All operating systems sort numbered folders identically
   - No alphabetical ambiguity

4. **Clear Intent**
   - Numbers signal "this is organized, not random"
   - Easier for new developers to understand priority

### Numbering Convention

```
[Number]. [Name]/
   └── [Sub-Number]. [Sub-Name]/
          └── [Sub-Sub-Number]. [Sub-Sub-Name]/
```

**Examples:**
- `1. Apps/2. Desktop/1. Opta Native/`
- `3. Matthew x Opta/1. personal/calendar.md`

---

## 🛠️ MIGRATION CHECKLIST

When moving to this structure:

- [ ] Fix `opta-aliases.sh` (dynamic paths)
- [ ] Fix `ios-aliases.sh` (dynamic paths)
- [ ] Use `git mv` for all moves (preserve history)
- [ ] Update `CLAUDE.md` with new paths
- [ ] Update `.planning/` references
- [ ] Test all builds after move
- [ ] Verify Syncthing sync
- [ ] Update IDE workspace paths
- [ ] Update README.md

---

**Visual guide created by opta-optimizer**
*Last updated: 2026-01-28*
