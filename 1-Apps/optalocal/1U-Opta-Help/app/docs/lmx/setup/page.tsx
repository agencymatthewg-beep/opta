"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "hardware-requirements", title: "Hardware Requirements", level: 2 as const },
  { id: "recommended-configurations", title: "Recommended Configurations", level: 3 as const },
  { id: "python-environment", title: "Python Environment", level: 2 as const },
  { id: "installation", title: "Installation", level: 2 as const },
  { id: "pip-install", title: "pip Install", level: 3 as const },
  { id: "uv-install", title: "uv Install", level: 3 as const },
  { id: "configuration", title: "Configuration", level: 2 as const },
  { id: "starting-lmx", title: "Starting LMX", level: 2 as const },
  { id: "launchd-service", title: "launchd Service", level: 2 as const },
  { id: "verification", title: "Verification", level: 2 as const },
];

export default function LmxSetupPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "LMX", href: "/docs/lmx/" },
          { label: "Setup" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>LMX Setup</h1>
          <p className="lead">
            This guide covers installing and configuring Opta LMX on your Apple Silicon machine.
            LMX is designed to run on a dedicated inference server — typically a Mac Studio on your
            local network.
          </p>

          <h2 id="hardware-requirements">Hardware Requirements</h2>
          <p>
            LMX requires Apple Silicon with sufficient unified memory to load your target models.
            The minimum and recommended configurations are:
          </p>

          <h3 id="recommended-configurations">Recommended Configurations</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Tier</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Chip</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Memory</th>
                  <th className="text-left py-2 text-text-muted font-medium">Model Range</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">Minimum</td>
                  <td className="py-2 pr-4 text-text-secondary">M1 Pro / M2 Pro</td>
                  <td className="py-2 pr-4 text-text-secondary">32GB</td>
                  <td className="py-2 text-text-secondary">7B - 14B models</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">Recommended</td>
                  <td className="py-2 pr-4 text-text-secondary">M2 Ultra / M3 Ultra</td>
                  <td className="py-2 pr-4 text-text-secondary">64GB - 128GB</td>
                  <td className="py-2 text-text-secondary">30B - 70B models</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-text-secondary">Ideal</td>
                  <td className="py-2 pr-4 text-text-secondary">M3 Ultra</td>
                  <td className="py-2 pr-4 text-text-secondary">192GB</td>
                  <td className="py-2 text-text-secondary">70B+ models, multiple concurrent</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="info" title="Unified memory sizing">
            As a rule of thumb, a model requires roughly 1GB of memory per billion parameters at 4-bit
            quantization. A 70B model needs approximately 40GB. Always leave headroom for the OS and
            MLX runtime overhead.
          </Callout>

          <h2 id="python-environment">Python Environment</h2>
          <p>
            LMX requires Python 3.12 or later. Use a virtual environment to isolate dependencies:
          </p>
          <CommandBlock
            command="python3 --version"
            description="Verify Python version (must be 3.12+)"
            output="Python 3.12.8"
          />
          <CommandBlock
            command="python3 -m venv .venv && source .venv/bin/activate"
            description="Create and activate a virtual environment"
          />
          <Callout variant="warning" title="System Python">
            Do not install LMX into the system Python. Always use a virtual environment. The{" "}
            <code>.venv/</code> directory is excluded from Syncthing via <code>.stignore</code>.
          </Callout>

          <h2 id="installation">Installation</h2>

          <h3 id="pip-install">pip Install</h3>
          <TabGroup
            tabs={[
              {
                label: "pip",
                content: (
                  <div>
                    <CommandBlock
                      command="pip install -e '.[dev]'"
                      description="Install LMX in editable mode with dev dependencies"
                    />
                    <p className="text-sm text-text-secondary mt-2">
                      This installs LMX from the local source tree. The <code>-e</code> flag enables
                      editable mode so changes to the source are reflected immediately.
                    </p>
                  </div>
                ),
              },
              {
                label: "uv",
                content: (
                  <div>
                    <CommandBlock
                      command="uv pip install -e '.[dev]'"
                      description="Install with uv (faster dependency resolution)"
                    />
                    <p className="text-sm text-text-secondary mt-2">
                      <code>uv</code> is a fast Python package installer. If you have it installed,
                      it provides significantly faster dependency resolution.
                    </p>
                  </div>
                ),
              },
            ]}
          />

          <p>Key dependencies installed:</p>
          <ul>
            <li><code>mlx</code> / <code>mlx-lm</code> — Apple MLX framework and model utilities</li>
            <li><code>fastapi</code> + <code>uvicorn</code> — HTTP server</li>
            <li><code>transformers</code> — Tokenizer support</li>
            <li><code>huggingface-hub</code> — Model downloading</li>
          </ul>

          <h2 id="configuration">Configuration</h2>
          <p>
            LMX reads configuration from environment variables and an optional config file. The
            primary settings are:
          </p>
          <CodeBlock
            filename="~/.config/opta/lmx/config.toml"
            language="toml"
            code={`[server]
host = "0.0.0.0"
port = 1234

[models]
# Default model to load on startup
default = "mlx-community/Qwen3-30B-A3B-4bit"

# Model search paths
paths = [
  "~/.cache/huggingface/hub",
  "~/models"
]

[inference]
max_tokens = 4096
temperature = 0.7
context_length = 32768

[memory]
# Maximum percentage of unified memory to use
max_memory_pct = 85
# Auto-unload model if memory exceeds this threshold
oom_threshold_pct = 90`}
          />
          <Callout variant="tip" title="Environment overrides">
            All config values can be overridden with environment variables using the{" "}
            <code>OPTA_LMX_</code> prefix. For example, <code>OPTA_LMX_PORT=5678</code> overrides
            the port setting.
          </Callout>

          <h2 id="starting-lmx">Starting LMX</h2>
          <StepList
            steps={[
              {
                title: "Activate the virtual environment",
                content: (
                  <CommandBlock command="source .venv/bin/activate" />
                ),
              },
              {
                title: "Start the server",
                content: (
                  <CommandBlock
                    command="python -m opta_lmx.main"
                    description="Start LMX in the foreground"
                    output={`INFO:     LMX starting on 0.0.0.0:1234
INFO:     Loading model: mlx-community/Qwen3-30B-A3B-4bit
INFO:     Model loaded in 2.3s (VRAM: 18.4GB)
INFO:     Ready for inference`}
                  />
                ),
              },
              {
                title: "Verify the server is responding",
                content: (
                  <CommandBlock
                    command="curl http://localhost:1234/healthz"
                    output={`{"status":"ok"}`}
                  />
                ),
              },
            ]}
          />

          <h2 id="launchd-service">launchd Service</h2>
          <p>
            For production use, run LMX as a launchd service so it starts automatically on boot and
            restarts on crash.
          </p>
          <CodeBlock
            filename="~/Library/LaunchAgents/com.opta.lmx.plist"
            language="xml"
            code={`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.opta.lmx</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/.venv/bin/python</string>
    <string>-m</string>
    <string>opta_lmx.main</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/path/to/1M-Opta-LMX</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/opta-lmx.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/opta-lmx.stderr.log</string>
</dict>
</plist>`}
          />
          <CommandBlock
            command="launchctl load ~/Library/LaunchAgents/com.opta.lmx.plist"
            description="Install and start the launchd service"
          />
          <CommandBlock
            command="launchctl list | grep opta.lmx"
            description="Verify the service is running"
            output={`12345	0	com.opta.lmx`}
          />
          <Callout variant="info" title="Update paths">
            Replace <code>/path/to/</code> in the plist with the actual absolute paths to your LMX
            virtual environment and project directory.
          </Callout>

          <h2 id="verification">Verification</h2>
          <p>
            Run these checks from your MacBook to confirm LMX is accessible over the LAN:
          </p>
          <StepList
            steps={[
              {
                title: "Liveness check",
                content: (
                  <CommandBlock
                    command="curl http://192.168.188.11:1234/healthz"
                    output={`{"status":"ok"}`}
                  />
                ),
              },
              {
                title: "Readiness check (model loaded)",
                content: (
                  <CommandBlock
                    command="curl http://192.168.188.11:1234/readyz"
                    output={`{"ready":true,"model":"qwen3-30b-a3b"}`}
                  />
                ),
              },
              {
                title: "Test inference",
                content: (
                  <CommandBlock
                    command={`curl http://192.168.188.11:1234/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"qwen3-30b-a3b","messages":[{"role":"user","content":"Hi"}]}'`}
                    description="Send a test completion request"
                  />
                ),
              },
              {
                title: "Check model list",
                content: (
                  <CommandBlock
                    command="curl http://192.168.188.11:1234/admin/models"
                    output={`{"models":[{"id":"qwen3-30b-a3b","loaded":true,"vram_gb":18.4}]}`}
                  />
                ),
              },
            ]}
          />

          <PrevNextNav
            prev={{ title: "LMX Overview", href: "/docs/lmx/" }}
            next={{ title: "API Reference", href: "/docs/lmx/api/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
