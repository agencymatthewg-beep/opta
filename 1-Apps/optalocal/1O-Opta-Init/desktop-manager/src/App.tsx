import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Channel,
  CommandOutcome,
  DaemonStatus,
  ManifestPayload,
  InstalledApp,
  ManifestApp,
  ManifestResponse,
} from "./types";

const EXTERNAL_LINKS = [
  { label: "Init Site", url: "https://init.optalocal.com" },
  { label: "LMX", url: "https://lmx.optalocal.com" },
  { label: "Accounts", url: "https://accounts.optalocal.com" },
  { label: "Docs", url: "https://docs.optalocal.com" },
] as const;

type AppAction = "install" | "update" | "launch";

const BROWSER_PREVIEW_MANIFEST: Record<Channel, ManifestPayload> = {
  stable: {
    channel: "stable",
    updatedAt: "preview",
    apps: [
      {
        id: "opta-cli",
        name: "Opta CLI",
        description: "Command-line interface for install/update and workflow orchestration.",
        version: "stable-preview",
        website: "https://init.optalocal.com/downloads/cli",
      },
      {
        id: "opta-lmx",
        name: "Opta LMX Runtime",
        description: "Model exchange and artifact orchestration runtime.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-code-universal",
        name: "Opta Code Universal",
        description: "Desktop coding surface for Opta operator workflows.",
        version: "stable-preview",
        website: "https://init.optalocal.com/apps/opta-code",
      },
      {
        id: "opta-daemon",
        name: "Opta Daemon Service",
        description: "Background daemon required for local runtime services.",
        version: "stable-preview",
        website: "https://docs.optalocal.com/daemon",
      },
    ],
  },
  beta: {
    channel: "beta",
    updatedAt: "preview",
    apps: [
      {
        id: "opta-cli",
        name: "Opta CLI",
        description: "Beta channel CLI with upcoming app and runtime features.",
        version: "beta-preview",
        website: "https://init.optalocal.com/downloads/cli",
      },
      {
        id: "opta-lmx",
        name: "Opta LMX Runtime",
        description: "Beta model exchange runtime for pre-release validation.",
        version: "beta-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-code-universal",
        name: "Opta Code Universal",
        description: "Preview builds of Opta Code Universal desktop.",
        version: "beta-preview",
        website: "https://init.optalocal.com/apps/opta-code",
      },
      {
        id: "opta-daemon",
        name: "Opta Daemon Service",
        description: "Pre-release daemon service package for validation rings.",
        version: "beta-preview",
        website: "https://docs.optalocal.com/daemon",
      },
    ],
  },
};

