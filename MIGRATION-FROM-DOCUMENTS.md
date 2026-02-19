# Migration Plan: ~/Documents/Opta/ → ~/Synced/Opta/

*Created: 2026-02-19*
*Author: Opta Max*
*Reason: Work was incorrectly placed in ~/Documents/Opta/ instead of the canonical ~/Synced/Opta/*

---

## Rule (Established 2026-02-19)
> **ALL work lives in ~/Synced/**. Never create or modify project files in ~/Documents/. The Synced folder is Syncthing-synced to all devices and is the single source of truth.

---

## What Needs Migrating

### 1. optalocal-dashboard (Dashboard App)
| | |
|--|--|
| **From** | `~/Documents/Opta/projects/optalocal-dashboard/` |
| **To** | `~/Synced/Opta/1-Apps/1L-Opta-Local/web/` |
| **Contents** | Next.js app: src/, prisma/, package.json, PLAN.md, SUPABASE-SETUP.md, PERMISSIONS-*.md |
| **Status** | ⏳ Pending |

**Notes:**
- `1L-Opta-Local/web/` already exists but may be empty/scaffold — check before overwriting
- The agent outputs (PERMISSIONS-PLAN/RESEARCH/UI-SPEC.md) should also move here

### 2. OptaCloud (Shared Auth/Infra Docs)
| | |
|--|--|
| **From** | `~/Documents/Opta/OptaCloud/` |
| **To** | `~/Synced/Opta/2-Docs/OptaCloud/` |
| **Contents** | AUTH-SETUP.md, SUPABASE-SCHEMA.md, README.md, QUICK-REF.md, configs/, docs/, shared-libs/ |
| **Status** | ⏳ Pending |

---

## Migration Steps

### Step 1: Check destination state
```bash
ls ~/Synced/Opta/1-Apps/1L-Opta-Local/web/
ls ~/Synced/Opta/2-Docs/
```

### Step 2: Migrate optalocal-dashboard
```bash
# If web/ is empty/scaffold, replace it:
rsync -av ~/Documents/Opta/projects/optalocal-dashboard/ \
  ~/Synced/Opta/1-Apps/1L-Opta-Local/web/

# Verify
ls ~/Synced/Opta/1-Apps/1L-Opta-Local/web/
```

### Step 3: Migrate OptaCloud
```bash
mkdir -p ~/Synced/Opta/2-Docs/OptaCloud
rsync -av ~/Documents/Opta/OptaCloud/ \
  ~/Synced/Opta/2-Docs/OptaCloud/

# Verify
ls ~/Synced/Opta/2-Docs/OptaCloud/
```

### Step 4: Archive originals (don't delete yet)
```bash
mkdir -p ~/Documents/Opta/_MIGRATED-TO-SYNCED
mv ~/Documents/Opta/projects ~/Documents/Opta/_MIGRATED-TO-SYNCED/
mv ~/Documents/Opta/OptaCloud ~/Documents/Opta/_MIGRATED-TO-SYNCED/
```

### Step 5: Update project memory files
- ✅ memory/projects/optalocal.md — updated
- ✅ memory/projects/opta-cloud.md — updated
- ✅ MEMORY.md — Opta Ecosystem section updated
- ✅ memory/workflows/kimi-code-workflow.md — updated

---

## Canonical App Path Map (~/Synced/Opta/1-Apps/)

| App | Folder |
|-----|--------|
| AI Components Web | 1A-AI-Components-Web |
| AICompare Web | 1B-AICompare-Web |
| MonoUsage | 1C-MonoUsage |
| Opta CLI TS | 1D-Opta-CLI-TS |
| Opta Life iOS | 1E-Opta-Life-IOS |
| Opta Life Web | 1F-Opta-Life-Web |
| Opta Mini macOS | 1G-Opta-Mini-MacOS |
| Opta Scan iOS | 1H-Opta-Scan-IOS |
| OptaPlus (design system) | 1I-OptaPlus |
| Opta LMX | 1M-Opta-LMX |
| Optamize macOS | 1J-Optamize-MacOS |
| Optamize Web | 1K-Optamize-Web |
| Opta Local (optalocal.com) | 1L-Opta-Local |
| Kimi Proxy | kimi-proxy |

---

## Status
- [x] Step 1: Check destinations
- [x] Step 2: Migrate optalocal-dashboard (planning docs → 1L-Opta-Local/web/docs/)
- [x] Step 3: Migrate OptaCloud → Synced/Opta/2-Docs/OptaCloud/
- [x] Step 4: Archive originals → ~/Documents/Opta/_MIGRATED-TO-SYNCED/
- [x] Step 5: Update memory files

**Completed: 2026-02-19. All work now in ~/Synced/.**
