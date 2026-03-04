# Opta Content Sync Map

This directory is the **single source of truth for cross-ecosystem content awareness** in the Opta Local monorepo. It answers one question:

> **After making a change, what else needs to be updated?**

## Structure

```
docs/content-sync-map/
├── README.md               ← This file
├── registry/
│   ├── apps.yaml           ← Canonical list of every Opta app
│   ├── logos.yaml          ← Every logo and every file that references it
│   └── content-nodes.yaml  ← Every content node mapped to what it describes
└── workflow/
    └── change-impact.md    ← AI workflow for generating update checklists
```

## How to Use

### As a human

Look up the relevant content node in `registry/content-nodes.yaml` and check its `stale_when` conditions.

### As an AI

Read `workflow/change-impact.md` and follow the instructions to produce a ripple-effect checklist from a natural-language change description.

You can also trigger the `/sync-check` slash command which will load the workflow automatically.

## How to Keep This Up to Date

**When adding a new page/component/guide:**

1. Add the app to `registry/apps.yaml` if it's a new app
2. Add the logo to `registry/logos.yaml` if a new logo was created
3. Add a new entry to `registry/content-nodes.yaml` for the new content node

**When updating a logo:**

1. Find the logo in `registry/logos.yaml`
2. Every file in `referenced_in` needs to be updated

**When shipping a new feature:**

1. Search `registry/content-nodes.yaml` for all nodes that `describes` the affected app
2. Check their `stale_when` list against the nature of the change

## Ownership

This registry is maintained as part of the Opta Local docs layer. Any AI working in this repo should update these files when it modifies content nodes.
