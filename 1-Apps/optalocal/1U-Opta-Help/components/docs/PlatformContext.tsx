"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type OptaPlatform = "macos" | "windows";
export type OptaCliProfile = "latest" | "v1_0";

interface PlatformContextValue {
  platform: OptaPlatform;
  setPlatform: (next: OptaPlatform) => void;
  installedCliVersion: string;
  cliProfile: OptaCliProfile;
  setInstalledCliVersion: (next: string) => void;
}

const STORAGE_KEY = "opta-help-platform";
const CLI_VERSION_STORAGE_KEY = "opta-help-cli-version";
const QUERY_PARAM_KEY = "platform";
const CLI_VERSION_QUERY_PARAM_KEY = "cli-version";
const DEFAULT_CLI_VERSION = "1.1.0";

const PlatformContext = createContext<PlatformContextValue | null>(null);

function detectPlatform(): OptaPlatform {
  if (typeof navigator === "undefined") return "macos";
  const ua = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (ua.includes("win")) return "windows";
  return "macos";
}

function isOptaPlatform(value: string | null): value is OptaPlatform {
  return value === "macos" || value === "windows";
}

function normalizeCliVersion(value: string | null | undefined): string {
  if (!value) return DEFAULT_CLI_VERSION;
  const next = value.trim();
  return next.length > 0 ? next : DEFAULT_CLI_VERSION;
}

function resolveCliProfile(version: string): OptaCliProfile {
  const normalized = normalizeCliVersion(version);
  return normalized.startsWith("1.0") ? "v1_0" : "latest";
}

function getPlatformFromQueryString(): OptaPlatform | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(QUERY_PARAM_KEY);
  return isOptaPlatform(value) ? value : null;
}

function getCliVersionFromQueryString(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(CLI_VERSION_QUERY_PARAM_KEY);
  return value ? normalizeCliVersion(value) : null;
}

function writePreferencesToQueryString(platform: OptaPlatform, cliVersion: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(QUERY_PARAM_KEY, platform);
  url.searchParams.set(CLI_VERSION_QUERY_PARAM_KEY, normalizeCliVersion(cliVersion));
  window.history.replaceState({}, "", url.toString());
}

export function PlatformPreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [platform, setPlatform] = useState<OptaPlatform>("macos");
  const [installedCliVersion, setInstalledCliVersion] = useState<string>(DEFAULT_CLI_VERSION);

  useEffect(() => {
    const queryPlatform = getPlatformFromQueryString();
    const queryCliVersion = getCliVersionFromQueryString();
    const storedPlatform = window.localStorage.getItem(STORAGE_KEY);
    const storedCliVersion = normalizeCliVersion(window.localStorage.getItem(CLI_VERSION_STORAGE_KEY));

    const resolvedPlatform = queryPlatform ?? (isOptaPlatform(storedPlatform) ? storedPlatform : detectPlatform());
    const resolvedCliVersion = normalizeCliVersion(queryCliVersion ?? storedCliVersion);

    setPlatform(resolvedPlatform);
    setInstalledCliVersion(resolvedCliVersion);
    window.localStorage.setItem(STORAGE_KEY, resolvedPlatform);
    window.localStorage.setItem(CLI_VERSION_STORAGE_KEY, resolvedCliVersion);
    writePreferencesToQueryString(resolvedPlatform, resolvedCliVersion);
  }, []);

  const cliProfile = useMemo<OptaCliProfile>(
    () => resolveCliProfile(installedCliVersion),
    [installedCliVersion],
  );

  const value = useMemo<PlatformContextValue>(
    () => ({
      platform,
      setPlatform: (next) => {
        setPlatform(next);
        window.localStorage.setItem(STORAGE_KEY, next);
        writePreferencesToQueryString(next, installedCliVersion);
      },
      installedCliVersion,
      cliProfile,
      setInstalledCliVersion: (next) => {
        const normalized = normalizeCliVersion(next);
        setInstalledCliVersion(normalized);
        window.localStorage.setItem(CLI_VERSION_STORAGE_KEY, normalized);
        writePreferencesToQueryString(platform, normalized);
      },
    }),
    [cliProfile, installedCliVersion, platform],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatformPreference() {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error("usePlatformPreference must be used within PlatformPreferenceProvider");
  }
  return context;
}

export function useOptionalPlatformPreference() {
  return useContext(PlatformContext);
}
