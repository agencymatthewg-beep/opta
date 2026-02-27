---
scope: Broader Opta ecosystem
purpose: Map of all Opta apps, how OptaPlus fits, data flows, bot infrastructure
version: 0.9.0
updated: 2026-02-15
---

# OptaPlus — ECOSYSTEM.md

> Map of Opta apps and bot infrastructure. How OptaPlus relates to Opta CLI, Opta Life, Opta-LMX, and the gateway network. Data flows between services.

---

## 1. High-Level Ecosystem Map

```
┌─────────────────────────────────────────────────────────────┐
│                      OPTA ECOSYSTEM                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │  OptaPlus    │  │  Opta CLI    │  │  Opta Life     │    │
│  │  (Client)    │  │  (Coding)    │  │  (Tasks)       │    │
│  │  iOS/macOS   │  │  Claude Code │  │  Web dashboard │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────┘    │
│         │                 │                    │             │
│         │        Bot      │        Schedule    │             │
│         │      Commands   │        Queries     │             │
│         │                 │                    │             │
│         └─────────────────┼────────────────────┘             │
│                           │                                  │
│                           ▼                                  │
│         ┌──────────────────────────────────┐                │
│         │   OpenClaw Gateway Network       │                │
│         │   (7+ bots on ports 18793+)     │                │
│         │   - Opta Max (port 19000)        │                │
│         │   - Opta512 (port 19001)         │                │
│         │   - Mono (port 19002)            │                │
│         │   - Saturday (port 19003)        │                │
│         │   - Claude (port 19004)          │                │
│         │   - Groq (port 19005)            │                │
│         │   - Anthropic (port 19006)       │                │
│         │   + custom bots (19007+)         │                │
│         └──────────┬───────────────────────┘                │
│                    │                                        │
│                    ▼                                        │
│         ┌──────────────────────────────────┐                │
│         │   OpenClaw Master Gateway        │                │
│         │   (Gateway Daemon)               │                │
│         │   - Auth, routing, webhooks      │                │
│         │   - Connection relay             │                │
│         │   - Cloudflare tunnel support    │                │
│         └──────────┬───────────────────────┘                │
│                    │                                        │
│        ┌───────────┼───────────────┐                        │
│        │           │               │                        │
│        ▼           ▼               ▼                        │
│   ┌─────────┐ ┌──────────┐  ┌──────────────┐               │
│   │Opta-LMX │ │Databases │  │ Cloudflare   │               │
│   │(Local   │ │(Tasks,   │  │ Tunnels      │               │
│   │ Inference)│ Chat history)  │ (NAT traverse) │           │
│   └─────────┘ └──────────┘  └──────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Service Catalog

### OptaPlus (This App)
| Aspect | Details |
|--------|---------|
| **Purpose** | Telegram replacement, bot communication client |
| **Platforms** | iOS 17+, macOS 14+ |
| **Repository** | `~/Synced/Opta/1-Apps/1I-OptaPlus/` |
| **Entry Point** | User launches app, connects to gateway |
| **Output** | Chat messages, cron jobs, bot config edits sent to gateway |

### Opta CLI
| Aspect | Details |
|--------|---------|
| **Purpose** | Command-line tool for bot management, coding |
| **Tech** | Clojure, runs on macOS/Linux |
| **Repository** | `~/Synced/Opta/1-Apps/1A-OptaCLI/` (or similar) |
| **Integration** | Generates bots, deploys code, configures gateway |
| **OptaPlus Link** | Bots created here appear in OptaPlus |

### Opta Life
| Aspect | Details |
|--------|---------|
| **Purpose** | Task management, schedule management, advice engine |
| **Tech** | Node.js, runs locally at `http://localhost:3000` |
| **API Endpoint** | `POST /api/opta-sync` (add/update/complete tasks) |
| **OptaPlus Link** | OptaPlus can trigger Opta Life tasks via cron jobs |
| **Example** | Cron job "check-schedule" queries Opta Life for Matthew's calendar |

### Opta-LMX
| Aspect | Details |
|--------|---------|
| **Purpose** | Local LLM inference, runs fast language models |
| **Tech** | Python, runs locally or on Mac Studio |
| **Model Examples** | Deepseek 7B, GLM 4-7B, Ollama models |
| **OptaPlus Link** | Bots can run inference tasks via Opta-LMX backend |
| **Speed** | Sub-second responses for small models |

