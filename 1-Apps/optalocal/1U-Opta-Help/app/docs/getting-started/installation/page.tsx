import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "prerequisites", title: "Prerequisites", level: 2 as const },
  { id: "install-the-cli", title: "Install the CLI", level: 2 as const },
  { id: "verify-installation", title: "Verify Installation", level: 2 as const },
  { id: "smoke-test", title: "Smoke Test", level: 2 as const },
  { id: "updating", title: "Updating", level: 2 as const },
  { id: "uninstalling", title: "Uninstalling", level: 2 as const },
];

export default function InstallationPage() {
  const { prev, next } = getPrevNext("/docs/getting-started/installation/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Getting Started", href: "/docs/getting-started/" },
          { label: "Installation" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Installation</h1>
          <p>
            Install Opta CLI globally via npm to activate the full local execution
            control plane. The CLI orchestrates daemon lifecycle, runtime routing,
            and every interactive or autonomous execution surface.
          </p>
          <p>
            Use the platform selector at the top of the docs to render commands for
            macOS or Windows before running installation and validation steps.
          </p>

          <h2 id="prerequisites">Prerequisites</h2>
          <p>
            Before installing, make sure your system meets the following requirements:
          </p>

          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Minimum</th>
                  <th>Recommended</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Node.js</strong></td>
                  <td>20.0+</td>
                  <td>22.x LTS</td>
                </tr>
                <tr>
                  <td><strong>Operating System</strong></td>
                  <td>macOS 14+, Linux (x64/arm64), Windows 11+</td>
                  <td>macOS 15 / Ubuntu 24.04 / Windows 11</td>
                </tr>
                <tr>
                  <td><strong>npm</strong></td>
                  <td>10.0+</td>
                  <td>Latest</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout variant="info" title="Node.js version">
            The CLI requires Node.js 20 or later for native fetch, structured clone,
            and stable WebSocket support. Check your version
            with <code>node --version</code>.
          </Callout>

          <p>Verify your Node.js version:</p>
          <CommandBlock
            command="node --version"
            output="v22.12.0"
            description="Check Node.js is installed and meets the minimum version"
          />

          <h2 id="install-the-cli">Install the CLI</h2>

          <StepList
            steps={[
              {
                title: "Install globally via npm",
                description:
                  "This installs the opta command globally so it is available from any directory.",
                content: (
                  <CommandBlock command="npm install -g @opta/opta-cli" />
                ),
              },
              {
                title: "Verify the binary is on your PATH",
                description:
                  "The opta command should now be accessible from your terminal.",
                content: (
                  <CommandBlock
                    platformCommands={{
                      macos: "which opta",
                      windows: "where opta",
                    }}
                    platformOutputs={{
                      macos: "/usr/local/bin/opta",
                      windows: "C:\\Users\\matt\\AppData\\Roaming\\npm\\opta.cmd",
                    }}
                  />
                ),
              },
              {
                title: "Check the installed version",
                content: (
                  <CommandBlock
                    command="opta --version"
                    versionOutputs={{
                      latest: "opta/1.1.0 darwin-arm64 node-v22.12.0",
                      v1_0: "opta/1.0.0 darwin-arm64 node-v22.12.0",
                    }}
                  />
                ),
              },
            ]}
          />

          <Callout variant="tip" title="Permission issues?">
            If you get an <code>EACCES</code> error during global install, either fix
            your npm prefix directory permissions or use a Node version manager
            like <code>nvm</code> or <code>fnm</code> which installs to your home directory.
          </Callout>

          <h2 id="verify-installation">Verify Installation</h2>
          <p>
            Run the built-in doctor command to check that your environment is correctly
            configured:
          </p>

          <CommandBlock
            command="opta doctor"
            platformOutputs={{
              macos: `Opta Doctor
-----------
  Node.js     v22.12.0       ok
  npm         10.9.0         ok
  Config dir  ~/.config/opta ok
  Daemon      not running    (start with: opta daemon start)
  LMX host    not configured (set with: opta config set connection.host <ip>)`,
              windows: `Opta Doctor
-----------
  Node.js     v22.12.0               ok
  npm         10.9.0                 ok
  Config dir  %APPDATA%\\opta         ok
  Daemon      not running            (start with: opta daemon start)
  LMX host    not configured         (set with: opta config set connection.host <ip>)`,
            }}
            description="Run diagnostics to verify your environment"
          />

          <p>
            At this stage, it is expected that the daemon is not running and LMX is not
            configured. You will set those up in the following pages.
          </p>

          <h2 id="smoke-test">Smoke Test</h2>
          <p>
            Run a validation check to confirm the CLI initializes and responds as expected:
          </p>

          <StepList
            steps={[
              {
                title: "Check CLI status",
                description:
                  "The status command shows the current state of all components.",
                content: (
                  <CommandBlock
                    command="opta status"
                    versionOutputs={{
                      latest: `CLI:    v1.1.0
Daemon: stopped
LMX:    not configured`,
                      v1_0: `CLI:    v1.0.0
Daemon: stopped
LMX:    not configured`,
                    }}
                  />
                ),
              },
              {
                title: "View available commands",
                description: "List all top-level commands and their descriptions.",
                content: (
                  <CommandBlock command="opta --help" />
                ),
              },
              {
                title: "Check configuration",
                description:
                  "View the current config file location and active settings.",
                content: (
                  <CommandBlock
                    command="opta config list"
                    output={`Config file: ~/.config/opta/config.json

connection.host     (not set)
connection.port     1234
daemon.autoStart    true
daemon.port         9999`}
                  />
                ),
              },
            ]}
          />

          <Callout variant="warning" title="No LMX connection yet">
            The CLI will show warnings about missing LMX configuration until you
            complete the <a href="/docs/getting-started/lan-setup/">LAN Setup</a> step.
            This is normal at this stage.
          </Callout>

          <h2 id="updating">Updating</h2>
          <p>
            To update to the latest version, re-run the global install command:
          </p>
          <CommandBlock
            command="npm install -g @opta/opta-cli@latest"
            description="Update to the latest release"
          />

          <p>
            You can also check if an update is available without installing:
          </p>
          <CommandBlock
            command="opta version --check"
            versionOutputs={{
              latest: "Current: 1.1.0  Latest: 1.1.0  (up to date)",
              v1_0: "Current: 1.0.0  Latest: 1.1.0  (update available)",
            }}
          />

          <h2 id="uninstalling">Uninstalling</h2>
          <p>
            To remove the CLI from your workstation and optionally clear local Opta state:
          </p>
          <CommandBlock
            command="npm uninstall -g @opta/opta-cli"
            description="Remove the globally installed CLI package"
          />
          <CommandBlock
            platformCommands={{
              macos: "rm -rf ~/.config/opta ~/.local/share/opta",
              windows: 'Remove-Item -Recurse -Force "$env:APPDATA\\opta"',
            }}
            description="Optional: remove local configuration and cached local state"
          />

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
