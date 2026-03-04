import { DaemonPanel } from "../components/DaemonPanel";
import type { DaemonConnectionOptions } from "../types";
import { OperationsPage } from "./OperationsPage";

interface SystemOperationsPageProps {
  connection: DaemonConnectionOptions;
  connectionState: "connected" | "connecting" | "disconnected";
  onOpenCliBridge?: () => void;
}

const SYSTEM_OPERATION_SCOPES: string[] = [
  "doctor",
  "version.check",
  "completions.generate",
  "daemon.*",
  "serve.*",
  "browser.*",
  "init.run",
  "update.run",
  "onboard.apply",
  "keychain.*",
];

export function SystemOperationsPage({
  connection,
  connectionState,
  onOpenCliBridge,
}: SystemOperationsPageProps) {
  return (
    <div className="system-operations-page">
      <div className="system-operations-header glass">
        <h2>System Control Plane</h2>
        <p>
          Frontend-optimized system workflows backed by Opta CLI and daemon
          operations.
        </p>
      </div>
      <DaemonPanel
        connection={connection}
        connectionState={connectionState}
        onOpenDaemonOperations={onOpenCliBridge}
      />
      <OperationsPage
        connection={connection}
        scopedOperationIds={SYSTEM_OPERATION_SCOPES}
        title="System Operations"
        subtitle="Diagnostics, lifecycle, onboarding, and maintenance through daemon-backed CLI operations."
      />
    </div>
  );
}
