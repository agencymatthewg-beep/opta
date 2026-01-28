# /cone - Creative Brainstorm (Cereal Milk Mode)

Launch the cereal-milk-creative agent for unconventional, abstract, wildly creative ideas.

## Instructions

1. Launch cereal-milk-creative agent
2. Share your problem or area for creative exploration
3. Receive 3-7 ideas ranging from "spicy but doable" to "absolutely unhinged"
4. Go deeper on threads that resonate

## When to Use

- When standard approaches have failed
- When you need to break a creative block
- When exploring "too weird" possibilities
- When you want unexpected connections between concepts
- When differentiation from competitors is critical

## Opta-Specific Applications

- Novel UI interaction patterns
- Unconventional optimization visualizations
- Creative ways to present system data
- Wild feature ideas for power users
- Abstract approaches to common problems

## Output Format

**Uses GenUI** - Generates an HTML report saved to `/tmp/genui_cone_{timestamp}.html` and opens in browser.

The GenUI report includes:
- **Header**: Problem/topic with creative exploration badge
- **Ideas Gallery**: Cards for each idea with:
  - Wild idea title with creativity rating (spicy/wild/unhinged)
  - Core concept description
  - "Why it might work" section
  - "What sparked this" insight
  - Grounded version callout
- **Vibes vs. Implementable Matrix**: Visual comparison table
- **Deeper Exploration Prompts**: Suggested follow-up threads

After generating the HTML report, output a brief console summary:

```
Cereal Milk brainstorm complete. Report: /tmp/genui_cone_{timestamp}.html

Generated X ideas (Y spicy, Z wild, W unhinged)
Top thread to explore: [most promising idea]
```

## Example

```
/cone How can we make the optimization score feel more rewarding?
```

Might generate ideas like:
- Score that responds to music playing on system
- Achievement system based on optimization "streaks"
- Score that physically "grows" a plant/creature over time
- Leaderboard against your past selves

## Related Commands

- `/ideas` - Standard context brainstorm
- `/aideas` - Advanced power-user ideas
- `/runidea` - Full idea pipeline (more structured)

## Notes

- Ideas may seem weird—that's the point
- Filter the wild through practical lens afterward
- At least one idea should feel uncomfortable in how unconventional it is
