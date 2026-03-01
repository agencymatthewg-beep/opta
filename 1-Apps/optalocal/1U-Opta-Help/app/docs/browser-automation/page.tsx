"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "what-is-browser-automation", title: "What is Browser Automation?", level: 2 as const },
  { id: "playwright-foundation", title: "Playwright Foundation", level: 2 as const },
  { id: "ai-driven-navigation", title: "AI-Driven Navigation", level: 2 as const },
  { id: "mcp-tool-routing", title: "MCP Tool Routing", level: 2 as const },
  { id: "policy-and-approval", title: "Policy and Approval", level: 2 as const },
  { id: "parallel-tabs", title: "Parallel Tab Support", level: 2 as const },
];

export default function BrowserAutomationOverviewPage() {
  return (
    <>
      <Breadcrumb items={[{ label: "Browser Automation" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Browser Automation</h1>
          <p className="lead">
            Opta includes a Playwright-based browser automation system that
            allows the AI to navigate web pages, interact with UI elements,
            capture screenshots, and execute JavaScript -- all under policy
            control and approval gating.
          </p>

          <h2 id="what-is-browser-automation">What is Browser Automation?</h2>
          <p>
            Browser automation gives the AI agent the ability to operate a
            real web browser programmatically. When the model determines that
            a task requires web interaction -- browsing documentation,
            filling out forms, testing a web application, or scraping data --
            it can invoke browser tools to accomplish these actions.
          </p>
          <p>
            This is not a simulated browser or a headless HTTP client. The
            automation runs a full Chromium browser instance via Playwright,
            with complete JavaScript execution, CSS rendering, and DOM
            interaction. The AI sees the page through accessibility tree
            snapshots and screenshots, making decisions about what to click,
            type, or navigate to next.
          </p>

          <h2 id="playwright-foundation">Playwright Foundation</h2>
          <p>
            The browser automation system is built on{" "}
            <code>@playwright/mcp</code>, which exposes 30+ browser control
            tools through the Model Context Protocol. Playwright provides:
          </p>
          <ul>
            <li>Cross-browser support (Chromium, Firefox, WebKit)</li>
            <li>Reliable element selection via accessibility tree and CSS selectors</li>
            <li>Network interception and request monitoring</li>
            <li>Screenshot and video recording capabilities</li>
            <li>File upload and download handling</li>
            <li>Multi-tab and multi-window management</li>
          </ul>

          <Callout variant="info" title="Chromium by default">
            Opta uses Chromium as the default browser engine. This provides
            the best compatibility with modern web applications and the most
            reliable automation behavior.
          </Callout>

          <h2 id="ai-driven-navigation">AI-Driven Navigation</h2>
          <p>
            Unlike scripted automation where every step is predetermined,
            Opta&apos;s browser automation is AI-driven. The model receives a
            high-level task (e.g., &quot;find the pricing page and extract the
            enterprise plan cost&quot;) and decides which browser tools to invoke
            at each step.
          </p>
          <p>
            The typical flow is:
          </p>
          <ol>
            <li>The model calls <code>navigate</code> to load a URL</li>
            <li>It calls <code>snapshot</code> to read the accessibility tree and understand the page structure</li>
            <li>Based on the accessibility tree, it calls <code>click</code>, <code>type</code>, or other interaction tools</li>
            <li>It may call <code>screenshot</code> to visually verify the result</li>
            <li>It repeats until the task is complete</li>
          </ol>

          <h2 id="mcp-tool-routing">MCP Tool Routing</h2>
          <p>
            Browser tools are routed through the <code>BrowserMcpInterceptor</code>,
            which sits between the daemon&apos;s tool router and the Playwright MCP
            server. The interceptor:
          </p>
          <ul>
            <li>Validates tool parameters before forwarding to Playwright</li>
            <li>Applies policy rules to determine if the action requires approval</li>
            <li>Logs all tool invocations for session recording</li>
            <li>Handles error recovery and retry logic</li>
          </ul>

          <CodeBlock
            language="text"
            filename="Tool Routing Flow"
            code={`Model requests tool → Daemon tool router
    → BrowserMcpInterceptor
        → Policy evaluation (approve / deny / ask)
        → @playwright/mcp server
            → Chromium browser instance
    ← Result returned to model`}
          />

          <h2 id="policy-and-approval">Policy and Approval</h2>
          <p>
            Not all browser actions are automatically approved. The policy
            system evaluates each tool call against the current permission
            rules:
          </p>
          <ul>
            <li><strong>Navigation</strong> to allowed domains -- auto-approved</li>
            <li><strong>Screenshots and snapshots</strong> -- auto-approved (read-only)</li>
            <li><strong>Clicks and form input</strong> -- may require approval depending on the target domain</li>
            <li><strong>JavaScript evaluation</strong> -- requires approval (can execute arbitrary code)</li>
            <li><strong>File uploads</strong> -- requires approval (sends local files to external servers)</li>
          </ul>
          <p>
            In <code>do</code> mode, safe browser actions (navigation,
            screenshots, snapshots) are auto-approved to enable fluent
            autonomous browsing. Destructive or data-exfiltration-risk
            actions still require explicit confirmation.
          </p>

          <h2 id="parallel-tabs">Parallel Tab Support</h2>
          <p>
            The browser automation system supports multiple tabs running
            concurrently. The model can open new tabs, switch between them,
            and perform actions in parallel. This is useful for:
          </p>
          <ul>
            <li>Comparing content across multiple pages simultaneously</li>
            <li>Performing searches in one tab while reading results in another</li>
            <li>Testing multi-tab workflows in web applications</li>
          </ul>
          <p>
            Tab management tools include <code>tabs</code> (list all open
            tabs) and <code>navigate_back</code> (browser history navigation).
            Each tab maintains its own independent state and navigation
            history.
          </p>

          <PrevNextNav
            prev={{ title: "Daemon Controls", href: "/docs/code-desktop/daemon-controls/" }}
            next={{ title: "Tools", href: "/docs/browser-automation/tools/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
