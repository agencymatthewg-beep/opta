import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "start-a-chat", title: "Start a Chat", level: 2 as const },
  { id: "understanding-streaming", title: "Understanding Streaming", level: 2 as const },
  { id: "do-mode", title: "Do Mode", level: 2 as const },
  { id: "permission-prompts", title: "Permission Prompts", level: 2 as const },
  { id: "managing-sessions", title: "Managing Sessions", level: 2 as const },
  { id: "exporting-sessions", title: "Exporting Sessions", level: 2 as const },
  { id: "tips", title: "Tips", level: 2 as const },
];

export default function FirstSessionPage() {
  const { prev, next } = getPrevNext("/docs/getting-started/first-session/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Getting Started", href: "/docs/getting-started/" },
          { label: "First Session" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>First Session</h1>
          <p>
            Now that the CLI is installed and connected to LMX, it is time to run your
            first AI session. This page covers interactive chat, autonomous task
            execution, permission handling, and session management.
          </p>

          <h2 id="start-a-chat">Start a Chat</h2>
          <p>
            The simplest way to interact with your local AI is the{" "}
            <code>opta chat</code> command. This opens an interactive chat session in
            your terminal.
          </p>

          <StepList
            steps={[
              {
                title: "Launch interactive chat",
                description:
                  "This starts the daemon (if not already running) and opens a new chat session.",
                content: (
                  <CommandBlock command="opta chat" />
                ),
              },
              {
                title: "Type your first prompt",
                description:
                  "Once the session is active, type a message and press Enter.",
                content: (
                  <CodeBlock
                    language="text"
                    filename="Chat session"
                    code={`> Explain the difference between let and const in TypeScript.

In TypeScript (and JavaScript), \`let\` and \`const\` are both block-scoped
variable declarations, but they differ in mutability:

- **const** declares a variable that cannot be reassigned after initialization.
  The binding is immutable, though object properties can still be modified.

- **let** declares a variable that can be reassigned. Use it when the value
  needs to change during execution.

Best practice: default to \`const\` and only use \`let\` when reassignment
is genuinely needed.`}
                  />
                ),
              },
              {
                title: "Continue the conversation",
                description:
                  "The session maintains full context. Follow-up messages reference the entire conversation history.",
                content: (
                  <CodeBlock
                    language="text"
                    filename="Follow-up"
                    code={`> Give me an example of when let is necessary.

A common case is loop counters:

for (let i = 0; i < items.length; i++) {
  // 'i' must be reassigned each iteration
  process(items[i]);
}

You cannot use \`const\` here because the value of \`i\` changes on each loop.`}
                  />
                ),
              },
              {
                title: "Exit the session",
                description:
                  "Press Ctrl+C or type /exit to end the chat session.",
                content: (
                  <CommandBlock command="/exit" />
                ),
              },
            ]}
          />

          <Callout variant="tip" title="One-shot mode">
            For quick questions without an interactive session, use the{" "}
            <code>--once</code> flag:
            <div className="mt-2">
              <code>opta chat --once &quot;What is the capital of Australia?&quot;</code>
            </div>
            This prints the response and exits immediately.
          </Callout>

          <h2 id="understanding-streaming">Understanding Streaming</h2>
          <p>
            Responses stream token-by-token as the model generates them. You will see
            text appearing incrementally in your terminal rather than waiting for the
            complete response.
          </p>
          <p>
            During streaming, the CLI shows:
          </p>
          <ul>
            <li><strong>Token output</strong> -- the response text, rendered as it arrives</li>
            <li><strong>Thinking indicators</strong> -- for reasoning models, a spinner or thinking block shows the model&apos;s internal reasoning before the final response</li>
            <li><strong>Turn statistics</strong> -- after each response, the CLI displays token count, generation speed (tokens/sec), and elapsed time</li>
          </ul>

          <CodeBlock
            language="text"
            filename="Turn statistics"
            code={`--- Turn complete ---
Tokens: 147 (prompt: 52, completion: 95)
Speed:  41.2 tok/s
Time:   2.3s`}
          />

          <h2 id="do-mode">Do Mode</h2>
          <p>
            While <code>opta chat</code> is conversational, <code>opta do</code> is
            action-oriented. It tells the AI to complete a specific task using available
            tools -- file operations, shell commands, code analysis, and more.
          </p>

          <CommandBlock
            command='opta do "Create a TypeScript function that validates email addresses using a regex, with unit tests"'
            description="Run an autonomous task"
          />

          <p>
            In do mode, the AI will:
          </p>
          <ol>
            <li>Analyze the task and plan the approach</li>
            <li>Use tools to read existing files, create new files, and run commands</li>
            <li>Ask for permission before potentially destructive operations</li>
            <li>Report the results when the task is complete</li>
          </ol>

          <Callout variant="info" title="Chat vs Do">
            <strong>Chat</strong> is for conversation, questions, and exploration. The
            model responds with text but does not take actions.{" "}
            <strong>Do</strong> is for task execution. The model actively uses tools to
            modify files, run commands, and complete objectives. Use chat when you want
            advice; use do when you want results.
          </Callout>

          <h2 id="permission-prompts">Permission Prompts</h2>
          <p>
            When the AI wants to perform an action in do mode, the CLI prompts you for
            approval. This is the permission system -- it ensures no tool runs without
            your explicit consent.
          </p>

          <CodeBlock
            language="text"
            filename="Permission prompt"
            code={`Tool: write_file
Path: src/utils/validate-email.ts
Content: [142 lines]

Allow this action? [y]es / [n]o / [a]lways for this tool: `}
          />

          <p>
            Your options at each permission prompt:
          </p>
          <ul>
            <li><strong>y</strong> (yes) -- approve this single invocation</li>
            <li><strong>n</strong> (no) -- deny this invocation; the AI will try an alternative approach</li>
            <li><strong>a</strong> (always) -- approve all future invocations of this tool for the current session</li>
          </ul>

          <Callout variant="warning" title="Safe tools auto-approve">
            Some read-only tools (like <code>read_file</code> and{" "}
            <code>list_directory</code>) are classified as safe and auto-approve
            without prompting. Write operations, shell commands, and destructive
            actions always require explicit approval.
          </Callout>

          <h2 id="managing-sessions">Managing Sessions</h2>
          <p>
            Every chat and do interaction creates a session. Sessions store the full
            conversation history, tool invocations, and metadata. You can list, resume,
            and manage sessions after they end.
          </p>

          <StepList
            steps={[
              {
                title: "List recent sessions",
                content: (
                  <CommandBlock
                    command="opta sessions list"
                    output={`ID          Mode   Created              Turns  Title
a1b2c3d4    chat   2026-03-01 10:15:00  8      TypeScript let vs const
e5f6g7h8    do     2026-03-01 10:22:00  3      Email validation function
i9j0k1l2    chat   2026-02-28 16:40:00  12     React hook patterns`}
                  />
                ),
              },
              {
                title: "Resume a previous session",
                description:
                  "Continue a conversation from where you left off. The full context is restored.",
                content: (
                  <CommandBlock command="opta chat --resume a1b2c3d4" />
                ),
              },
              {
                title: "View session details",
                description:
                  "Inspect metadata, token usage, and tool call history for a session.",
                content: (
                  <CommandBlock
                    command="opta sessions show a1b2c3d4"
                    output={`Session: a1b2c3d4
Mode:    chat
Created: 2026-03-01 10:15:00
Turns:   8
Tokens:  1,247 (prompt) + 892 (completion)
Tools:   0 invocations
Title:   TypeScript let vs const`}
                  />
                ),
              },
            ]}
          />

          <h2 id="exporting-sessions">Exporting Sessions</h2>
          <p>
            Sessions can be exported in multiple formats for sharing, archiving, or
            processing:
          </p>

          <CommandBlock
            command="opta sessions export a1b2c3d4 --format markdown --output session.md"
            description="Export a session to Markdown"
          />

          <p>
            Supported export formats:
          </p>
          <ul>
            <li><strong>markdown</strong> -- human-readable Markdown document</li>
            <li><strong>json</strong> -- full session data including metadata and tool calls</li>
            <li><strong>text</strong> -- plain text transcript</li>
          </ul>

          <CommandBlock
            command="opta sessions export a1b2c3d4 --format json --output session.json"
            description="Export full session data as JSON"
          />

          <h2 id="tips">Tips</h2>

          <Callout variant="tip" title="Slash commands in chat">
            During an interactive chat session, you can use slash commands for quick
            actions without leaving the session:
            <ul className="mt-2 mb-0">
              <li><code>/model</code> -- switch the active model</li>
              <li><code>/session</code> -- view current session info</li>
              <li><code>/debug</code> -- toggle debug output</li>
              <li><code>/help</code> -- list all available slash commands</li>
            </ul>
          </Callout>

          <Callout variant="tip" title="Model selection">
            By default, the CLI uses whatever model is currently loaded on LMX. To
            request a specific model:
            <div className="mt-2">
              <code>opta chat --model qwen3-30b-a3b</code>
            </div>
            If the requested model is not loaded, LMX will attempt to load it
            (unloading the current model if necessary to free VRAM).
          </Callout>

          <p>
            You are now ready to use the full Opta Local stack. The next section covers
            the CLI reference in detail, including all available commands, configuration
            options, and slash commands.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
