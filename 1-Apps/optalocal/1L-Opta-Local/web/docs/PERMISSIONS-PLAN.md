---
status: review
---

# LLM Permissions System — Implementation Plan

> **Status:** Draft  
> **Date:** 2026-02-19  
> **Scope:** optalocal-dashboard (Next.js) + Opta LMX (Python/FastAPI)

---

## 1. Permission Scope Definitions

Six scope groups, each with granular toggles:

### filesystem
| Scope | Description | Default |
|-------|-------------|---------|
| `filesystem.read` | Read files from disk | ❌ |
| `filesystem.write` | Write/create files | ❌ |
| `filesystem.delete` | Delete files | ❌ |
| `filesystem.allowed_paths` | Whitelist of allowed directories (array) | `[]` |

### network
| Scope | Description | Default |
|-------|-------------|---------|
| `network.http_outbound` | Make HTTP requests to external URLs | ❌ |
| `network.allowed_domains` | Domain whitelist (array, empty = all if enabled) | `[]` |
| `network.websocket` | Open WebSocket connections | ❌ |

### shell
| Scope | Description | Default |
|-------|-------------|---------|
| `shell.execute` | Run shell commands | ❌ |
| `shell.allowed_commands` | Command whitelist (array) | `[]` |
| `shell.sudo` | Allow elevated/sudo commands | ❌ |

### tools
| Scope | Description | Default |
|-------|-------------|---------|
| `tools.function_calling` | Use tool/function calling | ✅ |
| `tools.allowed_tools` | Tool name whitelist (empty = all if enabled) | `[]` |
| `tools.max_tool_calls_per_turn` | Rate limit per inference turn | `10` |

### memory
| Scope | Description | Default |
|-------|-------------|---------|
| `memory.read_context` | Access RAG/vector store context | ✅ |
| `memory.write_context` | Ingest documents into RAG store | ❌ |
| `memory.session_persistence` | Persist conversation sessions | ✅ |
| `memory.max_context_documents` | Max docs per query | `5` |

### api
| Scope | Description | Default |
|-------|-------------|---------|
| `api.external_llm_calls` | Call other LLM APIs (chain/delegate) | ❌ |
| `api.webhook_triggers` | Trigger webhooks/callbacks | ❌ |
| `api.max_requests_per_minute` | Per-model rate limit | `60` |

---

## 2. Supabase Schema

### Table: `permission_scopes`

Reference table of all available scopes. Seeded once, rarely changes.

```sql
CREATE TABLE permission_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,        -- e.g. 'filesystem.read'
  scope_group TEXT NOT NULL,             -- e.g. 'filesystem'
  display_name TEXT NOT NULL,            -- e.g. 'Read Files'
  description TEXT,
  value_type TEXT NOT NULL DEFAULT 'boolean',  -- 'boolean' | 'integer' | 'string_array'
  default_value JSONB NOT NULL DEFAULT 'false'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'medium',   -- 'low' | 'medium' | 'high' | 'critical'
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: readable by all authenticated users (reference data)
ALTER TABLE permission_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scopes_read" ON permission_scopes FOR SELECT TO authenticated USING (true);
```

### Table: `permission_presets`

User-created named presets (like GitHub OAuth app scopes).

```sql
CREATE TABLE permission_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g. 'Trusted Assistant', 'Sandboxed'
  description TEXT,
  icon TEXT DEFAULT '🔒',               -- emoji for UI cards
  color TEXT DEFAULT '#8b5cf6',          -- hex for UI
  scopes JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { "filesystem.read": true, "shell.execute": false, ... }
  is_default BOOLEAN NOT NULL DEFAULT false,  -- one per user can be default
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, name)
);

ALTER TABLE permission_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presets_own" ON permission_presets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Table: `model_preset_assignments`

Maps a model ID to a preset for a given user.

```sql
CREATE TABLE model_preset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,                -- HuggingFace model ID (e.g. 'mlx-community/Qwen2.5-32B-4bit')
  preset_id UUID NOT NULL REFERENCES permission_presets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, model_id)
);

ALTER TABLE model_preset_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_own" ON model_preset_assignments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Seed Data: Built-in Presets

Insert 3 system presets (user_id = NULL or a system UUID) that users can clone:

