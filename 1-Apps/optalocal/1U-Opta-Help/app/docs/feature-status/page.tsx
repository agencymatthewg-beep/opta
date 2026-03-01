"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { FeatureTable } from "@/components/docs/FeatureTable";

const tocItems = [
  { id: "cli-features", title: "CLI Features", level: 2 as const },
  { id: "lmx-features", title: "LMX Features", level: 2 as const },
  { id: "local-web-features", title: "Local Web Features", level: 2 as const },
  { id: "code-desktop-features", title: "Code Desktop Features", level: 2 as const },
  { id: "browser-automation-features", title: "Browser Automation Features", level: 2 as const },
  { id: "security-features", title: "Security Features", level: 2 as const },
];

export default function FeatureStatusPage() {
  const { prev, next } = getPrevNext("/docs/feature-status/");
  return (
    <>
      <Breadcrumb items={[{ label: "Feature Status" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Feature Status Board</h1>
          <p className="lead">
            Current implementation status of all features across the Opta
            Local stack. This page is updated as features are completed,
            extended, or planned.
          </p>

          <h2 id="cli-features">CLI Features</h2>

          <FeatureTable
            title="Opta CLI"
            features={[
              { feature: "Interactive Chat (opta chat)", status: "done", description: "Full streaming chat with tool support" },
              { feature: "Autonomous Do (opta do)", status: "done", description: "Agentic task execution with auto-approve for safe tools" },
              { feature: "Daemon Management", status: "done", description: "Start, stop, restart, install as system service" },
              { feature: "Configuration", status: "done", description: "View and edit config, environment profiles" },
              { feature: "Model Management", status: "done", description: "Load, swap, browse, inspect LMX models" },
              { feature: "Session Management", status: "done", description: "List, view, export, delete sessions" },
              { feature: "Browser Automation", status: "done", description: "Playwright-based AI-driven browser control" },
              { feature: "MCP Integration", status: "done", description: "Add, list, test, remove MCP servers" },
            ]}
          />

          <h2 id="lmx-features">LMX Features</h2>

          <FeatureTable
            title="Opta LMX"
            features={[
              { feature: "Inference Engine", status: "done", description: "MLX-based Metal GPU inference on Apple Silicon" },
              { feature: "Streaming Responses", status: "done", description: "SSE streaming for /v1/chat/completions" },
              { feature: "Model Management", status: "done", description: "Load, unload, and download models via admin API" },
              { feature: "Health Monitoring", status: "done", description: "VRAM, throughput, uptime, active request tracking" },
            ]}
          />

          <h2 id="local-web-features">Local Web Features</h2>

          <FeatureTable
            title="Opta Local Web"
            features={[
              { feature: "Dashboard", status: "done", description: "VRAM gauge, model list, throughput chart, status badges" },
              { feature: "Chat Interface", status: "done", description: "Model picker, streaming, markdown rendering" },
              { feature: "Model Management", status: "done", description: "Load and unload models from the web UI" },
              { feature: "Cloud Sync", status: "partial", description: "Supabase auth for WAN mode, session sync planned" },
            ]}
          />

          <h2 id="code-desktop-features">Code Desktop Features</h2>

          <FeatureTable
            title="Opta Code Desktop"
            features={[
              { feature: "Session Monitor", status: "done", description: "Workspace rail, timeline cards, turn statistics" },
              { feature: "Daemon Controls", status: "done", description: "Start, stop, restart daemon from UI" },
              { feature: "Log Viewer", status: "done", description: "Real-time daemon log tail with level filtering" },
            ]}
          />

          <h2 id="browser-automation-features">Browser Automation Features</h2>

          <FeatureTable
            title="Browser Automation"
            features={[
              { feature: "Navigation & Interaction", status: "done", description: "Navigate, click, type, hover, drag, select" },
              { feature: "Session Recording", status: "done", description: "Step logs, screenshots, timing data" },
              { feature: "Visual Diff", status: "done", description: "Before/after screenshot comparison" },
            ]}
          />

          <h2 id="security-features">Security Features</h2>

          <FeatureTable
            title="Security"
            features={[
              { feature: "Permission System", status: "done", description: "Per-tool allow/ask/deny with user prompts" },
              { feature: "Guardrails", status: "done", description: "Critical, Strict, and Guideline rule tiers" },
              { feature: "Privacy Architecture", status: "done", description: "Local-first, no telemetry, no cloud without opt-in" },
            ]}
          />

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
