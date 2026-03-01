"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "what-is-mcp", title: "What is MCP?", level: 2 as const },
  { id: "listing-servers", title: "Listing Servers", level: 2 as const },
  { id: "adding-servers", title: "Adding Servers", level: 2 as const },
  { id: "testing-servers", title: "Testing Servers", level: 2 as const },
  { id: "removing-servers", title: "Removing Servers", level: 2 as const },
  { id: "built-in-tools", title: "Built-In MCP Tools", level: 2 as const },
  { id: "browser-mcp", title: "Browser Automation via MCP", level: 2 as const },
];

export default function DeveloperMcpPage() {
  const { prev, next } = getPrevNext("/docs/developer/mcp/");
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Developer Guide", href: "/docs/developer/" },
          { label: "MCP Integration" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>MCP Integration</h1>
          <p className="lead">
            The Model Context Protocol (MCP) is an open standard for giving
            AI models access to external tools and data sources. Opta
            supports connecting to multiple MCP servers, making their tools
            available to the AI during sessions.
          </p>

          <h2 id="what-is-mcp">What is MCP?</h2>
          <p>
            MCP defines a standard interface between an AI host (the daemon)
            and tool providers (MCP servers). Each MCP server exposes a set
            of tools with typed inputs and outputs. The daemon connects to
            these servers, discovers their tools, and routes tool calls from
            the model to the appropriate server.
          </p>
          <p>
            This means you can extend the AI&apos;s capabilities without
            modifying the daemon or the model. Want the AI to query a
            database? Write an MCP server that wraps your database. Want
            it to manage Kubernetes? Write an MCP server that wraps kubectl.
          </p>

          <Callout variant="info" title="Open standard">
            MCP is an open protocol. Opta is compatible with any MCP server
            that implements the standard, including servers built for other
            AI platforms. See the MCP specification for protocol details.
          </Callout>

          <h2 id="listing-servers">Listing Servers</h2>
          <p>
            View all configured MCP servers and their status:
          </p>

          <CommandBlock
            command="opta mcp list"
            output={`MCP Servers:
  playwright    @playwright/mcp    connected    32 tools
  github        github-mcp         connected    18 tools
  filesystem    fs-mcp             stopped      --`}
          />

          <p>
            The output shows the server name, package, connection status,
            and the number of available tools. Servers that are stopped
            need to be started before their tools are available.
          </p>

          <h2 id="adding-servers">Adding Servers</h2>
          <p>
            Add a new MCP server to the daemon&apos;s configuration:
          </p>

          <CommandBlock
            command='opta mcp add my-server --command "npx my-mcp-server"'
            description="Add a custom MCP server"
          />

          <p>
            The <code>--command</code> flag specifies how to start the
            server. The daemon will launch this command as a subprocess
            and communicate with it over the MCP protocol.
          </p>
          <p>
            MCP server configuration is stored in <code>.mcp.json</code>{" "}
            in the project root. Each server entry includes the command,
            arguments, environment variables, and optional authentication
            settings.
          </p>

          <CodeBlock
            language="json"
            filename=".mcp.json (example)"
            code={`{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["my-mcp-server"],
      "env": {
        "API_KEY": "\${MY_API_KEY}"
      }
    }
  }
}`}
          />

          <Callout variant="warning" title="API keys in .mcp.json">
            Use environment variable placeholders (e.g.,{" "}
            <code>{`\${MY_API_KEY}`}</code>) instead of raw API keys in{" "}
            <code>.mcp.json</code>. Set the actual values in your shell
            environment or a <code>.env</code> file that is gitignored.
          </Callout>

          <h2 id="testing-servers">Testing Servers</h2>
          <p>
            Verify that an MCP server is working correctly:
          </p>

          <CommandBlock
            command="opta mcp test my-server"
            output={`Testing my-server...
  Connection:  OK
  Tools:       12 discovered
  Ping:        3ms
  Status:      Ready`}
          />

          <p>
            The test command connects to the server, discovers its tools,
            and verifies that it responds to ping requests. This is useful
            for debugging connection issues or verifying that a server is
            properly configured.
          </p>

          <h2 id="removing-servers">Removing Servers</h2>
          <p>
            Remove an MCP server from the configuration:
          </p>

          <CommandBlock
            command="opta mcp remove my-server"
            description="Remove an MCP server"
          />

          <p>
            This removes the server entry from <code>.mcp.json</code> and
            disconnects from the server if it is currently running.
          </p>

          <h2 id="built-in-tools">Built-In MCP Tools</h2>
          <p>
            The daemon includes built-in tools that are always available
            without configuring an MCP server:
          </p>
          <ul>
            <li><strong>read_file</strong> -- read file contents</li>
            <li><strong>write_file</strong> -- create or overwrite files</li>
            <li><strong>search_files</strong> -- search for patterns in files</li>
            <li><strong>list_directory</strong> -- list directory contents</li>
            <li><strong>run_command</strong> -- execute shell commands</li>
          </ul>
          <p>
            These built-in tools are subject to the same permission system
            as MCP tools. They cannot bypass permission checks.
          </p>

          <h2 id="browser-mcp">Browser Automation via MCP</h2>
          <p>
            The browser automation system is implemented as an MCP server
            using <code>@playwright/mcp</code>. It provides 30+ tools for
            browser control, all routed through the{" "}
            <code>BrowserMcpInterceptor</code> for policy evaluation.
          </p>
          <p>
            See the{" "}
            <a href="/docs/browser-automation/">Browser Automation</a>{" "}
            section for complete documentation on browser tools.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
