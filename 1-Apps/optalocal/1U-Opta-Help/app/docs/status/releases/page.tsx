import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "release-view-purpose", title: "Release View Purpose", level: 2 as const },
  { id: "release-states", title: "Release States", level: 2 as const },
  { id: "pre-release-checks", title: "Pre-release Checks", level: 2 as const },
  { id: "rollout-actions", title: "Rollout Actions", level: 2 as const },
  { id: "post-release-verification", title: "Post-release Verification", level: 2 as const },
];

export default function StatusReleasesPage() {
  const { prev, next } = getPrevNext("/docs/status/releases/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Status", href: "/docs/status/" },
          { label: "Releases" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Releases</h1>
          <p className="lead">
            The Releases view tells you where each release stands, what might block it,
            and what action is required to move forward safely.
          </p>

          <h2 id="release-view-purpose">Release View Purpose</h2>
          <p>
            Use this view to decide whether to promote, pause, rollback, or close a release.
            It should combine delivery status, risk signals, and ownership into one timeline.
          </p>

          <h2 id="release-states">Release States</h2>
          <ul>
            <li>
              <strong>Planned</strong> -- scoped but not yet deployed.
            </li>
            <li>
              <strong>In Progress</strong> -- deployment or rollout actively underway.
            </li>
            <li>
              <strong>Blocked</strong> -- cannot continue due to a dependency or failure.
            </li>
            <li>
              <strong>Rolled Out</strong> -- delivered to target environment/cohort.
            </li>
            <li>
              <strong>Rolled Back</strong> -- reverted to protect reliability.
            </li>
          </ul>

          <CodeBlock
            language="text"
            filename="Release Entry Example"
            code={`Release: opta-help@2026.03.04.1
State: In Progress
Scope: Status docs + nav wiring
Risk: Low
Blockers: None
Owner: docs-platform
Next Action: validate links in staging, then promote`}
          />

          <h2 id="pre-release-checks">Pre-release Checks</h2>
          <ol>
            <li>Validate change scope and rollback path.</li>
            <li>Confirm dependent services are healthy.</li>
            <li>Ensure on-call/owner assignment is explicit.</li>
            <li>Capture go/no-go signal and timestamp.</li>
          </ol>

          <h2 id="rollout-actions">Rollout Actions</h2>
          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Condition</th>
                  <th>Action</th>
                  <th>Owner Response</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>No regressions in early cohort</td>
                  <td>Expand rollout</td>
                  <td>Post timestamped checkpoint</td>
                </tr>
                <tr>
                  <td>Minor regression with workaround</td>
                  <td>Hold expansion</td>
                  <td>Patch and re-verify</td>
                </tr>
                <tr>
                  <td>Major user-facing breakage</td>
                  <td>Rollback immediately</td>
                  <td>Open incident and recovery plan</td>
                </tr>
                <tr>
                  <td>Unknown state due to missing telemetry</td>
                  <td>Freeze rollout</td>
                  <td>Restore observability before proceeding</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="post-release-verification">Post-release Verification</h2>
          <p>
            Mark a release complete only after monitoring confirms expected behavior across
            the intended user scope. A deployment is not finished when shipping ends; it is
            finished when risk returns to baseline.
          </p>

          <Callout variant="warning" title="Do not close with open blockers">
            If any critical blocker remains unresolved, keep the release in blocked or
            rolled-back state and track ownership to closure.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
