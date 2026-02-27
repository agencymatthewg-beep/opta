# Opta Local Production Readiness — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the TUI as the primary Opta Local interface and enable access from anywhere via `https://local.optalocal.com`.

**Architecture:** Two parallel tracks — Track 1 sets up infrastructure (Cloudflare Tunnel, Vercel, Google OAuth); Track 2 builds the missing `/models` page and validates the three already-complete pages (Dashboard, Chat, Sessions).

**Tech Stack:** Cloudflare Tunnel (`cloudflared`), Vercel (Next.js 16), Supabase Auth, React 19, `@opta/ui`, Framer Motion, Lucide React

**Audit outcome:** Dashboard ✅, Chat ✅, Sessions ✅ — all production-ready. Only `/models` page is missing (`web/src/app/models/page.tsx` does not exist). Dashboard already has ModelList + ModelLoadDialog so models components exist and can be reused.

---

## TRACK 1 — Infrastructure

### Task 1: Add default tunnel URL env var support

This is the only code change for Track 1. All other Track 1 steps are config, not code.

**Files:**
- Modify: `web/src/lib/connection.ts:43-49`
- Modify: `web/.env.local.example`
- Test: `web/tests/unit/connection.test.ts`

**Step 1: Write the failing test**

Open `web/tests/unit/connection.test.ts` and add to the existing test file:

```typescript
describe('DEFAULT_SETTINGS tunnel URL', () => {
  it('uses NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL env var when set', () => {
    // Reset modules to pick up new env var
    vi.resetModules();
    process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL = 'https://lmx.optalocal.com';

    const { DEFAULT_SETTINGS } = require('@/lib/connection');
    expect(DEFAULT_SETTINGS.tunnelUrl).toBe('https://lmx.optalocal.com');

    delete process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL;
  });

  it('defaults to empty string when env var is not set', () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL;
    vi.resetModules();

    const { DEFAULT_SETTINGS } = require('@/lib/connection');
    expect(DEFAULT_SETTINGS.tunnelUrl).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd web
npx vitest run tests/unit/connection.test.ts
```

Expected: FAIL — `DEFAULT_SETTINGS.tunnelUrl` is `''` regardless of env var.

**Step 3: Implement**

In `web/src/lib/connection.ts`, change `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: ConnectionSettings = {
  host: '192.168.188.11',
  port: 1234,
  adminKey: '',
  useTunnel: false,
  tunnelUrl: process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL ?? '',
};
```

**Step 4: Update `.env.local.example`**

Add to `web/.env.local.example`:

```bash
# Default tunnel URL (pre-fills Settings → Tunnel for new users)
NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL=https://lmx.optalocal.com
```

**Step 5: Run test to verify it passes**

```bash
npx vitest run tests/unit/connection.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
cd web
git add src/lib/connection.ts .env.local.example tests/unit/connection.test.ts
git commit -m "feat(web): read default tunnel URL from NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL env var"
```

---

### Task 2: Cloudflare Tunnel on Mono512

This is configuration work on the Mac Studio. No code changes.

**Step 1: SSH into Mono512**

```bash
ssh mono512   # or: ssh matt@192.168.188.11
```

**Step 2: Install cloudflared**

```bash
brew install cloudflared
```

**Step 3: Authenticate with Cloudflare**

```bash
cloudflared tunnel login
```

This opens a browser. Select the `optalocal.com` zone.

**Step 4: Create the tunnel**

```bash
cloudflared tunnel create opta-lmx
```

Note the tunnel ID printed (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). You'll need it next.

**Step 5: Create the tunnel config**

Create `/Users/Shared/312/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-ID-FROM-STEP-4>
credentials-file: /Users/Shared/312/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: lmx.optalocal.com
    service: http://localhost:1234
  - service: http_status:404
```

**Step 6: Route the domain**

```bash
cloudflared tunnel route dns opta-lmx lmx.optalocal.com
```

This adds a CNAME in Cloudflare DNS pointing `lmx.optalocal.com` → your tunnel.

**Step 7: Test the tunnel manually**

```bash
cloudflared tunnel run opta-lmx
```

In a separate terminal:

```bash
curl https://lmx.optalocal.com/v1/models
```

Expected: JSON response listing loaded models (or `[]` if none loaded).

