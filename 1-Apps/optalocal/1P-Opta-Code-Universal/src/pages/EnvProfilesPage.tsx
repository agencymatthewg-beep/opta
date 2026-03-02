import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface EnvProfilesPageProps {
  connection: DaemonConnectionOptions;
}

export function EnvProfilesPage({ connection }: EnvProfilesPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={["env.*"]}
      title="Environment Profiles"
      subtitle="Manage environment profile operations via daemon API."
    />
  );
}
