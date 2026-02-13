# Opta Project Instructions

---

## CRITICAL: Design System Compliance (NON-NEGOTIABLE)

**ALL UI, UX, styling, and design work MUST follow `/DESIGN_SYSTEM.md`**

Before writing ANY frontend code, you MUST:

1. Read `/DESIGN_SYSTEM.md` completely
2. Use ONLY the specified components and patterns
3. Verify compliance with the checklist below

### Mandatory Requirements

| Requirement | Rule |
|-------------|------|
| **Animations** | Framer Motion ONLY (`motion`, `AnimatePresence`) |
| **Icons** | Lucide React ONLY (never inline SVGs) |
| **Glass Effects** | ALWAYS use `.glass`, `.glass-subtle`, `.glass-strong` |
| **Colors** | CSS variables ONLY (never hex/rgb, never arbitrary colors) |
| **Typography** | Sora font ONLY (already configured) |
| **Styling** | Use `cn()` helper for conditional classes |

### Quick Reference

```tsx
// CORRECT - Framer Motion animation
<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>

// CORRECT - Lucide icon
import { Settings } from 'lucide-react';
<Settings className="w-5 h-5 text-primary" strokeWidth={1.75} />

// CORRECT - Glass styling
<div className="glass rounded-xl border border-border/30">

// CORRECT - Semantic colors
<span className="text-primary bg-card text-success text-warning text-danger">

// WRONG - Never do these
<svg>...</svg>                    // No inline SVGs
<div className="bg-gray-800">    // No solid backgrounds
<div className="text-[#8b5cf6]"> // No arbitrary colors
className="transition-opacity"   // No CSS transitions for animations
```

### Pre-Commit Checklist

- [ ] No inline SVGs (Lucide only)
- [ ] No arbitrary colors (CSS variables only)
- [ ] All containers use glass effects
- [ ] All animations use Framer Motion
- [ ] Interactive elements have hover/tap feedback
- [ ] Build passes (`npm run build`)

---

## Commands

```bash
npm install
npm run dev                     # Vite dev server (frontend only)
npm run tauri dev               # Full Tauri app (frontend + Rust backend)
npm run build                   # tsc + vite build
npm run build:dmg               # Build macOS DMG (aarch64)
npm run build:app               # Build .app bundle (aarch64)
```

## Tech Stack
- Frontend: React 19 + TypeScript + Vite
- Backend: Tauri v2 (Rust)
- System Integration: Python MCP Server (`mcp-server/`, uses `pyproject.toml` + `uv`)
- AI: Hybrid LLM (Local Llama 3 8B + Cloud Claude)

## Key Architecture Decisions
- MCP for all integrations ("USB-C for AI")
- Hybrid semantic router for cost efficiency
- Detect conflicts, warn only (don't auto-disable other tools)
- Shareable Optimization Score for virality

## Key Files

| Path | Purpose |
|------|---------|
| `src/pages/` | Dashboard, Optimize, Games, Chess, Score, Settings |
| `src/components/` | React UI components |
| `src/hooks/` | Custom hooks (useTelemetry, useClaude, etc.) |
| `src/contexts/` | React context providers |
| `src-tauri/src/lib.rs` | Tauri command registrations |
| `src-tauri/src/telemetry.rs` | Python-Rust telemetry bridge |
| `src-tauri/src/processes.rs` | Process management + stealth mode |
| `src-tauri/src/platform/` | Platform-specific code (macos, windows, linux, mobile) |
| `src-tauri/src/ipc/` | Socket server + metrics serializer |
| `DESIGN_SYSTEM.md` | Full design system spec (referenced above) |
