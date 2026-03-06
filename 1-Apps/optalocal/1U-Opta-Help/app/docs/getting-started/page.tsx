import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "what-is-opta-local", title: "What is Opta Local?", level: 2 as const },
  { id: "the-three-core-apps", title: "The Three Core Apps", level: 2 as const },
  { id: "who-is-it-for", title: "Who is it For?", level: 2 as const },
  { id: "key-benefits", title: "Key Benefits", level: 2 as const },
  { id: "architecture-overview", title: "Architecture Overview", level: 2 as const },
  { id: "next-steps", title: "Next Steps", level: 2 as const },
];

export default function GettingStartedIntroPage() {
  const { prev, next } = getPrevNext("/docs/getting-started/");

  return (
    <>
      <Breadcrumb items={[{ label: "Getting Started" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Introduction to Opta Local</h1>
          <p>
            Opta Local is a local-first AI operating stack for engineering teams that
            require private inference on Apple Silicon, with governed cloud fallback
            only when it is explicitly enabled.
          </p>
          <p>
            Use the platform selector at the top of docs pages to switch between macOS
            and Windows views. Commands, file paths, and service instructions adapt to
            the selected operating system.
          </p>

          <h2 id="what-is-opta-local">What is Opta Local?</h2>
          <p>
            Opta Local is a vertically integrated execution system that unifies a
            command-line interface, a local inference runtime, and operator surfaces
            into one coherent contract. It supports interactive chat, autonomous coding
            workflows, session governance, and runtime observability.
          </p>
          <p>
            Unlike cloud-only tooling, Opta Local defaults to local execution.
            Prompts and session data remain on your infrastructure unless cloud providers
            are intentionally configured for fallback or burst capacity.
          </p>

          <h2 id="the-three-core-apps">The Three Core Apps</h2>
          <p>
            Opta Local is packaged as three core apps. Internally, these apps are powered by layered services:
          </p>

          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Role</th>
                  <th>Runs On</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Opta CLI</strong></td>
                  <td>
                    Terminal-first control surface for chat, task execution, sessions, permissions, and tool routing. (Internally powered by the local daemon.)
                  </td>
                  <td>Your workstation (MacBook, desktop)</td>
                </tr>
                <tr>
                  <td><strong>Opta LMX + Dashboard</strong></td>
                  <td>
                    Local inference engine (LMX) plus its dashboard experience for monitoring and control.
                  </td>
                  <td>dedicated Apple Silicon host (high-memory host)</td>
                </tr>
                <tr>
                  <td><strong>Opta Code Desktop (macOS + Windows + Linux)</strong></td>
                  <td>
                    Native desktop execution surface for Opta workflows, backed by the daemon.
                  </td>
                  <td>macOS + Windows + Linux workstations</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout variant="info" title="Product vs architecture">
            Product taxonomy uses three core apps: Opta CLI, Opta LMX + Dashboard, and
            Opta Code Desktop. Surface websites (Home, Init, Help, Accounts) are entrypoints,
            not core apps.
          </Callout>

          <Callout variant="info" title="How they connect">
            The CLI daemon runs on your development machine and proxies requests to the
            LMX inference server over your local network. The web dashboard connects
            directly to LMX for monitoring and chat. All communication stays on your LAN
            unless you explicitly configure a Cloudflare Tunnel for remote access.
          </Callout>

          <h2 id="who-is-it-for">Who is it For?</h2>
          <p>
            Opta Local is optimized for operators who prioritize control, privacy, and
            predictable execution:
          </p>
          <ul>
            <li>
              <strong>Developers with Apple Silicon hardware</strong> -- particularly
              high-memory Apple Silicon hosts with 96GB+ unified memory, capable of running
              70B+ parameter models locally.
            </li>
            <li>
              <strong>Privacy-conscious engineers</strong> who want AI assistance without
              sending proprietary code or sensitive data to cloud providers.
            </li>
            <li>
              <strong>Power users</strong> who want full control over model selection,
              inference parameters, and tool permissions.
            </li>
            <li>
              <strong>Teams</strong> who want to share a local inference server across
              multiple workstations on a LAN.
            </li>
          </ul>

          <h2 id="key-benefits">Key Benefits</h2>

          <h3>Privacy</h3>
          <p>
            Every prompt, response, and session stays on your local network. There is no
            telemetry, no cloud logging, and no data retention by third parties. Your code
            and conversations are yours alone.
          </p>

          <h3>Speed</h3>
          <p>
            Apple Silicon unified memory architecture allows models to load directly into
            GPU-accessible memory without PCIe bottlenecks. A dedicated Apple Silicon host with 192GB of
            unified memory can run 70B parameter models at 40+ tokens per second --
            comparable to or faster than many cloud API endpoints.
          </p>

          <h3>Control</h3>
          <p>
            You choose which models to run, which tools to enable, and what permissions
            to grant. The CLI&apos;s permission system lets you approve or deny individual
            tool invocations. There are no opaque safety filters -- you set the guardrails.
          </p>

          <h3>No Recurring Costs</h3>
          <p>
            After the initial hardware investment, inference is free. No per-token
            pricing, no API rate limits, no monthly subscriptions. Run as many queries
            as your hardware can handle.
          </p>

          <h2 id="architecture-overview">Architecture Overview</h2>
          <p>
            The following diagram shows how the three components connect:
          </p>

          <CodeBlock
            language="text"
            filename="Stack Architecture"
            code={`opta chat / opta do / opta tui        CLI commands (your terminal)
        |
        v
opta daemon  127.0.0.1:9999            Background orchestration service
        |   HTTP v3 REST + WS streaming
        v
Opta LMX  lmx-host.local:1234          Apple Silicon inference server
        |   OpenAI-compatible /v1/chat/completions
        v
Opta Local Web  localhost:3004         Browser dashboard + chat UI`}
          />

          <p>
            The <strong>CLI</strong> is your primary interface. When you run{" "}
            <code>opta chat</code> or <code>opta do</code>, the CLI connects to the{" "}
            <strong>daemon</strong> (starting it automatically if needed). The daemon
            manages sessions, enforces permissions, and proxies inference requests to{" "}
            <strong>LMX</strong> over your LAN. The <strong>web dashboard</strong> provides
            a visual interface for the same stack, connecting to LMX directly for
            monitoring and chat.
          </p>

          <h2 id="next-steps">Next Steps</h2>
          <p>
            Proceed to installation to provision the CLI runtime and verify host
            readiness before connecting to inference.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
