# Auto-02: Web Fetch Tool

**Priority:** HIGH (gap score 3) | **Effort:** ~120 lines | **New tool**
**Competitors with this:** Claude Code (WebFetch), OpenCode (webfetch), Gemini CLI (Google Search)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-02-web-fetch-tool.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/tools.ts` — ALL tool definitions and implementations (add web_fetch here)
3. `src/core/agent.ts` — System prompt (needs to mention the new tool)
4. `tests/core/tools.test.ts` — Add tests for new tool
</context>

<instructions>
### 1. Add `web_fetch` tool schema to TOOL_SCHEMAS array in `tools.ts`

```typescript
{
  type: 'function' as const,
  function: {
    name: 'web_fetch',
    description: 'Fetch a URL and extract readable text content (HTML → markdown). Use for reading documentation, API references, or web pages.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTP or HTTPS URL to fetch' },
        max_chars: { type: 'number', description: 'Maximum characters to return (default: 10000)' },
      },
      required: ['url'],
    },
  },
}
```

### 2. Implement the tool execution in `executeTool`

Use Node's built-in `fetch()` (available in Node 20+):
1. Fetch the URL with a 10-second timeout using `AbortController`
2. Get the response text
3. Strip HTML tags with a simple regex: `html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()`
4. Truncate to `max_chars` (default 10000)
5. Return the cleaned text

**Do NOT add any dependencies.** Use built-in `fetch` only.

For better quality, extract content between `<main>`, `<article>`, or `<body>` tags first if present, before stripping all HTML.

### 3. Security

- Only allow `http://` and `https://` URLs
- Reject `file://`, `data://`, `javascript:` URLs
- Set User-Agent to `Opta-CLI/0.1 (web-fetch)`
- Timeout: 10 seconds max

### 4. Update system prompt

In `agent.ts` `buildSystemPrompt()`, add a line mentioning the web_fetch tool:
```
- web_fetch: Fetch and read web pages (documentation, APIs, references)
```

### 5. Tests

Add to `tests/core/tools.test.ts`:
- URL validation test (rejects file://, data://, etc.)
- Schema presence test (web_fetch in TOOL_SCHEMAS)
- Mock fetch test (returns truncated text)
</instructions>

<constraints>
- ZERO new dependencies — use Node built-in fetch only
- Must work offline gracefully (return error message, don't crash)
- Max response: 10,000 chars default, configurable
- HTML stripping is basic (not a full markdown converter) — that's fine
- This becomes tool #10 (after read_project_docs)
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-02 — web_fetch tool added (tool #10, zero deps)" --mode now
```
</output>
