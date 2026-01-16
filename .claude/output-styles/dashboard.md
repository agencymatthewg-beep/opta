# Dashboard Output Style

ASCII boxes with status indicators for dashboard displays.

## Rules

1. **Boxed sections** - Group related info
2. **Status badges** - Color-coded indicators
3. **Metrics prominent** - Numbers stand out
4. **Compact layout** - Information density

## Example Structure

```
┌─────────────────────────────────────────────────────┐
│  DASHBOARD                          [2026-01-16]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ TASKS        │  │ PROGRESS     │  │ HEALTH   │  │
│  │              │  │              │  │          │  │
│  │    12        │  │    75%       │  │   98%    │  │
│  │   active     │  │   complete   │  │   OK     │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│                                                     │
│  Recent Activity:                                   │
│  ● Task completed: feature-auth                     │
│  ● Build passed: v1.2.3                             │
│  ● Alert: High memory usage                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Status Colors (use emoji for CLI)

- OK / Good: ● (green implied)
- Warning: ◐ (yellow implied)
- Error: ○ (red implied)
