export type Channel = "stable" | "beta";

export interface AppCommands {
  install?: string[];
  update?: string[];
  launch?: string[];
}

export interface ManifestApp {
  id: string;
  name: string;
  description: string;
  version: string;
  website?: string;
  commands?: AppCommands;
}

export interface ManifestPayload {
  channel: Channel;
  updatedAt?: string;
  apps: ManifestApp[];
}

export interface ManifestResponse {
  manifest: ManifestPayload;
  source: string;
  warning?: string;
}

export interface InstalledApp {
  id: string;
  name: string;
  path: string;
  version?: string;
  source: string;
}

export interface DaemonStatus {
  running: boolean;
  message: string;
  rawOutput?: string;
  checkedAt: string;
}

export interface CommandOutcome {
  ok: boolean;
  command: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  message: string;
}
