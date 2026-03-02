import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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

// App Logo mapping (Strictly Opta Local Logos only, pure SVGs)
const LOGOS: Record<string, string> = {
  "opta-lmx": "/logos/opta-lmx-mark.svg",
  "opta-cli": "/logos/opta-cli-mark.svg",
  "opta-code-universal": "/logos/opta-code-mark.svg",
  "opta-local": "/logos/opta-local-mark.svg",
  "opta-accounts": "/logos/opta-accounts-mark.svg",
  "opta-status": "/logos/opta-status-mark.svg",
  "opta-learn": "/logos/opta-learn-mark.svg",
  "opta-help": "/logos/opta-help-mark.svg",
  "opta-daemon": "/logos/opta-status-mark.svg", // Using status logo for daemon
  "default": "/logos/opta-local-mark.svg",
};

const BROWSER_PREVIEW_MANIFEST: Record<Channel, ManifestPayload> = {
  stable: {
    channel: "stable",
    updatedAt: "preview",
    apps: [
      {
        id: "opta-cli",
        name: "Opta CLI",
        description: "Command-line interface for local orchestration, model downloading, and stack management.",
        version: "stable-preview",
        website: "https://init.optalocal.com/downloads/cli",
      },
      {
        id: "opta-lmx",
        name: "Opta LMX",
        description: "The core local inference engine. Manage your models, endpoints, and local API traffic.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-code-universal",
        name: "Opta Code",
        description: "Desktop IDE surface powered by your local LMX endpoints.",
        version: "stable-preview",
        website: "https://init.optalocal.com/apps/opta-code",
      },
      {
        id: "opta-local",
        name: "Opta Local",
        description: "Web management dashboard for the Opta ecosystem.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-accounts",
        name: "Opta Accounts",
        description: "Manage your local identity, sync preferences, and cloud backups.",
        version: "stable-preview",
        website: "https://accounts.optalocal.com",
      },
      {
        id: "opta-status",
        name: "Opta Status",
        description: "System health monitoring and service status.",
        version: "stable-preview",
        website: "https://status.optalocal.com",
      },
      {
        id: "opta-learn",
        name: "Opta Learn",
        description: "Discovery and guide portal.",
        version: "stable-preview",
        website: "https://learn.optalocal.com",
      },
      {
        id: "opta-help",
        name: "Opta Help",
        description: "Technical reference documentation.",
        version: "stable-preview",
        website: "https://help.optalocal.com",
      },
      {
        id: "opta-daemon",
        name: "Opta Daemon",
        description: "Background daemon service required for continuous local runtime orchestration.",
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

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      const parent = c.parentElement;
      if (parent) {
        c.width = parent.clientWidth;
        c.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const cx = c.width / 2; 
    const cy = c.height / 2;

    const particles: any[] = [];
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        size: Math.random() * 2,
        speedY: -(Math.random() * 0.3 + 0.05),
        speedX: (Math.random() - 0.5) * 0.2
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400);
      glow.addColorStop(0, "rgba(168,85,247,0.12)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, c.width, c.height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < 0) p.y = c.height;
        if (p.x < 0) p.x = c.width;
        if (p.x > c.width) p.x = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,85,247,0.4)`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="void-canvas" />;
}

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

  const runAppAction = useCallback(async (app: ManifestApp, action: "install" | "update" | "launch" | "verify" | "open_folder") => {
    if (!tauriAvailable) return;
    if (action === "verify" || action === "open_folder") {
      console.log(`Action ${action} requested for ${app.name}`);
      // In the future, map these to real Tauri commands like invoke("verify_app")
      return;
    }
    
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
  }, [channel, tauriAvailable]);

  useEffect(() => {
    if (!hoveredApp || pendingKey !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isInstalled = installedIndex.has(hoveredApp.id);
      
      if (key === 'u' && isInstalled) {
        void runAppAction(hoveredApp, "update");
      } else if (key === 'l' && isInstalled) {
        void runAppAction(hoveredApp, "launch");
      } else if (key === 'd' && !isInstalled) {
        void runAppAction(hoveredApp, "install");
      } else if (key === 'v') {
        void runAppAction(hoveredApp, "verify");
      } else if (key === 'f') {
        void runAppAction(hoveredApp, "open_folder");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredApp, installedIndex, pendingKey, runAppAction]);

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
  
  // Extract top apps
  const topLocal = apps.find(a => a.id === "opta-local");
  const topDaemon = apps.find(a => a.id === "opta-daemon");

  // Extract core apps
  const coreCli = apps.find(a => a.id === "opta-cli");
  const coreLmx = apps.find(a => a.id === "opta-lmx");
  const coreCode = apps.find(a => a.id === "opta-code-universal");
  
  // Extract bottom apps
  const bottomApps = apps.filter(a => !["opta-local", "opta-daemon", "opta-cli", "opta-lmx", "opta-code-universal"].includes(a.id));

  const displayApp = hoveredApp;
  const isInstalled = displayApp ? installedIndex.has(displayApp.id) : false;
  const isPending = displayApp ? pendingKey?.includes(displayApp.id) : false;

  // Floating animation delays
  const getFloatingClass = (index: number) => `floating-${(index % 5) + 1}`;

  const renderAppNode = (app: ManifestApp, customClass: string = "", animIndex: number) => {
    if (!app) return null;
    const logoPath = LOGOS[app.id] || LOGOS["default"];
    const isAppInstalled = installedIndex.has(app.id);
    const isDaemon = app.id === "opta-daemon";
    const isActive = isDaemon ? daemon?.running : isAppInstalled;
    
    return (
      <div 
        key={app.id} 
        className={`app-item ${customClass} ${getFloatingClass(animIndex)}`} 
        onMouseEnter={() => setHoveredApp(app)}
        onMouseLeave={() => setHoveredApp(null)}
      >
        <div className="tooltip">
          <div className="tooltip-title">{app.name}</div>
          {hoveredApp?.id === app.id && app.id !== "opta-daemon" && (
            <div className="tooltip-shortcuts">
              {isAppInstalled ? (
                <>
                  <span><kbd>L</kbd> Launch</span>
                  <span><kbd>U</kbd> Update</span>
                  <span><kbd>V</kbd> Verify</span>
                  <span><kbd>F</kbd> Folder</span>
                </>
              ) : (
                <span><kbd>D</kbd> Download</span>
              )}
            </div>
          )}
        </div>
        <div className="purple-circle"></div>
        <img 
          src={logoPath} 
          className="app-logo" 
          alt={app.name} 
          onError={(e) => { 
            if (e.currentTarget.src !== LOGOS["default"]) {
              e.currentTarget.src = LOGOS["default"]; 
            }
          }} 
        />
        {isActive && <div className="app-status-pip active"></div>}
      </div>
    );
  };

  return (
    <div className="window-app">
      <ParticleBackground />

      <div className="header">
        <div className="sidebar-text">INIT MANAGER</div>
        <h1 className="main-title">{displayApp ? displayApp.name : "Select Environment"}</h1>
        {displayApp && (
          <p className="app-desc-text fade-in">{displayApp.description}</p>
        )}
      </div>
      
      <div className="cluster-container">
        {/* TOP ROW: Local & Daemon */}
        <div className="top-row">
          {topLocal && renderAppNode(topLocal, "top-item", 3)}
          {topDaemon && renderAppNode(topDaemon, "top-item", 4)}
        </div>

        {/* CORE ROW: CLI - LMX - CODE */}
        <div className="core-row">
          {coreCli && renderAppNode(coreCli, "", 0)}
          {coreLmx && renderAppNode(coreLmx, "lmx-item", 1)}
          {coreCode && renderAppNode(coreCode, "", 2)}
        </div>
        
        {/* BOTTOM ROW */}
        <div className="bottom-row">
          {bottomApps.map((app, i) => {
            const isMiddle = bottomApps.length === 4 && (i === 1 || i === 2);
            return renderAppNode(app, `support-item ${isMiddle ? 'bottom-middle-item' : ''}`, i + 5);
          })}
        </div>
      </div>

      <div className="bottom-panel">
        <div className="status-badge" onClick={() => runDaemonAction(daemon?.running ? "stop" : "start")} style={{cursor: 'pointer'}}>
          <div className={`status-dot ${daemon?.running ? 'active' : ''}`}></div>
          {daemon?.running ? 'Daemon Active' : 'Daemon Stopped'}
          {pendingKey?.includes('daemon') && " (Working...)"}
        </div>
        
        <div className="action-buttons">
          {displayApp ? (
            <div className="fade-in">
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
          ) : (
            <div className="fade-in">
              <button className="btn primary" onClick={() => void refreshData()} disabled={pendingKey !== null}>
                Refresh Stack
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
