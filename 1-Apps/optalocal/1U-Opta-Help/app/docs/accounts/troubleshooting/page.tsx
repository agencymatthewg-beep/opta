"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";

const tocItems = [
  { id: "supabase-not-configured", title: "Supabase Not Configured", level: 2 as const },
  { id: "oauth-timeout-or-state-mismatch", title: "OAuth Timeout or State Mismatch", level: 2 as const },
  { id: "keys-commands-not-signed-in", title: "Keys Commands: Not Signed In", level: 2 as const },
  { id: "health-endpoint-failing", title: "Health Endpoint Failing", level: 2 as const },
  { id: "stale-or-expired-local-session", title: "Stale or Expired Local Session", level: 2 as const },
  { id: "oauth-opta-browser-issues", title: "OAuth Opta Browser Issues", level: 2 as const },
  { id: "clean-reset", title: "Clean Reset", level: 2 as const },
];

export default function AccountsTroubleshootingPage() {
  const { prev, next } = getPrevNext("/docs/accounts/troubleshooting/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accounts", href: "/docs/accounts/" },
          { label: "Troubleshooting" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Troubleshooting</h1>
          <p className="lead">
            Common failure modes for account login, callback relay, and cloud sync commands with
            direct remediation steps.
          </p>

          <h2 id="supabase-not-configured">Supabase Not Configured</h2>
          <p>
            If login exits with a Supabase config error, required env vars are missing or empty.
          </p>
          <CommandBlock
            command="env | rg 'OPTA_SUPABASE|NEXT_PUBLIC_SUPABASE'"
            description="Check effective Supabase auth environment"
          />
          <CodeBlock
            language="bash"
            filename="Set required vars"
            code={`export OPTA_SUPABASE_URL="https://<project>.supabase.co"
export OPTA_SUPABASE_ANON_KEY="<anon-key>"`}
          />

          <h2 id="oauth-timeout-or-state-mismatch">OAuth Timeout or State Mismatch</h2>
          <p>
            Browser auth fails if callback does not arrive before timeout or if callback{" "}
            <code>state</code> differs from the CLI-issued value.
          </p>
          <CommandBlock
            command="opta account login --oauth --timeout 600"
            description="Increase callback window for slow or interrupted sign-in"
          />
          <CommandBlock
            command="opta account login --oauth --accounts-url https://accounts.optalocal.com"
            description="Force canonical accounts portal origin"
          />
          <Callout variant="warning" title="Callback target restriction">
            The Accounts relay only redirects to <code>127.0.0.1:&lt;port&gt;</code> and requires
            matching state. Invalid port/state always fail by design.
          </Callout>

          <h2 id="keys-commands-not-signed-in">Keys Commands: Not Signed In</h2>
          <p>
            <code>opta account keys ...</code> requires a valid local account session with an access
            token.
          </p>
          <CommandBlock
            command="opta account status --json"
            description="Verify authenticated=true before running key sync commands"
          />
          <CommandBlock
            command="opta account login --oauth"
            description="Re-authenticate, then retry keys list/push/delete"
          />

          <h2 id="health-endpoint-failing">Health Endpoint Failing</h2>
          <p>
            Use the Supabase health gate to isolate service-level vs schema-level failures.
          </p>
          <CodeBlock
            language="bash"
            filename="Accounts health check"
            code={`curl -s "\${OPTA_ACCOUNTS_URL:-https://accounts.optalocal.com}/api/health/supabase" | jq .`}
          />
          <p>
            Focus fields:
          </p>
          <ul>
            <li>
              <code>services.auth.ok</code>, <code>services.rest.ok</code>,{" "}
              <code>services.storage.ok</code>
            </li>
            <li>
              <code>schemaReady</code> and per-table presence under <code>tables</code>
            </li>
          </ul>
          <Callout variant="info" title="schemaReady=false">
            If services are up but <code>schemaReady</code> is false, required Accounts tables are
            missing in Supabase. Apply the current Accounts schema migration set, then re-run health.
          </Callout>

          <h2 id="stale-or-expired-local-session">Stale or Expired Local Session</h2>
          <p>
            The CLI attempts refresh when expiry is within 5 minutes. If refresh fails, session is
            treated as logged out.
          </p>
          <CommandBlock
            command="opta account status --json | jq '.session'"
            description="Check whether local session is null or expired"
          />
          <CommandBlock
            command="opta account logout && opta account login --oauth"
            description="Clear stale state and establish a new session"
          />

          <h2 id="oauth-opta-browser-issues">OAuth Opta Browser Issues</h2>
          <p>
            If <code>--oauth-opta-browser</code> fails to open or navigate, fall back to system
            browser flow first, then debug cookie-jar mode.
          </p>
          <CommandBlock
            command="opta account login --oauth"
            description="Baseline system-browser OAuth path"
          />
          <CommandBlock
            command="opta account login --oauth-opta-browser --oauth-cookie-jar default"
            description="Retry Opta-managed browser session with explicit jar"
          />

          <h2 id="clean-reset">Clean Reset</h2>
          <p>
            Use this only when local account state is known-bad and normal logout/login does not
            recover.
          </p>
          <CommandBlock
            command="opta account logout"
            description="Best-effort local clear + remote revoke"
          />
          <CommandBlock
            command="rm ~/.config/opta/account.json"
            description="Remove persisted local session file"
          />
          <CommandBlock
            command="opta account login --oauth && opta account status --json"
            description="Re-create clean account state and verify"
          />
          <Callout variant="danger" title="Do not delete the entire config directory">
            Limit cleanup to <code>account.json</code> unless you intentionally want to reset all
            Opta CLI local state.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
