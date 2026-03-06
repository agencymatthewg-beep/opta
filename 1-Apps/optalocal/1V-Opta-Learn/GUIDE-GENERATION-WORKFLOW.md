# Opta Learn Guide Generation Workflow

## 0. Quality Bar (Mandatory)

All published guides on learn.optalocal.com must match the CLI masterclass quality baseline:
- Dense explanatory depth (architecture + operation + failure modes)
- Full lifecycle flow coverage from setup to optimization
- At least one integrated visual block per guide section set (template-enforced)
- Cross-guide linking where relevant (`/guides/cli`, `/guides/lmx`, `/guides/accounts`, `/guides/code-desktop`)
- Practical operational commands and verification paths
- No thin summaries for verified guides

This document outlines the strict process for generating content and guides for the `learn.optalocal.com` platform.
Canonical key/workflow index: `<optalocal-root>/docs/GEMINI-GEMDESIGN-WORKFLOW-AND-KEYS.md`

## 1. Tooling Requirements

**CRITICAL MANDATE:** ONLY use **Gemini 3.1 with the frontend design skill** to generate new guides for Opta Learn. Do not use other models, tools, or plain text generators. This ensures strict adherence to the Opta visual hierarchy, tone, and component structures.

## 2. The Opta Aesthetic (Learn Context)

`learn.optalocal.com` is classified as a **Management Website**. 
- **Tone:** Calm authority, approachable, highly discoverable. No generic AI fluff.
- **Typography:** **Sora** for body, prose, and headings. **JetBrains Mono** strictly for quantitative data, code, terminal commands, and configuration keys.
- **Visuals:** Guides MUST include educational, inline HTML/Tailwind/SVG visuals using the `visual` field to aid visual learners. Use Obsidian interactive cards, glass search bars, `.bg-dot-subtle` backgrounds, and canonical brand colors.
- **Colors:** Mixed per-app (`#a855f7` for LMX, `#22c55e` for CLI, `#3b82f6` for Accounts, `#f59e0b` for Init, `#a1a1aa` for General).

## 3. Guide Data Structure

All guides must be generated as TypeScript objects implementing the `Guide` interface defined in `1V-Opta-Learn/content/guides/index.ts`.

```typescript
export interface Guide {
  slug: string;             // kebab-case
  title: string;            // Concise, action-oriented or descriptive
  app: AppSlug;             // 'lmx' | 'cli' | 'accounts' | 'init' | 'general'
  category: Category;       // 'getting-started' | 'feature' | 'troubleshooting' | 'reference'
  template: GuideTemplateId;// Approved template ID (required)
  summary: string;          // 1-2 sentences
  tags: string[];           // For search discoverability
  sections: GuideSection[]; // The content payload
  updatedAt: string;        // YYYY-MM-DD
}

export interface GuideSection {
  heading: string;
  body: string;             // Primary text (Sora). Rendered as HTML.
  note?: string;            // Renders as an Amber callout. Rendered as HTML.
  code?: string;            // Renders in a JetBrains Mono dark block.
  visual?: string;          // HTML string utilizing Tailwind/SVG for inline visuals.
}
```

### 3.1 Inline Wikipedia-Style App Linking (NEW)

Because the `body` and `note` fields are parsed via `dangerouslySetInnerHTML` in the Next.js frontend, **you must embed raw HTML links whenever referencing other Opta Apps**. 

This creates a cohesive, Wikipedia-style interconnected learning network. Use the following syntax:

- `<a href="/guides/cli" class="app-link link-cli">Opta CLI</a>`
- `<a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a>`
- `<a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a>`
- `<a href="/guides/code-desktop" class="app-link link-general">Opta Code Desktop</a>`
- `<a href="/guides/browser-automation" class="app-link link-general">Browser Automation</a>`

*Note: The frontend will automatically wrap naked plain-text "Opta" mentions in the brand purple, but generating the specific `<a>` links when cross-referencing apps is a hard requirement for all guide generation.*

## 4. Types of Guides

Guides must be structured based on their scope and purpose. Use the following archetypes when generating `sections`:

### 4.1 Approved Template IDs (Hard Requirement)

Every new guide must use one and only one approved template ID:

1. `holistic-whole-app` — **L4 Masterclass extent** (widest and deepest)
2. `feature-deep-dive` — **L3 Deep-Dive extent**
3. `process-workflow` — **L2 Operational extent**
4. `setting-configuration` — **L1 Reference extent** (narrowest and most precise)
5. `visual-interactive-journey` — **L3 Visual-first interactive extent**

These five templates are the only approved structures for preserving Opta Learn aesthetic, format, and rendering behavior.

### 4.2 Lifecycle Stage Standard (Mandatory for all templates)

All guides must cover this complete flow in canonical order using heading markers or equivalent heading language:
1. `[Setup]`
2. `[Configuration]`
3. `[Operation]`
4. `[Troubleshooting]`
5. `[Optimization]`

