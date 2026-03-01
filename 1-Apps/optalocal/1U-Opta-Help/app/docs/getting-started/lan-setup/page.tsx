import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "configure-lmx-host", title: "Configure LMX Host", level: 2 as const },
  { id: "api-key-setup", title: "API Key Setup", level: 2 as const },
  { id: "failover-hosts", title: "Failover Hosts", level: 2 as const },
  { id: "ssh-configuration", title: "SSH Configuration", level: 2 as const },
  { id: "verify-connection", title: "Verify Connection", level: 2 as const },
  { id: "troubleshooting", title: "Troubleshooting", level: 2 as const },
];

export default function LanSetupPage() {
  const { prev, next } = getPrevNext("/docs/getting-started/lan-setup/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Getting Started", href: "/docs/getting-started/" },
          { label: "LAN Setup" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>LAN Setup</h1>
          <p>
            Connect your CLI to the LMX inference server running on your local network.
            This page walks you through configuring the host address, setting up API
            keys, and verifying the connection.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            The Opta CLI communicates with LMX over your local network using HTTP.
            LMX exposes an OpenAI-compatible API on a configurable port (default 1234).
            You need to tell the CLI where to find this server.
          </p>

          <Callout variant="info" title="Network requirement">
            Your workstation and LMX host must be on the same LAN. Opta Local uses
            direct LAN connections for speed and privacy -- never route through
            Tailscale or other overlay networks for local inference.
          </Callout>

          <h2 id="configure-lmx-host">Configure LMX Host</h2>
          <p>
            Point the CLI at your LMX server by setting the host IP and port:
          </p>

          <StepList
            steps={[
              {
                title: "Set the LMX host address",
                description:
                  "Replace the IP with your LMX server's local address. This is typically your Mac Studio's static IP.",
                content: (
                  <CommandBlock
                    command="opta config set connection.host 192.168.188.11"
                    description="Set the LMX inference server IP address"
                  />
                ),
              },
              {
                title: "Set the port (if non-default)",
                description:
                  "The default port is 1234. Only change this if your LMX instance is configured differently.",
                content: (
                  <CommandBlock
                    command="opta config set connection.port 1234"
                    description="Set the LMX port (default: 1234)"
                  />
                ),
              },
              {
                title: "Confirm the configuration",
                content: (
                  <CommandBlock
                    command="opta config get connection"
                    output={`connection.host    192.168.188.11
connection.port    1234`}
                  />
                ),
              },
            ]}
          />

          <h2 id="api-key-setup">API Key Setup</h2>
          <p>
            LMX supports optional API key authentication. If your LMX instance requires
            a key, generate one and configure the CLI to use it.
          </p>

          <StepList
            steps={[
              {
                title: "Generate an API key",
                description:
                  "Creates a new API key and stores it securely in your system keychain.",
                content: (
                  <CommandBlock
                    command="opta key create"
                    output={`API key created and stored in keychain.
Key ID: opta_key_a1b2c3d4
Host:   192.168.188.11:1234`}
                  />
                ),
              },
              {
                title: "Verify the key is stored",
                content: (
                  <CommandBlock
                    command="opta key list"
                    output={`ID                  Host                    Created
opta_key_a1b2c3d4   192.168.188.11:1234     2026-03-01`}
                  />
                ),
              },
            ]}
          />

          <Callout variant="tip" title="Keychain storage">
            API keys are stored in your system keychain (macOS Keychain or
            libsecret on Linux), not in plain text config files. This keeps your
            credentials secure even if your config directory is synced or backed up.
          </Callout>

          <h2 id="failover-hosts">Failover Hosts</h2>
          <p>
            If you have multiple LMX instances (for example, a Mac Studio and a Mac Pro),
            you can configure failover hosts. The CLI will try each host in order until
            one responds.
          </p>

          <CodeBlock
            language="json"
            filename="~/.config/opta/config.json"
            code={`{
  "connection": {
    "host": "192.168.188.11",
    "port": 1234,
    "failover": [
      { "host": "192.168.188.12", "port": 1234 },
      { "host": "192.168.188.13", "port": 1234 }
    ],
    "timeout": 5000
  }
}`}
          />

          <p>
            The CLI performs a lightweight health check against each host. If the primary
            host does not respond within the configured timeout (default 5 seconds), it
            automatically falls through to the next host in the list.
          </p>

          <h2 id="ssh-configuration">SSH Configuration</h2>
          <p>
            For remote operations like model management on the LMX host, configure SSH
            access. This allows the CLI to run administrative commands on the inference
            server directly.
          </p>

          <CodeBlock
            language="text"
            filename="~/.ssh/config"
            code={`Host lmx-studio
    HostName 192.168.188.11
    User matt
    IdentityFile ~/.ssh/id_ed25519
    ForwardAgent yes`}
          />

          <p>
            Then configure the CLI to use this SSH alias:
          </p>

          <CommandBlock
            command="opta config set connection.sshAlias lmx-studio"
            description="Set the SSH host alias for remote model management"
          />

          <h2 id="verify-connection">Verify Connection</h2>
          <p>
            With everything configured, verify the full connection path:
          </p>

          <StepList
            steps={[
              {
                title: "Check LMX connectivity",
                description:
                  "The status command pings the LMX health endpoint and reports the result.",
                content: (
                  <CommandBlock
                    command="opta status"
                    output={`CLI:    v1.0.0
Daemon: stopped
LMX:    connected (192.168.188.11:1234)
  Model: Qwen3-30B-A3B (loaded)
  VRAM:  42.1 / 192.0 GB`}
                  />
                ),
              },
              {
                title: "Run a quick health check",
                description:
                  "The doctor command now validates the LMX connection alongside other checks.",
                content: (
                  <CommandBlock
                    command="opta doctor"
                    output={`Opta Doctor
-----------
  Node.js     v22.12.0           ok
  npm         10.9.0             ok
  Config dir  ~/.config/opta     ok
  Daemon      not running        (start with: opta daemon start)
  LMX host    192.168.188.11     ok
  LMX health  200 OK             ok
  LMX model   Qwen3-30B-A3B     loaded`}
                  />
                ),
              },
              {
                title: "Test inference directly",
                description:
                  "Send a quick test prompt to confirm end-to-end inference works.",
                content: (
                  <CommandBlock
                    command='opta chat --once "Say hello in one sentence."'
                    output="Hello! I'm your local AI assistant, running entirely on your hardware."
                  />
                ),
              },
            ]}
          />

          <Callout variant="warning" title="Daemon not required for this step">
            You do not need to start the daemon to test LMX connectivity. The{" "}
            <code>opta status</code> and <code>opta chat --once</code> commands can
            connect to LMX directly. The daemon adds session persistence, permissions,
            and tool orchestration on top.
          </Callout>

          <h2 id="troubleshooting">Troubleshooting</h2>

          <h3>Connection refused</h3>
          <p>
            If <code>opta status</code> shows &quot;connection refused&quot;, verify that:
          </p>
          <ul>
            <li>LMX is running on the target host (<code>systemctl status opta-lmx</code> or check the process)</li>
            <li>The IP address and port are correct (<code>opta config get connection</code>)</li>
            <li>No firewall is blocking port 1234 on the LMX host</li>
            <li>Both machines are on the same LAN subnet</li>
          </ul>

          <h3>Timeout errors</h3>
          <p>
            If connections succeed but are slow or intermittent, increase the timeout:
          </p>
          <CommandBlock
            command="opta config set connection.timeout 10000"
            description="Increase connection timeout to 10 seconds"
          />

          <h3>DNS resolution issues</h3>
          <p>
            Always use IP addresses rather than hostnames for LMX connections. mDNS
            hostname resolution can be unreliable across different macOS versions and
            network configurations.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
