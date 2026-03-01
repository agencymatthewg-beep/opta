"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "local-first-privacy", title: "Local-First Privacy", level: 2 as const },
  { id: "inference-on-your-hardware", title: "Inference on Your Hardware", level: 2 as const },
  { id: "no-cloud-without-opt-in", title: "No Cloud Without Opt-In (S04)", level: 2 as const },
  { id: "session-data", title: "Session Data on Disk", level: 2 as const },
  { id: "no-telemetry", title: "No Telemetry", level: 2 as const },
  { id: "token-safety", title: "Token Safety (S02)", level: 2 as const },
  { id: "lan-isolation", title: "LAN Isolation", level: 2 as const },
];

export default function SecurityPrivacyPage() {
  const { prev, next } = getPrevNext("/docs/security/privacy/");
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Security", href: "/docs/security/" },
          { label: "Privacy" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Privacy</h1>
          <p className="lead">
            Opta is built on a local-first privacy architecture. All
            inference runs on your hardware, session data stays on your
            disk, there is no telemetry, and no data leaves your network
            without explicit consent.
          </p>

          <h2 id="local-first-privacy">Local-First Privacy</h2>
          <p>
            Privacy in Opta is not a policy promise -- it is an
            architectural guarantee. The system is designed so that data
            physically cannot leave your local network unless you explicitly
            configure a cloud integration.
          </p>
          <p>
            There is no cloud backend processing your requests. There is no
            analytics service tracking your usage. There is no data
            retention policy because there is no external party retaining
            your data. The AI runs on your machine, the data stays on your
            machine, and the network traffic stays on your network.
          </p>

          <h2 id="inference-on-your-hardware">Inference on Your Hardware</h2>
          <p>
            The LMX inference server runs on your Apple Silicon Mac, using
            MLX for optimized Metal GPU inference. Your prompts are processed
            locally and model outputs are generated locally. At no point
            during inference does data leave your machine.
          </p>
          <p>
            This means:
          </p>
          <ul>
            <li>Proprietary source code sent to the AI never leaves your network</li>
            <li>Sensitive business documents processed by the AI stay on your hardware</li>
            <li>Personal conversations with the AI are stored only on your local filesystem</li>
            <li>No third party can read, log, or train on your interactions</li>
          </ul>

          <Callout variant="tip" title="Why this matters">
            Cloud AI services process your prompts on their servers, subject
            to their data retention and privacy policies. With Opta, there
            are no such policies to worry about because the data never
            leaves your control.
          </Callout>

          <h2 id="no-cloud-without-opt-in">No Cloud Without Opt-In (S04)</h2>
          <p>
            Rule S04 (Strict tier) requires that no component of the Opta
            stack sends data to any cloud service without explicit user
            opt-in. This applies to:
          </p>
          <ul>
            <li>Model downloads (require user-initiated action)</li>
            <li>Cloud API fallback (disabled by default, must be configured)</li>
            <li>Telemetry (does not exist -- there is no telemetry code)</li>
            <li>Error reporting (errors are logged locally, never phoned home)</li>
            <li>Usage analytics (not implemented)</li>
          </ul>
          <p>
            If you configure a Cloudflare Tunnel for remote access, that
            is an explicit opt-in action. If you add an Anthropic API key
            for cloud inference fallback, that is an explicit opt-in action.
            The default configuration makes zero outbound connections to
            any external service.
          </p>

          <h2 id="session-data">Session Data on Disk</h2>
          <p>
            All session data -- conversation history, tool call records,
            model responses, browser automation recordings -- is stored on
            your local filesystem. The daemon writes session data to{" "}
            <code>~/.config/opta/daemon/sessions/</code> as JSON files.
          </p>
          <p>
            You have full control over this data:
          </p>
          <ul>
            <li>Read it with standard file tools</li>
            <li>Back it up with your existing backup solution</li>
            <li>Delete it when you no longer need it</li>
            <li>Encrypt it with disk-level encryption (FileVault on macOS)</li>
          </ul>
          <p>
            There is no cloud sync for session data by default. Sessions
            exist only where the daemon writes them.
          </p>

          <h2 id="no-telemetry">No Telemetry</h2>
          <p>
            Opta contains no telemetry code. There are no analytics SDKs,
            no usage tracking, no crash reporters that phone home, and no
            feature flags fetched from external servers.
          </p>
          <p>
            This is a deliberate design decision, not an oversight. The
            Opta codebase does not import Sentry, Amplitude, Mixpanel,
            Google Analytics, or any other analytics or error reporting
            service.
          </p>

          <h2 id="token-safety">Token Safety (S02)</h2>
          <p>
            Rule S02 (Strict tier) requires that authentication tokens,
            API keys, and other secrets are never written to log files or
            displayed in output. This prevents accidental exposure of
            credentials in debug logs, terminal output, or session
            recordings.
          </p>
          <p>
            The daemon sanitizes all log output to redact tokens before
            writing. If a log message would contain a Bearer token, API
            key, or password, it is replaced with a placeholder before
            the message is persisted.
          </p>

          <Callout variant="info" title="Keychain storage">
            Sensitive credentials (LMX admin key, Anthropic API key) are
            stored in the macOS Keychain, not in configuration files. This
            provides OS-level encryption and access control for secrets.
          </Callout>

          <h2 id="lan-isolation">LAN Isolation</h2>
          <p>
            The Opta stack operates entirely within your local area network.
            The daemon binds to localhost (127.0.0.1), so it is not even
            accessible from other machines on your LAN. The LMX server
            binds to a LAN address but is not exposed to the internet.
          </p>
          <p>
            Network communication within the stack:
          </p>
          <ul>
            <li><strong>CLI to Daemon</strong> -- localhost only (127.0.0.1:9999)</li>
            <li><strong>Daemon to LMX</strong> -- LAN only (192.168.188.11:1234)</li>
            <li><strong>Web Dashboard to LMX</strong> -- LAN only or via Cloudflare Tunnel (explicit opt-in)</li>
          </ul>
          <p>
            No component initiates connections to external IP addresses or
            domains unless explicitly configured to do so.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
