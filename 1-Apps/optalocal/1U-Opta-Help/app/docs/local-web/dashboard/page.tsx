"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "dashboard-overview", title: "Dashboard Overview", level: 2 as const },
  { id: "vram-gauge", title: "VRAM Gauge", level: 2 as const },
  { id: "active-models", title: "Active Models", level: 2 as const },
  { id: "throughput-chart", title: "Throughput Chart", level: 2 as const },
  { id: "server-status", title: "Server Status", level: 2 as const },
  { id: "health-polling", title: "Health Polling", level: 2 as const },
];

export default function LocalWebDashboardPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Local Web", href: "/docs/local-web/" },
          { label: "Dashboard" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Dashboard</h1>
          <p className="lead">
            The Opta Local Web dashboard provides real-time visibility into
            your LMX inference server -- VRAM utilization, loaded models,
            token throughput, and server health at a glance.
          </p>

          <h2 id="dashboard-overview">Dashboard Overview</h2>
          <p>
            The dashboard is the default landing page of Opta Local Web. It
            is organized into a grid of status panels, each updating in real
            time through the SSE connection to LMX. The layout is designed to
            give you immediate situational awareness: is the server healthy,
            how much memory is available, what models are loaded, and how
            fast inference is running.
          </p>

          <h2 id="vram-gauge">VRAM Gauge</h2>
          <p>
            The VRAM gauge is a circular progress indicator that shows the
            current unified memory utilization of your Apple Silicon GPU. It
            displays:
          </p>
          <ul>
            <li><strong>Current usage</strong> -- how many GB of unified memory are allocated to loaded models</li>
            <li><strong>Total capacity</strong> -- the total unified memory pool (e.g., 192GB on a Mac Studio Ultra)</li>
            <li><strong>Percentage fill</strong> -- rendered as a circular arc with smooth animation</li>
          </ul>
          <p>
            The gauge color shifts from green to amber to red as utilization
            increases, providing instant visual feedback on memory pressure.
            When VRAM is nearly full, loading additional models risks OOM
            conditions -- the gauge helps you decide when to unload before
            loading.
          </p>

          <Callout variant="tip" title="Memory headroom">
            Keep at least 10-15% of unified memory free for system processes
            and inference scratch space. Running at 100% utilization will
            cause model loads to fail or trigger automatic unloading.
          </Callout>

          <h2 id="active-models">Active Models</h2>
          <p>
            The active models panel lists every model currently loaded into
            GPU memory. Each entry shows:
          </p>
          <ul>
            <li><strong>Model name</strong> -- the identifier used for inference requests</li>
            <li><strong>Memory footprint</strong> -- how many GB this model occupies</li>
            <li><strong>Quantization</strong> -- the quantization level (e.g., Q4_K_M, Q8_0, F16)</li>
            <li><strong>Status indicator</strong> -- whether the model is idle, actively inferring, or loading</li>
          </ul>
          <p>
            You can load and unload models directly from this panel. Loading
            a model sends a request to the LMX admin API, and the panel
            updates in real time as the model initializes and enters the
            ready state. Unloading frees the GPU memory immediately.
          </p>

          <h2 id="throughput-chart">Throughput Chart</h2>
          <p>
            The throughput panel shows a rolling history of inference speed
            measured in tokens per second. Data arrives via the SSE stream
            from <code>/admin/events</code> and is stored in a client-side
            circular buffer of 300 entries.
          </p>
          <p>
            The chart renders as a line graph showing throughput over time.
            Spikes indicate active inference requests; flat lines indicate
            idle periods. This is useful for:
          </p>
          <ul>
            <li>Verifying that inference is running at expected speeds</li>
            <li>Identifying throughput degradation under concurrent load</li>
            <li>Comparing performance between different models or quantizations</li>
          </ul>

          <CodeBlock
            language="text"
            filename="SSE Event Stream"
            code={`GET /admin/events
Accept: text/event-stream

data: {"type":"throughput","tokens_per_sec":42.3,"model":"qwen3-72b"}
data: {"type":"vram","used_gb":87.2,"total_gb":192.0}
data: {"type":"model_status","model":"qwen3-72b","state":"ready"}`}
          />

          <h2 id="server-status">Server Status</h2>
          <p>
            Status badges at the top of the dashboard indicate the health of
            each component in the stack:
          </p>
          <ul>
            <li><strong>LMX Server</strong> -- connected or disconnected, with latency</li>
            <li><strong>Active Requests</strong> -- number of concurrent inference requests</li>
            <li><strong>Uptime</strong> -- how long the LMX server has been running</li>
          </ul>
          <p>
            Each badge is color-coded: green for healthy, amber for degraded,
            and red for offline. The badges update every heartbeat cycle.
          </p>

          <h2 id="health-polling">Health Polling</h2>
          <p>
            In addition to the SSE event stream, the dashboard runs a
            periodic heartbeat check against the LMX health endpoint. This
            independent polling mechanism ensures the dashboard can detect
            when the SSE connection silently drops (e.g., due to network
            interruption) and display an accurate offline state.
          </p>
          <p>
            The heartbeat interval is configurable but defaults to 10 seconds.
            If three consecutive heartbeats fail, the dashboard transitions
            to a disconnected state and displays a reconnection indicator.
          </p>

          <Callout variant="info" title="Automatic reconnection">
            When the SSE connection drops, the dashboard automatically
            attempts to reconnect with exponential backoff. Once the LMX
            server becomes reachable again, the dashboard restores live
            updates without requiring a page refresh.
          </Callout>

          <PrevNextNav
            prev={{ title: "Overview", href: "/docs/local-web/" }}
            next={{ title: "Chat", href: "/docs/local-web/chat/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
