import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Channel,
  DaemonStatus,
  ManifestPayload,
  InstalledApp,
  ManifestApp,
  ManifestResponse,
} from "./types";
import "./app.css";

// App Logo mapping
const LOGOS: Record<string, string> = {
  "opta-lmx": "/logos/opta-lmx-logo-final.png",
  "opta-cli": "/logos/opta-cli-logo-final.png",
  "opta-code-universal": "/logos/opta-code-logo-final.png",
  "opta-daemon": "/logos/opta-status-logo-final.png", // Using status logo for daemon for now
  "default": "/logos/opta-logo.png",
};

const BROWSER_PREVIEW_MANIFEST: Record<Channel, ManifestPayload> = {
  stable: {
    channel: "stable",
    updatedAt: "preview",
    apps: [
      {
        id: "opta-lmx",
        name: "Opta LMX",
        description: "Model exchange and artifact orchestration runtime.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-cli",
        name: "Opta CLI",
        description: "Command-line interface for orchestration.",
        version: "stable-preview",
        website: "https://init.optalocal.com/downloads/cli",
      },
      {
        id: "opta-code-universal",
        name: "Opta Code",
        description: "Desktop coding surface for Opta operators.",
        version: "stable-preview",
        website: "https://init.optalocal.com/apps/opta-code",
      },
      {
        id: "opta-daemon",
        name: "Opta Daemon",
        description: "Background daemon for local runtime services.",
        version: "stable-preview",
        website: "https://docs.optalocal.com/daemon",
      },
    ],
  },
  beta: {
    channel: "beta",
    updatedAt: "preview",
    apps: [],
  },
};

// Calculate coordinates for N apps on an ellipse/circle
const calculateOrbitPositions = (count: number) => {
  const positions = [];
  for (let i = 0; i < count; i++) {
    // Start at top (270 degrees)
    const angle = (i * (360 / count) - 90) * (Math.PI / 180);
    // Orbit size (radius)
    const rx = 240; 
    const ry = 240;
    
    // We use percentages for absolute positioning
    const x = 50 + (Math.cos(angle) * rx) / 5; // scaled for CSS %
    const y = 50 + (Math.sin(angle) * ry) / 5; // scaled for CSS %
    
    positions.push({ left: `${x}%`, top: `${y}%` });
  }
  return positions;
};

export function App() {
  const tauriAvailable =
    typeof window !== "undefined" &&
    Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const [channel] = useState<Channel>("stable");
  const [manifestResp, setManifestResp] = useState<ManifestResponse | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  
  const [hoveredApp, setHoveredApp] = useState<ManifestApp | null>(null);

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
    if (!tauriAvailable) {
      setManifestResp({
        manifest: BROWSER_PREVIEW_MANIFEST[channel],
        source: "browser-preview",
      });
      setInstalledApps([]);
      setDaemon({ running: false, message: "browser mode", rawOutput: "", checkedAt: "" });
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
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  }, [channel, tauriAvailable]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const runAppAction = async (app: ManifestApp, action: "install" | "update" | "launch") => {
    if (!tauriAvailable) return;
    setPendingKey(`${action}:${app.id}`);
    try {
      const command = action === "install" ? "install_app" : action === "update" ? "update_app" : "launch_app";
      await invoke(command, action === "launch" ? { appId: app.id } : { appId: app.id, channel });
      if (action !== "launch") {
        setInstalledApps(await invoke<InstalledApp[]>("list_installed_apps"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPendingKey(null);
    }
  };

  const runDaemonAction = async (action: "start" | "stop") => {
    if (!tauriAvailable) return;
    setPendingKey(`daemon:${action}`);
    try {
      await invoke(action === "start" ? "daemon_start" : "daemon_stop");
      setDaemon(await invoke<DaemonStatus>("daemon_status"));
    } catch (e) {
      console.error(e);
    } finally {
      setPendingKey(null);
    }
  };

  const apps = manifestResp?.manifest.apps ?? [];
  const positions = calculateOrbitPositions(apps.length);

  // Fallback to central generic view if no app is hovered
  const displayApp = hoveredApp;
  const isInstalled = displayApp ? installedIndex.has(displayApp.id) : false;
  const isPending = displayApp ? pendingKey?.includes(displayApp.id) : false;

  return (
    <div className="window-app">
      <div className="header">
        <div className="logo-text">INIT<span>MANAGER</span></div>
        <div className="status-badge" onClick={() => runDaemonAction(daemon?.running ? "stop" : "start")} style={{cursor: 'pointer'}}>
          <div className={`status-dot ${daemon?.running ? 'active' : ''}`}></div>
          {daemon?.running ? 'Daemon Active' : 'Daemon Stopped'}
          {pendingKey?.includes('daemon') && " (Working...)"}
        </div>
      </div>
      
      <div className="orbit-container">
        <div className="orbit-line"></div>
        
        {/* Central Information Hub */}
        <div className="center-info">
          {displayApp ? (
            <div className="fade-in">
              <h2 className="app-title">{displayApp.name}</h2>
              <p className="app-desc">{displayApp.description}</p>
              
              <div className="action-buttons">
                {displayApp.id === "opta-daemon" ? (
                  <button 
                    className="btn primary" 
                    disabled={pendingKey !== null}
                    onClick={() => runDaemonAction(daemon?.running ? "stop" : "start")}
                  >
                    {pendingKey?.includes('daemon') ? "Processing..." : (daemon?.running ? "Stop Daemon" : "Start Daemon")}
                  </button>
                ) : isInstalled ? (
                  <>
                    <button className="btn primary" disabled={pendingKey !== null} onClick={() => runAppAction(displayApp, "launch")}>
                      {isPending ? "Working..." : "Launch App"}
                    </button>
                    <button className="btn secondary" disabled={pendingKey !== null} onClick={() => runAppAction(displayApp, "update")}>
                      Update
                    </button>
                  </>
                ) : (
                  <button className="btn primary" disabled={pendingKey !== null} onClick={() => runAppAction(displayApp, "install")}>
                    {isPending ? "Installing..." : "Install App"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="fade-in">
              <h2 className="app-title default-title">Opta Local Stack</h2>
              <p className="app-desc">Hover over an application in the orbit ring to manage or launch it.</p>
            </div>
          )}
        </div>

        {/* Orbiting App Nodes */}
        {apps.map((app, i) => {
          const pos = positions[i] || { left: '50%', top: '50%' };
          const logoPath = LOGOS[app.id] || LOGOS["default"];
          
          return (
            <div 
              key={app.id} 
              className="app-node" 
              style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
              onMouseEnter={() => setHoveredApp(app)}
              onMouseLeave={() => setHoveredApp(null)}
            >
              <div className="purple-circle"></div>
              {/* Note: since logos have black backgrounds, they will blend perfectly into the void background of this app */}
              <img src={logoPath} className="app-logo" alt={app.name} onError={(e) => { e.currentTarget.src = LOGOS["default"]; }} />
              
              {/* Status indicator pip */}
              {app.id === "opta-daemon" ? (
                <div className={`app-status-pip ${daemon?.running ? 'active' : ''}`}></div>
              ) : (
                installedIndex.has(app.id) && <div className="app-status-pip active"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
