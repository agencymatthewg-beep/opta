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
  "init.run",
  "update.run",
  "sessions.*",
  "diff",
  "embed",
  "rerank",
  "benchmark",
  "models.*",
  "keychain.*",
];

export function CliOperationsPage({ connection }: CliOperationsPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={CLI_OPERATION_SCOPES}
      title="CLI Operations"
      subtitle="Full Opta CLI operation-family access via daemon API."
    />
  );
}