### OpenClaw Gateway
| Aspect | Details |
|--------|---------|
| **Purpose** | Central hub for bot communication, auth, routing |
| **Tech** | Node.js, daemon process, runs on macOS/Linux |
| **Ports** | Main gateway on 18793, bots on 19000-19008 |
| **Responsibilities** | Auth, WebSocket relay, cron scheduler, webhooks |
| **OptaPlus Integration** | OptaPlus connects here to talk to all bots |

---

## 3. Data Flows

### Flow 1: User sends message in OptaPlus → Bot responds

```
1. User types in OptaPlus iOS/macOS
2. OptaPlus creates ChatMessage(role: .user, content: "...")
3. OptaPlus sends via NWConnection WebSocket to gateway:
   {
     "req": "chat.send",
     "params": {
       "session": "abc123",
       "text": "...",
       "botId": "opta-max"
     }
   }
4. Gateway routes to bot (port 19000 for Opta Max)
5. Bot processes, generates response
6. Gateway sends back:
   {
     "event": "chat.delta",
     "data": {
       "content": "Thinking...",
       "role": "assistant"
     }
   }
7. OptaPlus streams response to UI
8. Message stored in CloudKit (iCloud sync)
```

### Flow 2: Cron job scheduled in OptaPlus → Executes on gateway

```
1. User creates job in OptaPlus: "Daily report at 10:00 AM"
2. OptaPlus sends:
   {
     "req": "cron.add",
     "params": {
       "schedule": "0 10 * * *",
       "botId": "opta-max",
       "payload": {
         "type": "agentTurn",
         "instruction": "Generate daily report"
       }
     }
   }
3. Gateway stores cron job
4. At 10:00 AM, gateway triggers bot:
   {
     "event": "cron.tick",
     "data": {
       "jobId": "daily-report",
       "timestamp": "2026-02-15T10:00:00Z"
     }
   }
5. Bot executes, generates report
6. OptaPlus receives notification (via push or WebSocket event)
7. Report appears in chat history
8. Live Activity on iOS shows progress
```

### Flow 3: @mention handoff between bots

```
1. User in OptaPlus chat with Claude bot types: "@Opta Max analyze this"
2. OptaPlus detects @mention, collects last 10 messages from Claude chat
3. OptaPlus sends to Opta Max:
   {
     "req": "chat.send",
     "params": {
       "session": "xyz789",
       "text": "[CROSS_BOT_HANDOFF from: claude]\n<last 10 messages>\n\nanalyze this"
     }
   }
4. Opta Max bot receives context, analyzes
5. Response appears in Opta Max chat
6. User continues in Opta Max chat or switches back to Claude
```

### Flow 4: Task query → Opta Life

```
1. Cron job "check-schedule" triggered by gateway
2. Bot calls internal task: GET http://localhost:3000/api/opta-sync?action=list_tasks
3. Opta Life responds with task list, calendar events
4. Bot incorporates into response: "You have 3 tasks today..."
5. OptaPlus receives message, displays to user
```

### Flow 5: iCloud Sync between macOS and iOS

```
1. Message arrives on macOS OptaPlus
2. macOS stores in CloudKit private database
3. CloudKit syncs to iCloud
4. iPhone OptaPlus notices change via CloudKit subscription
5. Message appears on iPhone within 30 seconds
6. User can see conversation history on both devices
```

---

## 4. Bot Infrastructure

### 7 Core Bots

| Bot Name | Port | Purpose | Status |
|----------|------|---------|--------|
| **Opta Max** | 19000 | Primary AI assistant (Claude 3.5 Sonnet) | Active |
| **Opta512** | 19001 | Secondary assistant, testing | Active |
| **Mono** | 19002 | Infrastructure, system management (shared with Josh) | Active |
| **Saturday** | 19003 | Josh's personal bot | Active |
| **Claude** | 19004 | Direct Claude inference (not user-facing) | Backend |
| **Groq** | 19005 | Fast inference via Groq API | Backend |
| **Anthropic** | 19006 | Direct Anthropic API (deprecated, internal use) | Legacy |

### Custom Bot Slots (19007+)

Users can add custom bots:
- Port 19007, 19008, 19009, etc.
- Each custom bot has own token, config, and OptaPlus connection

---

## 5. Connection Methods

### LAN (Local Network)

```
OptaPlus ───(Bonjour discovery)──> Gateway
          ───(NWConnection)────> Bot (19000)
          ───(WebSocket)────────> Chat stream
```

**Latency:** <5ms
**Speed:** Fast, always available at home
**Reliability:** Excellent (local network)

### Manual IP

```
OptaPlus ───(user enters IP)──> 192.168.1.100:18793
          ───(NWConnection)──> Gateway
          ───(relay)──────────> Bot
```

