# /style - Output Style Switcher

Switch between custom output styles.

## Usage

```
/style [style-name]
```

## Available Styles

| Command | Style | Description |
|---------|-------|-------------|
| `/style genui` | Generative UI | Modern UI styling with visual hierarchy |
| `/style explanatory` | Educational | Explains implementation choices |
| `/style learning` | Hands-on practice | Claude guides, you write code |
| `/style markdown` | Full markdown | Maximum markdown features |
| `/style bullets` | Bullet points | Concise hierarchical bullets |
| `/style concise` | Ultra minimal | Minimal words, direct action |
| `/style html` | HTML markup | Valid HTML output |
| `/style yaml` | YAML structured | Machine-parseable YAML |
| `/style audio` | Audio/TTS | TTS-optimized output |
| `/style tables` | Table based | Data in markdown tables |
| `/style retro` | Terminal aesthetic | CLI/ASCII art style |
| `/style dashboard` | ASCII dashboard | Boxed status displays |
| `/style critical` | Critical reviewer | Uncompromising code review |
| `/style security` | Security auditor | Paranoid security focus |
| `/style default` | Reset to normal | Standard formatting |

## Instructions

1. Read style file from `.claude/output-styles/[style].md`
2. Apply formatting rules to subsequent responses
3. Confirm style activation

## Notes

- Styles persist for current session only
- Use `/style default` to reset
- Styles replace formatting instructions (unlike CLAUDE.md which appends)
