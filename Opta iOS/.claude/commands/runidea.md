# /runidea - Full Idea Pipeline

Run full 3-stage idea pipeline with comparison and examples.

## Stages

### Stage 1: Ideation
- Deep analysis of the problem
- Generate diverse solutions (15-25+ ideas)
- Initial filtering to top candidates

### Stage 2: Critique
- Professional critique of top ideas
- Risk assessment
- Feasibility analysis

### Stage 3: Compare & Exemplify
- Side-by-side comparison of top ideas
- Concrete use case examples for each
- Real-world scenarios demonstrating value

## Usage

```
/runidea [topic or problem]
```

## Example

```
/runidea How should Opta visualize memory pressure?
```

## Output Format

**Uses GenUI** - Generates an HTML report saved to `/tmp/genui_runidea_{timestamp}.html` and opens in browser.

The GenUI report includes:

### Stage 1: Ideation Section
- **Problem Analysis Card**: Deep dive into the challenge
- **Ideas Gallery**: All 15-25+ ideas as compact cards
- **Shortlist Highlight**: Top 3-5 elevated with badges

### Stage 2: Critique Section
- **Critique Cards** for each shortlisted idea:
  - Strengths (green bullets)
  - Weaknesses (red bullets)
  - Risks (yellow bullets)
  - Score visualization (X/10 gauge)

### Stage 3: Compare & Exemplify Section
- **Comparison Matrix Table**: Side-by-side with color-coded ratings
- **Use Case Cards**: Scenario, example walkthrough, outcome for each
- **Recommendation Alert**: Final guidance with context-based suggestions

After generating the HTML report, output a brief console summary:

```
Idea pipeline complete. Report: /tmp/genui_runidea_{timestamp}.html

Generated: X ideas → Shortlisted: Y → Critiqued: Z
Top recommendation: [winning idea] (Score: X/10)
Runner-up: [second choice] for [specific context]
```

## Opta-Specific Evaluation Criteria

When evaluating ideas for Opta:
- **Design System Fit**: Does it work with glass effects, Framer Motion?
- **Performance**: Will it impact system monitoring overhead?
- **Cross-Platform**: Works on macOS, Windows, Linux?
- **Premium Feel**: Does it match Opta's visual identity?
- **AI Integration**: Can Opta AI enhance this feature?

## Related Commands

- `/ideas` - Quick context brainstorm
- `/aideas` - Advanced ideas for power users
- `/arunidea` - Full advanced pipeline
- `/cone` - Wild creative exploration

## Notes

- Most comprehensive ideation command
- Use for significant decisions or features
- Stage 3 uses systematic comparison for final selection
