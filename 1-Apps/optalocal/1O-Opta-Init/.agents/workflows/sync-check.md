---
description: Analyse what needs updating across all Opta sites and apps after a change. Reads the content-sync-map registry and produces a ripple-effect update checklist.
---

# /sync-check — Opta Content Sync Checker

## When to Use

Run this command after:

- Shipping a new feature or fix to any Opta app
- Updating a logo or brand asset
- Cutting a new release (stable or beta)
- Adding, removing, or renaming an app or service
- Changing a URL, port number, API contract, or CLI command

## Process

// turbo-all

1. Read the workflow instructions:

   ```
   view_file docs/content-sync-map/workflow/change-impact.md
   ```

2. Read all three registry files:
   - `docs/content-sync-map/registry/apps.yaml`
   - `docs/content-sync-map/registry/logos.yaml`
   - `docs/content-sync-map/registry/content-nodes.yaml`

3. Ask the user (if not already stated):
   > "Describe the change you just made. Include: what app, what changed (feature, logo, version, URL, API), and whether it went to stable or beta."

4. Follow the change-impact workflow to:
   - Identify affected app IDs
   - Find all matching content nodes from the registry
   - Find all logo references if a logo changed
   - Classify each as MUST / SHOULD / CONSIDER

5. Output the full update checklist, grouped by surface (site/app), with file paths and reasons.

6. For any MUST items, offer to immediately execute the update.
