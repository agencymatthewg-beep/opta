"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "listing-sessions", title: "Listing Sessions", level: 2 as const },
  { id: "viewing-a-session", title: "Viewing a Session", level: 2 as const },
  { id: "exporting-sessions", title: "Exporting Sessions", level: 2 as const },
  { id: "deleting-sessions", title: "Deleting Sessions", level: 2 as const },
  { id: "storage-location", title: "Storage Location", level: 2 as const },
  { id: "session-format", title: "Session Format", level: 2 as const },
  { id: "cross-client-continuity", title: "Cross-Client Continuity", level: 2 as const },
];

export default function SessionsPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "CLI Reference", href: "/docs/cli/" },
          { label: "Sessions" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Sessions</h1>
          <p className="lead">
            Every conversation and task in Opta is tracked as a session. Use the{" "}
            <code>sessions</code> command group to list, inspect, export, and
            manage your session history.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            Sessions are the fundamental unit of interaction in Opta. Each{" "}
            <code>opta chat</code> or <code>opta do</code> invocation creates a
            new session (or resumes an existing one). Sessions persist all
            messages, tool calls, tool results, and metadata to disk so you can
            review, export, or continue them later.
          </p>

          <h2 id="listing-sessions">Listing Sessions</h2>
          <p>
            <code>opta sessions list</code> shows all stored sessions, sorted by
            most recent first. Each entry displays the session ID, title
            (auto-generated from the first message), creation date, and message
            count.
          </p>

          <CommandBlock
            command="opta sessions list"
            output={`ID          Title                          Created           Messages
abc12345    Refactor auth module           2 hours ago       24
def67890    Add JWT validation             Yesterday         18
ghi11223    Fix TypeScript errors          3 days ago        12
jkl44556    Write API documentation        5 days ago        31`}
            description="List all sessions"
          />

          <h2 id="viewing-a-session">Viewing a Session</h2>
          <p>
            <code>opta sessions show</code> displays the full contents of a
            session, including all messages, tool calls, and results. Use this to
            review what happened in a previous conversation or task.
          </p>

          <CommandBlock
            command="opta sessions show abc12345"
            description="View a specific session"
          />

          <CommandBlock
            command="opta sessions show abc12345 --compact"
            description="View session with collapsed tool calls"
          />

          <h2 id="exporting-sessions">Exporting Sessions</h2>
          <p>
            <code>opta sessions export</code> writes a session to a file in JSON
            format. This is useful for sharing sessions, archiving important
            conversations, or processing session data with external tools.
          </p>

          <CommandBlock
            command="opta sessions export abc12345"
            output="Exported to ./opta-session-abc12345.json"
            description="Export a session to JSON"
          />

          <CommandBlock
            command="opta sessions export abc12345 --output ~/exports/auth-refactor.json"
            description="Export to a specific path"
          />

          <h2 id="deleting-sessions">Deleting Sessions</h2>
          <p>
            <code>opta sessions delete</code> permanently removes a session from
            disk. This action cannot be undone.
          </p>

          <CommandBlock
            command="opta sessions delete abc12345"
            output="Session abc12345 deleted."
            description="Delete a session"
          />

          <Callout variant="danger" title="Permanent deletion">
            Deleting a session removes all messages, tool calls, and metadata
            permanently. There is no trash or undo. Export the session first if
            you may need it later.
          </Callout>

          <h2 id="storage-location">Storage Location</h2>
          <p>
            Sessions are stored as JSON files in the daemon&apos;s configuration
            directory. Each session gets its own subdirectory containing the
            session data and any associated metadata.
          </p>

          <CodeBlock
            code={`~/.config/opta/sessions/
├── abc12345/
│   ├── session.json        # Messages, tool calls, metadata
│   └── metadata.json       # Title, timestamps, stats
├── def67890/
│   ├── session.json
│   └── metadata.json
└── ...`}
            filename="Session storage structure"
          />

          <Callout variant="info">
            The session directory follows the XDG Base Directory specification.
            On macOS, this defaults to{" "}
            <code>~/.config/opta/sessions/</code>. On Linux, it respects the{" "}
            <code>XDG_CONFIG_HOME</code> environment variable.
          </Callout>

          <h2 id="session-format">Session Format</h2>
          <p>
            Sessions are stored as JSON, following the daemon v3 protocol
            schema. Each session contains an array of events including user
            messages, assistant responses, tool calls, and tool results.
          </p>

          <CodeBlock
            language="json"
            code={`{
  "sessionId": "abc12345",
  "title": "Refactor auth module",
  "createdAt": "2026-03-01T10:30:00Z",
  "updatedAt": "2026-03-01T11:15:00Z",
  "events": [
    {
      "type": "user.message",
      "content": "Refactor the auth module to use JWT",
      "seq": 1
    },
    {
      "type": "assistant.message",
      "content": "I'll refactor the auth module...",
      "seq": 2
    },
    {
      "type": "tool.call",
      "toolName": "read_file",
      "args": { "path": "src/auth/index.ts" },
      "seq": 3
    }
  ]
}`}
            filename="session.json"
          />

          <h2 id="cross-client-continuity">Cross-Client Continuity</h2>
          <p>
            Sessions created in the CLI are accessible from any Opta client that
            connects to the same daemon. This means you can start a conversation
            in the CLI, then continue it in the Opta Local Web interface or the
            Opta Code Desktop app.
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Client</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Read Sessions</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Create Sessions</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Resume Sessions</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Opta CLI</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5">Opta Local Web</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">Opta Code Desktop</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                  <td className="px-4 py-2.5 text-neon-green">Yes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Callout variant="tip" title="Resuming sessions">
            To resume a session from the CLI, pass the session ID to the chat
            command: <code>opta chat --session abc12345</code>. The conversation
            picks up exactly where you left off, with full context preserved.
          </Callout>

          <PrevNextNav
            prev={{ title: "Model Management", href: "/docs/cli/models/" }}
            next={{ title: "Configuration", href: "/docs/cli/configuration/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
