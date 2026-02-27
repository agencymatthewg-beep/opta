# LLM Permissions Management — UI/UX Specification

> optalocal.com · Next.js 15 · Tailwind · Supabase  
> Dark theme: `#09090b` bg, `#8b5cf6` Electric Violet, Sora font, glassmorphism cards

---

## 1. Design System Extensions

### Trust Level Colours

| Level | Badge | Background | Border | Text | Dot |
|-------|-------|-----------|--------|------|-----|
| Untrusted | 🔴 | `bg-red-500/10` | `border-red-500/30` | `text-red-400` | `bg-red-500` |
| Restricted | 🟡 | `bg-amber-500/10` | `border-amber-500/30` | `text-amber-400` | `bg-amber-500` |
| Trusted | 🟢 | `bg-emerald-500/10` | `border-emerald-500/30` | `text-emerald-400` | `bg-emerald-500` |
| Full Access | 🔵 | `bg-violet-500/10` | `border-violet-500/30` | `text-violet-400` | `bg-violet-500` |

### Trust Calculation

```
0 scopes enabled     → Untrusted
1-4 scopes (no shell/network) → Restricted
5-8 scopes (no shell)  → Trusted
Shell + Network + 6+  → Full Access
```

### Card Style (matches existing)

```
rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm
```

### Toggle Style

```
Off: bg-zinc-800 border-zinc-700
On:  bg-violet-600 border-violet-500
Disabled: opacity-50 cursor-not-allowed
```

---

## 2. Permission Scopes

### Scope Groups & Individual Scopes

```typescript
type ScopeGroup = {
  id: string
  label: string
  icon: string // Lucide icon name
  description: string
  scopes: Scope[]
}

type Scope = {
  id: string
  label: string
  description: string
  dangerous?: boolean // shows warning indicator
}
```

| Group | Icon | Scopes |
|-------|------|--------|
| **File System** | `HardDrive` | `fs.read` Read files, `fs.write` Write files, `fs.delete` Delete files |
| **Network** | `Globe` | `net.http` HTTP requests, `net.websocket` WebSocket connections, `net.dns` DNS lookups |
| **Shell & Exec** | `Terminal` | `shell.exec` Run commands, `shell.sudo` Elevated privileges, `shell.background` Background processes |
| **Tool Calling** | `Wrench` | `tools.builtin` Built-in tools, `tools.mcp` MCP servers, `tools.custom` Custom tools |
| **Memory & Persistence** | `Database` | `mem.read` Read memory, `mem.write` Write memory, `mem.delete` Clear memory |
| **External APIs** | `Zap` | `api.outbound` Outbound API calls, `api.auth` Use stored credentials, `api.billing` Billable APIs |

### Dangerous Scopes (red indicator dot)

`fs.delete`, `shell.exec`, `shell.sudo`, `shell.background`, `mem.delete`, `api.billing`

---

## 3. Default Presets

| Preset | Trust | Enabled Scopes |
|--------|-------|---------------|
| **Sandboxed** | 🔴 Untrusted | None |
| **Research Mode** | 🟡 Restricted | `net.http`, `tools.builtin`, `mem.read`, `api.outbound` |
| **Code Only** | 🟢 Trusted | `fs.read`, `fs.write`, `shell.exec`, `tools.builtin`, `tools.mcp`, `mem.read`, `mem.write` |
| **Fully Trusted** | 🔵 Full Access | All scopes |

---

## 4. Component Specifications

### 4.1 `TrustBadge`

```typescript
interface TrustBadgeProps {
  level: 'untrusted' | 'restricted' | 'trusted' | 'full-access'
  size?: 'sm' | 'md' | 'lg'    // default: 'md'
  showLabel?: boolean           // default: true
  className?: string
}
```

**Render:** Pill badge with coloured dot + label text.

```
sm:  h-5 text-xs px-2 gap-1  dot: w-1.5 h-1.5
md:  h-6 text-sm px-2.5 gap-1.5  dot: w-2 h-2
lg:  h-8 text-base px-3 gap-2  dot: w-2.5 h-2.5
```

**Example HTML:**
```html
<span class="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
  Trusted
</span>
```

---

### 4.2 `PermissionScopeToggle`

```typescript
interface PermissionScopeToggleProps {
  scope: {
    id: string
    label: string
    description: string
    dangerous?: boolean
  }
  enabled: boolean
  disabled?: boolean
  onChange: (id: string, enabled: boolean) => void
}
```

**Layout:** Row — left: label + description, right: toggle switch.  
Dangerous scopes show a small `🔴` dot next to the label.

