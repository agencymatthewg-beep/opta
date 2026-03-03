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

export type ManagerUpdateState = "up_to_date" | "update_available" | "error";

export interface ManagerUpdateCheckResult {
  currentVersion?: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  endpointUsed?: string;
  channel?: string;
  available?: boolean;
  updateAvailable?: boolean;
  update_available?: boolean;
  hasUpdate?: boolean;
  has_update?: boolean;
  status?: string;
  warnings?: string[];
  message?: string;
  error?: string;
}

export interface ManagerUpdateInstallResult {
  ok?: boolean;
  installed?: boolean;
  currentVersion?: string;
  latestVersion?: string;
  releaseNotes?: string;
  releaseDate?: string;
  endpointUsed?: string;
  channel?: string;
  warnings?: string[];
  message?: string;
  error?: string;
}

export interface AccountProfile {
  email?: string;
  name?: string;
  avatar?: string;
  activeRole?: string;
}
