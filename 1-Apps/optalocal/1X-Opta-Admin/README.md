# Opta Admin (`1X-Opta-Admin`)

Private website-management control plane for the Opta Local web surfaces (`admin.optalocal.com`).

## Purpose

- Manage Opta management websites as a single fleet (Home, Init, Accounts, Status, Help, Learn, Admin).
- Track local and production reachability for each website.
- Operate Opta Learn guide promotion workflow (draft -> verified) from one interface.

## Local Development

```bash
cd 1X-Opta-Admin
npm install
npm run dev
```

Default local URL: `http://localhost:3008`

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

## Key Files

- `src/app/page.tsx` — server data loading for guides + website health snapshots.
- `src/app/components/AdminDashboardUI.tsx` — admin UI for website operations + guide promotion.
- `src/app/api/promote/route.ts` — draft promotion endpoint for Opta Learn guides.
- `src/app/api/health/route.ts` — lightweight health endpoint for status polling.
- `src/app/lib/types.ts` — shared typed models for guides and website health.
- `src/app/lib/websites.ts` — canonical managed-website registry and probes.