```
┌──────────────────────────────────────────────────────┐
│  🔴 Run commands                          [  ○━━━]  │
│     Execute shell commands on the host               │
└──────────────────────────────────────────────────────┘
```

**Toggle switch:** 44×24px, `rounded-full`, uses trust-level colours.

---

### 4.3 `ScopeGroup`

```typescript
interface ScopeGroupProps {
  group: {
    id: string
    label: string
    icon: string
    description: string
  }
  scopes: Array<{
    id: string
    label: string
    description: string
    dangerous?: boolean
  }>
  enabledScopes: Set<string>
  disabledScopes?: Set<string>
  onChange: (scopeId: string, enabled: boolean) => void
  onToggleAll?: (groupId: string, enabled: boolean) => void
}
```

**Layout:** Collapsible section with icon header, group toggle-all, and child `PermissionScopeToggle` rows.

```
┌──────────────────────────────────────────────────────┐
│  🖥 Shell & Exec                    [All] [▾]       │
│  Execute commands on the host system                 │
│──────────────────────────────────────────────────────│
│  🔴 Run commands                          [  ━━━○]  │
│     Execute shell commands on the host               │
│                                                      │
│  🔴 Elevated privileges                  [  ○━━━]   │
│     Run with sudo/admin rights                       │
│                                                      │
│  🔴 Background processes                 [  ○━━━]   │
│     Spawn long-running processes                     │
└──────────────────────────────────────────────────────┘
```

**Styles:** Card uses standard glassmorphism. Header row: `flex items-center justify-between`. Icon: Lucide component, `w-5 h-5 text-zinc-400`. Toggle-all: small `text-xs text-violet-400 hover:text-violet-300` button. Chevron animates rotation on expand/collapse.

---

### 4.4 `PresetCard`

```typescript
interface PresetCardProps {
  preset: {
    id: string
    name: string
    description?: string
    scopeCount: number
    totalScopes: number
    trustLevel: 'untrusted' | 'restricted' | 'trusted' | 'full-access'
    assignedModelCount: number
    isDefault?: boolean
  }
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onClick: (id: string) => void
}
```

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│  Code Only                          🟢 Trusted      │
│  File access + shell for coding tasks                │
│                                                      │
│  7/18 scopes    •    3 models assigned               │
│                                                      │
│  [Edit]  [Duplicate]  [Delete]              DEFAULT  │
└──────────────────────────────────────────────────────┘
```

**Card:** `p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer`  
**Name:** `text-lg font-semibold text-white`  
**Description:** `text-sm text-zinc-400 mt-1`  
**Stats row:** `text-xs text-zinc-500 mt-4 flex items-center gap-3`  
**Actions:** `mt-4 pt-4 border-t border-zinc-800 flex items-center gap-2` — ghost buttons `text-xs text-zinc-400 hover:text-white`  
**Default badge:** `text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full ml-auto`  
**Delete:** `text-red-400 hover:text-red-300` (disabled if `isDefault`)

---

### 4.5 `PresetPicker`

```typescript
interface PresetPickerProps {
  presets: Array<{
    id: string
    name: string
    trustLevel: 'untrusted' | 'restricted' | 'trusted' | 'full-access'
    scopeCount: number
    totalScopes: number
  }>
  selectedId: string | null
  onChange: (presetId: string) => void
  className?: string
}
```

**Layout:** Radio-card group. Each option is a compact card showing name + trust badge. Selected state: `border-violet-500 bg-violet-500/5`.

```
┌─────────────────┐  ┌─────────────────┐  ┌═════════════════╗
│  Sandboxed      │  │  Research Mode   │  ║  Code Only      ║
│  🔴 0/18        │  │  🟡 4/18        │  ║  🟢 7/18  ✓    ║
└─────────────────┘  └─────────────────┘  ╚═════════════════╝
```

**Unselected:** `border-zinc-800 hover:border-zinc-700`  
**Selected:** `border-violet-500 bg-violet-500/5`  
**Check:** `text-violet-400` checkmark icon top-right

---

### 4.6 `PermissionWarningBanner`

```typescript
interface PermissionWarningBannerProps {
  warnings: Array<{
    id: string
    severity: 'info' | 'warning' | 'danger'
    message: string
  }>
  onDismiss?: (id: string) => void
  className?: string
}
```

**Dangerous Combinations (auto-detected):**

| Combo | Severity | Message |
|-------|----------|---------|
| `shell.exec` + `net.http` | danger | "Shell + Network access allows arbitrary code to reach external servers" |
| `shell.sudo` + any | danger | "Elevated privileges can bypass all other restrictions" |
| `fs.delete` + `mem.delete` | warning | "Can delete both files and memory — data loss risk" |
| `api.billing` + `api.auth` | warning | "Can make billable API calls with stored credentials" |
| All scopes enabled | info | "Full access — this model has no restrictions" |

**Layout:** Stacked banners above the scope toggles.

```
┌──────────────────────────────────────────────────────┐
│  ⚠️  Shell + Network access allows arbitrary code    │
│     to reach external servers                   [✕]  │
└──────────────────────────────────────────────────────┘
```

**Danger:** `bg-red-500/10 border border-red-500/30 text-red-400`  
**Warning:** `bg-amber-500/10 border border-amber-500/30 text-amber-400`  
**Info:** `bg-zinc-800 border border-zinc-700 text-zinc-300`  
**Container:** `rounded-xl p-4 flex items-start gap-3 text-sm`

---

## 5. Page Layouts

### 5.1 `/dashboard/permissions` — Preset Management

**Route:** `src/app/dashboard/permissions/page.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  [Header - same as dashboard]                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Permission Presets                    [+ Create Preset]     │
│  Manage permission bundles for your models                   │
│                                                              │
│  ┌─ PresetCard ──┐  ┌─ PresetCard ──┐  ┌─ PresetCard ──┐   │
│  │  Sandboxed    │  │  Research     │  │  Code Only    │   │
│  │  🔴 0/18     │  │  🟡 4/18     │  │  🟢 7/18     │   │
│  │  0 models    │  │  2 models    │  │  3 models    │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                              │
│  ┌─ PresetCard ──┐                                           │
│  │  Fully Trust  │                                           │
│  │  🔵 18/18    │                                           │
│  │  1 model     │                                           │
│  └───────────────┘                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Grid:** `grid md:grid-cols-2 lg:grid-cols-3 gap-6`

