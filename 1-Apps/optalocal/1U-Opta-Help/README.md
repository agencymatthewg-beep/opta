# 1U-Opta-Help

Canonical path: `1-Apps/optalocal/1U-Opta-Help`

## Purpose

Documentation and support center for Opta Local, with canonical guidance on activating Opta AI through local LMX or cloud runtimes into CLI/Code workflows.

## Local Development

```bash
cd <optalocal-root>/1U-Opta-Help
npm install
npm run dev
```

## Validation

```bash
npm run check
```

## Adding Learn Links

1. Add or update route mappings in `lib/learn-route-guide-map.json` (`docsPrefix` -> `guides[]` slugs).
2. Prefer stable Help-side slugs and keep `lib/learn-guide-slug-aliases.json` in sync when Learn publishes a renamed guide.
3. Keep local fallback summaries/app tags in `lib/learn-about.ts` for any new slug used in Help.
4. Sync the Learn manifest and validate mappings:

```bash
npm run sync:learn-guides
npm run validate:learn-links
```

The validator resolves aliases first, then fails if any mapped slug is still missing from the synced Learn manifest (`lib/generated/learn-guides-manifest.json`).

## Build and Start

```bash
npm run build
npm run start
```
