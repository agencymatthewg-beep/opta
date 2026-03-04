import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface AppCatalogPageProps {
  connection: DaemonConnectionOptions;
}

export function AppCatalogPage({ connection }: AppCatalogPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={["apps.*"]}
      title="App Catalog"
      subtitle="Install, list, and uninstall Opta apps through daemon-backed CLI operations."
    />
  );
}

