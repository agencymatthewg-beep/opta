# Opta Init — Workflows

## Local Development

```bash
cd ~/Synced/Opta/1-Apps/optalocal/1O-Opta-Init
npm install
npm run dev           # localhost:3005
```

## Build + Export

```bash
npm run build         # next build + export
npm run start         # serve static export from out/ on localhost:3005
# Output in out/
# Deploy out/ to Vercel
```

## Deploy to Vercel

1. `npx vercel` (first time: link project)
2. Set domain: `init.optalocal.com`
3. Use `npx vercel deploy --prod --yes` for explicit production deploys
4. Vercel auto-deploys on push to main if Git integration is enabled

## Cloudflare DNS

Add record in Cloudflare for optalocal.com:
- Type: CNAME
- Name: init
- Value: cname.vercel-dns.com
- Proxy: DNS only (grey cloud) for Vercel SSL

## Clauding Workflow (AI-assisted development)

Trigger phrase: "Claude it"
Protocol: ~/Synced/AI26/2-Bot-Ops/2H-Workflows/CLAUDING.md

For this project:
1. Read APP.md + CLAUDE.md first
2. Check docs/ROADMAP.md for current phase
3. Implement one phase section at a time
4. Verify Lighthouse after each phase

## Updating Download URLs

Edit `lib/constants.ts` when new releases ship:
```ts
export const DOWNLOADS = {
  cli: { macos: '...', windows: '...' },
  lmx: { macos: '...', windows: '...' },
}
```

Commit + push -> Vercel auto-deploys.

## Lighthouse Audit

```bash
npx lighthouse https://init.optalocal.com --output html --output-path ./lighthouse.html
```

Must pass before every deploy: >= 95 Performance, 100 Accessibility, 100 SEO.
