"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "daemon-panel", title: "Daemon Panel", level: 2 as const },
  { id: "lifecycle-controls", title: "Lifecycle Controls", level: 2 as const },
  { id: "log-viewer", title: "Log Viewer", level: 2 as const },
  { id: "connection-status", title: "Connection Status", level: 2 as const },
  { id: "auto-discovery", title: "Auto-Discovery", level: 2 as const },
];

export default function CodeDesktopDaemonControlsPage() {
  const { prev, next } = getPrevNext("/docs/code-desktop/daemon-controls/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Code Desktop", href: "/docs/code-desktop/" },
          { label: "Daemon Controls" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Daemon Controls</h1>
          <p className="lead">
            Code Desktop includes a dedicated daemon panel for managing the
            Opta daemon lifecycle, viewing real-time logs, and monitoring
            connection health -- all from the graphical interface.
          </p>

          <h2 id="daemon-panel">Daemon Panel</h2>
          <p>
            The daemon panel is a dedicated section of the Code Desktop
            interface that surfaces daemon status and control actions. It
            shows:
          </p>
          <ul>
            <li><strong>Current state</strong> -- whether the daemon is running, stopped, or starting</li>
            <li><strong>PID</strong> -- the process ID of the running daemon</li>
            <li><strong>Uptime</strong> -- how long the daemon has been running since last start</li>
            <li><strong>Port</strong> -- the port the daemon is listening on (default 9999)</li>
            <li><strong>Session count</strong> -- number of active sessions</li>
          </ul>

          <h2 id="lifecycle-controls">Lifecycle Controls</h2>
          <p>
            The daemon panel provides three primary lifecycle actions:
          </p>
          <ul>
            <li>
              <strong>Start</strong> -- launches the daemon if it is not
              running. The panel polls the daemon health endpoint until
              it responds, then transitions to the connected state.
            </li>
            <li>
              <strong>Stop</strong> -- sends a graceful shutdown signal
              to the daemon. Active sessions are preserved on disk before
              the process exits.
            </li>
            <li>
              <strong>Restart</strong> -- performs a stop followed by a
              start. The WebSocket connection automatically reconnects
              after the daemon comes back online.
            </li>
          </ul>

          <Callout variant="warning" title="Token rotation">
            When the daemon restarts, it generates a new authentication
            token. Code Desktop detects this and updates the stored token
            in <code>localStorage</code> automatically. If you see
            authentication errors after a restart, try refreshing the page.
          </Callout>

          <h2 id="log-viewer">Log Viewer</h2>
          <p>
            The log viewer provides a real-time tail of daemon log output.
            Logs are streamed from the daemon&apos;s log file and displayed in a
            scrollable terminal-style panel with:
          </p>
          <ul>
            <li><strong>Timestamp</strong> -- when each log entry was written</li>
            <li><strong>Level</strong> -- color-coded severity (debug, info, warn, error)</li>
            <li><strong>Component</strong> -- which daemon subsystem generated the log (e.g., session, tools, lmx)</li>
            <li><strong>Message</strong> -- the log content</li>
          </ul>
          <p>
            The log viewer auto-scrolls to the latest entry by default.
            Scrolling up pauses auto-scroll so you can inspect older entries;
            scrolling back to the bottom resumes auto-scroll.
          </p>
          <p>
            Log entries can be filtered by severity level. Setting the
            filter to &quot;error&quot; shows only errors and warnings, which is
            useful for diagnosing issues without wading through verbose
            debug output.
          </p>

          <h2 id="connection-status">Connection Status</h2>
          <p>
            The connection status indicator is always visible in the Code
            Desktop header. It shows one of three states:
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">State</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Indicator</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Connected</td>
                  <td className="px-4 py-2.5 text-neon-green">Green dot</td>
                  <td className="px-4 py-2.5">WebSocket active, daemon responding to health checks</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Reconnecting</td>
                  <td className="px-4 py-2.5 text-neon-amber">Amber pulse</td>
                  <td className="px-4 py-2.5">WebSocket disconnected, attempting reconnection with backoff</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">Disconnected</td>
                  <td className="px-4 py-2.5 text-neon-red">Red dot</td>
                  <td className="px-4 py-2.5">Daemon unreachable, multiple reconnection attempts failed</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="auto-discovery">Auto-Discovery</h2>
          <p>
            Code Desktop automatically discovers the daemon running on
            localhost. On startup, it checks the default daemon address
            (<code>127.0.0.1:9999</code>) and establishes a connection if the
            daemon is running. If the daemon is not running, it displays
            the disconnected state with a &quot;Start Daemon&quot; button.
          </p>
          <p>
            The daemon configuration path is XDG-aware, matching the CLI&apos;s
            behavior. On macOS, the daemon state file is read from{" "}
            <code>~/.config/opta/daemon/state.json</code>, which contains
            the authentication token and port number.
          </p>

          <Callout variant="tip" title="Background daemon">
            For the best experience, install the daemon as a system service
            using <code>opta daemon install</code>. This ensures the daemon
            starts automatically at login and is always available for Code
            Desktop to connect to.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
