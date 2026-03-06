# Opta Admin (`1X-Opta-Admin`)

Private website-management control plane for the Opta Local web surfaces (`admin.optalocal.com`).

## Purpose

- Manage Opta management websites as a single fleet (Home, Init, Accounts, Status, Help, Learn, Admin).
- Track local and production reachability for each website.
- Operate Opta Learn guide promotion workflow (draft -> verified) from one interface.
- Surface recent promotion actions (attempt/success/failure) with structured admin audit visibility.
- Integrate status signals from Opta Status (`/api/health/admin`) plus feature-registry snapshot data.

## Local Development

```bash
cd 1X-Opta-Admin
npm install
npm run dev
```

Default local URL: `http://localhost:3008`

## Auth Configuration

Set the following environment variables for admin access control:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPTA_ADMIN_ALLOWED_EMAILS` (comma-separated emails, e.g. `admin1@example.com,admin2@example.com`)
- `NEXT_PUBLIC_ACCOUNTS_SIGN_IN_URL` (optional, defaults to `https://accounts.optalocal.com/login`)
- `PROMOTION_ALLOWED_SLUGS` (optional allowlist, comma-separated slugs or `*`/`all`; defaults to all slugs for authenticated admins)

Auth behavior:

- `/api/health` is always public.
- `/unauthorized` is public so redirects can resolve.
- All other routes require a signed-in Supabase user.
- In production, missing `OPTA_ADMIN_ALLOWED_EMAILS` fails closed (no admin access).
- In non-production, if `OPTA_ADMIN_ALLOWED_EMAILS` is unset, any signed-in user is allowed.

## Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run check
```

`check` runs typecheck + lint + build.

## How it integrates

- Reads guide source + manifest from `../1V-Opta-Learn/`.
- Promotion API updates `1V-Opta-Learn/content/guides/index.ts` and runs `npm run guides:inventory`.
- Website fleet view is sourced from `src/app/lib/websites.ts`.
- Admin ops snapshot API (`/api/admin-ops`) exposes:
  - in-memory recent admin actions (ring buffer, newest first)
  - status probe from `status.optalocal.com/api/health/admin`
  - feature registry summary parsed from `../1S-Opta-Status/docs/feature-audit.md` when available

## Audit + Status Notes

- Audit records are intentionally lightweight and runtime-local (in-memory ring buffer, no external database).
- This keeps production-safe visibility without introducing heavy infrastructure.
- Feature registry snapshot gracefully degrades when the sibling `1S-Opta-Status` repo is not mounted in the runtime.

## Key Files

- `src/app/page.tsx` — server data loading for guides + website health snapshots.
- `src/app/components/AdminDashboardUI.tsx` — admin UI for website operations + guide promotion.
- `src/app/api/promote/route.ts` — draft promotion endpoint for Opta Learn guides.
- `src/app/api/admin-ops/route.ts` — structured admin operations snapshot API.
- `src/app/api/health/route.ts` — lightweight health endpoint for status polling.
- `src/app/lib/adminOps.ts` — audit ring buffer + status/feature snapshot helpers.
- `src/app/lib/types.ts` — shared typed models for guides, promotion API, website health, and admin ops.
- `src/app/lib/websites.ts` — canonical managed-website registry and probes.
