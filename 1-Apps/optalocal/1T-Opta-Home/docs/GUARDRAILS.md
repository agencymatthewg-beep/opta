# Opta Home — Guardrails

Hard rules. These are non-negotiable without explicit Matthew override.

---

## Design

- **Never** use a different background than `#09090b` (void black)
- **Never** use linear CSS transitions for interactive elements — Framer Motion spring only
- **Never** deviate from the `.obsidian-interactive` hover system for cards
- **Never** modify the OptaRing CSS keyframe animations
- **Always** use `.text-moonlight` for primary H1/H2 headings
- **Always** apply `useInView` scroll triggers with `once: true`

## Architecture

- **Never** add API routes — this is a static site, full stop
- **Never** add server-side rendering — `output: 'export'` is locked
- **Never** fetch external data at runtime — all content is static strings
- **Never** add user auth or accounts flows — that's accounts.optalocal.com

## Links

- **Always** link Init CTA to `https://init.optalocal.com`
- **Always** link LMX to `https://lmx.optalocal.com`
- **Always** link Accounts to `https://accounts.optalocal.com`
- **Never** hardcode IP addresses or localhost URLs in production content

## Scope

- **Never** duplicate the init.optalocal.com setup guide inline
- **Never** duplicate the lmx dashboard functionality
- **Never** embed model download links directly (link to init instead)
- This site must NOT grow into a portal — each subdomain owns its function

## Deployment

- `npm run build` must pass cleanly before any deploy
- All TypeScript errors must be resolved — `strict: true` is non-negotiable
- Vercel project name: `opta-home` (separate from `opta-init`, `opta-lmx-web`)
