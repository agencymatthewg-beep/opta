"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "daemon-client-sdk", title: "Daemon Client SDK", level: 2 as const },
  { id: "creating-a-client", title: "Creating a Client", level: 2 as const },
  { id: "session-lifecycle", title: "Session Lifecycle", level: 2 as const },
  { id: "create-session", title: "Create a Session", level: 3 as const },
  { id: "submit-turn", title: "Submit a Turn", level: 3 as const },
  { id: "poll-events", title: "Poll Events", level: 3 as const },
  { id: "websocket-streaming", title: "WebSocket Streaming", level: 2 as const },
  { id: "event-handling", title: "Event Handling", level: 2 as const },
  { id: "reconnection", title: "Reconnection with afterSeq", level: 2 as const },
];

export default function DeveloperSdkPage() {
  const { prev, next } = getPrevNext("/docs/developer/sdk/");
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Developer Guide", href: "/docs/developer/" },
          { label: "Daemon Client SDK" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Daemon Client SDK</h1>
          <p className="lead">
            The <code>@opta/daemon-client</code> TypeScript package provides
            a typed client for the daemon HTTP API and WebSocket event
            stream, handling authentication, serialization, and
            reconnection automatically.
          </p>

          <h2 id="daemon-client-sdk">Daemon Client SDK</h2>
          <p>
            The daemon client is used by Code Desktop and can be used by
            any TypeScript application that needs to interact with the Opta
            daemon. It wraps the daemon v3 REST API and WebSocket endpoint
            with fully typed request and response objects.
          </p>

          <h2 id="creating-a-client">Creating a Client</h2>

          <CodeBlock
            language="typescript"
            filename="Creating a daemon client"
            code={`import { DaemonClient } from "@opta/daemon-client";

const client = new DaemonClient({
  host: "127.0.0.1",
  port: 9999,
  token: "<bearer-token>",
});

// Verify connection
const health = await client.health();
console.log(health.status);  // "ok"`}
          />

          <p>
            The token is read from the daemon&apos;s <code>state.json</code>{" "}
            file at <code>~/.config/opta/daemon/state.json</code>. In
            browser environments, Code Desktop stores the token in{" "}
            <code>localStorage</code> after initial authentication.
          </p>

          <h2 id="session-lifecycle">Session Lifecycle</h2>
          <p>
            The daemon client supports the full session lifecycle: create,
            submit turns, poll for events, and close.
          </p>

          <h3 id="create-session">Create a Session</h3>

          <CodeBlock
            language="typescript"
            filename="Create a session"
            code={`const session = await client.createSession({
  mode: "chat",         // "chat" or "do"
  model: "qwen3-72b",  // model to use for inference
});

console.log(session.id);       // "sess-abc123"
console.log(session.status);   // "active"`}
          />

          <h3 id="submit-turn">Submit a Turn</h3>

          <CodeBlock
            language="typescript"
            filename="Submit a turn"
            code={`const turn = await client.submitTurn(session.id, {
  content: "Explain how unified memory works on Apple Silicon",
});

console.log(turn.id);  // "turn-xyz789"`}
          />

          <p>
            After submitting a turn, the model begins inference. You can
            track progress through WebSocket events or by polling the
            session endpoint.
          </p>

          <h3 id="poll-events">Poll Events</h3>

          <CodeBlock
            language="typescript"
            filename="Poll for events"
            code={`const events = await client.getEvents(session.id, {
  afterSeq: 0,  // get all events from the beginning
});

for (const event of events) {
  console.log(event.event, event.seq);
  // "turn.token" 1
  // "turn.token" 2
  // ...
  // "turn.done" 42
}`}
          />

          <Callout variant="tip" title="Polling vs. WebSocket">
            Polling is simpler but less efficient. For real-time streaming,
            use the WebSocket connection described below. Polling is best
            for one-off event retrieval or when WebSocket is unavailable.
          </Callout>

          <h2 id="websocket-streaming">WebSocket Streaming</h2>

          <CodeBlock
            language="typescript"
            filename="WebSocket streaming"
            code={`const ws = client.connectWebSocket();

ws.on("event", (envelope) => {
  switch (envelope.event) {
    case "turn.token":
      // Streaming token: envelope.data.token
      process.stdout.write(envelope.data.token);
      break;

    case "turn.tool_call":
      // Tool invocation: envelope.data.toolName, envelope.data.args
      console.log("Tool:", envelope.data.toolName);
      break;

    case "turn.tool_result":
      // Tool result: envelope.data.toolName, envelope.data.result
      console.log("Result:", envelope.data.result);
      break;

    case "turn.done":
      // Turn completed: envelope.stats
      console.log("\\nStats:", envelope.stats);
      break;

    case "turn.error":
      // Error during turn
      console.error("Error:", envelope.data.message);
      break;

    case "session.cancelled":
      // Session was cancelled
      console.log("Session cancelled");
      break;
  }
});

ws.on("disconnect", () => {
  console.log("WebSocket disconnected");
});`}
          />

          <h2 id="event-handling">Event Handling</h2>
          <p>
            The daemon emits several event types through the WebSocket
            connection:
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Event</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Stop Event</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">turn.token</td>
                  <td className="px-4 py-2.5">Streaming token from model output</td>
                  <td className="px-4 py-2.5">No</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">turn.thinking</td>
                  <td className="px-4 py-2.5">Model reasoning/thinking output</td>
                  <td className="px-4 py-2.5">No</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">turn.tool_call</td>
                  <td className="px-4 py-2.5">Model invoked a tool</td>
                  <td className="px-4 py-2.5">No</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">turn.tool_result</td>
                  <td className="px-4 py-2.5">Tool execution result</td>
                  <td className="px-4 py-2.5">No</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">turn.done</td>
                  <td className="px-4 py-2.5">Turn completed successfully</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">turn.error</td>
                  <td className="px-4 py-2.5">Error during inference or tool execution</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">session.cancelled</td>
                  <td className="px-4 py-2.5">Session was cancelled by user</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            Stop events (<code>turn.done</code>, <code>turn.error</code>,{" "}
            <code>session.cancelled</code>) indicate that no more events
            will be emitted for the current turn. Your UI should transition
            from a streaming state to a completed state when it receives a
            stop event.
          </p>

          <h2 id="reconnection">Reconnection with afterSeq</h2>
          <p>
            Each event has a sequence number (<code>seq</code>). When
            reconnecting after a disconnection, pass the last received
            sequence number as <code>afterSeq</code> to avoid re-delivery
            of events you have already processed.
          </p>

          <CodeBlock
            language="typescript"
            filename="Reconnection with cursor"
            code={`let lastSeq = 0;

ws.on("event", (envelope) => {
  lastSeq = envelope.seq;
  // ... handle event
});

ws.on("disconnect", () => {
  // Reconnect with cursor to avoid re-delivery
  const newWs = client.connectWebSocket({ afterSeq: lastSeq });
  // ... reattach event handlers
});`}
          />

          <Callout variant="info" title="Event cursor">
            The <code>afterSeq</code> cursor is essential for reliable
            reconnection. Without it, the client would receive duplicate
            events for everything that happened before the disconnection.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
