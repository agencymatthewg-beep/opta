"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";

const tocItems = [
  { id: "session-recording", title: "Session Recording", level: 2 as const },
  { id: "steps-jsonl", title: "Steps Log (steps.jsonl)", level: 2 as const },
  { id: "visual-diff", title: "Visual Diff", level: 2 as const },
  { id: "recordings-manifest", title: "Recordings Manifest", level: 2 as const },
  { id: "approval-log", title: "Approval Log", level: 2 as const },
  { id: "run-corpus", title: "Run Corpus", level: 2 as const },
];

export default function BrowserAutomationRecordingPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Browser Automation", href: "/docs/browser-automation/" },
          { label: "Recording & Replay" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Recording &amp; Replay</h1>
          <p className="lead">
            Every browser automation session is recorded with step-by-step
            logs, visual diffs, and approval records. These recordings
            enable debugging, audit trails, and test replay.
          </p>

          <h2 id="session-recording">Session Recording</h2>
          <p>
            When the AI performs browser automation, every action is logged
            to a session directory under <code>.opta/browser/</code>. Each
            session gets its own folder (e.g., <code>sess-int-02/</code>)
            containing all recording artifacts. This happens automatically
            -- there is no configuration needed to enable recording.
          </p>
          <p>
            The recording system captures:
          </p>
          <ul>
            <li>Every tool invocation with its arguments and results</li>
            <li>Screenshots at key interaction points</li>
            <li>Visual diffs comparing before and after states</li>
            <li>Policy decisions (approved, denied, auto-approved)</li>
            <li>Timing data for each step</li>
          </ul>

          <h2 id="steps-jsonl">Steps Log (steps.jsonl)</h2>
          <p>
            The primary recording artifact is <code>steps.jsonl</code>, a
            newline-delimited JSON file where each line represents one tool
            invocation. Each entry includes:
          </p>

          <CodeBlock
            language="json"
            filename="steps.jsonl (example entry)"
            code={`{
  "step": 3,
  "tool": "click",
  "args": { "selector": "[data-testid='submit-button']" },
  "result": { "success": true },
  "timestamp": "2026-03-01T14:23:45.123Z",
  "duration_ms": 142,
  "policy": "auto-approved"
}`}
          />

          <p>
            The JSONL format is chosen for append-only efficiency -- each
            step is written as it completes, so recordings survive crashes
            or interruptions. You can stream the file with standard tools
            like <code>tail -f</code> to watch automation in progress.
          </p>

          <h2 id="visual-diff">Visual Diff</h2>
          <p>
            The visual diff system captures screenshots before and after
            key interactions and compares them to detect visual changes.
            Two files track this data:
          </p>
          <ul>
            <li>
              <strong>visual-diff-manifest.jsonl</strong> -- maps each diff
              entry to its before/after screenshot paths and the triggering
              tool call
            </li>
            <li>
              <strong>visual-diff-results.jsonl</strong> -- contains the
              comparison results, including pixel difference percentage and
              detected change regions
            </li>
          </ul>
          <p>
            Visual diffs are useful for verifying that browser interactions
            had the expected effect. If a click was supposed to open a modal,
            the diff shows whether the modal actually appeared.
          </p>

          <Callout variant="tip" title="Debugging failed automations">
            When a browser automation task fails, check the visual diff
            results first. They often reveal what the AI expected to see
            versus what actually happened -- a common source of automation
            failures is pages that load differently than expected.
          </Callout>

          <h2 id="recordings-manifest">Recordings Manifest</h2>
          <p>
            Each session directory contains a <code>recordings.json</code>{" "}
            file that serves as a manifest for all recording artifacts in
            that session. It includes:
          </p>
          <ul>
            <li>Session ID and metadata (start time, duration, status)</li>
            <li>List of all captured screenshots with paths</li>
            <li>Step count and tool call summary</li>
            <li>Links to the steps log, visual diff files, and approval log</li>
          </ul>
          <p>
            The manifest provides a quick overview of a session without
            needing to parse the full JSONL step log.
          </p>

          <h2 id="approval-log">Approval Log</h2>
          <p>
            The file <code>approval-log.jsonl</code> (stored at the browser
            root level, not per-session) records every policy decision made
            during browser automation. Each entry captures:
          </p>
          <ul>
            <li>Which tool was invoked</li>
            <li>The policy decision (approved, denied, auto-approved, user-approved)</li>
            <li>Who approved it (system policy or user confirmation)</li>
            <li>Timestamp and session context</li>
          </ul>
          <p>
            This log serves as an audit trail for security review. You can
            verify that no browser actions were taken without proper
            authorization.
          </p>

          <h2 id="run-corpus">Run Corpus</h2>
          <p>
            The run corpus (<code>.opta/browser/run-corpus/</code>) stores
            reference recordings that can be used for test replay. The{" "}
            <code>latest.json</code> file points to the most recent
            complete automation run.
          </p>
          <p>
            Run corpus recordings are useful for regression testing -- you
            can replay a previously successful automation sequence to verify
            that a web application still behaves as expected after changes.
          </p>

          <Callout variant="info" title="File locations">
            All browser recording artifacts are stored under{" "}
            <code>.opta/browser/</code> in the project root. Session
            directories are named with the pattern{" "}
            <code>sess-int-NN/</code>. The approval log and run corpus
            are at the browser root level.
          </Callout>

          <PrevNextNav
            prev={{ title: "Tools", href: "/docs/browser-automation/tools/" }}
            next={{ title: "Security", href: "/docs/security/" }}
          />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
