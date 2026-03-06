"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "what-is-code-desktop", title: "What is Code Desktop?", level: 2 as const },
  { id: "architecture", title: "Architecture", level: 2 as const },
  { id: "key-features", title: "Key Features", level: 2 as const },
  { id: "connection-model", title: "Connection Model", level: 2 as const },
  { id: "design-system", title: "Design System", level: 2 as const },
];

export default function CodeDesktopOverviewPage() {
  const { prev, next } = getPrevNext("/docs/code-desktop/");

  return (
    <>
      <Breadcrumb items={[{ label: "Code Desktop" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Code Desktop</h1>
          <p className="lead">
            Opta Code Desktop is a native desktop application built with a
            Tauri v2 shell and a Vite + React UI, providing graphical control
            for daemon-connected coding workflows.
          </p>

          <h2 id="what-is-code-desktop">What is Code Desktop?</h2>
          <p>
            While the Opta CLI is a terminal-native experience, Code Desktop
            offers the same daemon interaction through a visual interface.
            It connects to the Opta daemon via WebSocket and HTTP, presenting
            session history as a timeline, tool calls as collapsible cards,
            and streaming model responses with live token counters.
          </p>
          <p>
            Code Desktop is designed for developers who want a persistent,
            always-visible window showing what the daemon is doing. Keep it
            open alongside your editor to watch sessions unfold in real time,
            review past conversations, or export session data.
          </p>

          <h2 id="architecture">Architecture</h2>
          <p>
            Code Desktop runs as a native Tauri desktop app. The Rust shell
            handles native capabilities and secure storage; the React UI handles
            interaction and streaming presentation. In browser/dev mode, the same
            UI can run without the native shell.
          </p>

          <CodeBlock
            language="text"
            filename="Code Desktop Architecture"
            code={`Code Desktop (Tauri v2 shell + React UI)
    |
    |  Tauri commands → bootstrap metadata, secure token storage
    |  HTTP REST      → session + operation control
    |  WebSocket      → real-time event streaming
    v
Opta Daemon  (bootstrapped host/port)
    |
    |  Proxied inference requests
    v
Opta LMX  lmx-host.local:1234`}
          />

          <p>
            The app uses two client packages for daemon communication:
          </p>
          <ul>
            <li><strong>@opta/daemon-client</strong> -- HTTP client for REST operations (create sessions, list sessions, submit turns)</li>
            <li><strong>@opta/protocol-shared</strong> -- TypeScript types for the v3 protocol contract</li>
          </ul>
          <p>
            These packages are referenced via TypeScript path aliases, not
            npm dependencies, allowing development without a separate build
            step.
          </p>

          <h2 id="key-features">Key Features</h2>
          <ul>
            <li><strong>Workspace Rail</strong> -- a sidebar listing all daemon sessions with search and filtering</li>
            <li><strong>Timeline View</strong> -- chronological display of turns within a session, including user messages, model responses, and tool calls</li>
            <li><strong>Streaming Indicators</strong> -- live token counters and progress indicators during active inference</li>
            <li><strong>Turn Statistics</strong> -- token count, generation speed (tok/s), elapsed time, and tool call count for each completed turn</li>
            <li><strong>Tool Cards</strong> -- collapsible panels showing tool name, arguments, and results for each tool invocation</li>
            <li><strong>Session Export</strong> -- export conversations as JSON or Markdown for archival or sharing</li>
            <li><strong>Daemon Panel</strong> -- restart/stop daemon controls, status, uptime, and CLI ops handoff</li>
            <li><strong>Chat / Do Mode Toggle</strong> -- switch between interactive chat and autonomous do mode from the composer</li>
          </ul>

          <h2 id="connection-model">Connection Model</h2>
          <p>
            Code Desktop resolves daemon connection details from runtime bootstrap metadata
            and stored connection settings, with <code>127.0.0.1:9999</code> as a safe fallback
            in browser/dev mode. For WebSocket connections, the daemon token is passed as a
            query parameter.
          </p>

          <Callout variant="info" title="Token persistence">
            In native desktop runtime, daemon tokens are persisted via OS keyring-backed secure
            storage. In browser/dev mode, <code>localStorage</code> remains the compatibility
            fallback.
          </Callout>

          <p>
            The WebSocket connection includes automatic reconnection with
            exponential backoff. If the daemon restarts, Code Desktop
            detects the disconnection and reconnects automatically, resuming
            event streaming from the last received sequence number.
          </p>

          <h2 id="design-system">Design System</h2>
          <p>
            Code Desktop uses the canonical Opta design tokens defined in{" "}
            <code>opta.css</code>. The visual system includes:
          </p>
          <ul>
            <li>OLED-optimized dark theme (<code>#09090b</code> background)</li>
            <li>Glass panels (<code>.glass</code>, <code>.glass-subtle</code>, <code>.glass-strong</code>) with purple gradient approach</li>
            <li>Lucide React for all icons</li>
            <li>Violet accent color (<code>--opta-primary: #8b5cf6</code>)</li>
            <li>Framer Motion spring physics for animations</li>
          </ul>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
