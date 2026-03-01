"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "authentication-overview", title: "Authentication Overview", level: 2 as const },
  { id: "daemon-auth", title: "Daemon Authentication", level: 2 as const },
  { id: "bearer-token", title: "Bearer Token (HTTP)", level: 3 as const },
  { id: "query-param", title: "Query Parameter (WebSocket)", level: 3 as const },
  { id: "token-rotation", title: "Token Rotation", level: 3 as const },
  { id: "lmx-admin-key", title: "LMX Admin Key", level: 2 as const },
  { id: "anthropic-api-key", title: "Anthropic API Key", level: 2 as const },
  { id: "supabase-jwt", title: "Supabase JWT", level: 2 as const },
];

export default function DeveloperAuthPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Developer Guide", href: "/docs/developer/" },
          { label: "API Authentication" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>API Authentication</h1>
          <p className="lead">
            The Opta stack uses different authentication mechanisms at each
            layer -- Bearer tokens for the daemon, admin keys for LMX,
            environment variables or Keychain for API keys, and Supabase
            JWTs for cloud-enabled web apps.
          </p>

          <h2 id="authentication-overview">Authentication Overview</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Service</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Auth Method</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Storage</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Daemon (HTTP)</td>
                  <td className="px-4 py-2.5">Bearer token</td>
                  <td className="px-4 py-2.5"><code>state.json</code></td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Daemon (WebSocket)</td>
                  <td className="px-4 py-2.5">Query parameter</td>
                  <td className="px-4 py-2.5"><code>state.json</code></td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">LMX (admin)</td>
                  <td className="px-4 py-2.5">Admin key</td>
                  <td className="px-4 py-2.5">macOS Keychain</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">LMX (inference)</td>
                  <td className="px-4 py-2.5">None (open)</td>
                  <td className="px-4 py-2.5">N/A</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Anthropic Cloud</td>
                  <td className="px-4 py-2.5">API key</td>
                  <td className="px-4 py-2.5">Env var or Keychain</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">Cloud Web Apps</td>
                  <td className="px-4 py-2.5">Supabase JWT</td>
                  <td className="px-4 py-2.5">Secure cookie</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="daemon-auth">Daemon Authentication</h2>

          <h3 id="bearer-token">Bearer Token (HTTP)</h3>
          <p>
            All HTTP requests to the daemon require a Bearer token in the
            Authorization header. The token is generated when the daemon
            starts and stored in the state file.
          </p>

          <CodeBlock
            language="bash"
            filename="Authenticated daemon request"
            code={`# Read the token from state.json
TOKEN=$(jq -r .token ~/.config/opta/daemon/state.json)

# Use it in API requests
curl -s http://127.0.0.1:9999/v3/sessions \\
  -H "Authorization: Bearer $TOKEN"`}
          />

          <p>
            The daemon validates tokens using <code>crypto.timingSafeEqual</code>{" "}
            to prevent timing-based attacks that could be used to
            incrementally guess the token value.
          </p>

          <h3 id="query-param">Query Parameter (WebSocket)</h3>
          <p>
            WebSocket connections cannot send custom headers during the
            handshake. Instead, the token is passed as a query parameter:
          </p>

          <CodeBlock
            language="typescript"
            filename="WebSocket authentication"
            code={`// Token in query parameter for WebSocket
const ws = new WebSocket(
  "ws://127.0.0.1:9999/v3/events?token=<token>"
);`}
          />

          <Callout variant="info" title="Query parameter safety">
            The WebSocket connection runs over localhost only, so the token
            in the query string is not exposed to network intermediaries.
            On production deployments with TLS, consider using a secure
            WebSocket (wss://) connection.
          </Callout>

          <h3 id="token-rotation">Token Rotation</h3>
          <p>
            The daemon generates a new token every time it starts. This
            means:
          </p>
          <ul>
            <li>Restarting the daemon invalidates all existing tokens immediately</li>
            <li>Clients must read the new token from <code>state.json</code> after a restart</li>
            <li>Code Desktop handles this automatically by detecting auth failures and refreshing the stored token</li>
            <li>Compromised tokens have a limited window of validity (until the next restart)</li>
          </ul>

          <h2 id="lmx-admin-key">LMX Admin Key</h2>
          <p>
            LMX inference endpoints (like <code>/v1/chat/completions</code>)
            are open and do not require authentication. This allows any
            client on the LAN to send inference requests.
          </p>
          <p>
            Administrative endpoints (model loading, unloading, server
            configuration) require an admin key. This key is stored in the
            macOS Keychain on the machine running LMX.
          </p>

          <TabGroup
            tabs={[
              {
                label: "Setting the Key",
                content: (
                  <div className="space-y-2">
                    <p className="text-sm text-text-secondary">
                      The admin key is set during LMX installation and stored
                      in the macOS Keychain. To update it:
                    </p>
                    <pre className="text-xs text-text-muted font-mono bg-[#0a0a0f] rounded p-2 overflow-x-auto">
                      {`security add-generic-password \\
  -s "opta-lmx" -a "admin" \\
  -w "<new-key>" -U`}
                    </pre>
                  </div>
                ),
              },
              {
                label: "Using the Key",
                content: (
                  <div className="space-y-2">
                    <p className="text-sm text-text-secondary">
                      Pass the admin key as a Bearer token for administrative
                      requests:
                    </p>
                    <pre className="text-xs text-text-muted font-mono bg-[#0a0a0f] rounded p-2 overflow-x-auto">
                      {`curl -X POST http://192.168.188.11:1234/admin/models/load \\
  -H "Authorization: Bearer <admin-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "qwen3-72b"}'`}
                    </pre>
                  </div>
                ),
              },
            ]}
          />

          <h2 id="anthropic-api-key">Anthropic API Key</h2>
          <p>
            If you configure the CLI to use Anthropic&apos;s cloud API as a
            fallback or primary provider, you need an Anthropic API key.
            The key can be stored in two locations:
          </p>
          <ul>
            <li>
              <strong>Environment variable</strong> --{" "}
              <code>ANTHROPIC_API_KEY</code> in your shell environment
            </li>
            <li>
              <strong>macOS Keychain</strong> -- stored securely via{" "}
              <code>opta key set anthropic</code>
            </li>
          </ul>
          <p>
            The Keychain option is recommended as it keeps the key out of
            shell history, dotfiles, and environment variable listings.
          </p>

          <CodeBlock
            language="bash"
            filename="Storing an Anthropic API key"
            code={`# Store in Keychain (recommended)
opta key set anthropic

# Or set as environment variable
export ANTHROPIC_API_KEY="sk-ant-..."`}
          />

          <h2 id="supabase-jwt">Supabase JWT</h2>
          <p>
            Cloud-enabled Opta web apps (Local Web in WAN mode, Opta
            Accounts) use Supabase authentication. After signing in, the
            user receives a JWT that is stored in a secure HTTP-only cookie.
          </p>
          <p>
            The JWT is verified by Supabase middleware on every request.
            All Opta apps share a single Supabase project, so one sign-in
            grants access to all cloud-enabled services.
          </p>
          <p>
            The Supabase SSR pattern used across Opta web apps splits auth
            into three concerns:
          </p>
          <ul>
            <li><strong>Client</strong> -- reads the session from cookies in the browser</li>
            <li><strong>Server</strong> -- validates the session on server-rendered pages</li>
            <li><strong>Middleware</strong> -- refreshes tokens and protects routes</li>
          </ul>

          <Callout variant="warning" title="Cloud auth is opt-in">
            Supabase authentication is only used when apps are accessed
            through a Cloudflare Tunnel. On LAN, no auth is required and
            no Supabase configuration is needed.
          </Callout>

          <PrevNextNav
            prev={{ title: "Daemon Client SDK", href: "/docs/developer/sdk/" }}
            next={{ title: "Feature Status", href: "/docs/feature-status/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
