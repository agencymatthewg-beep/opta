"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "rule-system", title: "Rule System", level: 2 as const },
  { id: "critical-rules", title: "Critical Rules", level: 2 as const },
  { id: "c01-no-data-exfil", title: "C01: No Data Exfiltration", level: 3 as const },
  { id: "c02-destructive-confirmation", title: "C02: Destructive Confirmation", level: 3 as const },
  { id: "c03-no-external-posts", title: "C03: No External Posts", level: 3 as const },
  { id: "c08-daemon-localhost", title: "C08: Daemon Localhost Only", level: 3 as const },
  { id: "strict-rules", title: "Strict Rules", level: 2 as const },
  { id: "s01-permission-check", title: "S01: Permission Check", level: 3 as const },
  { id: "s02-no-tokens-in-logs", title: "S02: No Tokens in Logs", level: 3 as const },
  { id: "s04-no-cloud-without-opt-in", title: "S04: No Cloud Without Opt-In", level: 3 as const },
  { id: "s06-max-tool-calls", title: "S06: Max Tool Calls", level: 3 as const },
];

export default function SecurityGuardrailsPage() {
  const { prev, next } = getPrevNext("/docs/security/guardrails/");
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Security", href: "/docs/security/" },
          { label: "Guardrails" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Guardrails</h1>
          <p className="lead">
            Guardrails are hard rules that govern what the AI agent can and
            cannot do. Critical rules cannot be overridden. Strict rules
            require explicit user confirmation to bypass.
          </p>

          <h2 id="rule-system">Rule System</h2>
          <p>
            The guardrail system uses a three-tier hierarchy. This page
            details the specific rules in the Critical and Strict tiers,
            which are the enforceable rules that prevent unsafe behavior.
          </p>

          <h2 id="critical-rules">Critical Rules</h2>
          <p>
            Critical rules are absolute hard stops. They cannot be overridden
            by user configuration, model behavior, or any other mechanism.
            A violation of a Critical rule causes the tool call to be
            rejected immediately.
          </p>

          <Callout variant="danger" title="C01: No Data Exfiltration">
            The AI agent must not transmit user data, files, or session
            content to any external server, API, or endpoint without
            explicit user approval. This includes HTTP requests, email
            sends, webhook calls, and any other form of data transmission.
            Every outbound data transfer requires a separate confirmation
            prompt showing exactly what data will be sent and where.
          </Callout>

          <h3 id="c01-no-data-exfil">C01: No Data Exfiltration</h3>
          <p>
            This is the most fundamental security rule. The AI cannot send
            your code, documents, or any other data to an external server
            without you seeing and approving the specific data being sent.
            This prevents malicious prompt injection attacks that attempt
            to exfiltrate sensitive data through tool calls.
          </p>

          <Callout variant="danger" title="C02: Destructive Commands Need Confirmation">
            Commands that delete files, drop databases, reset repositories,
            or perform other irreversible operations must receive explicit
            user confirmation before execution. The confirmation prompt must
            clearly describe the destructive action.
          </Callout>

          <h3 id="c02-destructive-confirmation">C02: Destructive Confirmation</h3>
          <p>
            Destructive commands include but are not limited to:{" "}
            <code>rm -rf</code>, <code>git reset --hard</code>,{" "}
            <code>DROP TABLE</code>, <code>docker system prune</code>.
            The daemon identifies destructive patterns in command arguments
            and escalates them to the user regardless of the current
            permission mode.
          </p>

          <Callout variant="danger" title="C03: No External Posts Without Approval">
            The AI agent must not create, modify, or delete content on
            external services (GitHub issues, Slack messages, social media
            posts, API calls) without explicit user approval. Each external
            mutation requires its own confirmation.
          </Callout>

          <h3 id="c03-no-external-posts">C03: No External Posts</h3>
          <p>
            This rule prevents the AI from taking actions on your behalf on
            external platforms. Even if the model has access to a GitHub
            MCP server, it cannot create a pull request, post a comment,
            or push code without your explicit approval for each action.
          </p>

          <Callout variant="danger" title="C08: Daemon Localhost Only">
            The daemon must bind exclusively to 127.0.0.1. It must not
            accept connections from external network interfaces under any
            circumstances. This rule is enforced at the network binding
            level and cannot be overridden by configuration.
          </Callout>

          <h3 id="c08-daemon-localhost">C08: Daemon Localhost Only</h3>
          <p>
            The daemon listens on <code>127.0.0.1:9999</code> and will
            refuse to bind to <code>0.0.0.0</code> or any external
            interface. This prevents remote exploitation of the daemon
            API, which has broad system access through its tool execution
            capabilities.
          </p>

          <h2 id="strict-rules">Strict Rules</h2>
          <p>
            Strict rules are enforced by default but can be overridden on
            a per-instance basis with explicit user confirmation. They
            represent important security practices that have legitimate
            exceptions.
          </p>

          <h3 id="s01-permission-check">S01: Permission Check</h3>
          <p>
            Every tool invocation must pass through the permission check
            pipeline. No tool call can bypass the permission system. This
            ensures that the permission table documented in the{" "}
            <a href="/docs/security/permissions/">Permissions</a> page is
            always consulted before any tool executes.
          </p>

          <h3 id="s02-no-tokens-in-logs">S02: No Tokens in Logs</h3>
          <p>
            Authentication tokens, API keys, passwords, and other secrets
            must never appear in log output, terminal display, or session
            recordings. The daemon sanitizes all log messages to replace
            sensitive strings with redacted placeholders before they are
            written to any output.
          </p>

          <h3 id="s04-no-cloud-without-opt-in">S04: No Cloud Without Opt-In</h3>
          <p>
            No component may transmit data to any cloud service without
            explicit user opt-in. The default configuration makes zero
            outbound connections. Cloud features (Anthropic API fallback,
            Cloudflare Tunnel, Supabase auth) must be explicitly configured
            by the user.
          </p>

          <h3 id="s06-max-tool-calls">S06: Max Tool Calls</h3>
          <p>
            A single turn is limited to a maximum of 30 tool calls. This
            prevents runaway agent loops where the model repeatedly invokes
            tools in an infinite cycle. If the limit is reached, the turn
            is terminated and the user is notified.
          </p>

          <Callout variant="info" title="Configurable limit">
            The 30-tool-call limit is the default. It can be adjusted via
            configuration, but increasing it requires explicit user action
            and awareness of the implications.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
