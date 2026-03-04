import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface CliOperationsPageProps {
  connection: DaemonConnectionOptions;
}

const CLI_OPERATION_SCOPES: string[] = [
  "doctor",
  "env.*",
  "config.*",
  "account.*",
  "key.*",
  "version.check",
  "completions.generate",
  "daemon.*",
  "mcp.*",
  "onboard.apply",
  "serve.*",
  "browser.*",
  "init.run",
  "update.run",
  "sessions.*",
  "diff",
  "embed",
  "rerank",
  "benchmark",
  "ceo.benchmark",
  "apps.*",
  "models.*",
  "vault.*",
  "keychain.*",
];

export function CliOperationsPage({ connection }: CliOperationsPageProps) {
  return (
    <div className="cli-bridge-page">
      <div className="cli-bridge-note glass-subtle" role="status">
        <strong>CLI Bridge:</strong> Opta CLI remains the primary TUI coding
        interface. Opta Code provides frontend-optimized controls over the same
        daemon-backed capabilities.
      </div>
      <OperationsPage
        connection={connection}
        scopedOperationIds={CLI_OPERATION_SCOPES}
        title="CLI Bridge"
        subtitle="Advanced parity bridge for full Opta CLI operation-family access via daemon API."
      />
    </div>
  );
}
