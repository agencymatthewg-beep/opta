"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { Callout } from "@/components/docs/Callout";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "command-reference", title: "Command Reference", level: 2 as const },
  { id: "general", title: "General", level: 3 as const },
  { id: "model-control", title: "Model Control", level: 3 as const },
  { id: "session-workflow", title: "Session & Workflow", level: 3 as const },
  { id: "code-tools", title: "Code Tools", level: 3 as const },
  { id: "research-debug", title: "Research & Debug", level: 3 as const },
  { id: "lmx-commands", title: "LMX Commands", level: 3 as const },
  { id: "browser-commands", title: "Browser Commands", level: 3 as const },
  { id: "usage-tips", title: "Usage Tips", level: 2 as const },
];

export default function SlashCommandsPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "CLI Reference", href: "/docs/cli/" },
          { label: "Slash Commands" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Slash Commands</h1>
          <p className="lead">
            Slash commands are special in-session commands that start with{" "}
            <code>/</code>. They let you control the session, switch models,
            trigger workflows, and access tools without leaving your active
            conversation.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            While in an <code>opta chat</code> session, type a slash command
            instead of a regular message. Slash commands are processed locally by
            the CLI and do not consume model tokens. They provide quick access to
            model switching, code review, research mode, session management, and
            debugging tools.
          </p>

          <CommandBlock
            command="/help"
            output={`Available commands:
  /help          Show this help message
  /model         Switch active model
  /plan          Enter plan-only mode
  /review        Code review current changes
  /research      Deep research mode
  ...`}
            description="Type /help during a chat session"
          />

          <h2 id="command-reference">Command Reference</h2>

          <h3 id="general">General</h3>

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
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/help</td>
                  <td className="px-4 py-2.5">Show available slash commands and usage</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/whoami</td>
                  <td className="px-4 py-2.5">Display current user, session ID, and connection info</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/memory</td>
                  <td className="px-4 py-2.5">Show stored memory entries for context persistence</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 id="model-control">Model Control</h3>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Command</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/model &lt;name&gt;</td>
                  <td className="px-4 py-2.5">Switch the active model mid-session. Accepts model names or aliases. The new model picks up the existing conversation context.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CommandBlock
            command="/model deepseek-r1"
            output="Switching to deepseek-r1...\nModel active: deepseek-r1-0528 (42.8 GB)"
            description="Switch model during a session"
          />

          <h3 id="session-workflow">Session & Workflow</h3>

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
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/plan</td>
                  <td className="px-4 py-2.5">Enter plan mode -- the model analyzes and proposes changes without executing them</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/export</td>
                  <td className="px-4 py-2.5">Export the current session to a JSON file</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/checkpoint</td>
                  <td className="px-4 py-2.5">Create a named checkpoint in the session for easy rollback</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/undo</td>
                  <td className="px-4 py-2.5">Revert the last file change made by the model</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 id="code-tools">Code Tools</h3>

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
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/review</td>
                  <td className="px-4 py-2.5">Run a code review on the current git diff or staged changes. Produces structured feedback.</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/commit</td>
                  <td className="px-4 py-2.5">Generate a conventional commit message from staged changes and optionally commit</td>
                </tr>
              </tbody>
            </table>
          </div>

          <TabGroup
            tabs={[
              {
                label: "/review",
                content: (
                  <div className="text-sm text-text-secondary space-y-3">
                    <p>
                      Analyzes the current git diff and provides structured
                      feedback on code quality, potential bugs, and
                      suggestions for improvement.
                    </p>
                    <CommandBlock
                      command="/review"
                      output={`Reviewing 3 changed files...

src/auth/validate.ts
  Line 24: Consider adding null check before accessing user.role
  Line 41: JWT expiry should use >=, not > (off-by-one)

src/api/routes.ts
  Line 12: Missing error handler for async route

Overall: 2 issues, 1 suggestion`}
                    />
                  </div>
                ),
              },
              {
                label: "/commit",
                content: (
                  <div className="text-sm text-text-secondary space-y-3">
                    <p>
                      Reads staged git changes, generates a conventional commit
                      message, and prompts you to approve and commit.
                    </p>
                    <CommandBlock
                      command="/commit"
                      output={`Suggested commit message:
  fix(auth): add JWT expiry boundary check and null guard

[C]ommit  [E]dit message  [A]bort`}
                    />
                  </div>
                ),
              },
            ]}
          />

          <h3 id="research-debug">Research & Debug</h3>

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
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/research</td>
                  <td className="px-4 py-2.5">Enter deep research mode -- the model explores code, reads documentation, and produces a comprehensive analysis</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/debug</td>
                  <td className="px-4 py-2.5">Show debug information including daemon connection, model status, token counts, and latency metrics</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 id="lmx-commands">LMX Commands</h3>
          <p>
            LMX slash commands let you check and manage the inference server
            connection without leaving your chat session.
          </p>

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
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/lmx status</td>
                  <td className="px-4 py-2.5">Show LMX server health, loaded model, VRAM usage, and uptime</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/lmx reconnect</td>
                  <td className="px-4 py-2.5">Force reconnect to the LMX server (useful after network changes)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <CommandBlock
            command="/lmx status"
            output={`LMX Server: 192.168.188.11:1234
Status: healthy
Model: qwen3-30b-a3b (4-bit)
VRAM: 18.2 / 192.0 GB
Uptime: 6h 42m
Throughput: 38.7 tok/s (avg)`}
            description="Check LMX server status in-session"
          />

          <h3 id="browser-commands">Browser Commands</h3>
          <p>
            Browser slash commands control the Playwright-based browser
            automation system. These commands let you open pages, navigate, and
            capture screenshots from within your chat session.
          </p>

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
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/browser open &lt;url&gt;</td>
                  <td className="px-4 py-2.5">Open a URL in the managed browser instance</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/browser navigate &lt;url&gt;</td>
                  <td className="px-4 py-2.5">Navigate the current tab to a new URL</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">/browser screenshot</td>
                  <td className="px-4 py-2.5">Capture a screenshot of the current browser state</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout variant="info" title="Browser automation">
            Browser commands require Playwright to be installed. The browser
            session persists across commands within the same chat session. See
            the{" "}
            <a href="/docs/browser-automation/" className="text-primary hover:underline">
              Browser Automation
            </a>{" "}
            section for full details on available tools and recording.
          </Callout>

          <h2 id="usage-tips">Usage Tips</h2>

          <ul>
            <li>
              Slash commands are processed entirely by the CLI -- they do not
              consume model tokens or affect the conversation context.
            </li>
            <li>
              You can use <code>/model</code> to switch models mid-conversation
              without losing context. The new model receives the full chat
              history.
            </li>
            <li>
              Combine <code>/plan</code> with <code>/review</code> for a
              plan-then-review workflow: first ask the model to plan changes,
              review them, then switch to do mode to execute.
            </li>
            <li>
              Use <code>/checkpoint</code> before risky operations. If something
              goes wrong, <code>/undo</code> reverts the last file change.
            </li>
            <li>
              <code>/debug</code> is invaluable for diagnosing slow responses --
              it shows per-turn latency and token counts.
            </li>
          </ul>

          <Callout variant="tip" title="Autocomplete">
            Slash commands support tab completion. Type <code>/</code> and press
            Tab to see all available commands. Start typing a command name and
            press Tab to autocomplete.
          </Callout>

          <PrevNextNav
            prev={{ title: "Configuration", href: "/docs/cli/configuration/" }}
            next={{ title: "Daemon Overview", href: "/docs/daemon/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