| Preset | Description | Key Scopes |
|--------|-------------|------------|
| **Sandboxed** | No external access, chat only | tools.function_calling=true, everything else off |
| **Standard** | Balanced — tools + RAG, no shell/filesystem | tools + memory.read_context + api rate limits |
| **Trusted** | Full access for power users | Everything enabled with reasonable limits |

---

## 3. Next.js Route Structure

```
src/app/
├── dashboard/
│   ├── page.tsx                    -- existing, add Permissions card
│   └── permissions/
│       ├── page.tsx                -- main permissions hub (list presets + assignments)
│       ├── presets/
│       │   ├── page.tsx            -- all presets grid view
│       │   ├── new/page.tsx        -- create new preset
│       │   └── [id]/page.tsx       -- edit preset (scope toggles)
│       └── models/
│           └── page.tsx            -- model → preset assignment table
```

### API Routes

```
src/app/api/
├── permissions/
│   ├── scopes/route.ts             -- GET: list all scope definitions
│   ├── presets/
│   │   ├── route.ts                -- GET: list user presets, POST: create
│   │   └── [id]/route.ts           -- GET/PUT/DELETE single preset
│   ├── assignments/
│   │   ├── route.ts                -- GET: list, POST: assign
│   │   └── [id]/route.ts           -- DELETE: unassign
│   └── sync/route.ts               -- POST: push resolved permissions to LMX
```

---

## 4. Component Breakdown

### Core Components

```
src/components/permissions/
├── ScopeGroup.tsx          -- Collapsible group (e.g. "Filesystem") with risk badge
├── PermissionToggle.tsx    -- Single scope toggle (switch for boolean, input for arrays/numbers)
├── PresetCard.tsx          -- Card showing preset name, icon, scope summary, edit/delete
├── PresetPicker.tsx        -- Dropdown/modal to assign a preset to a model
├── PresetEditor.tsx        -- Full-page form: name, description, all scope groups
├── ModelPermissionRow.tsx  -- Table row: model name | current preset | change button
├── RiskBadge.tsx           -- Colored badge (low=green, medium=yellow, high=orange, critical=red)
└── ScopeSummary.tsx        -- Compact view: "5/18 scopes enabled" with risk breakdown
```

### ScopeGroup Props
```typescript
type ScopeGroupProps = {
  group: string               // 'filesystem' | 'network' | ...
  scopes: PermissionScope[]   // scope definitions for this group
  values: Record<string, any> // current values from preset
  onChange: (scopeKey: string, value: any) => void
  disabled?: boolean
}
```

### PermissionToggle Props
```typescript
type PermissionToggleProps = {
  scope: PermissionScope
  value: any                  // boolean | number | string[]
  onChange: (value: any) => void
  disabled?: boolean
}
```

### PresetCard Props
```typescript
type PresetCardProps = {
  preset: PermissionPreset
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  assignedModelCount: number
}
```

---

## 5. Opta LMX API Changes

### 5.1 New Config Section: `permissions`

Add to `config.py`:

```python
class PermissionProfile(BaseModel):
    """Per-model permission profile synced from optalocal dashboard."""
    model_id: str
    scopes: dict[str, Any] = Field(default_factory=dict)
    preset_name: str = "default"
    synced_at: float = 0.0

class PermissionsConfig(BaseModel):
    """Permission enforcement settings."""
    enabled: bool = Field(False, description="Enable permission enforcement")
    default_profile: str = Field("sandboxed", description="Default permission profile for unassigned models")
    profiles_path: Path = Field(
        default_factory=lambda: Path.home() / ".opta-lmx" / "permissions.json",
        description="Path to synced permission profiles from dashboard",
    )
    enforce_tool_calls: bool = Field(True, description="Filter disallowed tool calls")
    enforce_rate_limits: bool = Field(True, description="Apply per-model rate limits")
```

Add `permissions: PermissionsConfig` to `LMXConfig`.

### 5.2 New Middleware: `PermissionEnforcementMiddleware`

**File:** `src/opta_lmx/api/permissions.py`

Enforcement happens at two levels:

**A) Pre-inference (request validation):**
- Check if model has `tools.function_calling` permission before allowing `tools` in request
- Check `api.max_requests_per_minute` rate limit per model
- Inject allowed tool filter (strip disallowed tools from request before passing to engine)

