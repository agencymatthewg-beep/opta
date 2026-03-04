import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface SessionMemoryPageProps {
  connection: DaemonConnectionOptions;
}

export function SessionMemoryPage({ connection }: SessionMemoryPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={["sessions.*"]}
      title="Session Memory"
      subtitle="Search, export, and manage persisted session memory via daemon operations."
    />
  );
}

