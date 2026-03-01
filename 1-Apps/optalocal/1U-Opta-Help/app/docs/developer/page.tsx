"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "building-on-opta", title: "Building on the Opta Stack", level: 2 as const },
  { id: "integration-points", title: "Integration Points", level: 2 as const },
  { id: "daemon-http-api", title: "Daemon HTTP API", level: 3 as const },
  { id: "lmx-openai-api", title: "LMX OpenAI API", level: 3 as const },
  { id: "websocket-events", title: "WebSocket Events", level: 3 as const },
  { id: "daemon-client-package", title: "@opta/daemon-client", level: 2 as const },
  { id: "extending-with-mcp", title: "Extending with MCP", level: 2 as const },
];

export default function DeveloperOverviewPage() {
  const { prev, next } = getPrevNext("/docs/developer/");
  return (
    <>
      <Breadcrumb items={[{ label: "Developer Guide" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Developer Guide</h1>
          <p className="lead">
            The Opta Local stack exposes multiple integration points for
            developers who want to build on top of the platform -- from
            the daemon HTTP API and LMX inference endpoints to WebSocket
            event streaming and MCP server extensions.
          </p>

          <h2 id="building-on-opta">Building on the Opta Stack</h2>
          <p>
            Opta is designed as an open integration platform. Each layer
            of the stack exposes well-documented APIs that you can use
            independently or together:
          </p>
          <ul>
            <li>Build custom UIs that connect to the daemon</li>
            <li>Write automation scripts that use the LMX inference API</li>
            <li>Create MCP servers that give the AI new tools</li>
            <li>Stream real-time events from the daemon WebSocket</li>
            <li>Integrate session data into your own workflows</li>
          </ul>

          <h2 id="integration-points">Integration Points</h2>

          <h3 id="daemon-http-api">Daemon HTTP API</h3>
          <p>
            The daemon exposes a REST API on <code>127.0.0.1:9999</code>{" "}
            for session management, turn submission, and daemon control.
            All requests require Bearer token authentication.
          </p>

          <CodeBlock
            language="bash"
            filename="Example: List Sessions"
            code={`curl -s http://127.0.0.1:9999/v3/sessions \\
  -H "Authorization: Bearer <token>" | jq`}
          />

          <p>
            The full HTTP API is documented in the{" "}
            <a href="/docs/daemon/http-api/">Daemon HTTP API</a> reference.
            Key endpoints include session CRUD, turn submission, health
            checks, and daemon lifecycle control.
          </p>

          <h3 id="lmx-openai-api">LMX OpenAI API</h3>
          <p>
            The LMX inference server exposes an OpenAI-compatible API at{" "}
            <code>192.168.188.11:1234</code>. Any tool or library that works
            with the OpenAI API can connect to LMX by changing the base
            URL.
          </p>

          <CodeBlock
            language="typescript"
            filename="LMX with OpenAI SDK"
            code={`import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://192.168.188.11:1234/v1",
  apiKey: "not-needed",  // LMX does not require an API key for inference
});

const response = await client.chat.completions.create({
  model: "qwen3-72b",
  messages: [{ role: "user", content: "Hello!" }],
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`}
          />

          <Callout variant="tip" title="OpenAI SDK compatible">
            You can use the official OpenAI Python or TypeScript SDK with
            LMX. Just set the <code>base_url</code> / <code>baseURL</code>{" "}
            to your LMX address. No API key is needed for inference
            endpoints.
          </Callout>

          <h3 id="websocket-events">WebSocket Events</h3>
          <p>
            The daemon provides a WebSocket endpoint for real-time event
            streaming. Events include turn progress, tool calls, completion
            notifications, and error reports. The WebSocket connection
            supports cursor-based reconnection to avoid re-delivery of
            events.
          </p>

          <CodeBlock
            language="typescript"
            filename="WebSocket Connection"
            code={`const ws = new WebSocket(
  "ws://127.0.0.1:9999/v3/events?token=<token>"
);

ws.onmessage = (event) => {
  const envelope = JSON.parse(event.data);
  switch (envelope.event) {
    case "turn.token":
      // streaming token
      break;
    case "turn.done":
      // turn completed, envelope.stats has token count, speed, etc.
      break;
    case "turn.error":
      // inference or tool error
      break;
  }
};`}
          />

          <p>
            Full WebSocket protocol documentation is in the{" "}
            <a href="/docs/daemon/websocket/">WebSocket Events</a> reference.
          </p>

          <h2 id="daemon-client-package">@opta/daemon-client</h2>
          <p>
            The <code>@opta/daemon-client</code> TypeScript package provides
            a typed client for the daemon HTTP API and WebSocket events. It
            handles authentication, reconnection, and event deserialization.
          </p>
          <p>
            See the{" "}
            <a href="/docs/developer/sdk/">Daemon Client SDK</a> page for
            usage details.
          </p>

          <h2 id="extending-with-mcp">Extending with MCP</h2>
          <p>
            The Model Context Protocol (MCP) allows you to give the AI
            new tools by writing MCP servers. The daemon can connect to
            multiple MCP servers simultaneously, making their tools
            available to the model during sessions.
          </p>
          <p>
            See the{" "}
            <a href="/docs/developer/mcp/">MCP Integration</a> page for
            details on listing, adding, testing, and removing MCP servers.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
