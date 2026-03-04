import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface ToolingOperationsPageProps {
  connection: DaemonConnectionOptions;
}

const TOOLING_OPERATION_SCOPES: string[] = [
  "diff",
  "embed",
  "rerank",
  "benchmark",
  "ceo.benchmark",
];

export function ToolingOperationsPage({ connection }: ToolingOperationsPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={TOOLING_OPERATION_SCOPES}
      title="Agent Tooling"
      subtitle="Frontend controls for CLI-backed tooling operations via daemon API."
    />
  );
}

