# Output Styles

## Quick Context
- Opta application source code and documentation
- Contains: iOS, macOS, web, CLI implementations
- Use for: building and extending Opta products


Custom output styles for Claude responses in Opta.

## Usage

```
/style [style-name]
```

Or use `/gu` for GenUI mode with HTML output.

## Available Styles

| File | Command | Description | Token Efficiency |
|------|---------|-------------|------------------|
| ultra-concise.md | `/style concise` | Minimal words, direct action | 0.3x |
| bullet-points.md | `/style bullets` | Hierarchical bullet points | 0.5x |
| yaml-structured.md | `/style yaml` | Machine-parseable YAML | 0.7x |
| table-format.md | `/style tables` | Markdown tables throughout | 0.8x |
| markdown-focused.md | `/style markdown` | Full markdown features | 1.0x |
| retro-terminal.md | `/style retro` | CLI/terminal aesthetic | 1.2x |
| dashboard.md | `/style dashboard` | ASCII boxes with status | 1.5x |
| html.md | `/style html` | Valid HTML markup | 1.5x |
| genui.md | `/style genui` | Modern UI (text version) | 1.5x |
| explanatory.md | `/style explanatory` | Educational with reasoning | 2.0x |
| learning.md | `/style learning` | Hands-on practice mode | 1.5x |
| audio-summary.md | `/style audio` | TTS-optimized output | 1.0x |
| critical-code-reviewer.md | `/style critical` | Uncompromising code review | 1.2x |
| security-auditor.md | `/style security` | Security-focused review | 1.2x |

## Special Commands

| Command | Purpose |
|---------|---------|
| `/gu` | Activate GenUI - generates HTML files opened in browser |
| `/style default` | Reset to standard formatting |

## How Styles Work

Each style file contains formatting instructions that replace Claude's default output formatting for the session.

Styles persist for the current session only. Use `/style default` to reset.

## Creating New Styles

1. Create `[style-name].md` in this folder
2. Define formatting rules and examples
3. Add frontmatter with name/description (optional)
4. Update this README

## Style Categories

### Efficiency-Focused
- **ultra-concise** - For quick actions, minimal context
- **bullets** - Scannable, organized information
- **yaml** - For automation and parsing

### Presentation-Focused
- **genui** - Rich visual HTML output
- **markdown** - Full markdown features
- **tables** - Data-dense comparisons
- **dashboard** - Status displays

### Specialized
- **learning** - Interactive code learning
- **explanatory** - Teaching and reasoning
- **audio** - Voice/TTS optimized
- **critical** - Rigorous code review
- **security** - Security-focused analysis

### Aesthetic
- **retro** - Terminal/CLI aesthetic
- **html** - Direct HTML output
