# Opta Local Product Model (Canonical)

Last updated: 2026-03-01
Owner: Opta Local

## Core Product Definition

Opta Local consists of **4 main local apps**:

1. **Opta Init Desktop Manager**
   - The only end-user install target from OptaLocal websites; manages lifecycle of the rest of the stack.
2. **Opta LMX**
   - Core local inference engine.
3. **Opta CLI**
   - Terminal-first control surface for local AI workflows.
4. **Opta Code Desktop (macOS + Windows)**
   - Desktop application surface for session and coding workflow control.

## Management Websites (Support / Infrastructure)

These are **management websites**, not main local apps:

- **optalocal.com** (Opta Home): brand + ecosystem landing
- **init.optalocal.com** (Opta Init Website): onboarding + distribution page for the desktop manager
- **help.optalocal.com** (Opta Help): technical reference docs
- **learn.optalocal.com** (Opta Learn): discovery + guide portal
- **accounts.optalocal.com** (Opta Accounts): identity, keys, account settings
- **status.optalocal.com** (Opta Status): health + incident visibility
- **admin.optalocal.com** (Opta Admin): private website-management control plane (fleet ops + guide promotions)

## Terminology Alignment (Home / Help / Learn / Admin)

- **Opta Home**: brand + ecosystem landing (`optalocal.com`)
- **Opta Help**: technical reference documentation (`help.optalocal.com`)
- **Opta Learn**: guided onboarding and workflow education (`learn.optalocal.com`)
- **Opta Admin**: private control plane for site operations and guide promotion (`admin.optalocal.com`)

Source-of-truth references:
- `docs/content-sync-map/registry/apps.yaml` (canonical app naming + role map)
- `docs/PRODUCT-MODEL.md` (product taxonomy authority)
- `websites.registry.json` (domain-to-surface registry consumed by website tooling)

Legal/copy review checklist before publish:
- [ ] Use canonical names exactly: "Opta Home", "Opta Help", "Opta Learn", "Opta Admin".
- [ ] Keep Help vs Learn boundary explicit (reference docs vs guided learning).
- [ ] Keep Admin labeled private/internal; do not present as a public end-user app.
- [ ] Reconfirm domain/name pairing is accurate (`optalocal.com`, `help.`, `learn.`, `admin.`).

## Taxonomy Rules (Non-Negotiable)

1. Do not label surface websites as core apps.
2. "Your Opta Apps" sections must list only the 4 main local apps.
3. Technical architecture terms (daemon, web dashboard internals) are not product taxonomy.
4. If a page needs both views, split into:
   - **Product taxonomy** (what users buy/use)
   - **Architecture** (how it works internally)

## Approved One-Line Copy

- **Opta CLI** — "Terminal-first control for the Opta Local stack."
- **Opta LMX + Dashboard** — "Local inference engine with a real-time dashboard."
- **Opta Code Desktop** — "Desktop app for Opta workflows on macOS and Windows."



## Distribution Rule (Canonical)

- The **only user-downloadable app on OptaLocal websites is Opta Init Desktop Manager**.
- Opta Init Website and Opta Init Desktop Manager are separate surfaces:
  - Website = onboarding/distribution/metadata
  - Desktop app = installed control plane users run locally
- Other apps (LMX/CLI/Code) are managed via Opta Init, not directly downloaded from marketing/onboarding pages.
