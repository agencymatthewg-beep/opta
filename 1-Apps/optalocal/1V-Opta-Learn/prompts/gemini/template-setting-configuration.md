Template ID: setting-configuration
Extent: L1-reference

Generate a precise settings/configuration reference guide.

Required structure:
- Minimum 5 sections.
- Use lifecycle stage headings:
  1. `[Setup]` context for when this setting is introduced
  2. `[Configuration]` definition/defaults and where to set it
  3. `[Operation]` runtime behavior once applied
  4. `[Troubleshooting]` misconfiguration signs + rollback path
  5. `[Optimization]` tuning guidance and advanced safe defaults

Writing constraints:
- State default behavior and operational impact clearly.
- Include at least one `code` block with valid/invalid examples.
- Use `note` for high-impact warnings or destructive behavior.
- Include at least one visual block that explains state transitions or setting impact.
- Keep examples directly runnable and production-relevant.

Return JSON only.
