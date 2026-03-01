"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "what-is-opta-local-web", title: "What is Opta Local Web?", level: 2 as const },
  { id: "thin-client-architecture", title: "Thin Client Architecture", level: 2 as const },
  { id: "dual-mode-access", title: "Dual-Mode Access", level: 2 as const },
  { id: "lan-mode", title: "LAN Mode", level: 3 as const },
  { id: "wan-mode", title: "WAN Mode", level: 3 as const },
  { id: "premium-glass-ui", title: "Premium Glass UI", level: 2 as const },
  { id: "real-time-monitoring", title: "Real-Time Monitoring", level: 2 as const },
  { id: "getting-started", title: "Getting Started", level: 2 as const },
];

export default function LocalWebOverviewPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Local Web" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Opta Local Web</h1>
          <p className="lead">
            Opta Local Web is a browser-based React dashboard that provides
            real-time monitoring, model management, and a streaming chat
            interface for your Opta LMX inference server.
          </p>

          <h2 id="what-is-opta-local-web">What is Opta Local Web?</h2>
          <p>
            Opta Local Web is the visual companion to the Opta CLI. While the
            CLI gives you terminal-native access to the Opta stack, the web
            dashboard offers the same capabilities through a modern browser
            interface. It connects directly to your LMX inference server as a
            thin client -- there is no intermediate backend or server-side
            rendering layer between the dashboard and your hardware.
          </p>
          <p>
            The dashboard is designed for monitoring and interactive use. You
            can watch VRAM utilization in real time, see which models are
            loaded, track inference throughput, and start chat sessions -- all
            from any browser on your network.
          </p>

          <h2 id="thin-client-architecture">Thin Client Architecture</h2>
          <p>
            Unlike traditional web applications that require a backend server
            to process requests, Opta Local Web communicates directly with the
            LMX API from the browser. The React app is served as static files
            (from a Next.js dev server or a static export) and makes
            client-side HTTP and SSE requests to the LMX endpoints.
          </p>

          <CodeBlock
            language="text"
            filename="Connection Architecture"
            code={`Browser (Opta Local Web)
    |
    |  HTTP requests to /v1/chat/completions
    |  SSE connection to /admin/events
    v
Opta LMX  192.168.188.11:1234
    |
    |  MLX inference on Apple Silicon
    v
Loaded Models (GPU memory)`}
          />

          <p>
            This architecture means zero additional infrastructure. The web
            dashboard adds no server processes, no databases, and no state
            management layers. It reads directly from the same API that the
            CLI daemon consumes.
          </p>

          <h2 id="dual-mode-access">Dual-Mode Access</h2>
          <p>
            Opta Local Web operates in two distinct modes depending on how
            you access it.
          </p>

          <h3 id="lan-mode">LAN Mode</h3>
          <p>
            When accessed from a device on your local network, the dashboard
            connects directly to LMX by IP address. No authentication is
            required -- LAN access is trusted by default. This is the
            recommended mode for development workstations on the same
            network as your inference server.
          </p>

          <h3 id="wan-mode">WAN Mode</h3>
          <p>
            For remote access outside your LAN, the dashboard can be served
            through a Cloudflare Tunnel. In this mode, Supabase authentication
            is enforced -- users must sign in before they can interact with
            the dashboard. This lets you access your local stack from a
            phone, a laptop at a coffee shop, or any remote device with a
            browser.
          </p>

          <Callout variant="info" title="Authentication is context-dependent">
            The dashboard detects its access mode automatically. On LAN, auth
            controls are hidden and all endpoints are open. Through the
            Cloudflare Tunnel, the sign-in page appears and a valid Supabase
            session is required for all operations.
          </Callout>

          <h2 id="premium-glass-ui">Premium Glass UI</h2>
          <p>
            The interface follows the Opta design system: an OLED-optimized
            dark theme with obsidian glass panels, violet accent colors, and
            the Sora typeface. Interactive elements use the{" "}
            <code>.glass-subtle</code> and <code>.glass-strong</code> CSS
            classes for layered translucency effects. All colors are defined
            through CSS custom properties, and animations use Framer Motion
            spring physics.
          </p>

          <h2 id="real-time-monitoring">Real-Time Monitoring</h2>
          <p>
            The dashboard maintains a persistent SSE (Server-Sent Events)
            connection to the LMX <code>/admin/events</code> endpoint. This
            provides continuous updates for:
          </p>
          <ul>
            <li>VRAM utilization (current and peak usage)</li>
            <li>Active model list with memory footprint per model</li>
            <li>Token throughput (tokens per second, rolling history)</li>
            <li>Server health status with heartbeat monitoring</li>
            <li>Active inference request count</li>
          </ul>
          <p>
            Data is buffered in a 300-entry circular buffer on the client side,
            giving you a scrollable history of throughput and utilization without
            any server-side persistence.
          </p>

          <h2 id="getting-started">Getting Started</h2>
          <p>
            To run the Opta Local Web dashboard locally:
          </p>

          <CodeBlock
            language="bash"
            filename="Terminal"
            code={`cd optalocal/1L-Opta-Local/web
npm install
npm run dev    # starts on http://localhost:3004`}
          />

          <p>
            Ensure your LMX server is running on the expected address
            (default: <code>192.168.188.11:1234</code>). The dashboard will
            connect automatically and begin streaming status data.
          </p>

          <PrevNextNav
            prev={{ title: "Monitoring", href: "/docs/lmx/monitoring/" }}
            next={{ title: "Dashboard", href: "/docs/local-web/dashboard/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
