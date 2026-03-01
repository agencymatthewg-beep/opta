"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";

const tocItems = [
  { id: "what-is-the-daemon", title: "What Is the Daemon", level: 2 as const },
  { id: "why-it-exists", title: "Why It Exists", level: 2 as const },
  { id: "architecture", title: "Architecture", level: 2 as const },
  { id: "multi-client-access", title: "Multi-Client Access", level: 3 as const },
  { id: "binding-and-port", title: "Binding and Port", level: 2 as const },
  { id: "authentication", title: "Authentication", level: 2 as const },
  { id: "state-file", title: "State File", level: 3 as const },
  { id: "quick-start", title: "Quick Start", level: 2 as const },
];

export default function DaemonOverviewPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Daemon", href: "/docs/daemon/" }, { label: "Overview" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Daemon Overview</h1>
          <p className="lead">
            The Opta daemon is a long-running background process that sits between the CLI and the
            LMX inference server. It provides session orchestration, permission gating, tool
            execution, and event persistence — enabling multiple clients to share a single inference
            pipeline.
          </p>

          <h2 id="what-is-the-daemon">What Is the Daemon</h2>
          <p>
            The daemon (<code>opta daemon</code>) is a headless HTTP + WebSocket server that runs on
            your local machine. It accepts requests from the CLI, Opta Code Desktop, and any other
            client that speaks the v3 protocol. The daemon owns the lifecycle of every AI session —
            creating, routing, persisting, and cancelling turns.
          </p>
          <p>
            When you run <code>opta chat</code> or <code>opta do</code>, the CLI connects to the
            daemon over HTTP. The daemon then proxies inference requests to the LMX server on your
            Mac Studio (or any OpenAI-compatible endpoint), handles tool calls, manages permissions,
            and streams events back to the client.
          </p>

          <h2 id="why-it-exists">Why It Exists</h2>
          <p>The daemon solves four problems that a direct CLI-to-LMX connection cannot:</p>
          <ul>
            <li>
              <strong>Persistent sessions</strong> — Conversations survive CLI restarts. The daemon
              persists every event to disk so sessions can be resumed from any client.
            </li>
            <li>
              <strong>Multi-client access</strong> — The CLI, Code Desktop, and Local Web can all
              connect to the same daemon simultaneously without conflicts.
            </li>
            <li>
              <strong>Permission gating</strong> — Dangerous tool calls (file writes, shell
              execution) require explicit user approval. The daemon queues permission requests and
              waits for resolution before proceeding.
            </li>
            <li>
              <strong>Event persistence</strong> — Every turn, token, and tool call is assigned a
              monotonic sequence number and written to disk. Clients can reconnect with{" "}
              <code>afterSeq</code> to resume without missing events.
            </li>
          </ul>

          <h2 id="architecture">Architecture</h2>
          <p>
            The daemon occupies the middle layer of the Opta Local stack. It exposes an HTTP REST API
            and a WebSocket endpoint for real-time streaming.
          </p>
          <CodeBlock
            language="text"
            code={`CLI / Code Desktop / Local Web
        │
        ▼
┌─────────────────────────────┐
│   Opta Daemon               │
│   127.0.0.1:9999             │
│                              │
│   - Session orchestration    │
│   - Permission gating        │
│   - Tool worker pool         │
│   - Event persistence        │
└─────────────┬───────────────┘
              │ HTTP /v1/chat/completions
              ▼
┌─────────────────────────────┐
│   Opta LMX                   │
│   192.168.188.11:1234        │
│   (Apple Silicon inference)  │
└─────────────────────────────┘`}
          />

          <h3 id="multi-client-access">Multi-Client Access</h3>
          <p>
            Multiple clients can connect to the daemon at the same time. Each client authenticates
            with the same Bearer token and can create or join sessions independently. The daemon
            handles concurrency — only one turn per session runs at a time, and tool workers are
            pooled across all active sessions.
          </p>

          <h2 id="binding-and-port">Binding and Port</h2>
          <p>
            By default, the daemon binds to <code>127.0.0.1:9999</code>. It only listens on
            localhost — it is never exposed to the network. If port 9999 is in use, the daemon will
            try ports 10000 through 10020 before failing.
          </p>
          <Callout variant="info" title="Localhost only">
            The daemon never binds to <code>0.0.0.0</code>. It is designed for local use only. For
            remote access, use the Opta Local Web dashboard with a Cloudflare Tunnel.
          </Callout>

          <h2 id="authentication">Authentication</h2>
          <p>
            All daemon endpoints require a Bearer token. This token is generated on first start and
            stored in a state file on disk. The CLI reads this file automatically — you never need to
            manage tokens manually.
          </p>
          <ul>
            <li>
              <strong>HTTP requests</strong> use the <code>Authorization: Bearer &lt;token&gt;</code>{" "}
              header.
            </li>
            <li>
              <strong>WebSocket connections</strong> pass the token as a query parameter:{" "}
              <code>ws://127.0.0.1:9999/v3/ws?token=T</code>.
            </li>
          </ul>
          <p>
            Token comparison uses <code>crypto.timingSafeEqual</code> to prevent timing attacks.
          </p>

          <h3 id="state-file">State File</h3>
          <p>
            The daemon writes its runtime state — including the auth token, PID, and port — to:
          </p>
          <CodeBlock
            filename="~/.config/opta/daemon/state.json"
            code={`{
  "pid": 12345,
  "port": 9999,
  "token": "opta_dk_...",
  "startedAt": "2026-03-01T10:00:00.000Z"
}`}
          />

          <h2 id="quick-start">Quick Start</h2>
          <CommandBlock
            command="opta daemon start"
            description="Start the daemon in the background"
            output={`Daemon started (pid 12345, port 9999)
Token written to ~/.config/opta/daemon/state.json`}
          />
          <CommandBlock
            command="opta daemon status"
            description="Check the daemon is running"
            output={`● running  pid=12345  port=9999  uptime=2m  sessions=0`}
          />
          <p>
            Once the daemon is running, all <code>opta chat</code> and <code>opta do</code> sessions
            will route through it automatically. See the{" "}
            <a href="/docs/daemon/lifecycle/">Lifecycle</a> page for full details on managing the
            daemon process.
          </p>

          <PrevNextNav
            prev={{ title: "Slash Commands", href: "/docs/cli/slash-commands/" }}
            next={{ title: "Lifecycle", href: "/docs/daemon/lifecycle/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