export function App() {
  const tauriAvailable =
    typeof window !== "undefined" &&
    Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const [channel, setChannel] = useState<Channel>("stable");
  const [loading, setLoading] = useState(false);
  const [manifestResp, setManifestResp] = useState<ManifestResponse | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const installedIndex = useMemo(() => {
    const map = new Map<string, InstalledApp>();
    for (const app of installedApps) {
      if (!map.has(app.id)) {
        map.set(app.id, app);
      }
    }
    return map;
  }, [installedApps]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setWarning(null);
    setNotice(null);

    if (!tauriAvailable) {
      setManifestResp({
        manifest: BROWSER_PREVIEW_MANIFEST[channel],
        source: "browser-preview",
        warning:
          "Browser preview mode: install/update/launch and daemon controls require the packaged Opta Init desktop app.",
      });
      setInstalledApps([]);
      setDaemon({
        running: false,
        message: "browser preview mode",
        rawOutput: "Tauri bridge unavailable in browser-only mode.",
        checkedAt: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      const [manifestResult, installedResult, daemonResult] = await Promise.all([
        invoke<ManifestResponse>("fetch_manifest", { channel }),
        invoke<InstalledApp[]>("list_installed_apps"),
        invoke<DaemonStatus>("daemon_status"),
      ]);

      setManifestResp(manifestResult);
      setInstalledApps(installedResult);
      setDaemon(daemonResult);
      if (manifestResult.warning) {
        setWarning(manifestResult.warning);
      }
    } catch (error) {
      setNotice(`Refresh failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [channel, tauriAvailable]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const openExternal = useCallback(async (url: string) => {
    if (!tauriAvailable) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await invoke("open_url", { url });
    } catch (error) {
      setNotice(`Could not open URL: ${String(error)}`);
    }
  }, [tauriAvailable]);

  const runAppAction = useCallback(
    async (app: ManifestApp, action: AppAction) => {
      if (!tauriAvailable) {
        setNotice("Run this inside the Opta Init desktop shell to execute install/update/launch actions.");
        return;
      }

      const key = `${action}:${app.id}`;
      setPendingKey(key);
      setNotice(null);
      try {
        const command =
          action === "install"
            ? "install_app"
            : action === "update"
              ? "update_app"
              : "launch_app";

        const payload =
          action === "launch"
            ? { appId: app.id }
            : { appId: app.id, channel };

        const outcome = await invoke<CommandOutcome>(command, payload);
        setNotice(outcome.message || `${action} complete for ${app.name}`);
        if (action !== "launch") {
          const nextInstalled = await invoke<InstalledApp[]>("list_installed_apps");
          setInstalledApps(nextInstalled);
        }
      } catch (error) {
        setNotice(`${action} failed for ${app.name}: ${String(error)}`);
      } finally {
        setPendingKey(null);
      }
    },
    [channel, tauriAvailable],
  );

  const runDaemonAction = useCallback(async (action: "start" | "stop") => {
    if (!tauriAvailable) {
      setNotice("Run this inside the Opta Init desktop shell to control daemon lifecycle.");
      return;
    }

    setPendingKey(`daemon:${action}`);
    setNotice(null);
    try {
      const command = action === "start" ? "daemon_start" : "daemon_stop";
      const outcome = await invoke<CommandOutcome>(command);
      setNotice(outcome.message);
      const status = await invoke<DaemonStatus>("daemon_status");
      setDaemon(status);
    } catch (error) {
      setNotice(`Daemon ${action} failed: ${String(error)}`);
    } finally {
      setPendingKey(null);
    }
  }, [tauriAvailable]);

  const apps = manifestResp?.manifest.apps ?? [];

  return (
    <div className="shell">
      <aside className="rail">
        <h2 className="brand">Opta Init</h2>
        <p className="brand-sub">Desktop Manager</p>
        <div className="rail-links">
          {EXTERNAL_LINKS.map((link) => (
            <button key={link.label} type="button" onClick={() => void openExternal(link.url)}>
              {link.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <div>
            <h1>App Manager</h1>
            <p>Manifest-driven install, update, launch, and daemon controls.</p>
          </div>
          <div className="controls">
            <label htmlFor="channel-select">Channel</label>
            <select
              id="channel-select"
              value={channel}
              onChange={(event) => setChannel(event.target.value as Channel)}
            >
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </select>
            <button type="button" onClick={() => void refreshData()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {notice ? <div className="notice">{notice}</div> : null}
        {warning ? <div className="notice warn">{warning}</div> : null}

        <section className="grid">
          <article className="card daemon">
            <h3>Daemon</h3>
            <p>Manage the local Opta daemon used by desktop-integrated commands.</p>
            <div className="meta">
              <span className={`pill ${daemon?.running ? "ok" : "off"}`}>
                {daemon?.running ? "running" : "stopped"}
              </span>
              <span className="pill">{daemon?.message ?? "unknown"}</span>
            </div>
            <div className="row">
              <button
                type="button"
                onClick={() => void runDaemonAction("start")}
                disabled={pendingKey !== null || !tauriAvailable}
              >
                Start daemon
              </button>
              <button
                type="button"
                onClick={() => void runDaemonAction("stop")}
                disabled={pendingKey !== null || !tauriAvailable}
              >
                Stop daemon
              </button>
              <button type="button" onClick={() => void refreshData()} disabled={loading}>
                Refresh status
              </button>
            </div>
            {daemon?.rawOutput ? <pre className="raw">{daemon.rawOutput}</pre> : null}
          </article>

          {apps.map((app) => {
            const installed = installedIndex.get(app.id);
            const runningInstall = pendingKey === `install:${app.id}`;
            const runningUpdate = pendingKey === `update:${app.id}`;
            const runningLaunch = pendingKey === `launch:${app.id}`;

            return (
              <article key={app.id} className="card">
                <h2>{app.name}</h2>
                <p>{app.description}</p>
                <div className="meta">
                  <span className="pill">id: {app.id}</span>
                  <span className="pill">manifest: {app.version}</span>
                  {installed ? (
                    <span className="pill ok">installed ({installed.source})</span>
                  ) : (
                    <span className="pill off">not installed</span>
                  )}
                </div>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => void runAppAction(app, "install")}
                    disabled={pendingKey !== null || !tauriAvailable}
                  >
                    {runningInstall ? "Installing..." : "Install"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAppAction(app, "update")}
                    disabled={pendingKey !== null || !tauriAvailable}
                  >
                    {runningUpdate ? "Updating..." : "Update"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAppAction(app, "launch")}
                    disabled={pendingKey !== null || !tauriAvailable}
                  >
                    {runningLaunch ? "Launching..." : "Launch"}
                  </button>
                  {app.website ? (
                    <button type="button" onClick={() => void openExternal(app.website as string)}>
                      Website
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
