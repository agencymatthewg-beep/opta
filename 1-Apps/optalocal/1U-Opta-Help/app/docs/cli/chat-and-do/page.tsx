"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Callout } from "@/components/docs/Callout";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "chat-mode", title: "Chat Mode", level: 2 as const },
  { id: "streaming-output", title: "Streaming Output", level: 3 as const },
  { id: "tool-execution", title: "Tool Execution", level: 3 as const },
  { id: "permission-prompts", title: "Permission Prompts", level: 3 as const },
  { id: "do-mode", title: "Do Mode", level: 2 as const },
  { id: "how-do-works", title: "How Do Works", level: 3 as const },
  { id: "mode-flag", title: "Mode Flag", level: 3 as const },
  { id: "tool-limits", title: "Tool Call Limits", level: 3 as const },
  { id: "cancelling", title: "Cancelling a Task", level: 3 as const },
  { id: "available-tools", title: "Available Tools", level: 2 as const },
  { id: "examples", title: "Examples", level: 2 as const },
];

export default function ChatAndDoPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "CLI Reference", href: "/docs/cli/" },
          { label: "Chat & Do" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Chat & Do</h1>
          <p className="lead">
            The two primary interaction modes in Opta CLI. <code>chat</code>{" "}
            gives you a conversational session with manual control.{" "}
            <code>do</code> runs an autonomous agent loop to complete a task from
            start to finish.
          </p>

          <h2 id="chat-mode">Chat Mode</h2>
          <p>
            <code>opta chat</code> starts an interactive conversation session.
            The model receives your messages, streams back responses token by
            token, and maintains full context across the conversation. You stay
            in control of tool approvals and can guide the conversation at every
            step.
          </p>

          <CommandBlock command="opta chat" description="Start interactive chat" />

          <CommandBlock
            command="opta chat --model deepseek-r1"
            description="Start chat with a specific model"
          />

          <h3 id="streaming-output">Streaming Output</h3>
          <p>
            Responses stream in real time as tokens are generated. You see the
            output building character by character, giving immediate feedback
            even for long responses. The stream includes thinking indicators and
            turn statistics (tokens generated, speed in tokens/sec, elapsed
            time) displayed after each response completes.
          </p>

          <h3 id="tool-execution">Tool Execution</h3>
          <p>
            During a chat session, the model can invoke tools to interact with
            your system. Tools let the AI read files, write code, run shell
            commands, and search your codebase. Each tool call is displayed in a
            collapsible card showing the tool name, arguments, and result.
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Description</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Auto-approve</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">read_file</td>
                  <td className="px-4 py-2.5">Read contents of a file</td>
                  <td className="px-4 py-2.5 text-neon-green text-xs">Yes</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">write_file</td>
                  <td className="px-4 py-2.5">Create or overwrite a file</td>
                  <td className="px-4 py-2.5 text-neon-amber text-xs">Prompt</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">run_command</td>
                  <td className="px-4 py-2.5">Execute a shell command</td>
                  <td className="px-4 py-2.5 text-neon-amber text-xs">Prompt</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-xs">search_files</td>
                  <td className="px-4 py-2.5">Search file contents with regex</td>
                  <td className="px-4 py-2.5 text-neon-green text-xs">Yes</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">list_directory</td>
                  <td className="px-4 py-2.5">List directory contents</td>
                  <td className="px-4 py-2.5 text-neon-green text-xs">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 id="permission-prompts">Permission Prompts</h3>
          <p>
            When the model requests a tool that modifies your system (writing
            files, running commands), the CLI displays a permission prompt. You
            can approve, deny, or approve all similar operations for the rest of
            the session.
          </p>

          <CodeBlock
            code={`Tool: write_file
Path: src/auth/validate.ts
Content: (47 lines)

[A]pprove  [D]eny  [A]ll for this tool  [Q]uit`}
            filename="Permission prompt"
          />

          <Callout variant="info">
            Read-only tools like <code>read_file</code>,{" "}
            <code>search_files</code>, and <code>list_directory</code> are
            auto-approved by default. This can be changed in configuration.
          </Callout>

          <h2 id="do-mode">Do Mode</h2>
          <p>
            <code>opta do</code> takes a natural-language task and runs an
            autonomous agent loop. It plans the work, executes tool calls, and
            iterates until the task is complete. Safe tools (reads, searches) are
            auto-approved; destructive tools (writes, commands) still require
            confirmation unless you opt in to full auto-approval.
          </p>

          <CommandBlock
            command='opta do "Refactor the auth module to use JWT tokens"'
            description="Run an autonomous task"
          />

          <h3 id="how-do-works">How Do Works</h3>
          <p>
            When you run <code>opta do</code>, the agent follows this loop:
          </p>
          <ol>
            <li>Receives your task description as the initial prompt</li>
            <li>Analyzes the codebase by reading relevant files</li>
            <li>Creates a plan of changes needed</li>
            <li>Executes changes step by step, using tools</li>
            <li>Verifies the result (runs tests if applicable)</li>
            <li>Reports completion with a summary of changes made</li>
          </ol>

          <h3 id="mode-flag">Mode Flag</h3>
          <p>
            The <code>--mode</code> flag controls how the agent approaches the
            task.
          </p>

          <TabGroup
            tabs={[
              {
                label: "Plan Mode",
                content: (
                  <div className="text-sm text-text-secondary space-y-3">
                    <p>
                      <code>--mode plan</code> makes the agent analyze and
                      propose changes without executing them. It produces a
                      detailed plan you can review before running the actual
                      implementation.
                    </p>
                    <CommandBlock command='opta do "Add error handling to API routes" --mode plan' />
                  </div>
                ),
              },
              {
                label: "Do Mode",
                content: (
                  <div className="text-sm text-text-secondary space-y-3">
                    <p>
                      <code>--mode do</code> (the default) executes the task
                      immediately, making changes as it goes. Safe tools are
                      auto-approved; destructive operations prompt for
                      confirmation.
                    </p>
                    <CommandBlock command='opta do "Add error handling to API routes" --mode do' />
                  </div>
                ),
              },
            ]}
          />

          <h3 id="tool-limits">Tool Call Limits</h3>
          <p>
            To prevent runaway agent loops, <code>opta do</code> enforces a
            maximum of <strong>30 tool calls</strong> per task. If the agent
            reaches this limit, it stops and reports what it accomplished. You
            can then resume or start a new task to continue the work.
          </p>

          <Callout variant="warning" title="Tool call limit">
            If a task consistently hits the 30-call limit, consider breaking it
            into smaller, more focused tasks. Complex refactors across many files
            often work better as a series of targeted <code>do</code> commands.
          </Callout>

          <h3 id="cancelling">Cancelling a Task</h3>
          <p>
            Press <kbd>Ctrl+C</kbd> at any time to cancel a running task. The
            agent will stop after completing its current tool call. Any changes
            already written to disk remain in place -- the cancellation does not
            roll back previous tool calls.
          </p>

          <CommandBlock
            command="# Press Ctrl+C during execution"
            output="Task cancelled. 12 of 30 tool calls used.\nChanges written to 3 files."
            description="Cancelling a running task"
          />

          <h2 id="available-tools">Available Tools</h2>
          <p>
            Both chat and do modes have access to the same set of tools. The
            difference is only in approval behavior -- do mode auto-approves safe
            tools while chat mode may prompt depending on your settings.
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Category</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tools</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Safety</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Read</td>
                  <td className="px-4 py-2.5 font-mono text-xs">read_file, search_files, list_directory</td>
                  <td className="px-4 py-2.5 text-neon-green text-xs">Safe</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Write</td>
                  <td className="px-4 py-2.5 font-mono text-xs">write_file, edit_file, delete_file</td>
                  <td className="px-4 py-2.5 text-neon-amber text-xs">Destructive</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Execute</td>
                  <td className="px-4 py-2.5 font-mono text-xs">run_command</td>
                  <td className="px-4 py-2.5 text-neon-amber text-xs">Destructive</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">Browser</td>
                  <td className="px-4 py-2.5 font-mono text-xs">browser_open, browser_navigate, browser_screenshot</td>
                  <td className="px-4 py-2.5 text-neon-amber text-xs">Destructive</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="examples">Examples</h2>

          <TabGroup
            tabs={[
              {
                label: "Chat",
                content: (
                  <div className="space-y-3">
                    <CommandBlock command="opta chat" description="Basic chat session" />
                    <CommandBlock
                      command="opta chat --model qwen3-30b"
                      description="Chat with a specific model"
                    />
                    <CommandBlock
                      command="opta chat --session abc123"
                      description="Resume a previous session"
                    />
                  </div>
                ),
              },
              {
                label: "Do",
                content: (
                  <div className="space-y-3">
                    <CommandBlock
                      command='opta do "Write unit tests for src/utils/parse.ts"'
                      description="Generate tests"
                    />
                    <CommandBlock
                      command='opta do "Fix the TypeScript errors in the auth module" --mode plan'
                      description="Plan-only mode"
                    />
                    <CommandBlock
                      command='opta do "Add JSDoc comments to all exported functions in src/api/"'
                      description="Batch documentation"
                    />
                  </div>
                ),
              },
            ]}
          />

          <PrevNextNav
            prev={{ title: "CLI Overview", href: "/docs/cli/" }}
            next={{ title: "Model Management", href: "/docs/cli/models/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
