---
phase: 04-web-anywhere
plan: "02"
status: complete
completed: 2026-02-18
commits:
  - ad1b250 feat(04-02): ConnectionBadge and global navigation header
  - 434d7b0 feat(04-02): connection-aware dashboard integration
files_created:
  - web/src/components/shared/ConnectionBadge.tsx
  - web/src/components/shared/ConnectionProvider.tsx
  - web/src/components/shared/AppShell.tsx
files_modified:
  - web/src/app/layout.tsx
  - web/src/app/page.tsx
  - web/src/hooks/useConnection.ts
---

# 04-02 Summary: ConnectionBadge and Global Navigation Header

## What Was Done

### Task 1: ConnectionBadge and Global Navigation Header

Created three new shared components and updated the root layout:

**ConnectionBadge** (`src/components/shared/ConnectionBadge.tsx`):
- Compact pill-shaped indicator showing connection type: LAN (emerald), WAN (amber), Offline (red), Probing (amber pulse)
- Lucide icons: Wifi (LAN), Globe (WAN), WifiOff (Offline), Loader2 (Probing)
- Framer Motion animated status dot with pulse effect while probing
- Displays latency in milliseconds when connected (LAN or WAN)
- glass-subtle background with color-coded border
- ARIA role="status" with descriptive label for accessibility

**ConnectionProvider** (`src/components/shared/ConnectionProvider.tsx`):
- Global React context that wraps the app with connection state
- Loads ConnectionSettings from encrypted localStorage on mount
- Falls back to DEFAULT_SETTINGS if storage read fails
- Provides two hooks:
  - `useConnectionContext()` — throws if provider not loaded (for components that require connection)
  - `useConnectionContextSafe()` — returns null while loading (for SSR-safe components)

**AppShell** (`src/components/shared/AppShell.tsx`):
- Root layout shell wrapping all page content
- Fixed/sticky glass-subtle header (z-50) with:
  - "Opta Local" branding (left)
  - Navigation links: Dashboard (/), Chat (/chat), Sessions (/sessions), Settings (/settings)
  - Active route highlighting with primary color
  - ConnectionBadge (right) showing live connection state
- Lucide icons for each nav item: LayoutDashboard, MessageSquare, History, Settings
- Content area offset by header height (pt-11)
- Responsive: nav hidden on small screens (< sm)

**Root Layout** (`src/app/layout.tsx`):
- Wrapped children in AppShell (which includes ConnectionProvider)
- Preserved existing Sora + JetBrains Mono font loading and metadata

### Task 2: Connection-Aware Dashboard Integration

**Dashboard** (`src/app/page.tsx`):
- Removed per-page header with "Opta Local" branding and navigation (now global)
- Removed ConnectionIndicator import (replaced by global ConnectionBadge)
- Removed manual `getConnectionSettings()` + `getBaseUrl()` logic
- Now uses `useConnectionContextSafe()` to get baseUrl, client, adminKey from global context
- SSE URL dynamically derived from `baseUrl` (adapts to LAN/WAN automatically)
- SSE headers include admin key from connection context
- Model unload uses connection-aware client (no more `createClient(settings)`)
- Gracefully handles null context during SSR prerender

**useConnection hook** (`src/hooks/useConnection.ts`):
- Added `adminKey: string` to `UseConnectionReturn` interface
- Exposes admin key from settings so consumers (SSE, admin API) can use it for authenticated requests

## Design Decisions

1. **Server/Client Component Split**: Root layout stays as a server component (exports metadata). AppShell is the client boundary that provides context and renders the header.

2. **Safe Context Hook**: `useConnectionContextSafe()` returns `null` during SSR prerender instead of throwing, which allows Next.js static generation to succeed.

3. **SSE Auto-Reconnect on Failover**: The `useSSE` hook already re-connects when its `url` prop changes (dependency in its internal `useEffect`), so LAN-to-WAN failover triggers automatic SSE reconnection without additional logic.

4. **Admin Key Exposure**: Added `adminKey` to the hook return value specifically for SSE headers. The LMXClient handles admin key internally for REST calls, but SSE (via fetch-event-source) needs explicit headers.

## Verification

- `pnpm run build` passes with 0 TypeScript errors
- All 6 routes render successfully during static generation
- No hardcoded LMX URLs remain in page components (only in DEFAULT_SETTINGS and settings placeholder)
- Global header renders on all pages with navigation and ConnectionBadge
