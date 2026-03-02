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

// App Logo mapping (Strictly Opta Local Logos only)
const LOGOS: Record<string, string> = {
  "opta-lmx": "/logos/opta-lmx-logo-final.png",
  "opta-cli": "/logos/opta-cli-logo-final.png",
  "opta-code-universal": "/logos/opta-code-logo-final.png",
  "opta-daemon": "/logos/opta-status-logo-final.png", 
  "default": "/logos/opta-local-logo-final.png", // Fallback to Local dashboard logo
};

const BROWSER_PREVIEW_MANIFEST: Record<Channel, ManifestPayload> = {
  stable: {
    channel: "stable",
    updatedAt: "preview",
    apps: [
      {
        id: "opta-lmx",
        name: "Opta LMX",
        description: "The core local inference engine. Manage your models, endpoints, and local API traffic.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-cli",
        name: "Opta CLI",
        description: "Command-line interface for local orchestration, model downloading, and stack management.",
        version: "stable-preview",
        website: "https://init.optalocal.com/downloads/cli",
      },
      {
        id: "opta-code-universal",
        name: "Opta Code",
        description: "Desktop IDE surface powered by your local LMX endpoints.",
        version: "stable-preview",
        website: "https://init.optalocal.com/apps/opta-code",
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

// Calculate fixed arc positions along the left side
const calculateArcPositions = (count: number) => {
  const positions = [];
  // For 4 items, position them nicely along a curve.
  const spread = 80; // percentage height spread
  const startY = 10; 
  
  for (let i = 0; i < count; i++) {
    const progress = count > 1 ? i / (count - 1) : 0.5; // 0 to 1
    
    // y goes from 10% to 90%
    const y = startY + progress * spread;
    
    // x curves outward in the middle. Max X at progress = 0.5
    // Parabola equation: x = a * (progress - 0.5)^2 + k
    // Let max x (k) be 80px, and at progress 0/1 x = 0px
    // 0 = a * (0.5)^2 + 80 -> a = -80 / 0.25 = -320
    const x = -320 * Math.pow(progress - 0.5, 2) + 80;

    positions.push({ left: `${x}px`, top: `${y}%` });
  }
  return positions;
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
      // The canvas sits inside a flex container, so we read its parent dimensions or use absolute inset
      const parent = c.parentElement;
      if (parent) {
        c.width = parent.clientWidth;
        c.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const cx = c.width * 0.35; // Focus point on the left where the arc is
    const cy = c.height / 2;

    const particles: any[] = [];
    const N = 150;
    for (let i = 0; i < N; i++) {
      const angle = Math.random() * Math.PI * 2;
      const t = Math.pow(Math.random(), 2.2);
      const r = 30 + t * 400; 
      const distFactor = 1 - (r / 500);
      const violet = Math.random() > 0.35;
      particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: (0.4 + Math.random() * 1.6) * (0.4 + Math.max(0, distFactor) * 0.8),
        alpha: (0.06 + Math.random() * 0.25) * (0.3 + Math.max(0, distFactor) * 0.9),
        violet,
        speed: (Math.random() * 0.2 + 0.05) * (Math.random() > 0.5 ? 1 : -1)
      });
    }

    const sparks: any[] = [];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const t = Math.pow(Math.random(), 3.0);
      const r = 55 + t * 200;
      const nearness = 1 - (r / 300);
      sparks.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: (0.6 + Math.random() * 1.0) * (0.5 + Math.max(0, nearness)),
        alpha: (0.4 + Math.random() * 0.6) * (0.4 + Math.max(0, nearness) * 0.7),
        violet: Math.random() > 0.25,
        speed: (Math.random() * 0.5 + 0.1) * (Math.random() > 0.5 ? 1 : -1)
      });
    }

    let time = 0;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      time += 0.01;

      // Glow behind the arc
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 250);
      core.addColorStop(0, "rgba(168,85,247,0.08)");
      core.addColorStop(0.4, "rgba(168,85,247,0.04)");
      core.addColorStop(1, "rgba(168,85,247,0.00)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, c.width, c.height);

      particles.forEach((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const angle = Math.atan2(dy, dx) + p.speed * 0.01;
        const dist = Math.sqrt(dx * dx + dy * dy);

        p.x = cx + Math.cos(angle) * dist;
        p.y = cy + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.violet
          ? `rgba(168,85,247,${p.alpha})`
          : `rgba(250,250,250,${p.alpha * 0.6})`;
        ctx.fill();
      });

      sparks.forEach((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const angle = Math.atan2(dy, dx) + p.speed * 0.015;
        const dist = Math.sqrt(dx * dx + dy * dy);

        p.x = cx + Math.cos(angle) * dist;
        p.y = cy + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.violet
          ? `rgba(192,132,252,${p.alpha})`
          : `rgba(255,255,255,${p.alpha * 0.7})`;
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
  const positions = calculateArcPositions(apps.length);

  const displayApp = hoveredApp;
  const isInstalled = displayApp ? installedIndex.has(displayApp.id) : false;
  const isPending = displayApp ? pendingKey?.includes(displayApp.id) : false;

  return (
    <div className="window-app">
      <ParticleBackground />

      <div className="sidebar">
        <div className="sidebar-logo"></div>
        <div className="sidebar-text">OPTA INIT</div>
      </div>
      
      <div className="arc-container">
        {apps.map((app, i) => {
          const pos = positions[i] || { left: '0px', top: '50%' };
          const logoPath = LOGOS[app.id] || LOGOS["default"];
          const isAppInstalled = installedIndex.has(app.id);
          const isDaemon = app.id === "opta-daemon";
          const isActive = isDaemon ? daemon?.running : isAppInstalled;
          
          return (
            <div 
              key={app.id} 
              className="app-item" 
              style={{ left: pos.left, top: pos.top }}
              onMouseEnter={() => setHoveredApp(app)}
              onMouseLeave={() => setHoveredApp(null)}
            >
              <div className="purple-circle"></div>
              <img src={logoPath} className="app-logo" alt={app.name} onError={(e) => { e.currentTarget.src = LOGOS["default"]; }} />
              
              {isActive && <div className="app-status-pip active"></div>}
            </div>
          );
        })}
      </div>

      <div className="main-area">
        <div className="info-panel">
          <div className="status-badge" onClick={() => runDaemonAction(daemon?.running ? "stop" : "start")} style={{cursor: 'pointer'}}>
            <div className={`status-dot ${daemon?.running ? 'active' : ''}`}></div>
            {daemon?.running ? 'Daemon Active' : 'Daemon Stopped'}
            {pendingKey?.includes('daemon') && " (Working...)"}
          </div>
          
          <div className="info-content">
            {displayApp ? (
              <div className="fade-in">
                <h1 className="app-title">{displayApp.name}</h1>
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
                <h1 className="app-title default-title">Opta Stack</h1>
                <p className="app-desc">Hover over the orbital arc to interact with your installed tools and runtimes.</p>
                <div className="action-buttons">
                  <button className="btn primary" onClick={() => void refreshData()} disabled={pendingKey !== null}>
                    Refresh Stack
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
