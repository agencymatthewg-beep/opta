"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { TabGroup } from "@/components/docs/TabGroup";
import { ApiEndpoint } from "@/components/docs/ApiEndpoint";

const tocItems = [
  { id: "connecting", title: "Connecting", level: 2 as const },
  { id: "envelope-format", title: "Envelope Format", level: 2 as const },
  { id: "event-types", title: "Event Types", level: 2 as const },
  { id: "session-events", title: "Session Events", level: 3 as const },
  { id: "turn-events", title: "Turn Events", level: 3 as const },
  { id: "tool-events", title: "Tool Events", level: 3 as const },
  { id: "permission-events", title: "Permission Events", level: 3 as const },
  { id: "background-events", title: "Background Events", level: 3 as const },
  { id: "reconnection", title: "Reconnection", level: 2 as const },
  { id: "client-example", title: "Client Example", level: 2 as const },
];

export default function DaemonWebSocketPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Daemon", href: "/docs/daemon/" },
          { label: "WebSocket Events" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>WebSocket Events</h1>
          <p className="lead">
            The daemon streams real-time events over a WebSocket connection. This is the recommended
            way to build interactive clients — it provides lower latency than HTTP polling and
            delivers every event as it happens.
          </p>

          <h2 id="connecting">Connecting</h2>
          <ApiEndpoint
            method="WS"
            path="/v3/ws?token=T"
            description="Opens a persistent WebSocket connection. The daemon pushes all session events for the authenticated client. The token is passed as a query parameter."
          />
          <p>
            Connect using the daemon token from <code>~/.config/opta/daemon/state.json</code>:
          </p>
          <CodeBlock
            language="javascript"
            filename="connect.js"
            code={`const ws = new WebSocket("ws://127.0.0.1:9999/v3/ws?token=opta_dk_...");

ws.onopen = () => console.log("connected");
ws.onmessage = (e) => {
  const envelope = JSON.parse(e.data);
  console.log(envelope.event, envelope.seq, envelope.data);
};
ws.onclose = (e) => console.log("closed", e.code, e.reason);`}
          />
          <Callout variant="info" title="Single connection">
            One WebSocket connection receives events for all sessions. You do not need a separate
            connection per session. Filter events client-side using the{" "}
            <code>data.sessionId</code> field.
          </Callout>

          <h2 id="envelope-format">Envelope Format</h2>
          <p>
            Every WebSocket message is a JSON object called a <strong>V3Envelope</strong>. It always
            contains three fields:
          </p>
          <CodeBlock
            language="typescript"
            filename="V3Envelope"
            code={`interface V3Envelope {
  event: string;    // Event type (e.g. "turn.token", "tool.start")
  seq: number;      // Monotonically increasing sequence number
  data: unknown;    // Event-specific payload
}`}
          />
          <p>
            The <code>seq</code> field is globally ordered across all sessions. It is the key to
            reliable reconnection — clients track the last received <code>seq</code> and pass it as{" "}
            <code>afterSeq</code> when reconnecting.
          </p>

          <h2 id="event-types">Event Types</h2>
          <p>
            The daemon emits the following event types. They are grouped by category.
          </p>

          <h3 id="session-events">Session Events</h3>

          <TabGroup
            tabs={[
              {
                label: "session.snapshot",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Sent immediately after WebSocket connection or session creation. Contains the full
                      session state.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "session.snapshot",
  "seq": 1,
  "data": {
    "sessionId": "sess_abc123",
    "mode": "chat",
    "model": "qwen3-30b-a3b",
    "status": "idle",
    "turns": 0
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "session.updated",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Emitted when session metadata changes (e.g., model swap, mode change).
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "session.updated",
  "seq": 50,
  "data": {
    "sessionId": "sess_abc123",
    "changes": { "model": "llama-3.3-70b" }
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "session.cancelled",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Emitted when a session&apos;s active turn is cancelled via the cancel endpoint.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "session.cancelled",
  "seq": 60,
  "data": {
    "sessionId": "sess_abc123",
    "turnId": "turn_003"
  }
}`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h3 id="turn-events">Turn Events</h3>
          <TabGroup
            tabs={[
              {
                label: "turn.queued",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      The turn has been accepted and is waiting to start.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "turn.queued",
  "seq": 41,
  "data": {
    "sessionId": "sess_abc123",
    "turnId": "turn_001",
    "content": "Explain this code"
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "turn.start",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Inference has begun for this turn. The LMX connection is active.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "turn.start",
  "seq": 42,
  "data": {
    "sessionId": "sess_abc123",
    "turnId": "turn_001"
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "turn.token",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      A single token of assistant output. These events stream rapidly — build your UI
                      to append tokens efficiently.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "turn.token",
  "seq": 43,
  "data": {
    "sessionId": "sess_abc123",
    "token": "Hello"
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "turn.thinking",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Emitted when the model is in a &quot;thinking&quot; phase (chain-of-thought).
                      Optional — not all models emit this.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "turn.thinking",
  "seq": 44,
  "data": {
    "sessionId": "sess_abc123",
    "content": "Let me analyze the code structure..."
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "turn.done",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      The turn has completed. Includes final statistics.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "turn.done",
  "seq": 80,
  "data": {
    "sessionId": "sess_abc123",
    "turnId": "turn_001",
    "stats": {
      "tokens": 342,
      "speed": 45.2,
      "elapsed": 7568,
      "toolCalls": 2
    }
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "turn.error",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      The turn failed with an error. This is a terminal event for the turn.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "turn.error",
  "seq": 81,
  "data": {
    "sessionId": "sess_abc123",
    "turnId": "turn_001",
    "error": {
      "code": "LMX_UNREACHABLE",
      "message": "Connection refused to 192.168.188.11:1234"
    }
  }
}`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h3 id="tool-events">Tool Events</h3>
          <TabGroup
            tabs={[
              {
                label: "tool.start",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      A tool call has started executing. Includes the tool name and input parameters.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "tool.start",
  "seq": 55,
  "data": {
    "sessionId": "sess_abc123",
    "toolName": "file_read",
    "toolCallId": "tc_001",
    "input": { "path": "/src/index.ts" }
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "tool.end",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      A tool call has completed. Includes duration and a summary of the result.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "tool.end",
  "seq": 56,
  "data": {
    "sessionId": "sess_abc123",
    "toolName": "file_read",
    "toolCallId": "tc_001",
    "durationMs": 12,
    "success": true
  }
}`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h3 id="permission-events">Permission Events</h3>
          <TabGroup
            tabs={[
              {
                label: "permission.request",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      The daemon needs user approval before executing a tool call. The turn is paused
                      until this is resolved.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "permission.request",
  "seq": 57,
  "data": {
    "sessionId": "sess_abc123",
    "requestId": "perm_001",
    "toolName": "file_write",
    "input": { "path": "/src/config.ts", "content": "..." },
    "reason": "Tool requires write access"
  }
}`}
                    />
                  </div>
                ),
              },
              {
                label: "permission.resolved",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      A permission request has been approved or denied. The turn resumes (or the tool
                      call is skipped).
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "permission.resolved",
  "seq": 58,
  "data": {
    "sessionId": "sess_abc123",
    "requestId": "perm_001",
    "approved": true
  }
}`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h3 id="background-events">Background Events</h3>
          <TabGroup
            tabs={[
              {
                label: "background.output",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Output from a background process (e.g., a long-running shell command). These
                      stream asynchronously alongside turn events.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "event": "background.output",
  "seq": 70,
  "data": {
    "sessionId": "sess_abc123",
    "taskId": "bg_001",
    "stream": "stdout",
    "text": "Build complete. 0 errors."
  }
}`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h2 id="reconnection">Reconnection</h2>
          <p>
            If the WebSocket connection drops, clients should reconnect using the last received
            sequence number to avoid re-processing events. The daemon supports cursor-based
            reconnection via the <code>afterSeq</code> query parameter.
          </p>
          <CodeBlock
            language="javascript"
            filename="reconnect.js"
            code={`let lastSeq = 0;

function connect() {
  const url = \`ws://127.0.0.1:9999/v3/ws?token=\${token}&afterSeq=\${lastSeq}\`;
  const ws = new WebSocket(url);

  ws.onmessage = (e) => {
    const envelope = JSON.parse(e.data);
    lastSeq = envelope.seq;
    handleEvent(envelope);
  };

  ws.onclose = () => {
    // Exponential backoff reconnect
    setTimeout(connect, Math.min(1000 * Math.pow(2, retries), 30000));
  };
}`}
          />
          <Callout variant="tip" title="No duplicate events">
            When you reconnect with <code>afterSeq</code>, the daemon replays only events with a
            sequence number greater than the value you provide. This guarantees no duplicates and no
            gaps.
          </Callout>

          <h2 id="client-example">Client Example</h2>
          <p>
            Here is a complete example of a minimal TypeScript client that connects to the daemon,
            submits a turn, and streams the response:
          </p>
          <CodeBlock
            language="typescript"
            filename="daemon-client.ts"
            code={`import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Read token from state file
const statePath = join(homedir(), ".config/opta/daemon/state.json");
const state = JSON.parse(readFileSync(statePath, "utf-8"));
const { token, port } = state;

// Connect WebSocket
const ws = new WebSocket(\`ws://127.0.0.1:\${port}/v3/ws?token=\${token}\`);

ws.onopen = async () => {
  // Create a session
  const res = await fetch(\`http://127.0.0.1:\${port}/v3/sessions\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: "chat" }),
  });
  const { sessionId } = await res.json();

  // Submit a turn
  await fetch(\`http://127.0.0.1:\${port}/v3/sessions/\${sessionId}/turns\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: "What is Opta?" }),
  });
};

ws.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data);

  switch (event) {
    case "turn.token":
      process.stdout.write(data.token);
      break;
    case "turn.done":
      console.log("\\n--- Done ---");
      console.log(\`\${data.stats.tokens} tokens at \${data.stats.speed} tok/s\`);
      ws.close();
      break;
    case "turn.error":
      console.error("Error:", data.error.message);
      ws.close();
      break;
  }
};`}
          />

          <PrevNextNav
            prev={{ title: "HTTP API", href: "/docs/daemon/http-api/" }}
            next={{ title: "Troubleshooting", href: "/docs/daemon/troubleshooting/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