**B) Post-inference (response filtering):**
- If model attempts tool calls that aren't in `tools.allowed_tools`, strip them
- If model tries to access filesystem/network/shell via tool calls, validate against scope

Implementation approach — **NOT middleware** (middleware can't easily inspect JSON bodies in ASGI). Instead, integrate into the inference handler:

```python
# In inference.py chat_completions handler, after preset resolution:

if app.state.permissions_enabled:
    profile = app.state.permission_profiles.get(resolved_model)
    if profile:
        # Filter tools list
        if not profile.scopes.get("tools.function_calling", False):
            body.tools = None
        elif profile.scopes.get("tools.allowed_tools"):
            allowed = set(profile.scopes["tools.allowed_tools"])
            body.tools = [t for t in (body.tools or []) if t["function"]["name"] in allowed]
        
        # Enforce rate limit
        if profile.scopes.get("api.max_requests_per_minute"):
            # Check per-model rate counter
            ...
```

### 5.3 New Admin Endpoints

```
POST /admin/permissions/sync
  Body: { "profiles": [ { "model_id": "...", "scopes": {...}, "preset_name": "..." } ] }
  → Writes to permissions.json + updates in-memory state
  → Returns: { "success": true, "profiles_updated": 3 }

GET /admin/permissions
  → Returns current active permission profiles for all models

GET /admin/permissions/{model_id}
  → Returns permission profile for specific model (resolved scopes)

POST /admin/permissions/validate
  Body: { "model_id": "...", "action": "tool_call", "tool_name": "shell_exec" }
  → Returns: { "allowed": false, "reason": "shell.execute is disabled", "scope": "shell.execute" }
```

### 5.4 Permission Profile File Format

`~/.opta-lmx/permissions.json`:
```json
{
  "version": 1,
  "synced_at": "2026-02-19T05:00:00Z",
  "synced_from": "optalocal.com",
  "default_profile": "sandboxed",
  "profiles": {
    "mlx-community/Qwen2.5-32B-4bit": {
      "preset_name": "Trusted",
      "scopes": {
        "filesystem.read": true,
        "filesystem.write": false,
        "tools.function_calling": true,
        "tools.allowed_tools": ["get_weather", "search_web"],
        "tools.max_tool_calls_per_turn": 10,
        "memory.read_context": true,
        "api.max_requests_per_minute": 60
      }
    }
  }
}
```

---

## 6. Data Flow: Dashboard → Supabase → LMX

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  optalocal.com   │────▶│   Supabase   │     │   Opta LMX   │
│  (Next.js UI)    │◀────│  (Postgres)  │     │  (FastAPI)    │
└──────┬───────────┘     └──────────────┘     └──────▲────────┘
       │                                             │
       │  On preset change / model assignment:       │
       │  1. Save to Supabase (presets + assignments)│
       │  2. Resolve all model → scopes              │
       │  3. POST /admin/permissions/sync ───────────┘
       │     to user's LMX server
```

### Sync Logic (in `src/lib/lmx/permissions-sync.ts`):

```typescript
async function syncPermissionsToLMX(userId: string) {
  // 1. Fetch all assignments for this user (with preset scopes)
  const { data: assignments } = await supabase
    .from('model_preset_assignments')
    .select('model_id, permission_presets(name, scopes)')
    .eq('user_id', userId)

  // 2. Build profiles payload
  const profiles = assignments.map(a => ({
    model_id: a.model_id,
    preset_name: a.permission_presets.name,
    scopes: a.permission_presets.scopes,
  }))

  // 3. Get user's LMX server URL
  const { profile } = await getProfile(userId)
  
  // 4. Push to LMX
  await fetch(`${profile.lmx_server_url}/admin/permissions/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(profile.lmx_server_token ? { Authorization: `Bearer ${profile.lmx_server_token}` } : {}),
    },
    body: JSON.stringify({ profiles }),
  })
}
```

### Sync Triggers:
1. **On preset edit** → re-sync all models using that preset
2. **On model assignment change** → sync that model
3. **On dashboard load** → background sync (verify LMX is current)
4. **Manual "Sync Now" button** → full re-sync

---

## 7. Implementation Order

### Phase 1: Schema + Scopes (Day 1)
- [ ] Create Supabase migration: `permission_scopes`, `permission_presets`, `model_preset_assignments`
- [ ] Seed `permission_scopes` with all 18 scopes defined above
- [ ] Seed 3 built-in presets (Sandboxed, Standard, Trusted)
- [ ] Add Supabase helper functions: `src/lib/supabase/permissions.ts`

### Phase 2: Dashboard UI — Presets (Day 2-3)
- [ ] Create route: `/dashboard/permissions/page.tsx` — hub with preset cards + model table
- [ ] Create `PresetCard`, `RiskBadge`, `ScopeSummary` components
- [ ] Create route: `/dashboard/permissions/presets/new/page.tsx` — preset editor
- [ ] Create `ScopeGroup`, `PermissionToggle` components
- [ ] Create route: `/dashboard/permissions/presets/[id]/page.tsx` — edit existing preset
- [ ] Add "Permissions" card to dashboard home with link

### Phase 3: Dashboard UI — Model Assignments (Day 3-4)
- [ ] Create route: `/dashboard/permissions/models/page.tsx` — model ↔ preset table
- [ ] Create `PresetPicker`, `ModelPermissionRow` components
- [ ] Fetch loaded models from LMX `/v1/models` to populate model list
- [ ] API routes: `GET/POST /api/permissions/presets`, `GET/POST /api/permissions/assignments`

### Phase 4: LMX Permissions Engine (Day 4-5)
- [ ] Add `PermissionsConfig` to `config.py`
- [ ] Create `src/opta_lmx/permissions/` module:
  - `profiles.py` — load/save/query permission profiles
  - `enforcer.py` — scope checking logic
- [ ] Add `POST /admin/permissions/sync` endpoint to `admin.py`
- [ ] Add `GET /admin/permissions` endpoint
- [ ] Integrate enforcer into `chat_completions` handler in `inference.py`

### Phase 5: Sync Pipeline (Day 5-6)
- [ ] Create `src/lib/lmx/permissions-sync.ts` — dashboard → LMX sync
- [ ] Wire sync triggers (preset edit, assignment change)
- [ ] Add "Sync Now" button + status indicator to permissions hub
- [ ] Add sync status to dashboard home (LMX permissions in sync? badge)

### Phase 6: Polish + Edge Cases (Day 6-7)
- [ ] Handle LMX offline during sync (queue + retry)
- [ ] Handle model not in LMX yet (store assignment, sync when loaded)
- [ ] Duplicate preset functionality
- [ ] Preset import/export (JSON)
- [ ] Permission denied UX: when LMX blocks a request, surface clear error to chat UI
- [ ] Audit log: track permission changes in a `permission_audit_log` table

---

## Architecture Notes

### Why Not Middleware for Enforcement?
ASGI middleware in FastAPI sees raw bytes, not parsed JSON. The permission enforcement needs to inspect `body.tools`, `body.model`, etc. The cleanest approach is a dependency-injected enforcer called within the inference handler, after request parsing but before engine dispatch.

### Why Sync-Based (Not Live Query)?
LMX runs on a local Mac with no guaranteed internet. Permissions are synced as a JSON file that LMX reads. If LMX can't reach Supabase, it still enforces the last-synced permissions. The dashboard pushes updates via the admin API when online.

### State Management
The dashboard uses React Context (`AuthProvider`) with `useState`. Permissions can follow the same pattern — a `PermissionsProvider` that fetches presets/assignments on mount and provides them to child components. No need for a heavier state manager given the current codebase simplicity.

### Existing Code Integration Points
- **Dashboard routing:** New `/dashboard/permissions/` routes alongside existing `/dashboard/page.tsx`
- **LMX client:** Extend `src/lib/lmx/client.ts` with `syncPermissions()` and `getPermissions()` methods
- **LMX inference:** Hook into `chat_completions` in `inference.py` after preset resolution (line ~50) and before engine dispatch
- **LMX config reload:** `POST /admin/config/reload` already exists — permissions reload can follow the same pattern
- **LMX presets:** The existing `PresetManager` handles inference presets (temperature, etc.). Permission presets are a separate concept but can reference the same model IDs.
