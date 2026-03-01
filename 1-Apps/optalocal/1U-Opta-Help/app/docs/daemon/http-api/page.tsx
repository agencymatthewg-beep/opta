"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { ApiEndpoint } from "@/components/docs/ApiEndpoint";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "authentication", title: "Authentication", level: 2 as const },
  { id: "health-and-metrics", title: "Health & Metrics", level: 2 as const },
  { id: "sessions", title: "Sessions", level: 2 as const },
  { id: "create-session", title: "Create Session", level: 3 as const },
  { id: "get-session", title: "Get Session", level: 3 as const },
  { id: "submit-turn", title: "Submit Turn", level: 3 as const },
  { id: "poll-events", title: "Poll Events", level: 3 as const },
  { id: "cancel-session", title: "Cancel Session", level: 3 as const },
  { id: "permissions", title: "Permissions", level: 2 as const },
  { id: "operations", title: "Operations", level: 2 as const },
  { id: "list-operations", title: "List Operations", level: 3 as const },
  { id: "execute-operation", title: "Execute Operation", level: 3 as const },
  { id: "error-format", title: "Error Format", level: 2 as const },
];

export default function DaemonHttpApiPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Daemon", href: "/docs/daemon/" },
          { label: "HTTP API" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>HTTP API</h1>
          <p className="lead">
            The daemon exposes a RESTful HTTP API on <code>127.0.0.1:9999</code> using the v3
            protocol. All endpoints except <code>/v3/health</code> require Bearer token
            authentication.
          </p>

          <h2 id="authentication">Authentication</h2>
          <p>
            Include the daemon token in the <code>Authorization</code> header on every request:
          </p>
          <CodeBlock
            language="http"
            code={`Authorization: Bearer opta_dk_...`}
          />
          <p>
            The token is read from <code>~/.config/opta/daemon/state.json</code>. If the token is
            missing or incorrect, the daemon returns <code>401 Unauthorized</code>.
          </p>
          <Callout variant="info" title="Token source">
            The CLI reads the token automatically. If you are building a custom client, read the{" "}
            <code>token</code> field from the state file.
          </Callout>

          <h2 id="health-and-metrics">Health & Metrics</h2>

          <ApiEndpoint
            method="GET"
            path="/v3/health"
            description="Liveness probe. Returns daemon status, protocol version, and uptime in seconds. No authentication required."
            response={`{
  "status": "ok",
  "version": "3.0.0",
  "uptime": 842
}`}
          />

          <ApiEndpoint
            method="GET"
            path="/v3/metrics"
            description="Returns daemon performance metrics including active sessions, total turns, memory usage, and tool worker pool status."
            auth
            response={`{
  "activeSessions": 2,
  "totalTurns": 147,
  "memoryMB": 64,
  "toolWorkers": { "active": 3, "max": 8, "queued": 0 }
}`}
          />

          <h2 id="sessions">Sessions</h2>

          <h3 id="create-session">Create Session</h3>
          <ApiEndpoint
            method="POST"
            path="/v3/sessions"
            description="Creates a new AI session. Returns the session ID and initial snapshot."
            auth
            params={[
              { name: "model", type: "string", description: "Model identifier to use for inference", required: false },
              { name: "systemPrompt", type: "string", description: "Optional system prompt override", required: false },
              { name: "mode", type: "\"chat\" | \"do\"", description: "Session mode. 'do' enables autonomous tool execution", required: false },
            ]}
            response={`{
  "sessionId": "sess_abc123",
  "mode": "chat",
  "model": "qwen3-30b-a3b",
  "createdAt": "2026-03-01T10:00:00.000Z"
}`}
          />

          <h3 id="get-session">Get Session</h3>
          <ApiEndpoint
            method="GET"
            path="/v3/sessions/:id"
            description="Returns the full session detail including mode, model, turn count, and current status."
            auth
            params={[
              { name: "id", type: "string", description: "Session ID", required: true },
            ]}
            response={`{
  "sessionId": "sess_abc123",
  "mode": "chat",
  "model": "qwen3-30b-a3b",
  "status": "idle",
  "turns": 5,
  "createdAt": "2026-03-01T10:00:00.000Z",
  "lastActivityAt": "2026-03-01T10:05:30.000Z"
}`}
          />

          <h3 id="submit-turn">Submit Turn</h3>
          <ApiEndpoint
            method="POST"
            path="/v3/sessions/:id/turns"
            description="Submits user input to the session, starting a new turn. The daemon queues the turn and begins inference. Use the events endpoint or WebSocket to stream results."
            auth
            params={[
              { name: "id", type: "string", description: "Session ID", required: true },
              { name: "content", type: "string", description: "User message text", required: true },
              { name: "attachments", type: "Attachment[]", description: "File references to include as context", required: false },
            ]}
            response={`{
  "turnId": "turn_001",
  "status": "queued",
  "seq": 42
}`}
          />

          <h3 id="poll-events">Poll Events</h3>
          <ApiEndpoint
            method="GET"
            path="/v3/sessions/:id/events"
            description="Long-polls for session events. Returns a batch of events newer than the specified sequence number. Use this for HTTP-only clients that cannot use WebSocket."
            auth
            params={[
              { name: "id", type: "string", description: "Session ID", required: true },
              { name: "afterSeq", type: "number", description: "Return events with seq > this value. Use 0 for all events.", required: false },
              { name: "timeout", type: "number", description: "Long-poll timeout in milliseconds (default 30000)", required: false },
            ]}
            response={`{
  "events": [
    { "event": "turn.start", "seq": 43, "data": { "turnId": "turn_001" } },
    { "event": "turn.token", "seq": 44, "data": { "token": "Hello" } },
    { "event": "turn.token", "seq": 45, "data": { "token": " world" } }
  ],
  "lastSeq": 45
}`}
          />

          <h3 id="cancel-session">Cancel Session</h3>
          <ApiEndpoint
            method="POST"
            path="/v3/sessions/:id/cancel"
            description="Cancels the currently running turn in the session. Emits a session.cancelled event. If no turn is active, returns 200 with no effect."
            auth
            params={[
              { name: "id", type: "string", description: "Session ID", required: true },
            ]}
            response={`{ "cancelled": true }`}
          />

          <h2 id="permissions">Permissions</h2>
          <ApiEndpoint
            method="POST"
            path="/v3/sessions/:id/permissions/:requestId"
            description="Resolves a pending permission request. When the daemon encounters a tool call that requires user approval, it pauses and emits a permission.request event. This endpoint approves or denies the request."
            auth
            params={[
              { name: "id", type: "string", description: "Session ID", required: true },
              { name: "requestId", type: "string", description: "Permission request ID from the permission.request event", required: true },
              { name: "approved", type: "boolean", description: "Whether to approve or deny the tool call", required: true },
            ]}
            response={`{ "resolved": true }`}
          />
          <Callout variant="warning" title="Timeout behavior">
            If a permission request is not resolved within 5 minutes, the daemon automatically
            denies it and emits a <code>permission.resolved</code> event with{" "}
            <code>approved: false</code>.
          </Callout>

          <h2 id="operations">Operations</h2>
          <p>
            Operations are pre-defined daemon commands (model management, config changes, diagnostics)
            that can be triggered via the API without creating a chat session.
          </p>

          <h3 id="list-operations">List Operations</h3>
          <ApiEndpoint
            method="GET"
            path="/v3/operations"
            description="Lists all available operations with their parameter schemas."
            auth
            response={`{
  "operations": [
    {
      "id": "model.load",
      "description": "Load a model into LMX",
      "params": { "model": "string" }
    },
    {
      "id": "model.unload",
      "description": "Unload the current model",
      "params": {}
    }
  ]
}`}
          />

          <h3 id="execute-operation">Execute Operation</h3>
          <ApiEndpoint
            method="POST"
            path="/v3/operations/:id"
            description="Executes a named operation. The response depends on the operation type."
            auth
            params={[
              { name: "id", type: "string", description: "Operation ID (e.g. model.load)", required: true },
              { name: "params", type: "object", description: "Operation-specific parameters", required: false },
            ]}
            response={`{
  "success": true,
  "result": { "model": "qwen3-30b-a3b", "loadTimeMs": 2340 }
}`}
          />

          <h2 id="error-format">Error Format</h2>
          <p>
            All error responses follow a consistent JSON format:
          </p>
          <CodeBlock
            language="json"
            code={`{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "No session with id 'sess_xyz'"
  }
}`}
          />
          <p>Common error codes:</p>
          <ul>
            <li><code>UNAUTHORIZED</code> — Missing or invalid Bearer token (401)</li>
            <li><code>SESSION_NOT_FOUND</code> — Session ID does not exist (404)</li>
            <li><code>TURN_IN_PROGRESS</code> — Cannot submit a new turn while one is active (409)</li>
            <li><code>LMX_UNREACHABLE</code> — Cannot connect to the LMX inference server (502)</li>
            <li><code>INTERNAL_ERROR</code> — Unexpected daemon error (500)</li>
          </ul>

          <PrevNextNav
            prev={{ title: "Lifecycle", href: "/docs/daemon/lifecycle/" }}
            next={{ title: "WebSocket Events", href: "/docs/daemon/websocket/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
