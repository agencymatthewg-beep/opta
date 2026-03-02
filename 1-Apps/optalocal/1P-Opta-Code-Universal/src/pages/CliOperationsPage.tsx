import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface CliOperationsPageProps {
  connection: DaemonConnectionOptions;
}

const CLI_OPERATION_SCOPES: string[] = [
  "doctor",
  "version.check",
  "completions.generate",
  "daemon.*",
  "onboard.apply",
  "serve.*",
  "init.run",
  "update.run",
  "sessions.*",
  "diff",
  "embed",
  "rerank",
  "benchmark",
  "keychain.*",
];

export function CliOperationsPage({ connection }: CliOperationsPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={CLI_OPERATION_SCOPES}
      title="CLI Operations"
      subtitle="Focused daemon/system/session command families from Opta CLI."
    />
  );
}
