# Auto-04: Multi-File Edit (Batch Edit Tool)

**Priority:** HIGH (gap score 3) | **Effort:** ~80 lines | **Tool upgrade**
**Competitors with this:** OpenCode (patch + multiedit), Aider (multi-file edits)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-04-multi-edit-tool.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/tools.ts` — Current edit_file tool (extend with multi_edit)
3. `tests/core/tools.test.ts` — Add multi_edit tests
</context>

<instructions>
### 1. Add `multi_edit` tool schema to TOOL_SCHEMAS

```typescript
{
  type: 'function' as const,
  function: {
    name: 'multi_edit',
    description: 'Apply multiple edits across one or more files in a single operation. More efficient than calling edit_file repeatedly. Each edit replaces old_text with new_text.',
    parameters: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          description: 'Array of edit operations',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path (relative to cwd)' },
              old_text: { type: 'string', description: 'Exact text to find' },
              new_text: { type: 'string', description: 'Replacement text' },
            },
            required: ['path', 'old_text', 'new_text'],
          },
        },
      },
      required: ['edits'],
    },
  },
}
```

### 2. Implement multi_edit execution

In the `executeTool` switch statement, add `case 'multi_edit'`:
1. Parse edits array from args
2. Group edits by file path (batch same-file edits together)
3. For each file:
   - Read file content once
   - Apply all edits for that file sequentially (each old_text → new_text)
   - Write file once
4. Return a summary: `"Applied N edits across M files: file1.ts (2 edits), file2.ts (1 edit)"`

### 3. Error handling

- If an old_text is not found: report which edit failed but continue with others
- If old_text appears multiple times: fail that specific edit (same as edit_file behavior)
- Return partial success: `"4/5 edits applied. Failed: edit #3 in utils.ts (text not found)"`

### 4. Tests

Add to `tests/core/tools.test.ts`:
- Multi-edit applies all edits to a single file
- Multi-edit works across multiple files
- Partial failure reports correctly
- Empty edits array returns gracefully
</instructions>

<constraints>
- Reuse existing edit_file logic internally (DRY)
- Max 20 edits per call (prevent abuse)
- Each edit still requires exact text match (no regex)
- This becomes tool #11
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-04 — multi_edit tool added (batch edits across files, tool #11)" --mode now
```
</output>
