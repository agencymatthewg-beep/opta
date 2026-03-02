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

Update release-control manifests when new releases ship:

1. Edit `channels/stable.json` and/or `channels/beta.json`
2. Keep artifact URLs in the canonical namespace:
   - `https://init.optalocal.com/downloads/...`
3. Sync deploy manifests:
   - `npm run sync:desktop-manifests`
4. Validate:
   - `npm run validate:release-manifests -- channels/stable.json channels/beta.json`
   - `npm run validate:manifest-links -- channels/stable.json channels/beta.json`

Commit + push -> Vercel auto-deploys.

## Lighthouse Audit

```bash
npx lighthouse https://init.optalocal.com --output html --output-path ./lighthouse.html
```

Must pass before every deploy: >= 95 Performance, 100 Accessibility, 100 SEO.
