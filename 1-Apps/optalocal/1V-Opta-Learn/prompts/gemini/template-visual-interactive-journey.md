Template ID: visual-interactive-journey
Extent: L3-deep-dive (visual-first)

Generate a visual-first guide that explains the full lifecycle through interactive visuals and compact text.

Required structure:
- Minimum 5 sections.
- Use canonical lifecycle headings in order:
  1. `[Setup]`
  2. `[Configuration]`
  3. `[Operation]`
  4. `[Troubleshooting]`
  5. `[Optimization]`

Visual-first requirements:
- 80-90% of explanatory load should be carried by `visual` blocks.
- Include visual blocks in at least 4 of 5 sections.
- Each `visual` block must use structured HTML with meaningful classes and layout (not plain text wrapped in divs).
- Prefer interactive native HTML patterns such as `<details>`, staged cards, flow rails, and decision-map layouts.

Text constraints:
- Keep section `body` concise and instructional (no large prose blocks).
- Focus on one guiding sentence plus operator intent for each stage.
- Avoid long narrative paragraphs and marketing language.
- Target total guide text around 120-420 words, with body-heavy prose avoided.

Operational requirements:
- App-focused guides must still include concrete configuration surfaces (settings/flags/env/profile keys).
- Troubleshooting must include a deterministic recovery path.
- Optimization must include at least one measurable target signal.

Return JSON only.
