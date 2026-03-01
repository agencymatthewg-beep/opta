# Opta Learn Guide Generation Workflow

This document outlines the strict process for generating content and guides for the `learn.optalocal.com` platform.

## 1. Tooling Requirements

**CRITICAL MANDATE:** ONLY use **Gemini 3.1 with the frontend design skill** to generate new guides for Opta Learn. Do not use other models, tools, or plain text generators. This ensures strict adherence to the Opta visual hierarchy, tone, and component structures.

## 2. The Opta Aesthetic (Learn Context)

`learn.optalocal.com` is classified as a **Management Website**. 
- **Tone:** Calm authority, approachable, highly discoverable. No generic AI fluff.
- **Typography:** **Sora** for body, prose, and headings. **JetBrains Mono** strictly for quantitative data, code, terminal commands, and configuration keys.
- **Visuals:** Obsidian interactive cards, glass search bars, `.bg-dot-subtle` backgrounds.
- **Colors:** Mixed per-app (`#a855f7` for LMX, `#22c55e` for CLI, `#3b82f6` for Accounts, `#f59e0b` for Init, `#a1a1aa` for General).

## 3. Guide Data Structure

All guides must be generated as TypeScript objects implementing the `Guide` interface defined in `1V-Opta-Learn/content/guides/index.ts`.

```typescript
export interface Guide {
  slug: string;             // kebab-case
  title: string;            // Concise, action-oriented or descriptive
  app: AppSlug;             // 'lmx' | 'cli' | 'accounts' | 'init' | 'general'
  category: Category;       // 'getting-started' | 'feature' | 'troubleshooting' | 'reference'
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
}
```

### 3.1 Inline Wikipedia-Style App Linking (NEW)

Because the `body` and `note` fields are parsed via `dangerouslySetInnerHTML` in the Next.js frontend, **you must embed raw HTML links whenever referencing other Opta Apps**. 

This creates a cohesive, Wikipedia-style interconnected learning network. Use the following syntax:

- `<a href="/guides/cli" class="app-link link-cli">Opta CLI</a>`
- `<a href="/guides/init" class="app-link link-init">Opta Init</a>`
- `<a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a>`
- `<a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a>`
- `<a href="/guides/dashboard" class="app-link link-dashboard">Opta Local Dashboard</a>`

*Note: The frontend will automatically wrap naked plain-text "Opta" mentions in the brand purple, but generating the specific `<a>` links when cross-referencing apps is a hard requirement for all guide generation.*

## 4. Types of Guides

Guides must be structured based on their scope and purpose. Use the following archetypes when generating `sections`:

### A. Holistic Whole App Guide
**Purpose:** An extensive, masterclass-level deep dive into a primary application (e.g., LMX Masterclass). Guides are automatically injected into an interactive sticky TOC.
**Tone:** Educational, multi-tiered, deeply visual via code blocks and structural formatting.
**Required Sections:**
1. **Ecosystem Role / Overview:** How it fits into the Opta stack (with `app-link` cross-references).
2. **Architecture:** How it works under the hood (memory tiers, daemons, etc).
3. **Feature Deep-Dive:** Comprehensive breakdowns of individual capabilities.
4. **Integrated Workflows:** How to use the app in conjunction with the rest of the stack.

### B. Feature Guide
**Purpose:** Deep dive into a specific capability within an app (e.g., Accounts Local Sync).
**Tone:** Focused, practical, illuminating.
**Required Sections:**
1. **What is [Feature]?:** Clear definition.
2. **Use Cases:** Why a user would enable or interact with this.
3. **Under the Hood:** Brief technical explanation of how it works locally.
4. **Usage / Configuration:** How to turn it on or use it.

### C. Process / Workflow Guide
**Purpose:** Step-by-step instructions to achieve a specific goal (e.g., CLI Setup, Importing a GGUF).
**Tone:** Direct, instructional, precise. Heavy use of `code` blocks.
**Required Sections:**
1. **Prerequisites:** What is needed before starting.
2. **Step-by-Step Execution:** Sequential headings (Step 1, Step 2, etc.) using `body` and `code` fields.
3. **Verification:** How the user knows the process was successful (e.g., terminal output).

### D. Setting / Configuration Guide
**Purpose:** Detail a specific configuration flag, environment variable, or system setting.
**Tone:** Terse, factual, reference-like.
**Required Sections:**
1. **Definition:** What the setting does and its default value.
2. **Impact:** Security, performance, or UI implications of changing it.
3. **Examples:** Valid and invalid states using the `code` field.
4. **Warnings:** Use the `note` field for destructive or high-impact changes.

## 5. Execution Workflow

When instructed to create a new guide:

1. **Activate Skill:** Ensure Gemini 3.1 with the frontend design skill is active.
2. **Analyze Request:** Determine the target `AppSlug`, `Category`, and Guide Type (App, Feature, Process, Setting).
3. **Draft Object:** Generate the valid TypeScript object adhering to the structure. Ensure `app-link` anchor tags are heavily utilized in the `body` string.
4. **Apply Aesthetics:** Ensure tone matches Opta guidelines. Use `note` for callouts and `code` for snippets. Keep summaries tight.
5. **Export & Register:** 
   - Create the new file in `1V-Opta-Learn/content/guides/<slug>.ts`.
   - Update `1V-Opta-Learn/content/guides/index.ts` to import the new guide and add it to the `allGuides` array.
6. **Verify:** Check that no forbidden visual descriptors or generic AI language were used in the content strings.