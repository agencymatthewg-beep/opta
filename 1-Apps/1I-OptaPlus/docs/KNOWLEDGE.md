---
scope: External resources, references, infrastructure
purpose: Known resources, skills, infrastructure, API specs, tools
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus — KNOWLEDGE.md

> External resources, references, API specs, infrastructure details. Where to find information, tools, specs, skills, and infrastructure components.

---

## 1. OpenClaw Documentation

### Main Documentation
- **Location:** `~/Synced/AI26/1-SOT/` (Source of Truth)
- **GATEWAY-PROTOCOL-V3.md** — Full gateway protocol specification
  - Frame types: req, res, event
  - All methods available (chat.send, cron.add, config.get, etc.)
  - Error codes and handling
  - Rate limiting rules

### Gateway Daemon
- **Config:** `~/.openclaw/config.json`
- **Logs:** `/tmp/openclaw.log`
- **Control:** `openclaw gateway status|start|stop|restart`
- **Ports:** Main on 18793, bots on 19000+

### Client Protocol
- **NWConnection:** Foundation framework (built-in)
- **WebSocket:** TCP over port 18793 (or tunnel)
- **TLS:** Enabled for Cloudflare tunnel
- **Keep-alive:** Ping every 30s, pong timeout 5s

---

## 2. Opta Infrastructure

### Bot Ports & Details

| Port | Bot Name | Purpose | Status |
|------|----------|---------|--------|
| 19000 | Opta Max | Primary AI | Active |
| 19001 | Opta512 | Secondary | Active |
| 19002 | Mono | Infrastructure | Active |
| 19003 | Saturday | Josh's bot | Active |
| 19004 | Claude | Internal | Backend |
| 19005 | Groq | Fast inference | Backend |
| 19006 | Anthropic | Direct API | Legacy |
| 19007+ | Custom | User bots | As created |

### Gateway Token
- **Location:** `~/.openclaw/GATEWAY-TOKEN`
- **Format:** 64-character hex string
- **Usage:** Connection auth in OptaPlus
- **Rotation:** Manual (edit file, restart gateway)
- **Never commit:** Always in .gitignore

### Cloudflare Tunnel
- **Service:** Cloudflare Zero Trust (free tier)
- **Config:** `cloudflared tunnel create openclaw-relay`
- **Domain:** `tunnel-xxx.trycloudflare.com` (auto-generated)
- **Use case:** NAT traversal, internet access without port forwarding
- **Security:** HTTPS + token auth

**Setup:**
```bash
# List tunnels
cloudflared tunnel list

# Create tunnel
cloudflared tunnel create openclaw-relay

# Route to localhost:18793
cloudflared tunnel route dns openclaw-relay tunnel-xxx.trycloudflare.com

# Run tunnel
cloudflared tunnel run openclaw-relay
```

---

## 3. AIALL Resources

### Location
`~/Synced/AIALL/`

### Contents
- **Research papers** — Latest AI/ML research
- **Model info** — Model cards, benchmarks, performance data
- **Prompt engineering** — Best practices, examples
- **Tools & techniques** — How to use OpenAI API, Anthropic API, Groq, etc.
- **Datasets** — Public datasets for testing/training

### Relevant for OptaPlus
- Bot prompt engineering templates
- Rate limiting strategies
- API cost optimization
- Multi-model comparison data

---

## 4. Bot Development Resources

### Creating a Bot

**Directory:** `~/Synced/Opta/1-Apps/1C-BotInfrastructure/`

Contains:
- Bot templates (Python, JavaScript, Go)
- Deployment scripts
- Configuration examples
- Health check patterns

### Bot Lifecycle

```
1. Development (local port)
2. Testing (with gateway on test environment)
3. Staging (separate instance, thorough testing)
4. Production (main gateway)
5. Monitoring (uptime, latency, error rates)
6. Maintenance (updates, security patches)
```

---

## 5. SwiftUI & Swift Resources

