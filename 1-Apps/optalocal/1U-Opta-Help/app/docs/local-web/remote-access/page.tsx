"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "access-modes", title: "Access Modes", level: 2 as const },
  { id: "lan-mode", title: "LAN Mode", level: 2 as const },
  { id: "wan-mode", title: "WAN Mode (Cloudflare Tunnel)", level: 2 as const },
  { id: "supabase-authentication", title: "Supabase Authentication", level: 2 as const },
  { id: "qr-pairing", title: "QR Pairing", level: 2 as const },
  { id: "admin-key", title: "Admin Key", level: 2 as const },
];

export default function LocalWebRemoteAccessPage() {
  const { prev, next } = getPrevNext("/docs/local-web/remote-access/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Local Web", href: "/docs/local-web/" },
          { label: "Remote Access" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Remote Access</h1>
          <p className="lead">
            Opta Local Web supports two access modes: direct LAN connections
            with no authentication, and secure WAN access through a
            Cloudflare Tunnel with Supabase authentication.
          </p>

          <h2 id="access-modes">Access Modes</h2>
          <p>
            The dashboard automatically detects its access context and
            adjusts its behavior accordingly. On your local network, it
            operates with zero authentication overhead. Through a remote
            tunnel, it enforces full user authentication before granting
            access to any functionality.
          </p>

          <TabGroup
            tabs={[
              {
                label: "LAN Mode",
                content: (
                  <div className="text-sm text-text-secondary space-y-2">
                    <p>Direct IP access on your local network. No authentication required.</p>
                    <p>Best for: development workstations, shared offices, home labs.</p>
                    <p>URL: <code>http://192.168.188.11:3004</code> or <code>http://localhost:3004</code></p>
                  </div>
                ),
              },
              {
                label: "WAN Mode",
                content: (
                  <div className="text-sm text-text-secondary space-y-2">
                    <p>Cloudflare Tunnel with Supabase authentication. Sign-in required.</p>
                    <p>Best for: mobile access, remote work, multi-site teams.</p>
                    <p>URL: your configured tunnel domain (e.g., <code>local.yourdomain.com</code>)</p>
                  </div>
                ),
              },
            ]}
          />

          <h2 id="lan-mode">LAN Mode</h2>
          <p>
            In LAN mode, the dashboard connects directly to your LMX server
            by IP address. All API calls go straight to the LMX endpoint
            without any authentication layer. The auth UI components (sign-in
            page, account settings) are hidden entirely.
          </p>
          <p>
            LAN mode is the default when the dashboard detects it is running
            on the same network as the LMX server. No configuration is needed
            beyond ensuring the LMX host address is correct.
          </p>

          <Callout variant="tip" title="Network security">
            LAN mode trusts your local network. Make sure your network is
            secured and that the LMX port is not exposed to the public
            internet. Use firewall rules to restrict access to trusted
            devices only.
          </Callout>

          <h2 id="wan-mode">WAN Mode (Cloudflare Tunnel)</h2>
          <p>
            For remote access, Opta Local Web can be served through a
            Cloudflare Tunnel. This creates a secure, encrypted connection
            from the public internet to your local server without opening
            any ports on your router or firewall.
          </p>

          <CodeBlock
            language="bash"
            filename="Cloudflare Tunnel Setup"
            code={`# Install cloudflared
brew install cloudflared

# Authenticate with Cloudflare
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create opta-local

# Run the tunnel (proxies to local web)
cloudflared tunnel --url http://localhost:3004 run opta-local`}
          />

          <p>
            Once the tunnel is running, the dashboard is accessible at your
            configured Cloudflare domain. All traffic is encrypted
            end-to-end by Cloudflare, and Supabase authentication is
            enforced for every request.
          </p>

          <h2 id="supabase-authentication">Supabase Authentication</h2>
          <p>
            When accessed through a Cloudflare Tunnel, the dashboard requires
            Supabase authentication. The sign-in flow uses the Supabase SSR
            pattern with a client/server/middleware split:
          </p>
          <ul>
            <li><strong>Sign in</strong> -- email/password or OAuth (Google, GitHub)</li>
            <li><strong>Session management</strong> -- JWT tokens stored in secure cookies</li>
            <li><strong>Route protection</strong> -- unauthenticated users are redirected to the sign-in page</li>
          </ul>
          <p>
            All Opta apps share a single Supabase project, so a user account
            created for the web dashboard also works with Opta Accounts and
            other cloud-enabled Opta services.
          </p>

          <Callout variant="warning" title="Environment variables">
            WAN mode requires <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to be set. Without
            these, the dashboard will fall back to LAN mode behavior even
            when accessed through a tunnel.
          </Callout>

          <h2 id="qr-pairing">QR Pairing</h2>
          <p>
            The pairing page (<code>/pair</code>) generates a QR code that
            encodes the LMX server address and an optional admin key. Scan
            the QR code from a phone or tablet to instantly configure the
            dashboard on that device without manually entering connection
            details.
          </p>
          <p>
            QR pairing is particularly useful for mobile devices on your LAN.
            Open the pairing page on your workstation, scan from your phone,
            and the phone browser navigates directly to the dashboard with
            the correct server address pre-filled.
          </p>

          <h2 id="admin-key">Admin Key</h2>
          <p>
            Protected LMX endpoints (model loading, unloading, server
            configuration) require an admin key. This key is stored in the
            macOS Keychain on the server host and must be provided as a
            header for administrative API calls.
          </p>

          <CodeBlock
            language="text"
            filename="Admin Request"
            code={`POST /admin/models/load
Authorization: Bearer <admin-key>
Content-Type: application/json

{ "model": "qwen3-72b" }`}
          />

          <p>
            The web dashboard prompts for the admin key when you first
            attempt a protected operation. Once entered, it is stored in
            the browser&apos;s local storage for the duration of the session.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
