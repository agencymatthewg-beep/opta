# Opta Local Stack — Organization

**Last updated:** 2026-02-19

---

## Overview

The Opta local stack consists of 3 main components:

| Component | Location | Purpose |
|-----------|----------|---------|
| **Opta CLI** | `1D-Opta-CLI-TS/` | Agentic AI coding CLI |
| **Opta LMX** | `1J-Opta-LMX/` | Local inference server |
| **optalocal.com** | `projects/optalocal-dashboard/` | Web dashboard |

---

## 1. Opta CLI

**Path:** `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/`

**Purpose:** Local-first agentic AI coding assistant

**Tech Stack:**
- Node.js + TypeScript
- Ink (React TUI)
- Connects to LMX for inference

**Commands:**
- `opta chat` — Interactive chat
- `opta do <task>` — One-shot tasks
- `opta models` — Model management
- `opta status` — LMX status

**Status:** 
- ✅ TypeScript 0 errors
- ✅ Tests 896/896 passing
- ✅ Build clean

---

## 2. Opta LMX

**Path:** `~/Synced/Opta/1-Apps/1J-Opta-LMX/`

**Purpose:** Private AI inference engine for Apple Silicon

**Tech Stack:**
- Python (mlx_lm)
- FastAPI
- macOS LaunchAgent

**Features:**
- Local model serving
- OpenAI-compatible API
- Model management
- Memory monitoring

**Status:**
- ✅ Running on Mono512
- ✅ Model loaded: MiniMax-M2.5-5bit

---

## 3. optalocal.com

**Path:** `~/Synced/Opta/1-Apps/1L-Opta-Local/web/`

**Purpose:** Web dashboard for LMX management

**Tech Stack:**
- Next.js 15
- Supabase Auth
- Tailwind CSS

**Features:**
- User authentication (Google, Apple, Email)
- Cloud sync
- Setup wizard
- Per-user config

**Status:**
- 🔄 In development

---

## Dependencies

```
Opta CLI ──→ Opta LMX (via API)
     │
     └─→ Local Models (MLX, GGUF)

optalocal.com ──→ Opta LMX (via API)
              │
              └─→ Supabase (Auth + DB)
```

---

## Running Services

| Service | Host | Port | Status |
|---------|------|------|--------|
| LMX Server | Mono512 | 1234 | ✅ Running |
| optalocal.com | Vercel | — | 🔄 Dev |

---

## Quick Commands

```bash
# CLI
cd ~/Synced/Opta/1-Apps/1D-Opta-CLI-TS
npm run dev -- chat

# Check LMX
curl http://192.168.188.11:1234/v1/models

# Dashboard
cd ~/Synced/Opta/1-Apps/1L-Opta-Local/web
npm run dev
```

---

## Known Issues

- [ ] Model auto-load on startup (presets have auto_load: false)
- [ ] Response truncation detection (finish_reason: 'length')
- [ ] Thinking shake (resolved)

---

## Future Plans

1. Load Qwen 2.5 Coder 32B for best coding performance
2. Implement model warming at startup
3. Add truncation warning to CLI
4. Deploy optalocal.com to production

