"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { ApiEndpoint } from "@/components/docs/ApiEndpoint";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "health-probes", title: "Health Probes", level: 2 as const },
  { id: "liveness", title: "Liveness (/healthz)", level: 3 as const },
  { id: "readiness", title: "Readiness (/readyz)", level: 3 as const },
  { id: "real-time-metrics", title: "Real-Time Metrics", level: 2 as const },
  { id: "sse-event-types", title: "SSE Event Types", level: 3 as const },
  { id: "memory-monitoring", title: "Memory Monitoring", level: 2 as const },
  { id: "vram-usage", title: "VRAM Usage", level: 3 as const },
  { id: "oom-alerts", title: "OOM Alerts", level: 3 as const },
  { id: "error-codes", title: "Error Codes", level: 2 as const },
  { id: "log-files", title: "Log Files", level: 2 as const },
  { id: "performance-benchmarks", title: "Performance Benchmarks", level: 2 as const },
  { id: "throughput-targets", title: "Throughput Targets", level: 3 as const },
  { id: "monitoring-from-local-web", title: "Monitoring from Local Web", level: 2 as const },
];

export default function LmxMonitoringPage() {
  const { prev, next } = getPrevNext("/docs/lmx/monitoring/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "LMX", href: "/docs/lmx/" },
          { label: "Monitoring" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Monitoring</h1>
          <p className="lead">
            LMX provides health probes, a real-time metrics stream, and detailed error reporting to
            help you monitor inference performance and diagnose issues.
          </p>

          <h2 id="health-probes">Health Probes</h2>
          <p>
            LMX exposes two health endpoints following the Kubernetes probe pattern. These are useful
            for monitoring tools, load balancers, and the Opta daemon&apos;s preflight check.
          </p>

          <h3 id="liveness">Liveness (/healthz)</h3>
          <ApiEndpoint
            method="GET"
            path="/healthz"
            description="Returns 200 if the LMX process is running and the HTTP server is accepting connections. Does not check whether a model is loaded."
            response={`{"status":"ok"}`}
          />
          <p>
            Use this endpoint for basic process monitoring. If <code>/healthz</code> returns an error
            or times out, the LMX process has crashed and needs to be restarted.
          </p>
          <CommandBlock
            command="curl -f http://192.168.188.11:1234/healthz && echo 'LMX alive' || echo 'LMX down'"
            description="Quick health check script"
          />

          <h3 id="readiness">Readiness (/readyz)</h3>
          <ApiEndpoint
            method="GET"
            path="/readyz"
            description="Returns 200 only if a model is loaded and the server is ready to handle inference requests. Returns 503 if no model is loaded."
          />
          <TabGroup
            tabs={[
              {
                label: "Ready (200)",
                content: (
                  <CodeBlock
                    language="json"
                    code={`{
  "ready": true,
  "model": "qwen3-30b-a3b",
  "vram_gb": 18.4
}`}
                  />
                ),
              },
              {
                label: "Not Ready (503)",
                content: (
                  <CodeBlock
                    language="json"
                    code={`{
  "ready": false,
  "error": "no-model-loaded"
}`}
                  />
                ),
              },
            ]}
          />
          <Callout variant="tip" title="Daemon preflight">
            The Opta daemon calls <code>/readyz</code> before every inference request. The result is
            cached for 10 seconds to reduce overhead. If <code>/readyz</code> returns 503, the daemon
            reports an <code>LMX_UNREACHABLE</code> error to the client.
          </Callout>

          <h2 id="real-time-metrics">Real-Time Metrics</h2>
          <ApiEndpoint
            method="GET"
            path="/admin/events"
            description="Server-Sent Events stream of real-time metrics. The stream emits throughput, memory, and heartbeat events continuously. Connect to this endpoint for live monitoring dashboards."
          />
          <p>
            Connect with any SSE client to receive metrics in real time:
          </p>
          <CommandBlock
            command="curl -N http://192.168.188.11:1234/admin/events"
            description="Stream metrics (press Ctrl+C to stop)"
          />

          <h3 id="sse-event-types">SSE Event Types</h3>
          <TabGroup
            tabs={[
              {
                label: "throughput",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Emitted during active inference. Reports tokens per second and active request
                      count.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "type": "throughput",
  "tokens_per_second": 45.2,
  "active_requests": 1,
  "model": "qwen3-30b-a3b"
}`}
                    />
                  </div>
                ),
              },
              {
                label: "memory",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Periodic memory status report. Includes VRAM used, total available, and
                      percentage.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "type": "memory",
  "vram_used_gb": 18.4,
  "vram_total_gb": 192.0,
  "pct": 9.6
}`}
                    />
                  </div>
                ),
              },
              {
                label: "heartbeat",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Periodic keepalive. Includes server uptime in seconds. Useful for detecting
                      stale connections.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "type": "heartbeat",
  "uptime": 86400
}`}
                    />
                  </div>
                ),
              },
              {
                label: "model_event",
                content: (
                  <div>
                    <p className="text-sm text-text-secondary mb-3">
                      Emitted when a model is loaded or unloaded. Useful for keeping dashboards in
                      sync.
                    </p>
                    <CodeBlock
                      language="json"
                      code={`{
  "type": "model_event",
  "action": "loaded",
  "model": "qwen3-30b-a3b",
  "vram_gb": 18.4,
  "load_time_ms": 2340
}`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h2 id="memory-monitoring">Memory Monitoring</h2>

          <h3 id="vram-usage">VRAM Usage</h3>
          <p>
            Monitor VRAM usage through the <code>/admin/events</code> SSE stream (memory events) or
            by querying the admin models endpoint:
          </p>
          <CommandBlock
            command="curl http://192.168.188.11:1234/admin/models"
            output={`{
  "models": [{
    "id": "qwen3-30b-a3b",
    "loaded": true,
    "vram_gb": 18.4,
    "format": "mlx"
  }]
}`}
          />
          <p>
            On a Mac Studio with 192GB unified memory, you can monitor system-level memory alongside
            LMX:
          </p>
          <CommandBlock
            command="memory_pressure"
            description="macOS system memory pressure report"
          />

          <h3 id="oom-alerts">OOM Alerts</h3>
          <p>
            When memory pressure reaches the configured thresholds, LMX emits special events via the
            SSE stream:
          </p>
          <CodeBlock
            language="json"
            filename="Warning event (85% threshold)"
            code={`{
  "type": "memory_warning",
  "vram_used_gb": 163.2,
  "vram_total_gb": 192.0,
  "pct": 85.0,
  "message": "Memory usage exceeds warning threshold"
}`}
          />
          <CodeBlock
            language="json"
            filename="Critical event (90% threshold)"
            code={`{
  "type": "memory_critical",
  "vram_used_gb": 172.8,
  "vram_total_gb": 192.0,
  "pct": 90.0,
  "message": "OOM threshold reached, unloading model",
  "action": "model_unloaded"
}`}
          />
          <Callout variant="danger" title="Automatic unload">
            When the critical threshold is hit, LMX unloads the model automatically to prevent a
            crash. All in-flight requests receive a <code>503</code> response with the{" "}
            <code>oom-unloaded</code> error code.
          </Callout>

          <h2 id="error-codes">Error Codes</h2>
          <p>
            These error codes appear in API responses and SSE events. Use them for automated
            monitoring and alerting:
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Code</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Severity</th>
                  <th className="text-left py-2 text-text-muted font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">no-model-loaded</code></td>
                  <td className="py-2 pr-4 text-neon-amber">Warning</td>
                  <td className="py-2 text-text-secondary">Load a model with POST /admin/models/load</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">storage-full</code></td>
                  <td className="py-2 pr-4 text-neon-red">Error</td>
                  <td className="py-2 text-text-secondary">Free disk space or remove cached models</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">lmx-timeout</code></td>
                  <td className="py-2 pr-4 text-neon-amber">Warning</td>
                  <td className="py-2 text-text-secondary">Reduce context length or switch to a smaller model</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">oom-unloaded</code></td>
                  <td className="py-2 pr-4 text-neon-red">Critical</td>
                  <td className="py-2 text-text-secondary">Free memory and reload a model (possibly smaller)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">model-not-found</code></td>
                  <td className="py-2 pr-4 text-neon-amber">Warning</td>
                  <td className="py-2 text-text-secondary">Check model path or download the model</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="log-files">Log Files</h2>
          <p>
            LMX writes logs to stdout/stderr, which are captured by launchd when running as a
            service:
          </p>
          <CommandBlock
            command="tail -f /tmp/opta-lmx.stdout.log"
            description="Follow LMX stdout logs"
          />
          <CommandBlock
            command="tail -f /tmp/opta-lmx.stderr.log"
            description="Follow LMX error logs"
          />
          <p>Key log patterns to watch for:</p>
          <CodeBlock
            language="text"
            code={`# Normal startup
INFO:     LMX starting on 0.0.0.0:1234
INFO:     Model loaded: qwen3-30b-a3b (18.4 GB, 2.3s)

# Inference activity
INFO:     Completion request model=qwen3-30b-a3b tokens=342 speed=45.2tok/s

# Memory warning
WARNING:  Memory usage at 85.0% (163.2/192.0 GB)

# OOM protection triggered
ERROR:    Memory critical at 90.0% — unloading model
INFO:     Model unloaded, freed 18.4 GB

# Client connection errors (usually harmless)
WARNING:  SSE client disconnected: ConnectionResetError`}
          />

          <h2 id="performance-benchmarks">Performance Benchmarks</h2>

          <h3 id="throughput-targets">Throughput Targets</h3>
          <p>
            Expected token generation speeds on a Mac Studio M3 Ultra (192GB) with MLX-native 4-bit
            quantized models:
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Model</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Prompt (tok/s)</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Generate (tok/s)</th>
                  <th className="text-left py-2 text-text-muted font-medium">Time to First Token</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">Qwen3-30B-A3B (4-bit)</td>
                  <td className="py-2 pr-4 text-text-secondary">~200</td>
                  <td className="py-2 pr-4 text-text-secondary">~65</td>
                  <td className="py-2 text-text-secondary">&lt;200ms</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">Llama-3.3-70B (4-bit)</td>
                  <td className="py-2 pr-4 text-text-secondary">~120</td>
                  <td className="py-2 pr-4 text-text-secondary">~25</td>
                  <td className="py-2 text-text-secondary">&lt;500ms</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-text-secondary">DeepSeek-V3-0324 (4-bit)</td>
                  <td className="py-2 pr-4 text-text-secondary">~40</td>
                  <td className="py-2 pr-4 text-text-secondary">~8</td>
                  <td className="py-2 text-text-secondary">&lt;2s</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="info" title="MLX vs GGUF">
            These numbers are for MLX-native models. GGUF models loaded through the compatibility
            layer typically show 10-20% lower throughput. Always prefer MLX-native models for best
            performance.
          </Callout>

          <h2 id="monitoring-from-local-web">Monitoring from Local Web</h2>
          <p>
            The Opta Local Web dashboard at <code>http://localhost:3004</code> provides a visual
            interface for monitoring LMX. It connects to the <code>/admin/events</code> SSE stream
            and displays:
          </p>
          <ul>
            <li>
              <strong>VRAM gauge</strong> — Real-time memory usage ring with percentage
            </li>
            <li>
              <strong>Throughput graph</strong> — Tokens per second over time (300-sample circular
              buffer)
            </li>
            <li>
              <strong>Model list</strong> — Currently loaded model and available models on disk
            </li>
            <li>
              <strong>Health indicator</strong> — Connection status badge with heartbeat monitoring
            </li>
          </ul>
          <p>
            See the <a href="/docs/local-web/">Local Web documentation</a> for setup and usage
            details.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
