Template ID: process-workflow
Extent: L2-operational

Generate an execution-first operational guide.

Required structure:
- Minimum 5 sections.
- Use lifecycle stage headings:
  1. `[Setup]` prerequisites and baseline checks
  2. `[Configuration]` workflow-specific settings and parameters
  3. `[Operation]` step-by-step execution path
  4. `[Troubleshooting]` known failure signatures and fixes
  5. `[Optimization]` repeatability/performance improvements

Writing constraints:
- Keep steps deterministic and observable.
- Include at least one `code` block with runnable commands.
- Include verification criteria and common failure signatures.
- Include at least one visual block that clarifies sequence/state flow.
- Keep the workflow end-to-end: first run, stable run, and recovery loop.

Return JSON only.
