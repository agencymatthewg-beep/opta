# Gemini Prompt Pack for Opta Learn Guides

This folder provides a deterministic Gemini workflow aligned to the enforced guide system in Learn:
- `content/guides/templates.ts` (5 approved templates)
- `scripts/new-guide.mjs` (guide scaffolding)
- `scripts/validate-guides.mjs` (template/link validation)

## Authoring loop

1. Scaffold a new draft guide:

```bash
npm run guide:new -- \
  --slug <slug> \
  --title "<title>" \
  --app <lmx|cli|accounts|init|general> \
  --category <getting-started|feature|troubleshooting|reference> \
  --template <holistic-whole-app|feature-deep-dive|process-workflow|setting-configuration|visual-interactive-journey> \
  --status draft
```

2. Send Gemini:
- `system-opta-learn.md` as the system instruction.
- One template prompt file matching `template`.
- The generated guide file content (`content/guides/<slug>.ts`) as context.

3. Ask Gemini to return only a JSON payload with this shape:

```json
{
  "summary": "...",
  "tags": ["..."],
  "sections": [
    {
      "heading": "...",
      "body": "...",
      "note": "optional",
      "code": "optional",
      "visual": "optional"
    }
  ]
}
```

4. Apply Gemini output into the scaffolded file (replace `summary`, `tags`, `sections`).

5. Validate:

```bash
npm run guides:validate
npm run lint
npm run build
```

## Stricter structure standard (required)

- Lifecycle flow coverage in headings:
  1. `Setup`
  2. `Configuration`
  3. `Operation`
  4. `Troubleshooting`
  5. `Optimization`
- Prefer explicit heading labels (`[Setup]`, `[Configuration]`, ...).
- App-focused guides must include concrete config surfaces (flags, env vars, profile keys, or UI settings).
- Rich content block coverage is mandatory:
  - `code` blocks (runnable snippets),
  - `note` blocks (high-impact caveats),
  - `visual` blocks (structured HTML with meaningful classes/layout).

## Rules

- Do not hardcode keys in prompts or files.
- Use only the approved template IDs.
- Keep cross-guide links as HTML anchors (`<a href="/guides/...">`).
- For `process-workflow` and `setting-configuration`, include at least one `code` block.
- Keep content end-to-end (first setup through stable operation + recovery + optimization), not feature summaries.
- For `visual-interactive-journey`, enforce visual-first composition with compact text and interactive HTML blocks (`details`, staged cards, decision flow visuals).
