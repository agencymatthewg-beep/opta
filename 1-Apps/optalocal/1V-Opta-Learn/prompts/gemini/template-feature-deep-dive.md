Template ID: feature-deep-dive
Extent: L3-deep-dive

Generate a focused capability guide with technical depth and practical usage.

Required structure:
- Minimum 5 sections.
- Headings must cover full lifecycle flow:
  1. `[Setup]` entry context and prerequisites
  2. `[Configuration]` settings/flags and expected defaults
  3. `[Operation]` normal runtime usage
  4. `[Troubleshooting]` failure patterns + corrective actions
  5. `[Optimization]` tuning, scaling, or reliability improvements

Writing constraints:
- Clarify scope boundaries (what it does and does not do).
- Include implementation-relevant behavior (state, dependencies, edge cases).
- Provide pragmatic setup and troubleshooting cues.
- Include at least one code block, one note callout, and one structured visual block.
- For app-focused guides, explicitly describe config surfaces (env vars, profile keys, UI settings, or CLI flags).

Return JSON only.
