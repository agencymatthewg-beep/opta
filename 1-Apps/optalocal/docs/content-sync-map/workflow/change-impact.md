---
description: |
  AI workflow for generating a ripple-effect update checklist after any change
  to an Opta app, feature, logo, or release. Run this with /sync-check or
  by asking: "What needs updating after I changed X?"
---

# Change Impact Analysis — Opta Content Sync Workflow

## Purpose

When a change is made to any Opta app, feature, logo, or release, this workflow
produces a precise, file-specific checklist of what else needs to be updated
across the entire Opta ecosystem (websites, guides, docs, manifests).

## Trigger

Run this workflow when you:

- Ship a new feature or fix to any core app (CLI, LMX, Code, Init, Daemon)
- Update a logo or brand asset
- Cut a new release (stable or beta)
- Add, remove, or rename an app or service
- Change a URL, port, or API contract

## Step 1: Load the Registry

Read these files from the repo:

```
docs/content-sync-map/registry/apps.yaml         ← App identity
docs/content-sync-map/registry/logos.yaml        ← Logo reference map
docs/content-sync-map/registry/content-nodes.yaml ← Content node map
```

## Step 2: Identify Affected App IDs

From the natural-language description of the change, identify which `id`(s) from
`apps.yaml` are affected.

**Examples:**

- "Added a new `--ceo` flag to the CLI" → `opta-cli`
- "Opta Code logo was redesigned" → check `logos.yaml`, then all `described_in` surfaces
- "LMX now supports vLLM backend" → `opta-lmx`
- "Shipped Init Manager v0.7.0 to stable" → `opta-init`
- "Added Windows support to stable channel" → `opta-cli`, `opta-init`

## Step 3: Query Content Nodes

Filter `content-nodes.yaml` for all nodes where:

1. The node's `describes` list contains any of the affected app IDs, **AND**
2. The node's `stale_when` list has a condition that matches the type of change

Group results by surface (site/app) for readability.

## Step 4: Query Logo Registry (if applicable)

If the change involves a logo update:

1. Find the logo in `logos.yaml`
2. Every file in `referenced_in` MUST be updated
3. Add each reference as a mandatory checklist item

## Step 5: Output the Checklist

Format the output as a structured checklist grouped by surface:

```markdown
## Update Checklist — [Change Description]

### 🚨 MUST Update (direct impact)
- [ ] `1T-Opta-Home/components/Hero.tsx` — [reason]
- [ ] `1T-Opta-Home/components/Ecosystem.tsx` — [reason]

### 📋 SHOULD Update (describes the affected app)
- [ ] `1V-Opta-Learn/content/guides/cli-masterclass.ts` — [reason]
- [ ] `1U-Opta-Help/app/docs/cli/` — [reason]

### 💡 CONSIDER Updating (indirectly affected)
- [ ] `1S-Opta-Status/app/release-notes.ts` — new release should be noted
- [ ] `1S-Opta-Status/app/features/page.tsx` — new feature to register
```

## Priority Rules

| Priority | Condition |
|---|---|
| 🚨 MUST | Logo change — all `referenced_in` files |
| 🚨 MUST | Download manifest — new release URL |
| 🚨 MUST | Service card name/URL — `status.service-cards` |
| 📋 SHOULD | Any node whose `stale_when` exactly matches the change type |
| 💡 CONSIDER | Nodes that `describe` the app but whose `stale_when` is a loose match |

## Example Run

**Change:** "Opta Code logo redesigned — new SVG committed to public/logos/"

**Step 1:** Load registry ✓

**Step 2:** Affected apps: `opta-code`. Also triggers logo workflow.

**Step 3:** Content nodes that describe `opta-code` and are stale by logo change:

- `home.hero` (describes opta-code, stale_when: "A core app logo is updated")
- `home.ecosystem` (describes opta-code, stale_when: "Any core app logo changes")
- `init.desktop-manager-app` (stale_when: "A logo is updated")

**Step 4:** Logo `opta-code-mark.svg` from logos.yaml → 4 referenced files:

- `1T-Opta-Home/components/Hero.tsx`
- `1T-Opta-Home/components/Ecosystem.tsx`
- `1O-Opta-Init/desktop-manager/src/App.tsx`
- `1P-Opta-Code-Universal/src/App.tsx`

**Output:**

```markdown
## Update Checklist — Opta Code Logo Redesigned

### 🚨 MUST Update (logo reference)
- [ ] `1T-Opta-Home/components/Hero.tsx:10` — /logos/opta-code-mark.svg referenced
- [ ] `1T-Opta-Home/components/Ecosystem.tsx:37` — /logos/opta-code-mark.svg referenced
- [ ] `1O-Opta-Init/desktop-manager/src/App.tsx:23` — LOGOS map, key opta-code-universal
- [ ] `1P-Opta-Code-Universal/src/App.tsx` — /opta-code-mark.svg in top-bar img src

### 📋 SHOULD Verify
- [ ] `1O-Opta-Init/public/logos/opta-code-mark.svg` — canonical source, confirm committed
- [ ] `design/logos/Opta-Code-Desktop/` — update design source files
```

## Keeping This Workflow Current

After each change, update `registry/content-nodes.yaml` if:

- A new file was created that describes an Opta app
- A file was deleted or moved
- New `stale_when` conditions were discovered

Update `registry/logos.yaml` if:

- A logo was added, renamed, or moved
- A new file started referencing an existing logo
