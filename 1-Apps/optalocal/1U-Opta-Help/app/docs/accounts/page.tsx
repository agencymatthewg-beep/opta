"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";

const tocItems = [
  { id: "what-is-opta-accounts", title: "What Is Opta Accounts", level: 2 as const },
  { id: "architecture", title: "Architecture", level: 2 as const },
  { id: "cli-surface", title: "CLI Surface", level: 2 as const },
  { id: "data-stored-locally", title: "Data Stored Locally", level: 2 as const },
  { id: "quick-start", title: "Quick Start", level: 2 as const },
  { id: "next-pages", title: "Next Pages", level: 2 as const },
];

export default function AccountsOverviewPage() {
  const { prev, next } = getPrevNext("/docs/accounts/");

  return (
    <>
      <Breadcrumb items={[{ label: "Accounts", href: "/docs/accounts/" }, { label: "Overview" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Accounts Overview</h1>
          <p className="lead">
            Opta Accounts is the identity and cloud-sync layer for Opta apps. It provides
            Supabase-backed authentication, CLI browser login handoff, cloud API key sync, and
            account capability checks used by the CLI runtime.
          </p>

          <h2 id="what-is-opta-accounts">What Is Opta Accounts</h2>
          <p>
            The Accounts portal runs at <code>https://accounts.optalocal.com</code>. The CLI uses
            it for browser OAuth sign-in and stores the resulting session locally. Once signed in,
            the CLI can sync API keys and evaluate account capabilities for gated actions.
          </p>
          <ul>
            <li>
              <strong>Auth</strong> - email/password, phone/password, and browser OAuth.
            </li>
            <li>
              <strong>CLI callback relay</strong> - secure redirect to local{" "}
              <code>127.0.0.1:&lt;port&gt;</code> callback.
            </li>
            <li>
              <strong>Cloud key sync</strong> - <code>opta account keys list|push|delete</code>.
            </li>
            <li>
              <strong>Capability checks</strong> - account and device-aware policy decisions.
            </li>
          </ul>

          <h2 id="architecture">Architecture</h2>
          <CodeBlock
            language="text"
            code={`Opta CLI
  │
  │ account login --oauth
  ▼
accounts.optalocal.com
  │
  │ /cli/callback?port=<local-port>&state=<csrf>
  ▼
127.0.0.1:<local-port>/callback
  │
  │ access_token + refresh_token
  ▼
~/.config/opta/account.json
  │
  ├─ account keys list|push|delete  -> Accounts API (/api/keys)
  └─ capability evaluate            -> Accounts API (/api/capabilities/evaluate)`}
          />

          <h2 id="cli-surface">CLI Surface</h2>
          <p>Primary account commands:</p>
          <CommandBlock
            command="opta account status --json"
            description="Inspect local account session and expiry"
            output={`{
  "ok": true,
  "authenticated": true,
  "project": "cytjsmezydytbmjrolyz",
  "user": { "id": "user_123", "email": "matthew@optamize.biz", "phone": null, "name": "Matthew" },
  "session": { "tokenType": "bearer", "expiresAt": "2026-03-04T10:24:12.000Z" },
  "updatedAt": "2026-03-04T09:41:03.000Z"
}`}
          />
          <CommandBlock
            command="opta account login --oauth"
            description="Open browser sign-in through accounts.optalocal.com"
          />
          <CommandBlock
            command="opta account keys list --json"
            description="List cloud-synced provider keys for this account"
          />

          <h2 id="data-stored-locally">Data Stored Locally</h2>
          <p>
            The CLI persists account session state to <code>~/.config/opta/account.json</code> with
            file mode <code>0600</code>. Directory mode is <code>0700</code>.
          </p>
          <CodeBlock
            filename="~/.config/opta/account.json"
            code={`{
  "project": "cytjsmezydytbmjrolyz",
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer",
    "expires_in": 3600,
    "expires_at": 1772619852
  },
  "user": {
    "id": "user_123",
    "email": "matthew@optamize.biz"
  },
  "updatedAt": "2026-03-04T09:41:03.000Z",
  "deviceId": "dev_abc123"
}`}
          />
          <Callout variant="info" title="Automatic refresh behavior">
            If a token is within 5 minutes of expiry, the CLI attempts a silent refresh using the
            stored <code>refresh_token</code>. If refresh fails, the local session is treated as
            unauthenticated.
          </Callout>

          <h2 id="quick-start">Quick Start</h2>
          <CommandBlock
            command="opta account login --oauth --timeout 300"
            description="Sign in through browser OAuth with a 5-minute timeout"
          />
          <CommandBlock
            command="opta account status --json"
            description="Verify the session is present and unexpired"
          />
          <CommandBlock
            command="opta account keys push anthropic sk-ant-... --label work"
            description="Store a provider API key in Opta Accounts cloud"
          />

          <h2 id="next-pages">Next Pages</h2>
          <ul>
            <li>
              <a href="/docs/accounts/auth/">Auth</a> - login modes, callback flow, token handling.
            </li>
            <li>
              <a href="/docs/accounts/sync/">Sync</a> - key sync, device registration, capabilities.
            </li>
            <li>
              <a href="/docs/accounts/troubleshooting/">Troubleshooting</a> - failure patterns and
              recovery commands.
            </li>
          </ul>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
