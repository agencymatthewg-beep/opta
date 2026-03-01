"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "permission-system", title: "Permission System", level: 2 as const },
  { id: "default-permissions", title: "Default Permissions", level: 2 as const },
  { id: "permission-prompts", title: "Permission Prompts", level: 2 as const },
  { id: "do-mode-auto-approve", title: "Do Mode Auto-Approve", level: 2 as const },
  { id: "cas-resolution", title: "CAS Resolution", level: 2 as const },
  { id: "s01-rule", title: "S01: Permission Check Rule", level: 2 as const },
];

export default function SecurityPermissionsPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Security", href: "/docs/security/" },
          { label: "Permissions" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Permissions</h1>
          <p className="lead">
            The permission system controls what tools the AI agent can invoke,
            requiring explicit user approval for potentially destructive
            operations while auto-approving safe read-only actions.
          </p>

          <h2 id="permission-system">Permission System</h2>
          <p>
            Every tool invocation passes through a permission check before
            execution. The permission system evaluates the tool name and
            its arguments against a set of rules to determine one of three
            outcomes:
          </p>
          <ul>
            <li><strong>Allow</strong> -- the tool executes immediately without user interaction</li>
            <li><strong>Ask</strong> -- the user is prompted to approve or deny the tool call</li>
            <li><strong>Deny</strong> -- the tool call is blocked outright</li>
          </ul>

          <h2 id="default-permissions">Default Permissions</h2>
          <p>
            The following table shows the default permission for each tool
            category. These defaults apply in <code>chat</code> mode. The{" "}
            <code>do</code> mode overrides are described below.
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Tool</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Default</th>
                  <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Rationale</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">read_file</td>
                  <td className="px-4 py-2.5 text-neon-green">Allow</td>
                  <td className="px-4 py-2.5">Reading files is non-destructive</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">write_file</td>
                  <td className="px-4 py-2.5 text-neon-amber">Ask</td>
                  <td className="px-4 py-2.5">Writing modifies the filesystem</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">run_command</td>
                  <td className="px-4 py-2.5 text-neon-amber">Ask</td>
                  <td className="px-4 py-2.5">Commands can have side effects</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">search_files</td>
                  <td className="px-4 py-2.5 text-neon-green">Allow</td>
                  <td className="px-4 py-2.5">Search is read-only</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">list_directory</td>
                  <td className="px-4 py-2.5 text-neon-green">Allow</td>
                  <td className="px-4 py-2.5">Directory listing is read-only</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">browser_navigate</td>
                  <td className="px-4 py-2.5 text-neon-green">Allow</td>
                  <td className="px-4 py-2.5">Navigation is non-destructive</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">browser_click</td>
                  <td className="px-4 py-2.5 text-neon-amber">Ask</td>
                  <td className="px-4 py-2.5">Clicks can trigger actions on external sites</td>
                </tr>
                <tr className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-neon-cyan text-xs">browser_evaluate</td>
                  <td className="px-4 py-2.5 text-neon-amber">Ask</td>
                  <td className="px-4 py-2.5">Executes arbitrary JavaScript</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="permission-prompts">Permission Prompts</h2>
          <p>
            When a tool call requires approval (permission = &quot;Ask&quot;), the CLI
            displays a permission prompt showing:
          </p>
          <ul>
            <li>The tool name being invoked</li>
            <li>The arguments the model wants to pass</li>
            <li>A preview of the operation (e.g., file path, command to run)</li>
          </ul>
          <p>
            The user can respond with:
          </p>
          <ul>
            <li><strong>Yes (y)</strong> -- approve this specific tool call</li>
            <li><strong>No (n)</strong> -- deny this tool call (the model receives the denial and can try an alternative)</li>
            <li><strong>Always</strong> -- approve this tool for the remainder of the session</li>
          </ul>
          <p>
            The &quot;Always&quot; option avoids repeated prompts for the same tool
            type during long sessions.
          </p>

          <h2 id="do-mode-auto-approve">Do Mode Auto-Approve</h2>
          <p>
            In <code>do</code> mode (autonomous task execution), safe tools
            are auto-approved to enable fluent agent loops. The model can
            read files, search directories, navigate browsers, and take
            screenshots without prompting the user.
          </p>
          <p>
            Destructive operations -- file writes, command execution,
            JavaScript evaluation -- still require user approval even in
            do mode. This provides a balance between autonomy and safety.
          </p>

          <Callout variant="warning" title="Do mode is not unguarded">
            Auto-approval in do mode only applies to read-only tools. Any
            tool that can modify state, execute code, or send data still
            requires your explicit confirmation.
          </Callout>

          <h2 id="cas-resolution">CAS Resolution</h2>
          <p>
            When multiple tool calls arrive concurrently (e.g., the model
            requests several file reads simultaneously), there is a race
            condition risk where one permission check might interfere with
            another. Opta resolves this using a CAS (Compare-And-Swap)
            mechanism that serializes permission decisions per session.
          </p>
          <p>
            This ensures that each permission prompt is presented and
            resolved independently, even when the model requests parallel
            tool invocations.
          </p>

          <h2 id="s01-rule">S01: Permission Check Rule</h2>
          <p>
            Rule S01 in the Strict tier mandates that every tool invocation
            must pass through the permission check pipeline. No tool can
            bypass the permission system, even internal or system-level
            tools. This rule is enforced at the daemon level and cannot be
            disabled by configuration.
          </p>

          <Callout variant="info" title="Strict enforcement">
            S01 is a Strict-tier rule, meaning it is enforced by default but
            can be overridden on a per-instance basis with user approval. In
            practice, S01 is never overridden -- it serves as a structural
            guarantee that permission checks are always present.
          </Callout>

          <PrevNextNav
            prev={{ title: "Overview", href: "/docs/security/" }}
            next={{ title: "Privacy", href: "/docs/security/privacy/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