**Step 8: Install as a launchd service (survives reboots)**

```bash
sudo cloudflared service install
```

Then start it:

```bash
sudo launchctl start com.cloudflare.cloudflared
```

Verify it's running:

```bash
sudo launchctl list | grep cloudflared
```

Expected: shows a PID (not `-`).

**Step 9: Fix Cloudflare SSE timeout**

In Cloudflare dashboard → `lmx.optalocal.com` → Network tab:
- Set **Response Buffering** to **Off** (prevents SSE connections being killed at 100 seconds)

**Step 10: Verify from your MacBook (no SSH)**

```bash
curl https://lmx.optalocal.com/admin/status
```

Expected: server status JSON.

---

### Task 3: Vercel Deployment

**Step 1: Push latest code to GitHub**

```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1L-Opta-Local
git push origin main
```

**Step 2: Create Vercel project**

- Go to vercel.com → Add New Project
- Import the GitHub repo
- Set **Root Directory** to `1-Apps/optalocal/1L-Opta-Local/web`
- Framework Preset: Next.js

**Step 3: Set environment variables in Vercel dashboard**

Add all of the following under Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL        = https://cytjsmezydytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <your anon key from Supabase dashboard>
NEXT_PUBLIC_SITE_URL            = https://local.optalocal.com
NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL = https://lmx.optalocal.com
```

**Step 4: Add custom domain**

In Vercel project → Settings → Domains → Add `local.optalocal.com`.

Vercel will give you DNS records to add. Go to Cloudflare DNS and add:
- CNAME: `local` → `cname.vercel-dns.com`

**Step 5: Verify deployment**

```bash
curl -I https://local.optalocal.com
```

Expected: `200 OK` with `x-powered-by: Next.js` header.

---

### Task 4: Supabase + Google OAuth

**Step 1: Add redirect URL in Supabase**

Supabase dashboard → Authentication → URL Configuration → Redirect URLs → Add:

```
https://local.optalocal.com/auth/callback
```

**Step 2: Create Google OAuth app**

- Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
- Application type: Web application
- Authorised redirect URI: `https://cytjsmezydytbmjrolyz.supabase.co/auth/v1/callback`
- Note the **Client ID** and **Client Secret**

**Step 3: Configure Google in Supabase**

Supabase dashboard → Authentication → Providers → Google:
- Enable Google provider
- Paste Client ID + Client Secret
- Save

**Step 4: Test the full OAuth round-trip**

Visit `https://local.optalocal.com` on your phone (mobile data, not home WiFi).

- Click Sign in with Google
- Complete OAuth flow
- Should land on dashboard at `https://local.optalocal.com`

**Step 5: Verify tunnel connection**

In Settings → Tunnel:
- Tunnel URL should show `https://lmx.optalocal.com` (pre-filled)
- Click Test Connection
- Should show `WAN · Xms`

---

## TRACK 2 — Feature: Models Page

**Context:** Dashboard already has `ModelList` (unload) and `ModelLoadDialog` (load by HuggingFace path). The `/models` page is a full-screen version of this — dedicated management view. Reuse both existing components.

### Task 5: Write tests for the models page

**Files:**
- Create: `web/tests/unit/models-page.test.tsx`

**Step 1: Create the test file**

```typescript
// web/tests/unit/models-page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the connection provider
vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => null,
}));

// Mock framer-motion (avoid animation complexity in unit tests)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
      <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    <>{children}</>,
}));

import ModelsPage from '@/app/models/page';

describe('ModelsPage', () => {
  it('renders the page header', () => {
    render(<ModelsPage />);
    expect(screen.getByRole('heading', { name: /models/i })).toBeInTheDocument();
  });

  it('shows offline state when no client', () => {
    render(<ModelsPage />);
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd web
npx vitest run tests/unit/models-page.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/models/page'`

---

### Task 6: Build the models page

**Files:**
- Create: `web/src/app/models/page.tsx`

**Step 1: Create the page**

