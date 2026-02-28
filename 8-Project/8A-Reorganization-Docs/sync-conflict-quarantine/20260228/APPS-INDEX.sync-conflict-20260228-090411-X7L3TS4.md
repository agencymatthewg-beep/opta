# Opta Ecosystem — Apps Index

*Last updated: 2026-02-28*

## Structure

```
1-Apps/
├── optamize/      ← optamize.biz products
├── optalocal/     ← optalocal.com products
└── shared/        ← cross-domain: elements, design, infra
```

---

## optamize/ (optamize.biz)

| ID | App | Platform | Stack | Status |
|----|-----|----------|-------|--------|
| 1E | Opta Life iOS | iOS | SwiftUI, Firebase, Siri Intents | Active |
| 1F | Opta Life Web | Web | Next.js 15, React 18 | Deployed → lm.optamize.biz |
| 1G | Opta Mini macOS | macOS | SwiftUI NSMenu | Active |
| 1H | Opta Scan iOS | iOS | SwiftUI, Claude Vision | Active |
| 1J | Optamize macOS | macOS | Tauri v2, React, Rust | Active — flagship |

## optalocal/ (optalocal.com)

| ID | App | Platform | Stack | Status |
|----|-----|----------|-------|--------|
| 1D | Opta CLI | CLI | TypeScript, Commander, Ink TUI | BETA v0.5 |
| 1L | Opta Local | Web + iOS | Next.js 15, SwiftUI | In dev → optalocal.com |
| 1M | Opta LMX | macOS service | Python, MLX, FastAPI | Live on Mono512:1234 |
| 1O | Opta Init | Web | Next.js 15, Tailwind v4, Framer Motion | Live → init.optalocal.com |
| 1P | Opta Codex App | macOS | Desktop companion | Emerging |

## shared/ (cross-domain)

| ID | App | Platform | Stack | Status |
|----|-----|----------|-------|--------|
| 1A | AI Components | Web | Next.js 16, React 19 | Merged from 1A + 1B |
| 1I | OptaPlus | iOS + macOS | SwiftUI | 8/13 phases — design system |
| 1N | Opta Cloud Accounts | iOS + Web | SwiftUI, Supabase | 85% complete |

---

## Deleted

| ID | App | Reason |
|----|-----|--------|
| 1B | AICompare Web | Merged into shared/1A-AI-Components/aicompare-web |
| 1C | MonoUsage | Retired — merged into Opta Mini |
| 1K | Optamize Web | Deleted — superseded |
| 1J-Opta-LMX | LMX (old) | Superseded by 1M — archived at optalocal/1J-Opta-LMX-ARCHIVED |

---

## Unregistered Services (Action Required — Move to 3-Services/)

| Dir | Description |
|-----|-------------|
| kimi-proxy | FastAPI proxy for Kimi models |
| opta-pa-messenger | PA messaging bridge |
| opta-phone-bridge | Phone bridge service |

## Services (3-Services/)

| Service | Description | Deployed |
|---------|-------------|----------|
| 3A-Opta-Gateway | AI provider routing API | lm.optamize.biz (Vercel) |

---

## OPIS Status

| App | OPIS |
|-----|------|
| 1D-Opta-CLI-TS | Yes |
| 1I-OptaPlus | Yes |
| 1L-Opta-Local | Yes |
| 1M-Opta-LMX | Yes |
| All others | Pending |