**Use case:** Known IP, DDNS, static IPs
**Latency:** Varies
**Reliability:** Depends on network stability

### Cloudflare Tunnel

```
OptaPlus ───(https)──> tunnel-xxx.trycloudflare.com
          ───(relay)──> OpenClaw Gateway
          ───(internal)──> Bot
```

**Use case:** Anywhere, NAT traversal, public internet
**Latency:** 20-100ms (depends on region)
**Reliability:** Good (Cloudflare infrastructure)

---

## 6. Authentication & Tokens

### Gateway Token

```
Format:   <random-64-char-hex>
Example:  a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3
Purpose:  Authenticates OptaPlus connection to gateway
Scope:    All bots behind gateway (for simplicity)
Storage:  iOS Keychain, macOS Keychain
Rotation: Manual (user must update in settings)
```

### Session Key

```
Generated: On each connection
Format:    UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)
Purpose:   Identifies OptaPlus session to gateway
Lifetime:  Until disconnect
Scope:     Single connection (macOS: per window, iOS: per app instance)
Rotation:  Auto-generated on reconnect
Storage:   NOT synced to iCloud (security)
```

---

## 7. Gateway Protocol v3 (Simplified)

### Frame Structure

```json
{
  "req": "chat.send",            // or "res", "event"
  "id": "msg-123",               // request ID for correlation
  "params": {                    // request-specific
    "session": "abc123",
    "text": "Hello"
  },
  "data": { },                   // response/event data
  "error": null                  // error if present
}
```

### Method Reference (Subset Used by OptaPlus)

| Method | Direction | Purpose |
|--------|-----------|---------|
| `connect` | req | Authenticate, establish session |
| `chat.send` | req | Send message to bot |
| `chat.delta` | event | Stream response chunk |
| `chat.history` | req | Fetch message history |
| `chat.abort` | req | Stop current generation |
| `sessions.list` | req | List active sessions |
| `cron.list` | req | Fetch cron jobs |
| `cron.add` | req | Create cron job |
| `cron.remove` | req | Delete cron job |
| `config.get` | req | Fetch bot config |
| `config.patch` | req | Update bot config |
| `gateway.restart` | req | Restart gateway |

### Full spec: `~/Synced/AI26/1-SOT/1B-Protocols/GATEWAY-PROTOCOL-V3.md`

---

## 8. Webhook Integrations

### Push Notifications (iOS/macOS)

```
1. Bot sends cron result to gateway
2. Gateway checks config: "notify on completion"
3. Gateway calls APNs webhook:
   POST https://api.push.apple.com/3/device/<token>
   {
     "alert": "Cron job completed: daily-report",
     "badge": 1,
     "sound": "default",
     "custom": { "botId": "opta-max" }
   }
4. Apple's APNs delivers notification
5. OptaPlus receives, displays in notification center
```

### Opta Life Callbacks

```
1. Bot needs task data
2. Bot queries Opta Life:
   GET http://localhost:3000/api/opta-sync?action=list_tasks
3. Opta Life returns JSON array of tasks
4. Bot uses task data in response
5. OptaPlus displays enriched message
```

---

## 9. Data Storage Layers

### Ephemeral (Session)
```
WebSocket connection state
Request/response IDs for correlation
Streaming chunks (accumulated, discarded after sent)
Lifetime: Connection open
```

### Local (OptaPlus App)
```
UserDefaults: Bot list, preferences, settings
Keychain: Gateway token
MessageStore: Last 100 messages per bot (cache)
CloudKit cache: Synced data cached locally
Lifetime: App runs
```

### iCloud (CloudKit)
```
Messages: Full chat history per bot
Bot configs: All saved bots and their settings
Preferences: Theme, notification config, UI state
Lifetime: User account (until manual delete)
Sync: Between devices, up to 30s latency
```

### Gateway (Transient)
```
Session keys: Stored during connection
Cron job metadata: Schedule, last run time
Bot config: Model, temperature, skills
Lifetime: Until gateway restart (not persisted to disk usually)
```

---

## 10. Scaling & Future

### Add a New Bot

**Process:**
1. Create bot in Opta CLI: `opta bot create --name my-bot --port 19010`
2. Bot boots, connects to gateway on port 19010
3. Gateway auto-discovers bot
4. OptaPlus polls `gateway.botlist` every 30s
5. My-bot appears in OptaPlus bot list automatically
6. User can enable/disable, configure, chat

### Add a New App

