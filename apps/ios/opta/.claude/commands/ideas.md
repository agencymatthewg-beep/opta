# /ideas - Context Brainstorm

Generate ideas from current conversation context.

## Instructions

1. Analyze the current conversation
2. Identify problems or opportunities discussed
3. Generate relevant ideas
4. Prioritize by feasibility and impact

## Output Format

**Uses GenUI** - Generates an HTML report saved to `/tmp/genui_ideas_{timestamp}.html` and opens in browser.

The GenUI report includes:
- **Header**: Context summary with idea count badge
- **Ideas Grid**: Cards for each idea with:
  - Title and brief description
  - Feasibility badge (green/yellow/red)
  - Impact badge (high/medium/low)
- **Quick Wins Section**: High feasibility + High impact ideas highlighted
- **Worth Exploring Section**: Medium feasibility + High impact ideas
- **Impact/Feasibility Matrix**: Visual 2x2 grid showing idea distribution

After generating the HTML report, output a brief console summary:

```
Ideas generated. Report: /tmp/genui_ideas_{timestamp}.html

Generated X ideas | Quick wins: Y | Worth exploring: Z
Top recommendation: [highest impact quick win]
```

## Opta-Specific Considerations

When generating ideas for Opta, consider:
- Design System compliance (Framer Motion, Lucide, glass effects)
- Cross-platform implications (macOS, Windows, Linux)
- Performance impact on system monitoring
- Opta's premium visual aesthetic
- AI integration possibilities

## Related Commands

- `/cone` - Wild creative brainstorm (cereal milk mode)
- `/aideas` - Advanced power-user focused ideas
- `/runidea [topic]` - Full idea pipeline with critique

## Notes

- Uses current conversation as input
- For topic-specific ideation, use `/runidea [topic]`
