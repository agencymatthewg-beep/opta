"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";

const tocItems = [
  { id: "daemon-exits-immediately", title: "Daemon Exits Immediately", level: 2 as const },
  { id: "port-in-use", title: "Port in Use", level: 3 as const },
  { id: "websocket-drops", title: "WebSocket Drops", level: 2 as const },
  { id: "lmx-unreachable", title: "LMX Unreachable", level: 3 as const },
  { id: "permission-requests-hang", title: "Permission Requests Hang", level: 2 as const },
  { id: "state-file-corrupt", title: "State File Corrupt", level: 2 as const },
  { id: "crash-recovery", title: "Crash Recovery", level: 2 as const },
  { id: "opta-doctor", title: "opta doctor", level: 2 as const },
  { id: "log-analysis", title: "Log Analysis", level: 2 as const },
  { id: "reset-everything", title: "Reset Everything", level: 2 as const },
];

export default function DaemonTroubleshootingPage() {
  const { prev, next } = getPrevNext("/docs/daemon/troubleshooting/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Daemon", href: "/docs/daemon/" },
          { label: "Troubleshooting" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Troubleshooting</h1>
          <p className="lead">
            Common daemon issues and their solutions. If you encounter a problem not listed here,
            check the daemon logs with <code>opta daemon logs</code> for detailed error messages.
          </p>

          <h2 id="daemon-exits-immediately">Daemon Exits Immediately</h2>
          <p>
            If <code>opta daemon start</code> exits without error output, the most common cause is a
            port conflict.
          </p>

          <h3 id="port-in-use">Port in Use</h3>
          <p>
            The daemon tries to bind to port 9999. If that port is taken, it scans ports 10000
            through 10020. If all ports are occupied, the daemon fails to start.
          </p>
          <CommandBlock
            command="lsof -i :9999"
            description="Check what is using port 9999"
            output={`COMMAND   PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345  matt   22u  IPv4  0x...  0t0  TCP localhost:9999 (LISTEN)`}
          />
          <p>
            If another process owns the port, either stop that process or configure the daemon to use
            a different port range:
          </p>
          <CommandBlock
            command="kill 12345 && opta daemon start"
            description="Kill the conflicting process and restart"
          />
          <Callout variant="warning" title="Multiple daemon instances">
            Never run two daemon instances. If you see a daemon already listening, use{" "}
            <code>opta daemon status</code> to check whether it is a legitimate Opta daemon before
            killing it.
          </Callout>

          <h2 id="websocket-drops">WebSocket Drops</h2>
          <p>
            WebSocket connections can drop for several reasons. The most common is the LMX server
            becoming unreachable during inference.
          </p>

          <h3 id="lmx-unreachable">LMX Unreachable</h3>
          <p>
            If the daemon cannot reach the LMX server at <code>192.168.188.11:1234</code>, it will
            emit a <code>turn.error</code> event with code <code>LMX_UNREACHABLE</code>. The
            WebSocket connection itself stays open, but inference fails.
          </p>
          <StepList
            steps={[
              {
                title: "Check LMX is running",
                content: (
                  <CommandBlock
                    command="curl http://192.168.188.11:1234/healthz"
                    output={`{"status":"ok"}`}
                  />
                ),
              },
              {
                title: "Check network connectivity",
                content: (
                  <CommandBlock
                    command="ping -c 3 192.168.188.11"
                    description="Verify LAN connection to Mac Studio"
                  />
                ),
              },
              {
                title: "Check LMX has a model loaded",
                content: (
                  <CommandBlock
                    command="curl http://192.168.188.11:1234/readyz"
                    output={`{"ready":true,"model":"qwen3-30b-a3b"}`}
                  />
                ),
              },
            ]}
          />
          <Callout variant="danger" title="Never use Tailscale">
            Always connect to the Mac Studio over LAN (<code>192.168.188.11</code>). Tailscale adds
            latency and is not supported for LMX connections.
          </Callout>

          <h2 id="permission-requests-hang">Permission Requests Hang</h2>
          <p>
            If a turn appears stuck, it may be waiting for a permission approval that was never
            resolved. This happens when a client disconnects while a <code>permission.request</code>{" "}
            event is pending.
          </p>
          <p>To unblock the session:</p>
          <StepList
            steps={[
              {
                title: "Check for pending permissions",
                description:
                  "Connect to the WebSocket or poll events to find any unresolved permission.request events.",
              },
              {
                title: "Cancel the stuck turn",
                content: (
                  <CommandBlock
                    command="curl -X POST http://127.0.0.1:9999/v3/sessions/SESSION_ID/cancel -H 'Authorization: Bearer TOKEN'"
                    description="Replace SESSION_ID and TOKEN with actual values"
                  />
                ),
              },
              {
                title: "Submit a new turn",
                description:
                  "After cancelling, you can submit a new turn to continue the conversation.",
              },
            ]}
          />
          <Callout variant="info" title="Automatic timeout">
            Permission requests that are not resolved within 5 minutes are automatically denied by
            the daemon. The turn will receive a tool denial and continue without the tool result.
          </Callout>

          <h2 id="state-file-corrupt">State File Corrupt</h2>
          <p>
            If the state file at <code>~/.config/opta/daemon/state.json</code> becomes corrupt (e.g.,
            due to a power loss during write), the CLI will fail to connect to the daemon.
          </p>
          <p>
            Fix: delete the state file and restart the daemon.
          </p>
          <CommandBlock
            command="rm ~/.config/opta/daemon/state.json && opta daemon start"
            description="Remove corrupt state and restart"
          />
          <Callout variant="warning" title="Session data is safe">
            Deleting <code>state.json</code> only removes the daemon process metadata (PID, token,
            port). Your session history is stored separately in{" "}
            <code>~/.config/opta/daemon/sessions/</code> and will not be affected.
          </Callout>

          <h2 id="crash-recovery">Crash Recovery</h2>
          <p>
            If the daemon crashes, the CLI automatically detects the stale state file on the next
            command. The <code>ensureDaemonRunning</code> crash guardian performs these steps:
          </p>
          <ul>
            <li>Reads the PID from <code>state.json</code></li>
            <li>Sends a signal-zero check to verify the process is alive</li>
            <li>If the process is dead, removes the stale state file</li>
            <li>Spawns a new daemon with a fresh token</li>
            <li>Retries the original command</li>
          </ul>
          <p>
            This happens transparently — in most cases, you will see a brief delay while the daemon
            restarts, then your command proceeds normally.
          </p>

          <h2 id="opta-doctor">opta doctor</h2>
          <p>
            The <code>opta doctor</code> command runs a comprehensive diagnostic check across the
            entire Opta Local stack:
          </p>
          <CommandBlock
            command="opta doctor"
            output={`Checking daemon...        ● running (pid 12345, port 9999)
Checking LMX...           ● reachable (192.168.188.11:1234)
Checking model...         ● loaded (qwen3-30b-a3b)
Checking config...        ● valid
Checking permissions...   ● ok

All checks passed.`}
          />
          <p>
            Use <code>opta doctor --fix</code> to attempt automatic fixes for common issues (stale
            state files, dead processes, missing config directories):
          </p>
          <CommandBlock
            command="opta doctor --fix"
            description="Run diagnostics and auto-fix issues"
          />

          <h2 id="log-analysis">Log Analysis</h2>
          <p>
            The daemon log at <code>~/.config/opta/daemon/daemon.log</code> is your primary debugging
            tool. Key patterns to look for:
          </p>
          <CodeBlock
            language="text"
            code={`# Successful start
[10:00:01] INFO  daemon started on 127.0.0.1:9999

# LMX connection failure
[10:00:05] ERROR lmx preflight failed: ECONNREFUSED 192.168.188.11:1234

# Permission timeout
[10:05:00] WARN  permission request perm_001 timed out (5m), auto-denying

# OOM in tool worker
[10:10:00] ERROR tool worker crashed: heap out of memory

# Session directory creation race
[10:00:02] WARN  session dir already exists, skipping mkdir`}
          />

          <h2 id="reset-everything">Reset Everything</h2>
          <p>
            As a last resort, you can perform a full daemon reset. This stops the daemon, removes all
            state files, and starts fresh. Session history is preserved.
          </p>
          <CommandBlock
            command="opta daemon stop"
            description="Step 1: Stop the daemon"
          />
          <CommandBlock
            command="rm ~/.config/opta/daemon/state.json ~/.config/opta/daemon/daemon.log"
            description="Step 2: Remove state and logs"
          />
          <CommandBlock
            command="opta daemon start"
            description="Step 3: Start fresh"
          />
          <Callout variant="danger" title="Do not delete the sessions directory">
            The <code>~/.config/opta/daemon/sessions/</code> directory contains all your persisted
            session data. Deleting it will permanently erase your conversation history.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