**Example: OptaPlus Web (future)**
1. Build web frontend (React, Next.js, etc.)
2. Use same gateway IP/token as OptaPlus (iOS/macOS)
3. NWConnection → WebSocket (native JS)
4. Share same ChatMessage models (JSON schema)
5. Web app connects to gateway, syncs via CloudKit (if auth works)

### Multi-Gateway Setup

**Example: Multiple households**
```
Gateway A (Mac Studio, home 1)  ← OptaPlus A, Opta CLI A
  ↓
  Cloudflare Tunnel (tunnel-a.trycloudflare.com)
  
Gateway B (Mac Studio, home 2)  ← OptaPlus B, Opta CLI B
  ↓
  Cloudflare Tunnel (tunnel-b.trycloudflare.com)

OptaPlus can connect to both via manual IP or tunnel URLs
```

---

## 11. Disaster Recovery & Resilience

### What Happens If Gateway Goes Down?

```
1. OptaPlus detects no pong (5s timeout)
2. Shows "Reconnecting..." banner, bot status turns amber
3. Tries reconnect every 5s with exponential backoff (up to 15s)
4. If offline >5 min, shows "Bot offline" warning
5. User can still read cached messages from CloudKit
6. User can manually refresh or try different connection method
```

### What Happens If iCloud Sync Fails?

```
1. Message saved locally first (fast)
2. Background task tries to sync to CloudKit
3. If fails, retries with exponential backoff
4. If fails for >10 min, shows notification: "Sync failed, check connection"
5. When internet returns, auto-syncs
6. User never loses data (local storage is source of truth)
```

### What Happens If Bot Crashes?

```
1. Gateway detects no heartbeat from bot (after 30s)
2. Gateway marks bot as offline
3. OptaPlus receives status event: "offline"
4. User sees red dot on bot
5. Gateway can auto-restart bot (configurable)
6. User can manually tap "Restart" → sends config.restart command
7. Bot reboots, reconnects
```

---

## 12. Ecosystem Diagram (Data Flows)

```
┌──────────────────────────────────────────────────────────┐
│ OptaPlus (iOS + macOS)                                   │
│ ├─ Sends: chat.send, cron.add, config.patch            │
│ ├─ Receives: chat.delta, cron.tick, status events       │
│ └─ Stores: CloudKit (iCloud), Keychain (token)         │
└────────────┬─────────────────────────────────────────────┘
             │ NWConnection + TLS (tunnel) or LAN
             │
┌────────────▼─────────────────────────────────────────────┐
│ OpenClaw Gateway (Daemon)                                │
│ ├─ Auth: Gateway token validation                        │
│ ├─ Routing: req → bot by ID                             │
│ ├─ Streaming: WebSocket frame relay                      │
│ ├─ Cron: Scheduler for jobs                             │
│ └─ Webhooks: APNs, Opta Life callbacks                  │
└────┬─────────┬────────────┬───────────────────────────────┘
     │         │            │
┌────▼───┐ ┌──▼─────┐ ┌────▼──────┐
│Bot 1   │ │Bot 2   │ │Custom Bot  │
│(19000) │ │(19001) │ │(19007)     │
└────────┘ └────────┘ └────────────┘
     │         │            │
     └─────────┼────────────┘
               │
          (inference)
               │
     ┌─────────▼──────────┐
     │ Opta-LMX           │
     │ (Local inference)  │
     │ Deepseek, GLM, etc │
     └────────────────────┘

     Parallel:
     ┌──────────────────────┐
     │ Opta Life            │
     │ (Task scheduler)     │
     │ http://localhost:3000│
     └──────────────────────┘
```

---

## 13. Key Dependencies

### OptaPlus depends on:
- ✅ OpenClaw Gateway (running, accessible)
- ✅ At least 1 bot on gateway
- ✅ iCloud account (for sync, optional)
- ✅ Internet (for Cloudflare tunnel, not needed for LAN)

### Optional:
- Opta Life (for task queries)
- Opta-LMX (for fast inference)
- Cloudflare account (for tunnel relay)

---

## 14. How to Add a Bot (For Matthew)

**Quick reference:**

```bash
# In Opta CLI
opta bot create \
  --name my-research-bot \
  --port 19010 \
  --model gpt-4 \
  --prompt "You are a research assistant"

# Bot boots, connects to gateway
# OptaPlus auto-discovers within 30s
# User can add/remove in OptaPlus settings
```

---

## 15. Reference

- **APP.md** — OptaPlus product context
- **SHARED.md** — Data models, sync strategy
- **docs/KNOWLEDGE.md** — Gateway Protocol spec, infrastructure details
- **docs/WORKFLOWS.md** — How to add a bot, testing workflow