For app-focused guides (`app !== 'general'`), settings/configuration coverage is mandatory and must include concrete surfaces such as CLI flags, env vars, profile keys, or UI settings.

### A. Holistic Whole App Guide
**Purpose:** An extensive, masterclass-level deep dive into a primary application (e.g., LMX Masterclass). Guides are automatically injected into an interactive sticky TOC.
**Tone:** Educational, multi-tiered, deeply visual via code blocks and structural formatting.
**Minimum Requirements:**
1. **7+ sections**
2. **360+ words**
3. **2+ visuals**
4. **2+ code blocks**
5. **All lifecycle stages covered**
6. **At least two sections beyond the five lifecycle stages** for architecture/deployment depth

### B. Feature Guide
**Purpose:** Deep dive into a specific capability within an app (e.g., Accounts Local Sync).
**Tone:** Focused, practical, illuminating.
**Minimum Requirements:**
1. **5+ sections**
2. **220+ words**
3. **1+ visual block**
4. **1+ code block**
5. **1+ note/callout block**
6. **All lifecycle stages covered**

### C. Process / Workflow Guide
**Purpose:** Step-by-step instructions to achieve a specific goal (e.g., CLI Setup, Importing a GGUF).
**Tone:** Direct, instructional, precise. Heavy use of `code` blocks.
**Minimum Requirements:**
1. **5+ sections**
2. **240+ words**
3. **1+ visual block**
4. **1+ code block**
5. **All lifecycle stages covered**
6. **Deterministic verification and recovery loop**

### D. Setting / Configuration Guide
**Purpose:** Detail a specific configuration flag, environment variable, or system setting.
**Tone:** Terse, factual, reference-like.
**Minimum Requirements:**
1. **5+ sections**
2. **220+ words**
3. **1+ visual block**
4. **1+ code block**
5. **1+ note/callout block**
6. **All lifecycle stages covered**
7. **Explicit config/default/rollback coverage**

### E. Visual Interactive Journey Guide
**Purpose:** Visual-first end-to-end guide where interaction blocks carry most explanatory weight.
**Tone:** Minimal prose, high clarity, operationally grounded.
**Minimum Requirements:**
1. **5+ sections in canonical lifecycle order**
2. **120–420 words total**
3. **4+ visual blocks**
4. **Visual coverage ratio >= 0.8**
5. **Max 45 words per section body**
6. **App-focused guides include concrete config surfaces**

## 5. Execution Workflow

When instructed to create a new guide:

1. **Activate Skill:** Ensure Gemini 3.1 with the frontend design skill is active.
2. **Analyze Request:** Determine the target `AppSlug`, `Category`, and Guide Type (App, Feature, Process, Setting).
3. **Draft Object:** Generate the valid TypeScript object adhering to the structure. Ensure `app-link` anchor tags are heavily utilized in the `body` string.
   - Use the reusable Gemini prompt pack in `1V-Opta-Learn/prompts/gemini/`:
     - `system-opta-learn.md`
     - `template-<id>.md` matching the selected template.
4. **Apply Aesthetics:** Ensure tone matches Opta guidelines. Use `note` for callouts and `code` for snippets. Keep summaries tight.
5. **Export & Register:** 
   - Create the new file in `1V-Opta-Learn/content/guides/<slug>.ts`.
   - Update `1V-Opta-Learn/content/guides/index.ts` to import the new guide and add it to the `allGuides` array.
   - Preferred: use the enforced scaffolder so template structure and registration are generated automatically:
     - `npm run guide:new -- --slug <slug> --title "<title>" --app <lmx|cli|accounts|init|general> --category <getting-started|feature|troubleshooting|reference> --template <holistic-whole-app|feature-deep-dive|process-workflow|setting-configuration|visual-interactive-journey>`
6. **Verify:** 
   - Run `npm run guides:validate` to enforce template structure, lifecycle-stage coverage, config coverage, visual/content block thresholds, and internal guide-link integrity.
   - Run `npm run lint` and ensure it passes.
   - Run `npm run build` and ensure static generation succeeds.
   - Check that no forbidden visual descriptors or generic AI language were used in the content strings.

## 6. Author Checklist (Before Marking Verified)

- [ ] Heading flow covers `[Setup]`, `[Configuration]`, `[Operation]`, `[Troubleshooting]`, `[Optimization]`.
- [ ] Guide meets template minimum section and word thresholds.
- [ ] Rich blocks are present (`code`, `note`, `visual`) per template.
- [ ] App-focused guides include concrete settings/configuration surfaces.
- [ ] Internal app links use `/guides/<slug>` anchors only.
- [ ] Validation succeeds: `npm run guides:validate` and `npm run check`.

## 6.1 CI Enforcement

- Repository workflow: `.github/workflows/opta-learn-quality.yml`
- CI gates on Learn changes:
  - `npm ci`
  - `npm run guides:inventory:check` (fails if `content/guides/index.ts` manifest inventory is stale)
  - `npm run check` (full gate: typecheck + lint + `guides:validate` + build)

This ensures guide template compliance and rendering integrity are enforced before merge.
