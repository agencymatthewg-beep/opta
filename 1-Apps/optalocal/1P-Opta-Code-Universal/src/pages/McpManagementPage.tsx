import { OperationsPage } from "./OperationsPage";
import type { DaemonConnectionOptions } from "../types";

interface McpManagementPageProps {
  connection: DaemonConnectionOptions;
}

export function McpManagementPage({ connection }: McpManagementPageProps) {
  return (
    <OperationsPage
      connection={connection}
      scopedOperationIds={["mcp.*"]}
      title="MCP Management"
      subtitle="Manage MCP server operations via daemon API."
    />
  );
}
