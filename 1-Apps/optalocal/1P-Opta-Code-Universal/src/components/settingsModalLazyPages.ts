import { lazy } from "react";
import type { SettingsTabId } from "./settingsStudioConfig";

const loadAppCatalogPage = () =>
  import("../pages/AppCatalogPage").then((module) => ({
    default: module.AppCatalogPage,
  }));

const loadSessionMemoryPage = () =>
  import("../pages/SessionMemoryPage").then((module) => ({
    default: module.SessionMemoryPage,
  }));

const loadEnvProfilesPage = () =>
  import("../pages/EnvProfilesPage").then((module) => ({
    default: module.EnvProfilesPage,
  }));

const loadMcpManagementPage = () =>
  import("../pages/McpManagementPage").then((module) => ({
    default: module.McpManagementPage,
  }));

const loadConfigStudioPage = () =>
  import("../pages/ConfigStudioPage").then((module) => ({
    default: module.ConfigStudioPage,
  }));

const loadAccountControlPage = () =>
  import("../pages/AccountControlPage").then((module) => ({
    default: module.AccountControlPage,
  }));

const loadBackgroundJobsPage = () =>
  import("../pages/BackgroundJobsPage").then((module) => ({
    default: module.BackgroundJobsPage,
  }));

const loadDaemonLogsPage = () =>
  import("../pages/DaemonLogsPage").then((module) => ({
    default: module.DaemonLogsPage,
  }));

const loadCliOperationsPage = () =>
  import("../pages/CliOperationsPage").then((module) => ({
    default: module.CliOperationsPage,
  }));

const loadSystemOperationsPage = () =>
  import("../pages/SystemOperationsPage").then((module) => ({
    default: module.SystemOperationsPage,
  }));

export const LazyAppCatalogPage = lazy(loadAppCatalogPage);
export const LazySessionMemoryPage = lazy(loadSessionMemoryPage);
export const LazyEnvProfilesPage = lazy(loadEnvProfilesPage);
export const LazyMcpManagementPage = lazy(loadMcpManagementPage);
export const LazyConfigStudioPage = lazy(loadConfigStudioPage);
export const LazyAccountControlPage = lazy(loadAccountControlPage);
export const LazyBackgroundJobsPage = lazy(loadBackgroundJobsPage);
export const LazyDaemonLogsPage = lazy(loadDaemonLogsPage);
export const LazyCliOperationsPage = lazy(loadCliOperationsPage);
export const LazySystemOperationsPage = lazy(loadSystemOperationsPage);

const SETTINGS_TAB_PRELOADERS: Partial<Record<SettingsTabId, () => Promise<unknown>>> = {
  "mcp-integrations": loadMcpManagementPage,
  "environment-profiles": loadEnvProfilesPage,
  "config-studio": loadConfigStudioPage,
  "accounts-vault": loadAccountControlPage,
  "apps-catalog": loadAppCatalogPage,
  "session-memory": loadSessionMemoryPage,
  "background-jobs": loadBackgroundJobsPage,
  "daemon-logs": loadDaemonLogsPage,
  "cli-system-advanced": async () => {
    await Promise.all([loadSystemOperationsPage(), loadCliOperationsPage()]);
  },
};

export function preloadSettingsModalLazyTab(tab: SettingsTabId): void {
  const preload = SETTINGS_TAB_PRELOADERS[tab];
  if (!preload) return;
  void preload();
}