### Apple Official
- [SwiftUI Tutorials](https://developer.apple.com/tutorials/SwiftUI) (apple.com)
- [Swift Language Guide](https://docs.swift.org/swift-book) (docs.swift.org)
- [Network Framework](https://developer.apple.com/documentation/network) (for NWConnection)
- [ActivityKit](https://developer.apple.com/documentation/ActivityKit) (Live Activities)
- [WidgetKit](https://developer.apple.com/documentation/WidgetKit)
- [AppIntents](https://developer.apple.com/documentation/AppIntents) (Siri)

### Community Resources
- [Swift Forums](https://forums.swift.org) — Official discussion
- [Stack Overflow SwiftUI tag](https://stackoverflow.com/questions/tagged/swiftui)
- [Hacking with Swift](https://www.hackingwithswift.com) — Tutorials & articles
- [Raycast Extension API](https://developers.raycast.com) — Not directly for OptaPlus, but similar architecture

---

## 6. Design Resources

### Cinematic Void Theme Reference
- **Resend.com** — Color, spacing, typography
- **Raycast** — Command palette, keyboard shortcuts
- **Lusion** — Motion, glass morphism effects
- **Apple HIG (Human Interface Guidelines)** — Standard patterns, accessibility

### Design Tools
- **Figma** — Design comps, prototypes (if designing new features)
- **SF Symbols** — System icons (built into SwiftUI)

---

## 7. Testing & QA Tools

### Built-in
- **Xcode** — Simulator (iOS), preview (SwiftUI)
- **XCTest** — Unit & integration testing
- **SwiftUI Previews** — Visual regression testing

### External (Optional)
- **Instruments** (Xcode) — Memory, CPU, battery profiling
- **Charles Proxy** — HTTP/WebSocket debugging (if needed)
- **Bonjour Browser** — mDNS service discovery testing

---

## 8. Git & Version Control

### Repository
- **Location:** `~/Synced/Opta/1-Apps/1I-OptaPlus/`
- **Remote:** Git repo (if synced to GitHub, URL TBD)
- **Branches:** main (production), develop (staging)

### Workflow
1. Create feature branch: `git checkout -b feature/feature-name`
2. Commit with clear messages
3. Push to remote
4. Create PR for review
5. Merge to develop after approval
6. Tag release on main

### Commit Message Format
```
[iOS|macOS|shared] Feature: Short description

Longer explanation if needed.

Fixes #123 (if bug fix)
```

---

## 9. Performance & Monitoring

### Local Profiling
```bash
# Open in Instruments from Xcode
Product > Profile > Memory / CPU / Energy

# Check memory usage
Instruments > System Memory
```

### Logging
```swift
import os.log
let logger = Logger(subsystem: "com.optaplus.ios", category: "networking")
logger.info("Connected: \(bot.name)")
logger.error("Connection failed: \(error.localizedDescription)")
```

### Metrics to Track
- **Startup time:** Cold start < 2s
- **Memory:** < 250MB (iOS), < 800MB (macOS)
- **Battery:** 30 min use = < 10% drain
- **Message latency:** Send → echo < 1s
- **Scroll performance:** 60fps constant

---

## 10. Security & Keys

### Credential Management
- **Never commit secrets** — Gateway token, API keys
- **Use Keychain** — iOS/macOS secure storage
- **Env variables** — Only in CI/CD, never in source

### Key Locations
- Gateway token: `~/.openclaw/GATEWAY-TOKEN`
- Cloudflare token: `~/.cloudflared/TUNNEL-TOKEN`
- API keys: `~/.credentials/` (if used)

### Secret Rotation
```bash
# 1. Generate new token (OpenClaw CLI)
openclaw gateway token rotate

# 2. Update in .openclaw/GATEWAY-TOKEN
# 3. Restart gateway: openclaw gateway restart
# 4. OptaPlus auto-reconnects with new token
```

---

## 11. Opta Life Integration

### API Endpoint
```
http://localhost:3000/api/opta-sync
```

### Methods
| Action | Request | Response |
|--------|---------|----------|
| List tasks | `GET ?action=list_tasks` | `{ tasks: [...] }` |
| Add task | `POST { add_task: {...} }` | `{ id, created: true }` |
| Complete | `POST { complete_task: {id} }` | `{ success: true }` |
| Update | `POST { update_task: {...} }` | `{ success: true }` |
| Delete | `POST { delete_task: {id} }` | `{ success: true }` |
| Health | `GET ?action=health` | `{ status: "ok" }` |

### Full Spec
`~/Synced/Opta/1-Apps/1D-OtaLife/API.md`

---

## 12. Claude Code Integration

### Skill: claude-mem
**Location:** `~/.openclaw/skills/claude-mem/`

Used to search past coding work:
```bash
mem-query search "websocket reconnection"
mem-query recent 10
mem-query sessions
```

### Skill: planning-with-files
**Location:** `~/.openclaw/skills/planning-with-files/`

Used to organize multi-step tasks:
```bash
cp ~/.openclaw/skills/planning-with-files/templates/* tasks/
```

---

## 13. Deployment & Release

### Build & Archive (Xcode)
```
Product > Archive
Organizer > Distribute App > App Store
```

### App Store Requirements
- [ ] Screenshots (iOS: 5.5" display minimum)
- [ ] App preview video (optional)
- [ ] Marketing description
- [ ] Reviewed version > previous
- [ ] All privacy policies linked
- [ ] Rating form completed (PEGI/ESRB)

### Release Checklist
- [ ] Version bumped (Info.plist)
- [ ] Changelog updated
- [ ] All features tested
- [ ] No debug logging
- [ ] No hardcoded tokens
- [ ] Memory < limits
- [ ] Performance targets met

---

## 14. Third-Party Services

### Cloudflare (Tunnel)
- **Website:** https://www.cloudflare.com
- **Service:** Free tunnel service (account needed)
- **Config:** `~/.cloudflared/`
- **Status:** https://status.cloudflare.com

### Apple (App Store, TestFlight, APNs)
- **Developer Account:** https://developer.apple.com/account
- **App Store Connect:** https://appstoreconnect.apple.com
- **APNs Setup:** Required for push notifications
- **Certificates:** Must be renewed annually

### Anthropic (Claude API, if bot uses it)
- **API Docs:** https://docs.anthropic.com
- **Rate limits:** Check current quotas
- **Pricing:** Per 1M input/output tokens

### OpenAI (GPT-4, if bot uses it)
- **API Docs:** https://platform.openai.com/docs
- **Rate limits:** Check current quotas
- **Pricing:** Per 1K tokens

---

## 15. Documentation Standards

### File Format
- **Markdown (.md)** — All documentation
- **YAML frontmatter** — Metadata at top
- **Code blocks** — Language-tagged for syntax highlighting

### Template
```yaml
---
parent: <reference doc>
scope: <area>
purpose: <one-liner>
version: <x.y.z>
updated: <YYYY-MM-DD>
---

# Title

> Summary

## Sections
```

### Keeping Docs Fresh
- Update `updated:` field whenever doc changes
- Add changelog entries to CHANGELOG.md
- Cross-reference related docs
- Include working examples (not aspirational)

---

## 16. How to Find Something

| I'm looking for... | Check... |
|--------------------|----------|
| Gateway protocol details | GATEWAY-PROTOCOL-V3.md |
| Bot creation | BotInfrastructure docs |
| SwiftUI patterns | Apple SwiftUI tutorials + hacking with swift |
| Performance targets | PLATFORM.md (section 12) |
| Code review checklist | CLAUDE.md (section 13) |
| Deployment process | WORKFLOWS.md |
| Design tokens | Colors.swift in OptaMolt |
| Keyboard shortcuts | SHORTCUTS.md or macOS/PLATFORM.md |
| App Intents | iOS/CLAUDE.md (section 4) |
| WidgetKit | iOS/CLAUDE.md (section 5) |
| Infrastructure | ECOSYSTEM.md, KNOWLEDGE.md (this file) |
| Past decisions | DECISIONS.md |
| Safety rules | GUARDRAILS.md |

---

## 17. Update This Document When

- [ ] A new API endpoint is discovered
- [ ] Infrastructure port changes
- [ ] New external resource becomes relevant
- [ ] Tool or service is added/removed
- [ ] Documentation URL changes
- [ ] New bot is created

---

## 18. Quick Reference Links

| Resource | URL |
|----------|-----|
| Swift Docs | https://docs.swift.org |
| SwiftUI Tutorials | https://developer.apple.com/tutorials/SwiftUI |
| Apple Network Framework | https://developer.apple.com/documentation/network |
| Hacking with Swift | https://www.hackingwithswift.com |
| Stack Overflow SwiftUI | https://stackoverflow.com/questions/tagged/swiftui |
| Cloudflare Docs | https://developers.cloudflare.com/tunnel/ |
| App Store Connect | https://appstoreconnect.apple.com |
| OpenClaw Gateway | `~/Synced/AI26/1-SOT/1B-Protocols/GATEWAY-PROTOCOL-V3.md` |
| Opta Life API | `~/Synced/Opta/1-Apps/1D-OtaLife/API.md` |

