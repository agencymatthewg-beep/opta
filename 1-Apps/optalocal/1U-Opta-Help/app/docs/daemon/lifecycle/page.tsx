"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";
import { ApiEndpoint } from "@/components/docs/ApiEndpoint";

const tocItems = [
  { id: "starting-the-daemon", title: "Starting the Daemon", level: 2 as const },
  { id: "checking-status", title: "Checking Status", level: 2 as const },
  { id: "viewing-logs", title: "Viewing Logs", level: 2 as const },
  { id: "restarting", title: "Restarting", level: 2 as const },
  { id: "stopping", title: "Stopping", level: 2 as const },
  { id: "health-check", title: "Health Check", level: 2 as const },
  { id: "auto-start-on-boot", title: "Auto-Start on Boot", level: 2 as const },
  { id: "launchd-macos", title: "launchd (macOS)", level: 3 as const },
  { id: "systemd-linux", title: "systemd (Linux)", level: 3 as const },
  { id: "uninstalling", title: "Uninstalling", level: 2 as const },
  { id: "crash-recovery", title: "Crash Recovery", level: 2 as const },
];

export default function DaemonLifecyclePage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Daemon", href: "/docs/daemon/" },
          { label: "Lifecycle" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Daemon Lifecycle</h1>
          <p className="lead">
            The daemon is managed through the <code>opta daemon</code> subcommand. This page covers
            starting, stopping, monitoring, and installing the daemon as a system service.
          </p>

          <h2 id="starting-the-daemon">Starting the Daemon</h2>
          <p>
            The <code>opta daemon start</code> command launches the daemon as a background process.
            It writes its PID, port, and authentication token to the state file at{" "}
            <code>~/.config/opta/daemon/state.json</code>.
          </p>
          <CommandBlock
            command="opta daemon start"
            output={`Daemon started (pid 12345, port 9999)
Token written to ~/.config/opta/daemon/state.json`}
          />
          <p>
            If the daemon is already running, the command will report the existing process and exit
            without starting a second instance.
          </p>
          <Callout variant="tip" title="Auto-start">
            When you run <code>opta chat</code> or <code>opta do</code>, the CLI will automatically
            start the daemon if it is not already running. You only need to run{" "}
            <code>opta daemon start</code> explicitly if you want to pre-warm the daemon before use.
          </Callout>

          <h2 id="checking-status">Checking Status</h2>
          <p>
            The <code>opta daemon status</code> command shows the current state of the daemon
            process, including PID, port, uptime, and active session count.
          </p>
          <CommandBlock
            command="opta daemon status"
            output={`● running  pid=12345  port=9999  uptime=14m  sessions=2`}
          />
          <p>
            If the daemon is not running, you will see:
          </p>
          <CommandBlock
            command="opta daemon status"
            output={`○ stopped  (no daemon process found)`}
          />

          <h2 id="viewing-logs">Viewing Logs</h2>
          <p>
            The daemon writes structured logs to <code>~/.config/opta/daemon/daemon.log</code>. Use
            the <code>logs</code> subcommand to tail the log file:
          </p>
          <CommandBlock
            command="opta daemon logs"
            description="Tail the last 50 lines of daemon logs"
            output={`[10:00:01] INFO  daemon started on 127.0.0.1:9999
[10:00:02] INFO  session created id=sess_abc123
[10:00:03] INFO  turn started session=sess_abc123 turn=1
[10:00:05] INFO  tool.start tool=file_read path=/src/index.ts
[10:00:05] INFO  tool.end tool=file_read duration=12ms`}
          />
          <CommandBlock
            command="opta daemon logs --lines 200"
            description="Show more log history"
          />

          <h2 id="restarting">Restarting</h2>
          <p>
            The <code>opta daemon restart</code> command performs a clean stop followed by a fresh
            start. On restart, a new authentication token is generated and written to the state file.
          </p>
          <CommandBlock
            command="opta daemon restart"
            output={`Stopping daemon (pid 12345)...
Daemon stopped.
Daemon started (pid 12350, port 9999)
Token rotated.`}
          />
          <Callout variant="warning" title="Token rotation">
            Restarting the daemon rotates the auth token. Any connected clients (Code Desktop, Local
            Web) will need to reconnect. The CLI reads the new token from the state file
            automatically.
          </Callout>

          <h2 id="stopping">Stopping</h2>
          <p>
            The <code>opta daemon stop</code> command sends a <code>SIGTERM</code> to the daemon
            process and waits for it to exit cleanly. Active sessions are preserved on disk and can
            be resumed after the daemon is restarted.
          </p>
          <CommandBlock
            command="opta daemon stop"
            output={`Stopping daemon (pid 12345)...
Daemon stopped.`}
          />

          <h2 id="health-check">Health Check</h2>
          <p>
            You can verify the daemon is responding to requests using the health endpoint:
          </p>
          <CommandBlock
            command="curl http://127.0.0.1:9999/v3/health"
            output={`{"status":"ok","version":"3.0.0","uptime":842}`}
          />
          <ApiEndpoint
            method="GET"
            path="/v3/health"
            description="Returns daemon health status, protocol version, and uptime in seconds. Does not require authentication."
            response={`{
  "status": "ok",
  "version": "3.0.0",
  "uptime": 842
}`}
          />

          <h2 id="auto-start-on-boot">Auto-Start on Boot</h2>
          <p>
            The <code>opta daemon install</code> command registers the daemon as a system service so
            it starts automatically when you log in.
          </p>

          <h3 id="launchd-macos">launchd (macOS)</h3>
          <p>
            On macOS, the install command creates a launchd plist at{" "}
            <code>~/Library/LaunchAgents/com.opta.daemon.plist</code>.
          </p>
          <CommandBlock
            command="opta daemon install"
            output={`Installed launchd service: com.opta.daemon
Daemon will start automatically on login.`}
          />
          <p>The generated plist configures the daemon to:</p>
          <ul>
            <li>Start at login (<code>RunAtLoad</code>)</li>
            <li>Restart on crash (<code>KeepAlive</code>)</li>
            <li>Log stdout/stderr to <code>~/.config/opta/daemon/</code></li>
          </ul>
          <CodeBlock
            filename="~/Library/LaunchAgents/com.opta.daemon.plist"
            language="xml"
            code={`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.opta.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/opta</string>
    <string>daemon</string>
    <string>start</string>
    <string>--foreground</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>`}
          />

          <h3 id="systemd-linux">systemd (Linux)</h3>
          <p>
            On Linux, the install command creates a systemd user service at{" "}
            <code>~/.config/systemd/user/opta-daemon.service</code>.
          </p>
          <CommandBlock
            command="opta daemon install"
            output={`Installed systemd user service: opta-daemon
Run: systemctl --user enable --now opta-daemon`}
          />

          <h2 id="uninstalling">Uninstalling</h2>
          <p>
            The <code>opta daemon uninstall</code> command removes the system service registration
            and stops the daemon if it is running.
          </p>
          <CommandBlock
            command="opta daemon uninstall"
            output={`Removed launchd service: com.opta.daemon
Daemon stopped.`}
          />

          <h2 id="crash-recovery">Crash Recovery</h2>
          <p>
            If the daemon crashes unexpectedly, the CLI detects the stale state file on the next
            command and automatically restarts it. The crash guardian in{" "}
            <code>ensureDaemonRunning</code> performs the following steps:
          </p>
          <StepList
            steps={[
              {
                title: "Detect stale PID",
                description:
                  "The CLI reads state.json and checks whether the PID is still alive using a signal-zero check.",
              },
              {
                title: "Clean up state file",
                description:
                  "If the PID is dead, the stale state.json is removed.",
              },
              {
                title: "Restart daemon",
                description:
                  "A new daemon process is spawned with a fresh token and state file.",
              },
              {
                title: "Retry the original command",
                description:
                  "The CLI retries connecting to the new daemon and proceeds with the user's command.",
              },
            ]}
          />
          <Callout variant="info" title="Session durability">
            Persisted session data is stored separately from the daemon process. Even after a crash,
            all previous sessions remain intact on disk and can be resumed.
          </Callout>

          <PrevNextNav
            prev={{ title: "Daemon Overview", href: "/docs/daemon/" }}
            next={{ title: "HTTP API", href: "/docs/daemon/http-api/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