#### Create/Edit Preset Modal (or slide-over panel)

**Implementation:** Full-page slide-over from right (`fixed inset-y-0 right-0 w-full max-w-xl`), dark overlay.

**Flow:** Name → Scope Groups → Preview → Save

```
┌─────────────────────────────────────────┐
│  Create Preset                     [✕]  │
│─────────────────────────────────────────│
│                                         │
│  Name  [____________________________]   │
│  Description (optional)                 │
│  [____________________________________] │
│                                         │
│  ┌─ TrustBadge preview ──────────────┐  │
│  │  Based on selected scopes: 🟡     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ ScopeGroup: File System ─────────┐  │
│  │  ...toggles...                    │  │
│  └───────────────────────────────────┘  │
│  ┌─ ScopeGroup: Network ────────────┐  │
│  │  ...toggles...                    │  │
│  └───────────────────────────────────┘  │
│  ┌─ ScopeGroup: Shell & Exec ───────┐  │
│  │  ...toggles...                    │  │
│  └───────────────────────────────────┘  │
│  ... more groups ...                    │
│                                         │
│  ┌─ PermissionWarningBanner ─────────┐  │
│  │  (live warnings as you toggle)    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Cancel]                      [Save]   │
└─────────────────────────────────────────┘
```

**Save button:** `bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-lg`  
**Cancel:** `text-zinc-400 hover:text-white`

---

### 5.2 `/dashboard/models/[id]/permissions` — Per-Model Assignment

**Route:** `src/app/dashboard/models/[id]/permissions/page.tsx`

