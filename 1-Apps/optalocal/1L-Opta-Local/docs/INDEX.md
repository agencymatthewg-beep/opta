# Opta Local — Documentation Index

> Read order and file map for AI agents and contributors.

---

## Read Order (Multi-Platform)

### Working on Web:
```
1. APP.md              ← Understand what Opta Local is
2. SHARED.md           ← Backend contracts, design language, parity matrix
3. web/PLATFORM.md     ← Web feature manifest and UX philosophy
4. web/CLAUDE.md       ← Web-specific coding rules (MUST READ)
5. web/ARCHITECTURE.md ← Web system design
6. docs/GUARDRAILS.md  ← Global guardrails + web/docs/GUARDRAILS.md
7. docs/KNOWLEDGE.md   ← Available resources before building
8. docs/DECISIONS.md   ← Don't re-open settled decisions
```

### Working on iOS:
```
1. APP.md              ← Understand what Opta Local is
2. SHARED.md           ← Backend contracts, design language, parity matrix
3. ios/PLATFORM.md     ← iOS feature manifest and UX philosophy
4. ios/CLAUDE.md       ← iOS-specific coding rules (MUST READ)
5. ios/ARCHITECTURE.md ← iOS system design
6. docs/GUARDRAILS.md  ← Global guardrails + ios/docs/GUARDRAILS.md
7. docs/KNOWLEDGE.md   ← Available resources before building
8. docs/DECISIONS.md   ← Don't re-open settled decisions
```

### Working on shared code/backend:
```
1. APP.md              ← Project identity
2. SHARED.md           ← API contracts, data models (CRITICAL)
3. Both PLATFORM.md    ← Understand both platforms' needs
4. docs/ECOSYSTEM.md   ← How this connects to LMX and CLI
```

---

## File Map

| File | Purpose | Changes How Often |
|------|---------|-------------------|
| `APP.md` | Project identity, purpose, non-negotiables | Rarely (monthly) |
| `SHARED.md` | Backend contracts, design language, parity matrix | Per API change |
| **Web Platform** | | |
| `web/PLATFORM.md` | Web feature manifest, UX philosophy | Per phase |
| `web/CLAUDE.md` | Web coding rules, patterns, don'ts | Occasionally |
| `web/ARCHITECTURE.md` | Web system design, components, data flow | Per major redesign |
| `web/docs/ROADMAP.md` | Web development phases | Weekly |
| `web/docs/GUARDRAILS.md` | Web-specific hard rules | Rarely |
| `web/docs/FEATURES.md` | Web feature list with status | Per feature change |
| **iOS Platform** | | |
| `ios/PLATFORM.md` | iOS feature manifest, UX philosophy | Per phase |
| `ios/CLAUDE.md` | iOS coding rules, patterns, don'ts | Occasionally |
| `ios/ARCHITECTURE.md` | iOS system design, components, data flow | Per major redesign |
| `ios/docs/ROADMAP.md` | iOS development phases | Weekly |
| `ios/docs/GUARDRAILS.md` | iOS-specific hard rules | Rarely |
| `ios/docs/FEATURES.md` | iOS feature list with status | Per feature change |
| **Shared Docs** | | |
| `docs/INDEX.md` | This file — documentation map | When files added/removed |
| `docs/DECISIONS.md` | Resolved decisions with reasoning (append-only) | Per decision |
| `docs/ECOSYSTEM.md` | Relationships to other Opta apps | When integrations change |
| `docs/KNOWLEDGE.md` | AI26/AIALL refs, skills, MCPs, resources | When resources discovered |
| `docs/WORKFLOWS.md` | Build, test, deploy, delegation patterns | Per workflow change |
| `docs/CHANGELOG.md` | What changed and when | Every significant change |

## Last Updated

| File | Date | By |
|------|------|----|
| APP.md | 2026-02-20 | Matthew/Codex |
| SHARED.md | 2026-02-18 | OPIS v2.0 |
| web/PLATFORM.md | 2026-02-18 | OPIS v2.0 |
| web/CLAUDE.md | 2026-02-18 | OPIS v2.0 |
| web/ARCHITECTURE.md | 2026-02-18 | OPIS v2.0 |
| web/docs/ROADMAP.md | 2026-02-20 | Matthew/Codex |
| web/docs/GUARDRAILS.md | 2026-02-18 | OPIS v2.0 |
| web/docs/FEATURES.md | 2026-02-20 | Matthew/Codex |
| ios/PLATFORM.md | 2026-02-18 | OPIS v2.0 |
| ios/CLAUDE.md | 2026-02-18 | OPIS v2.0 |
| ios/ARCHITECTURE.md | 2026-02-18 | OPIS v2.0 |
| ios/docs/ROADMAP.md | 2026-02-20 | Matthew/Codex |
| ios/docs/GUARDRAILS.md | 2026-02-18 | OPIS v2.0 |
| ios/docs/FEATURES.md | 2026-02-18 | OPIS v2.0 |
| docs/INDEX.md | 2026-02-18 | OPIS v2.0 |
| docs/DECISIONS.md | 2026-02-20 | Matthew/Codex |
| docs/ECOSYSTEM.md | 2026-02-18 | OPIS v2.0 |
| docs/KNOWLEDGE.md | 2026-02-18 | OPIS v2.0 |
| docs/WORKFLOWS.md | 2026-02-20 | Matthew/Codex |
| docs/CHANGELOG.md | 2026-02-20 | Matthew/Codex |

---

*Updated — 2026-02-20*
