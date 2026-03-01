"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "tool-reference", title: "Tool Reference", level: 2 as const },
  { id: "navigation-tools", title: "Navigation Tools", level: 2 as const },
  { id: "interaction-tools", title: "Interaction Tools", level: 2 as const },
  { id: "inspection-tools", title: "Inspection Tools", level: 2 as const },
  { id: "input-tools", title: "Input Tools", level: 2 as const },
  { id: "tab-management", title: "Tab Management", level: 2 as const },
  { id: "advanced-tools", title: "Advanced Tools", level: 2 as const },
];

export default function BrowserAutomationToolsPage() {
  const { prev, next } = getPrevNext("/docs/browser-automation/tools/");
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Browser Automation", href: "/docs/browser-automation/" },
          { label: "Tools" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Browser Tools</h1>
          <p className="lead">
            The browser automation system exposes 30+ tools through{" "}
            <code>@playwright/mcp</code>. These tools cover navigation,
            element interaction, page inspection, input handling, tab
            management, and advanced operations.
          </p>

          <h2 id="tool-reference">Tool Reference</h2>
          <p>
            Each tool below is available to the AI model during browser
            automation sessions. The model selects which tools to invoke
            based on the task at hand and the current page state.
          </p>

          <h2 id="navigation-tools">Navigation Tools</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">navigate</td>
                  <td className="px-4 py-2.5">Navigate to a URL. Waits for the page to load before returning.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">navigate_back</td>
                  <td className="px-4 py-2.5">Go back in the browser history. Equivalent to clicking the back button.</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">wait_for</td>
                  <td className="px-4 py-2.5">Wait for a specific condition (element visible, text appears, network idle).</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="interaction-tools">Interaction Tools</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">click</td>
                  <td className="px-4 py-2.5">Click on an element identified by selector or accessibility reference.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">hover</td>
                  <td className="px-4 py-2.5">Hover over an element to trigger tooltips or dropdown menus.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">drag</td>
                  <td className="px-4 py-2.5">Drag an element from one position to another.</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">select_option</td>
                  <td className="px-4 py-2.5">Select an option from a dropdown or select element.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="inspection-tools">Inspection Tools</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">snapshot</td>
                  <td className="px-4 py-2.5">Capture the page accessibility tree. This is how the AI &quot;sees&quot; page structure.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">screenshot</td>
                  <td className="px-4 py-2.5">Take a visual screenshot of the current viewport.</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">console_messages</td>
                  <td className="px-4 py-2.5">Retrieve console log output from the browser developer tools.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout variant="tip" title="Snapshot vs. Screenshot">
            The <code>snapshot</code> tool returns a text-based accessibility
            tree that the model can parse efficiently. <code>screenshot</code>{" "}
            captures a visual image. The model typically uses snapshots for
            understanding page structure and screenshots for visual
            verification.
          </Callout>

          <h2 id="input-tools">Input Tools</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">type</td>
                  <td className="px-4 py-2.5">Type text into the currently focused element.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">press_key</td>
                  <td className="px-4 py-2.5">Press a keyboard key or key combination (e.g., Enter, Ctrl+A).</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">file_upload</td>
                  <td className="px-4 py-2.5">Upload a local file to a file input element.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="tab-management">Tab Management</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">tabs</td>
                  <td className="px-4 py-2.5">List all open browser tabs with their URLs and titles. Used for tab switching.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            The model can open new tabs by navigating to URLs that trigger
            new windows, or by using JavaScript evaluation. Each tab is
            independently addressable and maintains its own navigation
            history. Parallel tab support means the model can have multiple
            pages open simultaneously.
          </p>

          <h2 id="advanced-tools">Advanced Tools</h2>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">evaluate</td>
                  <td className="px-4 py-2.5">Execute arbitrary JavaScript in the page context. Returns the result.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout variant="warning" title="JavaScript evaluation">
            The <code>evaluate</code> tool executes arbitrary JavaScript in
            the browser context. This is powerful but carries risk -- it can
            read page data, modify the DOM, or make network requests. This
            tool always requires explicit approval in chat mode.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
