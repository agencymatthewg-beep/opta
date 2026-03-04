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

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