```typescript
'use client';

/**
 * Models Page — Full-screen model management.
 *
 * Shows currently loaded models with unload controls (ModelList),
 * and a form to load a new model by HuggingFace path (ModelLoadDialog).
 * Reuses dashboard components. No new API calls needed.
 */

import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { useModels } from '@/hooks/useModels';
import { ModelList } from '@/components/dashboard/ModelList';
import { ModelLoadDialog } from '@/components/dashboard/ModelLoadDialog';
import type { ModelLoadRequest } from '@/types/lmx';

export default function ModelsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const { models, isLoading, refresh } = useModels(client);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [unloadingId, setUnloadingId] = useState<string | null>(null);

  const handleLoad = useCallback(
    async (modelPath: string, quantization?: string) => {
      if (!client) return;
      setIsLoadingModel(true);
      try {
        const req: ModelLoadRequest = { model_id: modelPath };
        if (quantization) req.quantization = quantization;
        await client.loadModel(req);
        refresh();
        setIsLoadDialogOpen(false);
      } finally {
        setIsLoadingModel(false);
      }
    },
    [client, refresh],
  );

  const handleUnload = useCallback(
    async (modelId: string) => {
      if (!client) return;
      setUnloadingId(modelId);
      try {
        await client.unloadModel(modelId);
        refresh();
      } finally {
        setUnloadingId(null);
      }
    },
    [client, refresh],
  );

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10',
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-semibold text-text-primary">Models</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!client ? (
          <p className="text-sm text-text-muted text-center pt-12">
            Not connected — check Settings to configure your server.
          </p>
        ) : (
          <>
            <ModelLoadDialog
              isOpen={isLoadDialogOpen}
              isLoading={isLoadingModel}
              onLoad={handleLoad}
              onClose={() => setIsLoadDialogOpen(false)}
            />
            <ModelList
              models={models}
              onUnload={handleUnload}
              isUnloading={unloadingId}
              onLoad={() => setIsLoadDialogOpen(true)}
            />
            {isLoading && models.length === 0 && (
              <p className="text-sm text-text-muted text-center pt-4">
                Loading models…
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
```

**Step 2: Run the tests**

```bash
cd web
npx vitest run tests/unit/models-page.test.tsx
```

Expected: PASS

**Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/models/page.tsx tests/unit/models-page.test.tsx
git commit -m "feat(web): add /models page for full-screen model management"
```

---

### Task 7: Add /models to the nav

**Files:**
- Modify: `web/src/components/shared/AppShell.tsx`

**Step 1: Find the models nav link**

```bash
grep -n "models\|Models" web/src/components/shared/AppShell.tsx
```

If there's already a `/models` link, verify it points to `/models` (not `/model`). If missing, add it in the nav links array alongside Chat, Sessions, etc.

**Step 2: Verify nav renders correctly**

```bash
npm run dev
```

Visit `http://localhost:3004` and confirm "Models" appears in the nav and clicking it loads the new page.

**Step 3: Commit if AppShell changed**

```bash
git add src/components/shared/AppShell.tsx
git commit -m "feat(web): add Models link to navigation"
```

---

### Task 8: Full CI check

```bash
cd web
npm run check
```

Expected: lint ✅, typecheck ✅, unit tests ✅, integration tests ✅, build ✅

If build fails on missing `ModelLoadRequest` type:

Check `web/src/types/lmx.ts` for `ModelLoadRequest`. If absent, add:

```typescript
export interface ModelLoadRequest {
  model_id: string;
  quantization?: string;
}
```

Rerun `npm run check`.

**Commit:**

```bash
git add -p   # stage only necessary fixes
git commit -m "fix(web): ensure ModelLoadRequest type is exported from lmx types"
```

---

## Final Validation

Run this checklist on your phone with **mobile data** (not home WiFi):

- [ ] `https://local.optalocal.com` loads in < 2s
- [ ] Sign in with Google completes without error
- [ ] Dashboard shows live VRAM gauge and loaded models
- [ ] Dashboard SSE stays connected for > 2 minutes without dropping
- [ ] Chat: type a message, receive a streaming response
- [ ] Chat: model picker shows currently loaded models
- [ ] Models: loaded models appear, unload button works, load dialog accepts a path
- [ ] Sessions: past sessions listed, clicking one resumes in chat
- [ ] Settings → Tunnel: `lmx.optalocal.com` is pre-filled
- [ ] Sign out and sign back in — session is restored

**Definition of done:** Every item above checked. TUI no longer required.
