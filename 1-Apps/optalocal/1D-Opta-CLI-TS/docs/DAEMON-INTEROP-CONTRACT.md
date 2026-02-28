# Opta Daemon v3 Interop Contract

> **Audience**: developers building Opta app clients (Opta Code Desktop, Opta Local web, bots).
> This document is derived from the Zod schemas in `src/protocol/v3/`.

---

## Overview

The Opta CLI daemon (`opta daemon start`) exposes a local JSON API over HTTP REST and WebSocket. All real-time event streaming uses the WebSocket path. HTTP is for control-plane operations (create session, submit turn, permission resolution, cancel, metrics).

**Default binding:** `127.0.0.1:9999`
**Protocol version:** `v3`
**Token location:** `~/.config/opta/daemon/state.json`

---

## Authentication

Every request requires a Bearer token.

- **HTTP**: `Authorization: Bearer <token>` header on all requests.
- **WebSocket**: Token passed as query parameter because browsers cannot set custom headers during WS handshake:
  ```
  ws://127.0.0.1:9999/v3/ws?sessionId=<sid>&afterSeq=0&token=<token>
  ```

---

## HTTP Endpoints

### `GET /v3/health`

Returns daemon liveness and version.

```json
{
  "status": "ok",
  "version": "0.5.0",
  "daemonId": "daemon_c7TiWPFQ",
  "runtime": { ... }
}
```

---

### `GET /v3/metrics`

Returns runtime snapshot (session count, active turns, subscriber count, etc.).

```json
{
  "daemonId": "daemon_c7TiWPFQ",
  "runtime": {
    "sessionCount": 2,
    "activeTurnCount": 1,
    "queuedTurnCount": 0,
    "subscriberCount": 3
  },
  "ts": "2026-02-28T04:00:00.000Z"
}
```

---

### `POST /v3/sessions`

Create a new session.

**Request body:**
```json
{
  "title": "Optional display name",
  "model": "optional-model-override",
  "metadata": { "workspace": "/path/to/cwd" }
}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "model": "mlx-community/Llama-3.2-3B-Instruct-4bit",
  "title": "Optional display name",
  "createdAt": "2026-02-28T04:00:00.000Z",
  "updatedAt": "2026-02-28T04:00:00.000Z",
  "activeTurnId": null,
  "queuedTurns": 0,
  "toolCallCount": 0,
  "writerCount": 0
}
```

---

### `GET /v3/sessions/:sessionId`

Fetch session detail including message history.

---

### `POST /v3/sessions/:sessionId/turns`

Submit a user turn (triggers the agent loop).

**Request body:**
```json
{
  "clientId": "opta-code-desktop-abc12345",
  "writerId": "opta-code-desktop-abc12345",
  "content": "Explain the auth module",
  "mode": "chat"
}
```

- `clientId`: stable per-client identifier (generate once, persist across sessions)
- `writerId`: identifies this specific writer (can equal `clientId` for single-user contexts)
- `mode`: `"chat"` (conversational) or `"do"` (agentic, auto-approves safe tools)

**Response:**
```json
{
  "turnId": "turn_xyz789",
  "queued": 0
}
```

---

### `GET /v3/sessions/:sessionId/events?afterSeq=0`

Poll for missed events since `afterSeq`. Used for initial load or reconnect catch-up. Prefer WebSocket for ongoing streaming.

**Response:**
```json
{
  "events": [ ... V3Envelope array ... ]
}
```

---

### `POST /v3/sessions/:sessionId/cancel`

Cancel the active or queued turn.

**Request body (all fields optional):**
```json
{ "turnId": "turn_xyz789", "writerId": "opta-code-desktop-abc12345" }
```

**Response:** `{ "cancelled": 1 }`

---

### `POST /v3/sessions/:sessionId/permissions/:requestId`

Resolve a tool permission request.

**Request body:**
```json
{
  "requestId": "perm_req_001",
  "decision": "allow",
  "decidedBy": "user@opta-code-desktop"
}
```

**Response:** `{ "ok": true, "conflict": false }`

`conflict: true` means another client already resolved this request.

---

### LMX Routes (proxied to Opta LMX server)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v3/lmx/status` | LMX server status + loaded models |
| `GET` | `/v3/lmx/memory` | Unified memory usage breakdown |
| `GET` | `/v3/lmx/models` | List loaded models |
| `GET` | `/v3/lmx/models/available` | List models on disk (not yet loaded) |
| `POST` | `/v3/lmx/models/load` | Load a model: `{ "modelId": "...", "backend": "mlx" }` |
| `POST` | `/v3/lmx/models/unload` | Unload a model: `{ "modelId": "..." }` |
| `DELETE` | `/v3/lmx/models/:modelId` | Delete a model from disk |
| `POST` | `/v3/lmx/models/download` | Start download: `{ "repoId": "mlx-community/..." }` |

---

## WebSocket (`/v3/ws`)

### Connection

```
ws://127.0.0.1:9999/v3/ws?sessionId=<sid>&afterSeq=<n>&token=<token>
```

- `afterSeq`: resume from this sequence number (events with `seq > afterSeq` will be delivered). Use `0` for full history replay, or the last-received `seq` for reconnect.
- Server sends missed events immediately on connect.

---

### Inbound Messages (Client → Server)

All messages are JSON objects with a `type` discriminant.