```
┌──────────────────────────────────────────────────────────────┐
│  [Header]                                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ← Back to Models                                            │
│                                                              │
│  deepseek-r1:14b                     🟢 Trusted             │
│  Permission configuration for this model                     │
│                                                              │
│  ┌─ PermissionWarningBanner ─────────────────────────────┐  │
│  │  ⚠️ Shell + Network allows...                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Preset ──────────────────────────────────────────────── │
│                                                              │
│  ┌─ PresetPicker ────────────────────────────────────────┐  │
│  │  [Sandboxed] [Research] [✓ Code Only] [Full Access]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ── Scope Overrides ─────────────────────────────────────── │
│  These override the preset for this model only.             │
│                                                              │
│  ┌─ ScopeGroup: File System (inherited: ✓) ─────────────┐  │
│  │  fs.read   ✓ (from preset)                            │  │
│  │  fs.write  ✓ (from preset)                            │  │
│  │  fs.delete ○ → ✓ (OVERRIDE)                          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ... more groups ...                                         │
│                                                              │
│  [Reset Overrides]                           [Save]         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Override indicator:** Scopes matching preset are dimmed (`text-zinc-500`). Overridden scopes show a violet dot and `(override)` label in `text-violet-400`.

**Reset Overrides:** `text-sm text-zinc-400 hover:text-white` — clears all per-model overrides back to preset defaults.

---

## 6. Interaction Flows

### 6.1 Create Preset

1. User clicks **"+ Create Preset"** on `/dashboard/permissions`
2. Slide-over opens with empty form
3. User enters name (required, validated: unique, 2-50 chars)
4. User toggles scopes — `TrustBadge` preview updates live
5. `PermissionWarningBanner` appears/disappears as dangerous combos change
6. User clicks **Save** → POST to `/api/permissions/presets` → toast "Preset created" → slide-over closes → card appears in grid

### 6.2 Edit Preset

1. User clicks **Edit** on a `PresetCard`
2. Same slide-over, pre-populated
3. If preset has assigned models, show info banner: "Changes apply to N models"
4. Save → PUT → toast → grid refreshes

### 6.3 Delete Preset

1. User clicks **Delete** on a `PresetCard`
2. If models assigned: block with "Reassign N models first"
3. If no models: confirmation dialog → DELETE → toast → card removed

### 6.4 Assign Preset to Model

1. Navigate to `/dashboard/models/[id]/permissions`
2. `PresetPicker` shows all presets as radio cards
3. Select one → scope groups below update to show inherited state
4. Optionally toggle individual overrides
5. **Save** → PUT to `/api/models/[id]/permissions`

### 6.5 Dangerous Scope Confirmation

When enabling a `dangerous` scope:
1. Toggle animates to "pending" state (pulsing)
2. Small inline confirm appears: "Enable shell execution? [Confirm] [Cancel]"
3. On confirm → toggle completes, warnings recalculate
4. On cancel → toggle reverts

---

## 7. Supabase Schema

```sql
-- Permission presets
create table permission_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  scopes text[] not null default '{}',
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- Model permission assignments
create table model_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  model_id text not null,
  preset_id uuid references permission_presets(id) on delete set null,
  scope_overrides jsonb default '{}', -- { "fs.delete": true, "shell.exec": false }
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, model_id)
);

-- RLS policies
alter table permission_presets enable row level security;
alter table model_permissions enable row level security;

create policy "Users manage own presets" on permission_presets
  for all using (auth.uid() = user_id);

create policy "Users manage own model permissions" on model_permissions
  for all using (auth.uid() = user_id);
```

---

## 8. API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/permissions/presets` | List user's presets |
| POST | `/api/permissions/presets` | Create preset |
| PUT | `/api/permissions/presets/[id]` | Update preset |
| DELETE | `/api/permissions/presets/[id]` | Delete preset (fails if models assigned) |
| GET | `/api/models/[id]/permissions` | Get model's preset + overrides |
| PUT | `/api/models/[id]/permissions` | Set model's preset + overrides |

---

## 9. File Structure

```
src/
├── app/dashboard/
│   ├── permissions/
│   │   └── page.tsx              # Preset management page
│   └── models/[id]/
│       └── permissions/
│           └── page.tsx          # Per-model permissions page
├── components/permissions/
│   ├── TrustBadge.tsx
│   ├── PermissionScopeToggle.tsx
│   ├── ScopeGroup.tsx
│   ├── PresetCard.tsx
│   ├── PresetPicker.tsx
│   ├── PermissionWarningBanner.tsx
│   └── PresetSlideOver.tsx       # Create/edit slide-over
├── lib/permissions/
│   ├── scopes.ts                 # Scope definitions & groups
│   ├── trust.ts                  # Trust level calculation
│   ├── warnings.ts               # Dangerous combo detection
│   └── types.ts                  # Shared TypeScript types
└── hooks/
    ├── usePresets.ts             # SWR/React Query hook for presets
    └── useModelPermissions.ts    # Hook for model permission state
```

---

## 10. Shared Types (`lib/permissions/types.ts`)

```typescript
export type TrustLevel = 'untrusted' | 'restricted' | 'trusted' | 'full-access'

export type WarningSeverity = 'info' | 'warning' | 'danger'

export interface Scope {
  id: string
  label: string
  description: string
  dangerous?: boolean
}

export interface ScopeGroupDef {
  id: string
  label: string
  icon: string
  description: string
  scopes: Scope[]
}

export interface Preset {
  id: string
  name: string
  description?: string
  scopes: string[]
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

export interface ModelPermission {
  modelId: string
  presetId: string | null
  scopeOverrides: Record<string, boolean>
}

export interface PermissionWarning {
  id: string
  severity: WarningSeverity
  message: string
}
```
