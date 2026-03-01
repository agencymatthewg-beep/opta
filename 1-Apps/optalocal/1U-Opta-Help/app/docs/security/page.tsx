"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "security-model", title: "Security Model", level: 2 as const },
  { id: "local-first", title: "Local-First Architecture", level: 2 as const },
  { id: "daemon-binding", title: "Localhost-Only Daemon", level: 2 as const },
  { id: "bearer-token-auth", title: "Bearer Token Auth", level: 2 as const },
  { id: "three-tier-rules", title: "Three-Tier Rule System", level: 2 as const },
  { id: "security-sections", title: "Detailed Sections", level: 2 as const },
];

export default function SecurityOverviewPage() {
  const { prev, next } = getPrevNext("/docs/security/");
  return (
    <>
      <Breadcrumb items={[{ label: "Security" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Security</h1>
          <p className="lead">
            Security in the Opta stack is built on a local-first architecture,
            localhost-bound services, token-based authentication, and a
            three-tier rule system that governs what the AI agent can and
            cannot do.
          </p>

          <h2 id="security-model">Security Model</h2>
          <p>
            The Opta security model is designed around a fundamental principle:
            the AI should have the minimum privileges needed to accomplish
            its task, with clear escalation paths for destructive or
            sensitive operations. Every tool call, file access, and command
            execution passes through a permission check before proceeding.
          </p>
          <p>
            The security architecture has four layers:
          </p>
          <ol>
            <li><strong>Network isolation</strong> -- the daemon binds to localhost only</li>
            <li><strong>Authentication</strong> -- Bearer token required for all daemon API access</li>
            <li><strong>Permission system</strong> -- per-tool approval rules with user confirmation</li>
            <li><strong>Guardrails</strong> -- hard rules that cannot be overridden by the model</li>
          </ol>

          <h2 id="local-first">Local-First Architecture</h2>
          <p>
            The entire Opta stack runs on your local network. Inference
            happens on your Apple Silicon hardware, session data is stored
            on your local filesystem, and the daemon only accepts connections
            from localhost. No data is sent to external servers unless you
            explicitly configure cloud integration.
          </p>
          <p>
            This is not &quot;privacy by policy&quot; (where a cloud service promises
            not to read your data). This is privacy by architecture -- the
            data physically cannot leave your network because there is no
            cloud component to send it to.
          </p>

          <h2 id="daemon-binding">Localhost-Only Daemon</h2>
          <p>
            The Opta daemon binds exclusively to <code>127.0.0.1:9999</code>.
            This is enforced at the network level -- the daemon will not
            accept connections from other machines on the network, even on
            the same LAN. This prevents unauthorized access from other
            devices.
          </p>

          <CodeBlock
            language="text"
            filename="Daemon Binding (C08)"
            code={`Listen address: 127.0.0.1:9999
Accepts connections from: localhost only
Remote access: NOT supported (by design)
LMX connections: outbound only (daemon → LMX)`}
          />

          <Callout variant="info" title="LMX is separate">
            The LMX inference server has its own network binding and
            authentication model. It listens on a LAN address
            (192.168.188.11:1234) to serve multiple clients. See the LMX
            documentation for its security configuration.
          </Callout>

          <h2 id="bearer-token-auth">Bearer Token Auth</h2>
          <p>
            All HTTP requests to the daemon require a Bearer token in the
            Authorization header. The token is generated when the daemon
            starts and stored in <code>~/.config/opta/daemon/state.json</code>.
            Token validation uses <code>crypto.timingSafeEqual</code> to
            prevent timing attacks.
          </p>
          <p>
            For WebSocket connections, the token is passed as a query
            parameter (<code>?token=T</code>) since WebSocket does not
            support custom headers during the handshake.
          </p>
          <p>
            The token rotates on every daemon restart. This limits the
            window of exposure if a token is compromised -- restarting the
            daemon immediately invalidates all existing tokens.
          </p>

          <h2 id="three-tier-rules">Three-Tier Rule System</h2>
          <p>
            The Opta guardrail system organizes rules into three tiers based
            on severity and enforceability:
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tier</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Enforcement</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Override</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-neon-red">Critical (C)</td>
                  <td className="px-4 py-2.5">Hard stops -- violations are blocked, not just warned</td>
                  <td className="px-4 py-2.5">Cannot be overridden</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-neon-amber">Strict (S)</td>
                  <td className="px-4 py-2.5">Enforced by default, violations require user confirmation</td>
                  <td className="px-4 py-2.5">User can approve per-instance</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-neon-cyan">Guidelines (G)</td>
                  <td className="px-4 py-2.5">Best practices, model is expected to follow but not hard-blocked</td>
                  <td className="px-4 py-2.5">Informational only</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            The specific rules in each tier are detailed in the{" "}
            <a href="/docs/security/guardrails/">Guardrails</a> section.
          </p>

          <h2 id="security-sections">Detailed Sections</h2>
          <p>
            The security documentation is organized into three focused sections:
          </p>
          <ul>
            <li>
              <strong><a href="/docs/security/permissions/">Permissions</a></strong>{" "}
              -- how tool permissions work, default policies, and the approval workflow
            </li>
            <li>
              <strong><a href="/docs/security/privacy/">Privacy</a></strong>{" "}
              -- local-first privacy guarantees and data handling
            </li>
            <li>
              <strong><a href="/docs/security/guardrails/">Guardrails</a></strong>{" "}
              -- the complete rule set with Critical, Strict, and Guideline tiers
            </li>
          </ul>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
