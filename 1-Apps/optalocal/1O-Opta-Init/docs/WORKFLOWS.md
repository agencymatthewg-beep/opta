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

## Updating Release Metadata

Update both release-control contracts whenever a new release ships:

1. Update component manifests:
   - `channels/stable.json`
   - `channels/beta.json`
2. Update manager updater metadata:
   - `channels/manager-updates/stable.json`
   - `channels/manager-updates/beta.json`
3. Keep URLs in canonical namespaces:
   - component artifacts: `https://init.optalocal.com/downloads/...`
   - manager updater artifacts: `https://init.optalocal.com/desktop-updates/manager/...`
4. Required manager signing variables:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
5. Sync publishable JSON:
   - `npm run sync:desktop-manifests`
   - `npm run sync:manager-updates`
6. Validate contracts and links:
   - `npm run validate:release-contract`
7. Smoke-check manager updater feed:
   - `curl -s https://init.optalocal.com/desktop-updates/stable.json | jq '.version, .pub_date, .platforms | keys'`
   - `curl -s https://init.optalocal.com/desktop-updates/beta.json | jq '.version, .pub_date, .platforms | keys'`

Commit + push -> Vercel auto-deploys.

## Lighthouse Audit

```bash
npx lighthouse https://init.optalocal.com --output html --output-path ./lighthouse.html
```

Must pass before every deploy: >= 95 Performance, 100 Accessibility, 100 SEO.