#### `hello`
Identify the client after connecting.
```json
{
  "type": "hello",
  "clientId": "opta-code-desktop-abc12345",
  "sessionId": "sess_abc123",
  "afterSeq": 0
}
```

#### `turn.submit`
Submit a user turn over WS (alternative to HTTP POST).
```json
{
  "type": "turn.submit",
  "clientId": "opta-code-desktop-abc12345",
  "writerId": "opta-code-desktop-abc12345",
  "sessionId": "sess_abc123",
  "content": "Hello",
  "mode": "chat"
}
```

#### `permission.resolve`
Approve or deny a tool permission request over WS.
```json
{
  "type": "permission.resolve",
  "sessionId": "sess_abc123",
  "requestId": "perm_req_001",
  "decision": "allow",
  "decidedBy": "user@opta-code-desktop"
}
```

#### `turn.cancel`
Cancel an active or queued turn over WS.
```json
{
  "type": "turn.cancel",
  "sessionId": "sess_abc123",
  "turnId": "turn_xyz789"
}
```

---

### Outbound Events (Server → Client)

All events are `V3Envelope` objects:

```typescript
interface V3Envelope {
  v: "3";
  event: V3Event;    // see event type list below
  daemonId: string;
  sessionId?: string;
  seq: number;       // monotonically increasing per session
  ts: string;        // ISO 8601
  payload: unknown;  // type-narrows based on event
}
```

**CRITICAL**: Route events by `envelope.event`, not `envelope.kind`. The `kind` field does not exist.

#### Event Reference

| `event` value | When emitted | Key payload fields |
|---|---|---|
| `session.snapshot` | On WS connect | Full `SessionSnapshot` |
| `turn.queued` | Turn added to queue | `{ turnId, writerId, position }` |
| `turn.start` | Agent loop begins | `{ turnId, writerId }` |
| `turn.token` | LLM token streamed | `{ text: string }` |
| `turn.thinking` | Reasoning token (extended thinking models) | `{ text: string }` |
| `tool.start` | Tool call begins | `{ toolName, callId, args }` |
| `tool.end` | Tool call completes | `{ toolName, callId, result, elapsed }` |
| `permission.request` | Tool awaiting user approval | `{ requestId, toolName, args }` |
| `permission.resolved` | Permission decided (any client) | `{ requestId, decision, decidedBy }` |
| `turn.progress` | Intermediate turn status update | `{ turnId, message }` |
| `turn.done` | Turn completed successfully | `TurnDonePayload` (see below) |
| `turn.error` | Turn failed | `TurnErrorPayload` (see below) |
| `session.updated` | Session metadata changed | Updated `SessionSnapshot` fields |
| `session.cancelled` | Session shut down | `{}` |
| `background.output` | Shell process produced output | `{ processId, pid, seq, stream, text }` |
| `background.status` | Shell process state changed | `{ process: BackgroundProcessSnapshot, reason }` |

#### `TurnDonePayload`

```typescript
{
  turnId: string;
  writerId: string;
  clientId: string;
  stats: {
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    toolCalls: number;
    elapsed: number;          // ms
    speed: number;            // tokens/sec
    firstTokenLatencyMs: number | null;
  };
}
```

#### `TurnErrorPayload`

```typescript
{
  turnId: string;
  writerId: string;
  clientId: string;
  message: string;
  code?: TurnErrorCode;
}
```

#### `turn.error` codes

| Code | Meaning |
|------|---------|
| `no-model-loaded` | LMX has no model ready |
| `lmx-ws-closed` | LMX WebSocket dropped mid-stream |
| `lmx-timeout` | LMX took too long to respond |
| `lmx-connection-refused` | LMX server not reachable |
| `storage-full` | Cannot persist session data |

#### Stop event kinds

Clients should treat these events as "streaming complete" and clear any loading state:

```
turn.done
turn.error
session.cancelled
```

---

## Reconnection Strategy

Clients should implement exponential backoff on unexpected close codes:

```typescript
if (closeCode !== 1000) {
  reconnectDelay = Math.min(baseDelay * Math.pow(2, attempt), 10_000);
  reconnect(afterSeq = lastReceivedSeq);
}
```

On reconnect, pass `afterSeq = lastReceivedSeq` to avoid re-receiving already-processed events. The server delivers only events with `seq > afterSeq`.

---

## Integration Requirements (Release Gate)

- Route by `event` envelope semantics end-to-end (never `kind`)
- Include `mode` in all `submitTurn` payloads
- Include `requestId` in all `resolvePermission` payloads
- Handle WS error frames explicitly (non-envelope `{ "error": "..." }` messages)
- Implement reconnect with `afterSeq` cursor
- Generate stable `clientId` per client instance (not per session)

---

## SDK

The `@opta/daemon-client` package (at `packages/daemon-client/`) provides typed wrappers for all HTTP endpoints and WebSocket helpers. Prefer consuming this package over raw fetch/WebSocket in app clients.

```typescript
import { DaemonHttpClient } from '@opta/daemon-client/http-client';
import type { DaemonConnectionOptions } from '@opta/daemon-client/types';

const client = new DaemonHttpClient({ host: '127.0.0.1', port: 9999, token });
const session = await client.createSession({ title: 'My session' });
```

---

## Versioning

The protocol version (`v: "3"`) is included in every envelope. Future breaking changes increment this value. Clients should check `v === "3"` and ignore or error on unknown versions.
