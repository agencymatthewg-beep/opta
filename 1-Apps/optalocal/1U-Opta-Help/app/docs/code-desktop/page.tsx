"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
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
  return (
    <>
      <Breadcrumb items={[{ label: "Code Desktop" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Code Desktop</h1>
          <p className="lead">
            Opta Code Desktop is a visual Vite + React application that
            provides a graphical interface for monitoring daemon activity,
            managing sessions, and controlling the daemon lifecycle.
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
            Code Desktop is a pure Vite + React web application served from
            the browser. It does not use Electron or Tauri -- it is a
            standard single-page application that communicates with the
            daemon over localhost.
          </p>

          <CodeBlock
            language="text"
            filename="Code Desktop Architecture"
            code={`Code Desktop (Vite + React)
    |
    |  HTTP REST   → session management, daemon control
    |  WebSocket   → real-time event streaming
    v
Opta Daemon  127.0.0.1:9999
    |
    |  Proxied inference requests
    v
Opta LMX  192.168.188.11:1234`}
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
            <li><strong>Daemon Panel</strong> -- start, stop, restart the daemon and view real-time logs</li>
            <li><strong>Chat / Do Mode Toggle</strong> -- switch between interactive chat and autonomous do mode from the composer</li>
          </ul>

          <h2 id="connection-model">Connection Model</h2>
          <p>
            Code Desktop connects to the daemon on <code>127.0.0.1:9999</code>{" "}
            by default. Authentication uses a Bearer token read from the
            daemon&apos;s <code>state.json</code> file. For WebSocket connections,
            the token is passed as a query parameter.
          </p>

          <Callout variant="info" title="Token persistence">
            The daemon connection token is stored in{" "}
            <code>localStorage</code> under the key{" "}
            <code>opta:daemon-connection</code>. This survives page reloads
            so you do not need to re-authenticate after refreshing the
            browser.
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

          <PrevNextNav
            prev={{ title: "Remote Access", href: "/docs/local-web/remote-access/" }}
            next={{ title: "Sessions", href: "/docs/code-desktop/sessions/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
