# Web Audit Report — 2026-02-18

**Score: 7.5/10** | 4 critical, 7 important, 6 minor | 8 design system violations

## Critical (Must Fix)

| # | Issue | File | Line |
|---|-------|------|------|
| C1 | Missing `error.tsx` error boundaries (CLAUDE.md requires them) | `app/` | — |
| C2 | Missing `noUncheckedIndexedAccess: true` in tsconfig | `tsconfig.json` | — |
| C3 | Silent error swallowing in `handleUnload` | `app/page.tsx` | 149-161 |
| C4 | `status?.tokens_per_second.toFixed(1)` can throw on undefined | `app/page.tsx` | 264, 268 |

## Important (Should Fix)

| # | Issue | Files |
|---|-------|-------|
| I1 | Duplicated client init pattern (4 instances) — use ConnectionProvider | ChatContainer, ChatPage, SessionResumePage, SessionsPage |
| I2 | No mobile navigation (nav hidden on `<sm`, no hamburger) | AppShell.tsx |
| I3 | Dead component — ConnectionIndicator never imported | ConnectionIndicator.tsx |
| I4 | Missing `models/page.tsx` route (documented in CLAUDE.md) | — |
| I5 | Token streaming creates full array copy per token | useChatStream.ts:72-83 |
| I6 | SessionCard setTimeout not cleared on unmount | SessionCard.tsx:81 |
| I7 | `beforeunload` async save may not complete | useSessionPersist.ts:53-71 |

## Minor (Polish)

| # | Issue |
|---|-------|
| M1 | Duplicated `truncate` helper (ToolCallBlock + SessionCard) |
| M2 | Duplicated `shortModelName`/`shortModelLabel` |
| M3 | Inconsistent date formatting (hand-rolled vs date-fns) |
| M4 | Double-header pattern (AppShell + page headers) |
| M5 | Loading skeletons use CSS `animate-pulse` not Framer Motion |
| M6 | Chat welcome state could have richer entrance animation |

## Design System Violations

| # | File | Issue |
|---|------|-------|
| V1-V5 | VRAMGauge.tsx, ThroughputChart.tsx | `rgba()` literals (7 instances) — should use CSS vars |
| V6 | tsconfig.json | Missing `noUncheckedIndexedAccess` |
| V7 | All app pages | Missing error boundaries |
| V8 | Multiple files | `transition-colors` CSS on interactive elements (30+ instances, debatable) |

## Strengths

- Zero `any` types, clean TypeScript
- CircularBuffer + useBufferedState pattern (prevents re-render storms)
- Encrypted admin key storage (AES-GCM + PBKDF2)
- LAN-first connection probe with WAN failover
- React.memo on ChatMessage, startTransition for streaming
- Three-tier glass depth system (genuine premium feel)
- Cohesive violet palette + Sora typography
- Virtual scrolling, optimistic deletes, SWR data fetching

## Aesthetic Verdict

Premium and distinctive — above "generic dashboard" territory. Glass system creates real depth. Weakest area is spatial composition (standard grids, no hero moments). Motion is intentional but could be richer on dashboard.

## Prioritized Fix Order

1. Add error.tsx boundaries (4 files)
2. Add noUncheckedIndexedAccess + fix compiler errors
3. Fix runtime error risk on dashboard status display
4. Fix silent error swallowing in handleUnload
5. Extract duplicated client init → use ConnectionProvider
6. Add mobile navigation
7. Replace rgba() literals with CSS vars
8. Remove/integrate dead ConnectionIndicator
9. Extract shared utilities
10. Clean up setTimeout leak
11. Standardize date formatting
12. Dynamic import Streamdown/Shiki
13. Update CLAUDE.md file structure docs
14. Add loading.tsx Suspense boundaries
15. Add ambient dashboard motion
