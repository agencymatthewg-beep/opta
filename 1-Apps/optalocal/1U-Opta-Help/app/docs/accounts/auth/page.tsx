"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";

const tocItems = [
  { id: "auth-modes", title: "Auth Modes", level: 2 as const },
  { id: "environment-configuration", title: "Environment Configuration", level: 2 as const },
  { id: "password-auth", title: "Password Auth", level: 2 as const },
  { id: "browser-oauth", title: "Browser OAuth", level: 2 as const },
  { id: "callback-security", title: "Callback Security", level: 2 as const },
  { id: "session-storage", title: "Session Storage", level: 2 as const },
  { id: "logout", title: "Logout", level: 2 as const },
  { id: "cli-offline-banner", title: "CLI Offline Banner", level: 2 as const },
  { id: "admin-key-detection", title: "Admin Key Detection", level: 2 as const },
  { id: "desktop-accounts-flow", title: "Desktop Accounts Button", level: 2 as const },
];

export default function AccountsAuthPage() {
  const { prev, next } = getPrevNext("/docs/accounts/auth/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accounts", href: "/docs/accounts/" },
          { label: "Auth" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Auth</h1>
          <p className="lead">
            Opta account authentication supports password-based sign-in and browser OAuth.
            Successful login writes a local session file used by CLI account and sync commands.
          </p>

          <h2 id="auth-modes">Auth Modes</h2>
          <ul>
            <li>
              <strong>Password mode</strong> - <code>opta account login --identifier ...</code>
            </li>
            <li>
              <strong>System browser OAuth</strong> - <code>opta account login --oauth</code>
            </li>
            <li>
              <strong>Opta browser OAuth</strong> -{" "}
              <code>opta account login --oauth-opta-browser</code>
            </li>
          </ul>
          <p>
            <code>opta account signup</code> creates a new account, then persists the issued
            session when available.
          </p>

          <h2 id="environment-configuration">Environment Configuration</h2>
          <p>
            CLI auth requires a Supabase project URL and anon key. These can be set directly in
            environment variables.
          </p>
          <CodeBlock
            language="bash"
            filename="Supabase auth config"
            code={`export OPTA_SUPABASE_URL="https://<project>.supabase.co"
export OPTA_SUPABASE_ANON_KEY="<anon-key>"

# Fallback names also supported by the CLI:
export NEXT_PUBLIC_SUPABASE_URL="$OPTA_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$OPTA_SUPABASE_ANON_KEY"`}
          />
          <Callout variant="info" title="Config discovery">
            If env vars are not set, the CLI attempts discovery from project-local{" "}
            <code>.env.local</code> files (for Accounts and Local Web workspaces).
          </Callout>

          <h2 id="password-auth">Password Auth</h2>
          <CommandBlock
            command='opta account signup --identifier "matthew@optamize.biz" --name "Matthew Byrden"'
            description="Create account using email/password flow"
          />
          <CommandBlock
            command='opta account login --identifier "matthew@optamize.biz"'
            description="Log in with password (password prompt appears in terminal)"
          />
          <CommandBlock
            command="opta account status --json"
            description="Inspect authenticated user, project, and session expiry"
          />

          <h2 id="browser-oauth">Browser OAuth</h2>
          <CommandBlock
            command="opta account login --oauth --timeout 300"
            description="Open system browser OAuth sign-in with 5-minute callback timeout"
          />
          <CommandBlock
            command="opta account login --oauth-opta-browser --oauth-cookie-jar default --timeout 300"
            description="Run OAuth inside an Opta-managed browser session"
          />
          <CommandBlock
            command="opta account login --oauth --return-to opta-init://auth/callback --json"
            description="After callback, deep-link back into another app"
          />
          <Callout variant="warning" title="OAuth timeout constraints">
            <code>--timeout</code> must be between <code>30</code> and <code>1800</code> seconds.
            Outside this range, login fails before browser launch.
          </Callout>

          <h2 id="callback-security">Callback Security</h2>
          <p>
            OAuth callback relay is restricted to <code>127.0.0.1:&lt;port&gt;</code> and guarded
            by a state token. The Accounts callback route rejects invalid or missing state.
          </p>
          <CodeBlock
            language="text"
            filename="CLI callback example"
            code={`GET https://accounts.optalocal.com/cli/callback?port=58321&state=7d2f...
-> 302 http://127.0.0.1:58321/callback?access_token=...&refresh_token=...&state=7d2f...`}
          />
          <p>
            The CLI verifies callback state before saving tokens. State mismatch results in login
            failure and no local session update.
          </p>

          <h2 id="session-storage">Session Storage</h2>
          <p>
            On success, auth state is written to <code>~/.config/opta/account.json</code>, with
            user profile, project ref, access token, refresh token, and expiry metadata.
          </p>
          <CodeBlock
            filename="Status payload fields"
            code={`{
  "authenticated": true,
  "project": "cytjsmezydytbmjrolyz",
  "user": { "id": "...", "email": "...", "phone": null, "name": "..." },
  "session": { "tokenType": "bearer", "expiresAt": "2026-03-04T10:24:12.000Z" }
}`}
          />

          <h2 id="logout">Logout</h2>
          <CommandBlock
            command="opta account logout"
            description="Clear local account state and attempt remote Supabase session revoke"
          />
          <CommandBlock
            command="opta account status"
            description="Verify the CLI reports not logged in"
          />
          <p>
            If Supabase env vars are unavailable during logout, local state is still cleared and a
            warning is printed for remote revoke.
          </p>

          <h2 id="cli-offline-banner">CLI Offline Banner</h2>
          <p>
            When <code>opta chat</code> can&apos;t reach LMX (host down, invalid admin key, or LAN
            fallback failure) the Ink UI now boots with an <strong>Offline</strong> banner. The
            composer is disabled, the attempted hosts are listed, and a CTA points you at recovery
            commands instead of crashing the CLI.
          </p>
          <Callout variant="warning" title="What the notice means">
            The banner renders after provider probes fail and <code>detectLocalAdminKey</code>{" "}
            cannot authorize against any loopback or fallback host. It is safe to keep the CLI
            open—the UI stays read-only until you rerun diagnostics or fix the server.
          </Callout>
          <p>
            Use these commands (in order) to clear the banner, re-run detection, and confirm the
            admin key:
          </p>
          <CommandBlock
            command="opta status"
            description="Print discovery info, host/fallback list, and whether the admin key was auto-detected or overridden."
          />
          <CommandBlock
            command="/server status"
            description="Slash command inside the chat UI that re-probes the current host/fallback set without restarting the CLI."
          />
          <CommandBlock
            command="opta models --json"
            description="Calls the secured /admin/model endpoints; success confirms the admin key is accepted again."
          />
          <CommandBlock
            command="opta config delete connection.adminKey"
            description="Clears a stale override so the CLI falls back to the auto-detected loopback key."
          />

          <h2 id="admin-key-detection">Admin Key Detection</h2>
          <p>
            Loopback hosts (e.g., <code>127.0.0.1</code>, <code>::1</code>) now trigger{" "}
            <code>detectLocalAdminKey</code>. After environment, project, and CLI overrides finish,
            the helper looks for <code>server.admin_key</code> inside{" "}
            <code>~/.opta-lmx/config.yaml</code>, copies it into{" "}
            <code>connection.adminKey</code>, and pre-populates{" "}
            <code>connection.adminKeysByHost</code> for every loopback fallback host. Remote hosts
            never receive this key—changing <code>connection.host</code> to a non-loopback value
            forces the helper to restart detection so nothing leaks.
          </p>
          <Callout variant="tip" title="Check the source of truth">
            <p>
              The CTA in the banner links to <code>~/.opta-lmx/config.yaml</code>. Ensure{" "}
              <code>server.admin_key</code> is set there (or export{" "}
              <code>OPTA_LMX_ADMIN_KEY</code>) so automatic detection continues to work after
              reboots.
            </p>
          </Callout>
          <p>Manual overrides are still available:</p>
          <CommandBlock
            command={`opta config set connection.adminKeysByHost '{"127.0.0.1":"<key>"}'`}
            description="Pin specific loopback hosts when multiple simulators are running."
          />
          <CommandBlock
            command="opta config set connection.adminKey <key>"
            description="Override detection globally. Remember to delete it after switching back to auto mode."
          />

          <h2 id="desktop-accounts-flow">Desktop Accounts Button</h2>
          <p>
            Opta Desktop apps (Code + Init) now ship an <strong>Accounts</strong> button in the
            header grid. Clicking it launches the system browser, renders the standard{" "}
            <code>accounts.optalocal.com</code> OAuth screen, then closes the tab after sign-in when
            the <code>opta-code://auth/callback</code> deep-link fires. The deep-link handler refreshes
            account state inside the app and the status badge flips to “Signed in” without requiring
            a manual reload.
          </p>
          <Callout variant="warning" title="If login looks stuck">
            <ul>
              <li>
                Ensure macOS still allows <code>opta-code://</code> deep-links (System Settings →
                Privacy &amp; Security → Open URLs with Opta Code).
              </li>
              <li>
                Run <code>opta account status</code> or <code>opta account login --oauth</code>{" "}
                from the CLI to confirm Supabase credentials while keeping the desktop app open.
              </li>
              <li>
                Re-trigger the Accounts button after clearing blocked pop-ups or network proxies; the
                handler unsubscribes/subscribe automatically so repeated attempts are safe.
              </li>
            </ul>
          </Callout>
          <p>
            Successful desktop logins immediately unlock the CLI as soon as the daemon picks up the
            refreshed session file, so you can bounce between desktop and terminal without repeating
            the flow.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
