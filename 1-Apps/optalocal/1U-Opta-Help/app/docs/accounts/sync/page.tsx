"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";

const tocItems = [
  { id: "what-syncs", title: "What Syncs", level: 2 as const },
  { id: "cloud-key-sync", title: "Cloud Key Sync", level: 2 as const },
  { id: "device-registration", title: "Device Registration", level: 2 as const },
  { id: "capability-evaluation", title: "Capability Evaluation", level: 2 as const },
  { id: "session-record-sync", title: "Session Record Sync", level: 2 as const },
  { id: "automation-example", title: "Automation Example", level: 2 as const },
];

export default function AccountsSyncPage() {
  const { prev, next } = getPrevNext("/docs/accounts/sync/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accounts", href: "/docs/accounts/" },
          { label: "Sync" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Sync</h1>
          <p className="lead">
            Opta Accounts sync covers cloud API keys, device identity, session activity, and
            capability checks used to gate CLI actions.
          </p>

          <h2 id="what-syncs">What Syncs</h2>
          <ul>
            <li>
              <strong>API keys</strong> - via Accounts API <code>/api/keys</code>.
            </li>
            <li>
              <strong>Device identity</strong> - fingerprint-based registration via{" "}
              <code>/api/devices/register</code>.
            </li>
            <li>
              <strong>Capability decisions</strong> - scoped checks via{" "}
              <code>/api/capabilities/evaluate</code>.
            </li>
            <li>
              <strong>Session records</strong> - upserted in <code>accounts_sessions</code> and
              periodically touched.
            </li>
          </ul>

          <h2 id="cloud-key-sync">Cloud Key Sync</h2>
          <p>
            Cloud key commands operate on the authenticated account and support provider filtering,
            labels, and JSON output for automation.
          </p>
          <CommandBlock
            command="opta account keys list --provider anthropic --json"
            description="List cloud keys for a provider"
          />
          <CommandBlock
            command="opta account keys push anthropic sk-ant-... --label work"
            description="Create or update a cloud key entry"
          />
          <CommandBlock
            command="opta account keys delete 9d4c4b93-2d7e-44cf-8ca2-f214ef6a10f1 --provider anthropic"
            description="Delete a cloud key by ID"
          />
          <CodeBlock
            filename="keys list --json output"
            code={`{
  "ok": true,
  "keys": [
    {
      "id": "9d4c4b93-2d7e-44cf-8ca2-f214ef6a10f1",
      "provider": "anthropic",
      "label": "work",
      "keyValue": "sk-ant-...",
      "updatedAt": "2026-03-04T08:17:41.902Z"
    }
  ]
}`}
          />
          <Callout variant="warning" title="Key material">
            Treat command history as sensitive when using <code>keys push &lt;provider&gt; &lt;key&gt;</code>. Prefer
            shell history controls or wrapper scripts in CI.
          </Callout>

          <h2 id="device-registration">Device Registration</h2>
          <p>
            On login, the CLI computes a deterministic device fingerprint and registers the device.
            Existing fingerprints are reused to avoid duplicate devices after re-login.
          </p>
          <CodeBlock
            language="text"
            filename="Device sync flow"
            code={`1) GET  /api/devices/fingerprint?hash=<sha256>
2) POST /api/devices/register (if not found)
3) Persist deviceId into ~/.config/opta/account.json`}
          />

          <h2 id="capability-evaluation">Capability Evaluation</h2>
          <p>
            Runtime features can be gated by account policy using{" "}
            <code>/api/capabilities/evaluate</code>. Typical scopes include CLI chat/run
            permissions and account-tier checks.
          </p>
          <CodeBlock
            language="json"
            filename="Capability request shape"
            code={`{
  "scope": "cli.run",
  "deviceId": "dev_abc123"
}`}
          />
          <p>
            If evaluation fails (network or auth), callers should assume deny and surface a
            recoverable reason.
          </p>

          <h2 id="session-record-sync">Session Record Sync</h2>
          <p>
            The CLI upserts a cloud session row after login and periodically touches{" "}
            <code>last_seen_at</code> while active. This drives account-side activity and device
            visibility.
          </p>
          <CodeBlock
            language="text"
            filename="Session row fields"
            code={`session_type: "cli"
created_at: ISO8601
last_seen_at: ISO8601
expires_at: ISO8601|null`}
          />

          <h2 id="automation-example">Automation Example</h2>
          <CodeBlock
            language="bash"
            filename="CI-friendly sync checks"
            code={`opta account status --json | jq '.authenticated'
opta account keys list --json | jq '.keys | length'
opta account keys push openai "$OPENAI_API_KEY" --label ci --json
opta account keys list --provider openai --json | jq '.keys[0].label'`}
          />

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
