# Plan: Opta Marketing App

**Created:** 2026-01-28
**Status:** Planning
**Author:** Matthew Byrden + Opta

---

## Vision

A macOS app that connects to Optimal's marketing infrastructure, enabling users to:
- Generate AI marketing content
- Schedule posts across platforms
- Automate posting via AdsPower profiles
- Sync state across devices (Syncthing)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPTA MARKETING APP                          │
│                    (Electron / macOS)                           │
├─────────────────────────────────────────────────────────────────┤
│  • Content calendar UI                                          │
│  • AI content generation (local LLM or API)                     │
│  • Image editor / Nanobana integration                          │
│  • Account management (AdsPower profiles)                       │
│  • Analytics dashboard                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│     SYNCTHING LAYER     │  │    OPTIMAL CLOUD API    │
│   (Local-first sync)    │  │     (Optional SaaS)     │
├─────────────────────────┤  ├─────────────────────────┤
│ ~/Opta/Marketing/       │  │ • User auth             │
│ ├── accounts/           │  │ • Usage metering        │
│ ├── queue/              │  │ • Shared templates      │
│ ├── templates/          │  │ • Analytics aggregation │
│ └── state.json          │  └─────────────────────────┘
└──────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION ENGINE                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐         │
│  │  AdsPower   │  │  Direct API │  │  Clawdbot Node  │         │
│  │  Profiles   │  │  (Twitter)  │  │  (AI posting)   │         │
│  └─────────────┘  └─────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **App Shell** | Electron | Same as YJS Dashboard, cross-platform |
| **Frontend** | React + Tailwind | Fast, consistent with your stack |
| **Local State** | SQLite + JSON files | Offline-first, Syncthing-friendly |
| **Sync** | Syncthing | Already in your infra, no server needed |
| **AI Content** | Local LLM (Ollama) or Claude API | User choice |
| **Posting** | AdsPower API + Playwright | Anti-detection, multi-account |
| **Cloud (optional)** | Cloudflare Workers + D1 | Serverless, cheap, global |

---

## Core Features (MVP)

### 1. Account Manager
- Connect AdsPower profiles
- Link Twitter/X, LinkedIn, Instagram, TikTok
- Profile health monitoring

### 2. Content Studio
- AI caption generator (prompt → variations)
- Image generation (Nanobana / DALL-E / local SD)
- Template library (brand-consistent)

### 3. Scheduler
- Calendar view (week/month)
- Drag-drop scheduling
- Optimal time suggestions (engagement data)

### 4. Automation Engine
- Queue processor (runs locally or on server)
- AdsPower integration for posting
- Retry logic, error handling

### 5. Analytics
- Post performance tracking
- Engagement metrics
- A/B test results

---

## Syncthing Integration

```
~/Opta/Marketing/           # Synced folder
├── accounts/
│   └── twitter_opta.json   # Encrypted credentials
├── queue/
│   ├── pending/
│   └── posted/
├── templates/
│   ├── opta-scan-promo.json
│   └── opta-scan-promo.png
├── analytics/
│   └── 2026-01.json
└── config.json             # App settings
```

- **Multi-device**: Edit on MacBook, posts execute from Mac Studio
- **Backup**: Syncthing handles redundancy
- **Collaboration**: Share folder with team members

---

## Content Creation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT CREATION                         │
│  (Weekly session: You + Opta + Nanobana)                   │
│  → Generate images, captions, schedule                      │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT QUEUE                            │
│  ~/Opta/Marketing/queue/                                    │
│  ├── 2026-01-29_0900_twitter.json                          │
│  ├── 2026-01-29_0900_twitter.png                           │
│  └── ...                                                    │
└─────────────────────┬───────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXECUTION LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Clawdbot    │  │ AdsPower    │  │ Local LLM   │         │
│  │ Cron+Skill  │  │ Profiles    │  │ (fallback)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Post Format Schema

```json
{
  "id": "uuid",
  "platform": "twitter",
  "scheduledAt": "2026-01-30T09:00:00+11:00",
  "caption": "Opta Scan just got smarter...",
  "image": "2026-01-30_twitter_opta-scan.png",
  "status": "pending",
  "account": "opta_main",
  "tags": ["product", "opta-scan"],
  "createdAt": "2026-01-28T22:00:00+11:00"
}
```

---

## Business Model Options

| Model | How it works |
|-------|--------------|
| **Free + Self-host** | App is free, users run their own infra |
| **Freemium** | Free tier (3 accounts), paid for more |
| **SaaS** | Optimal hosts execution engine, subscription |
| **Lifetime** | One-time purchase, self-hosted |

---

## Project Location

```
/Users/matthewbyrden/Documents/Opta/1. Apps/2. Desktop/3. Opta Marketing/
```

---

## Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Electron app scaffold (React + Tailwind)
- [ ] Account connection UI (AdsPower profiles)
- [ ] Content queue system (JSON-based, Syncthing-ready)
- [ ] Basic scheduler UI (calendar view)
- [ ] Manual post execution (AdsPower automation)

### Phase 2: AI Integration (Week 3-4)
- [ ] Caption generation (Claude API / local LLM)
- [ ] Image generation integration (Nanobana)
- [ ] Template system
- [ ] Bulk content generation

### Phase 3: Automation (Week 5-6)
- [ ] Cron-based queue processor
- [ ] Multi-platform posting
- [ ] Error handling and retry logic
- [ ] Notification system

### Phase 4: Analytics & Polish (Week 7-8)
- [ ] Analytics dashboard
- [ ] Engagement tracking
- [ ] A/B testing support
- [ ] App Store preparation

---

## Open Questions

1. Which platforms to prioritize? (Twitter, LinkedIn, Instagram, TikTok)
2. Pricing strategy for external users?
3. Should execution run locally or on cloud?
4. Integration with existing Opta apps?

---

## Related Projects

- YJS Dashboard (Electron app reference)
- Opta Life Manager (scheduling patterns)
- Clawdbot skills (automation reference)

---

## Notes

- Use AdsPower for anti-detection on social platforms
- Syncthing enables multi-device without cloud dependency
- Local LLM option for privacy-conscious users
- Could integrate with Opta Life Manager for unified task management
