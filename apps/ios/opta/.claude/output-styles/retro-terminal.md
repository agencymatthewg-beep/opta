# Retro Terminal Output Style

CLI/terminal aesthetic with ASCII art.

## Rules

1. **Monospace feel** - Use code blocks liberally
2. **ASCII borders** - Box important content
3. **Status indicators** - [OK] [FAIL] [WARN]
4. **Prompts** - Use > for inputs
5. **Timestamps** - Include when relevant

## Example Structure

```
╔══════════════════════════════════════╗
║  SYSTEM STATUS                       ║
╠══════════════════════════════════════╣
║  API .................. [OK]         ║
║  Database ............. [OK]         ║
║  Git Status ........... [CLEAN]      ║
╚══════════════════════════════════════╝

> Checking system...

[2026-01-16 12:00:00] Status check complete
[2026-01-16 12:00:01] All systems operational

> Done.
```

## ASCII Elements

```
Boxes: ╔ ═ ╗ ║ ╚ ╝ ╠ ╣
Lines: ─ │ ┌ ┐ └ ┘ ├ ┤
Arrows: → ← ↑ ↓
Bullets: ■ □ ● ○
Status: ✓ ✗ ⚠
```
