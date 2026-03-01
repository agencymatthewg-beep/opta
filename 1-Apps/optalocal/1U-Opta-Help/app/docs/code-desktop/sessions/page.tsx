"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "workspace-rail", title: "Workspace Rail", level: 2 as const },
  { id: "session-search", title: "Session Search", level: 3 as const },
  { id: "timeline-cards", title: "Timeline Cards", level: 2 as const },
  { id: "streaming-indicators", title: "Streaming Indicators", level: 2 as const },
  { id: "turn-statistics", title: "Turn Statistics", level: 2 as const },
  { id: "tool-cards", title: "Tool Cards", level: 2 as const },
  { id: "session-export", title: "Session Export", level: 2 as const },
];

export default function CodeDesktopSessionsPage() {
  const { prev, next } = getPrevNext("/docs/code-desktop/sessions/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Code Desktop", href: "/docs/code-desktop/" },
          { label: "Session Management" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Session Management</h1>
          <p className="lead">
            Code Desktop provides a visual interface for browsing, searching,
            and inspecting daemon sessions. The workspace rail and timeline
            view give you full visibility into every conversation and task.
          </p>

          <h2 id="workspace-rail">Workspace Rail</h2>
          <p>
            The workspace rail is a sidebar panel that lists all sessions
            managed by the daemon. Each session entry displays:
          </p>
          <ul>
            <li><strong>Session title</strong> -- derived from the first user message or a custom name</li>
            <li><strong>Session ID</strong> -- the unique identifier for the session</li>
            <li><strong>Status indicator</strong> -- active (green), idle (grey), or errored (red)</li>
            <li><strong>Last activity</strong> -- relative timestamp of the most recent turn</li>
            <li><strong>Turn count</strong> -- total number of turns in the session</li>
          </ul>
          <p>
            Clicking a session in the rail loads its timeline in the main
            content area. The currently selected session is highlighted with
            a violet accent border.
          </p>

          <h3 id="session-search">Session Search</h3>
          <p>
            The workspace rail includes a search input at the top that
            filters sessions in real time. Search matches against both the
            session title and the session ID, making it easy to find specific
            conversations in a long list.
          </p>

          <h2 id="timeline-cards">Timeline Cards</h2>
          <p>
            When a session is selected, the main content area displays its
            turns as a chronological timeline. Each turn is rendered as a
            card containing:
          </p>
          <ul>
            <li><strong>User message</strong> -- the prompt sent to the model</li>
            <li><strong>Model response</strong> -- the generated reply, rendered with full markdown support</li>
            <li><strong>Tool calls</strong> -- collapsible tool invocation cards (see below)</li>
            <li><strong>Metadata</strong> -- model name, timestamp, and turn index</li>
          </ul>
          <p>
            The timeline scrolls vertically with the most recent turn at the
            bottom. New turns appear automatically as they stream in via the
            WebSocket connection.
          </p>

          <h2 id="streaming-indicators">Streaming Indicators</h2>
          <p>
            When the daemon is actively processing a turn, the timeline
            displays streaming indicators:
          </p>
          <ul>
            <li>A pulsing accent border on the active turn card</li>
            <li>A live token counter showing tokens generated so far</li>
            <li>Progressive markdown rendering as tokens arrive</li>
          </ul>
          <p>
            Streaming events are received via the WebSocket connection. The
            client subscribes to events for the active session and routes
            them by event type (<code>turn.token</code>,{" "}
            <code>turn.tool_call</code>, <code>turn.done</code>, etc.).
          </p>

          <h2 id="turn-statistics">Turn Statistics</h2>
          <p>
            When a turn completes (indicated by a <code>turn.done</code>{" "}
            event), the turn card displays summary statistics:
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Statistic</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">tokens</td>
                  <td className="px-4 py-2.5">Total tokens generated in the response</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">speed</td>
                  <td className="px-4 py-2.5">Generation speed in tokens per second</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">elapsed</td>
                  <td className="px-4 py-2.5">Wall-clock time from request to completion</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">toolCalls</td>
                  <td className="px-4 py-2.5">Number of tool invocations during the turn</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="tool-cards">Tool Cards</h2>
          <p>
            Tool invocations are displayed as collapsible cards within the
            turn timeline. Each tool card has two variants:
          </p>
          <ul>
            <li><strong>tool-call</strong> -- shows the tool name and arguments the model passed</li>
            <li><strong>tool-result</strong> -- shows the output returned to the model</li>
          </ul>
          <p>
            The primary field is <code>toolName</code>, matching the v3
            protocol contract. Cards are collapsed by default to keep the
            timeline compact, and expand on click to reveal full details.
          </p>

          <Callout variant="info" title="V3 protocol events">
            Tool cards render from <code>envelope.event</code> data in the
            WebSocket stream. The event type field is <code>event</code>,
            not <code>kind</code> -- this matches the daemon v3 protocol
            contract.
          </Callout>

          <h2 id="session-export">Session Export</h2>
          <p>
            Sessions can be exported in two formats:
          </p>
          <ul>
            <li><strong>JSON</strong> -- full structured data including all turns, tool calls, metadata, and statistics</li>
            <li><strong>Markdown</strong> -- human-readable transcript with formatted code blocks and tool call summaries</li>
          </ul>
          <p>
            Export is triggered from the session context menu in the workspace
            rail. The exported file is downloaded directly in the browser.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
