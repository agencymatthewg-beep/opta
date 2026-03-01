"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { Callout } from "@/components/docs/Callout";
import { FeatureTable } from "@/components/docs/FeatureTable";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "core-commands", title: "Core Commands", level: 2 as const },
  { id: "two-modes", title: "Two Modes", level: 2 as const },
  { id: "interactive-chat", title: "Interactive Chat", level: 3 as const },
  { id: "autonomous-do", title: "Autonomous Do", level: 3 as const },
  { id: "platform-support", title: "Platform Support", level: 2 as const },
  { id: "global-flags", title: "Global Flags", level: 2 as const },
];

export default function CliOverviewPage() {
  const { prev, next } = getPrevNext("/docs/cli/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "CLI Reference", href: "/docs/cli/" },
          { label: "Overview" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>CLI Reference</h1>
          <p className="lead">
            The Opta CLI is your primary interface to the Opta Local stack. It
            provides interactive AI chat, autonomous task execution, model
            management, session control, and daemon lifecycle commands -- all
            from your terminal.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            Opta CLI connects to the local daemon which orchestrates sessions,
            manages permissions, and proxies requests to LMX for inference on
            Apple Silicon. You can use it for quick questions, deep coding
            sessions, or fully autonomous multi-step tasks.
          </p>

          <CommandBlock
            command="opta --help"
            output={`Usage: opta [command] [options]

Commands:
  chat          Start interactive AI conversation
  do            Run autonomous agent task
  daemon        Manage the Opta daemon
  config        View and edit configuration
  models        Manage LMX models
  sessions      List and manage sessions
  status        Show stack health
  doctor        Diagnose and fix issues`}
          />

          <h2 id="core-commands">Core Commands</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Command</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta chat</td>
                  <td className="px-4 py-2.5">Start an interactive AI conversation with streaming output</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta do &quot;task&quot;</td>
                  <td className="px-4 py-2.5">Run an autonomous agent loop that completes a task</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta daemon</td>
                  <td className="px-4 py-2.5">Start, stop, restart, or install the background daemon</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta config</td>
                  <td className="px-4 py-2.5">View and modify CLI configuration settings</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta models</td>
                  <td className="px-4 py-2.5">Load, swap, browse, and inspect LMX models</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta sessions</td>
                  <td className="px-4 py-2.5">List, view, export, and delete conversation sessions</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta status</td>
                  <td className="px-4 py-2.5">Display health of daemon, LMX, and connected services</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">opta doctor</td>
                  <td className="px-4 py-2.5">Diagnose common issues and optionally apply fixes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="two-modes">Two Modes</h2>
          <p>
            The CLI operates in two fundamental modes that serve different
            workflows. Understanding when to use each is key to getting the most
            from Opta.
          </p>

          <h3 id="interactive-chat">Interactive Chat</h3>
          <p>
            <code>opta chat</code> opens a persistent, conversational session.
            You type messages, the model streams back responses in real time, and
            you can ask follow-up questions within the same context. Tool calls
            (file reads, writes, commands) require your explicit approval before
            executing.
          </p>
          <CommandBlock command="opta chat" description="Start an interactive chat session" />

          <h3 id="autonomous-do">Autonomous Do</h3>
          <p>
            <code>opta do</code> takes a natural-language task description and
            runs an agentic loop to completion. It auto-approves safe tool calls
            (file reads, searches) while still prompting for destructive
            operations (file writes, command execution). This mode is ideal for
            tasks like refactoring a module, writing tests, or generating
            documentation.
          </p>
          <CommandBlock
            command='opta do "Add unit tests for the auth module"'
            description="Run an autonomous task"
          />

          <Callout variant="tip" title="Choosing a mode">
            Use <code>chat</code> when you want to explore, iterate, and steer
            the conversation. Use <code>do</code> when you have a well-defined
            task and want the AI to execute it with minimal interruption.
          </Callout>

          <h2 id="platform-support">Platform Support</h2>

          <FeatureTable
            title="Platform Compatibility"
            features={[
              { feature: "macOS (Apple Silicon)", status: "done", description: "Primary platform, full feature support" },
              { feature: "macOS (Intel)", status: "done", description: "CLI + daemon, no local inference" },
              { feature: "Linux (x86_64)", status: "done", description: "CLI + daemon, LMX requires Apple Silicon" },
              { feature: "Windows (WSL2)", status: "partial", description: "CLI works under WSL2, native support planned" },
              { feature: "Windows (native)", status: "planned", description: "Planned for future release" },
            ]}
          />

          <Callout variant="info" title="LMX requires Apple Silicon">
            The LMX inference server uses MLX and only runs on Apple Silicon
            Macs. The CLI and daemon work on all supported platforms and can
            connect to a remote LMX instance over LAN.
          </Callout>

          <h2 id="global-flags">Global Flags</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Flag</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">--verbose, -v</td>
                  <td className="px-4 py-2.5">Enable verbose output and debug logging</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">--json</td>
                  <td className="px-4 py-2.5">Output responses as JSON (useful for scripting)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">--host &lt;addr&gt;</td>
                  <td className="px-4 py-2.5">Override the daemon host address</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">--version</td>
                  <td className="px-4 py-2.5">Print CLI version and exit</td>
                </tr>
              </tbody>
            </table>
          </div>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
