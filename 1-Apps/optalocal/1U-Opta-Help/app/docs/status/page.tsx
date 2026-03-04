import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "status-views", title: "Status Views", level: 2 as const },
  { id: "reading-signals", title: "Reading Signals", level: 2 as const },
  { id: "action-workflow", title: "Action Workflow", level: 2 as const },
  { id: "common-playbooks", title: "Common Playbooks", level: 2 as const },
  { id: "when-to-escalate", title: "When to Escalate", level: 2 as const },
];

export default function StatusOverviewPage() {
  const { prev, next } = getPrevNext("/docs/status/");

  return (
    <>
      <Breadcrumb items={[{ label: "Status", href: "/docs/status/" }, { label: "Overview" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Status Overview</h1>
          <p className="lead">
            The Status section explains how to interpret operational health, release
            progress, and feature readiness. Use these pages to decide whether to keep
            moving, mitigate risk, or escalate.
          </p>

          <h2 id="status-views">Status Views</h2>
          <p>
            Status is split into four views so you can isolate the kind of decision you
            need to make:
          </p>
          <ul>
            <li>
              <strong>Overview</strong> -- how the full status system works and when to use each view.
            </li>
            <li>
              <strong><a href="/docs/status/service-cards/">Service Cards</a></strong> -- runtime health and reliability signals for live services.
            </li>
            <li>
              <strong><a href="/docs/status/releases/">Releases</a></strong> -- rollout state, blockers, and post-release confidence.
            </li>
            <li>
              <strong><a href="/docs/status/feature-registry/">Feature Registry</a></strong> -- feature maturity, availability, and actionability.
            </li>
          </ul>

          <h2 id="reading-signals">Reading Signals</h2>
          <p>
            Every status view should be read in this order:
          </p>
          <ol>
            <li>
              <strong>State</strong> -- the current explicit status (healthy, degraded, blocked, beta, and so on).
            </li>
            <li>
              <strong>Freshness</strong> -- when that status was last updated.
            </li>
            <li>
              <strong>Impact</strong> -- which users, teams, or workflows are affected.
            </li>
            <li>
              <strong>Owner and next action</strong> -- who owns the item and what should happen next.
            </li>
          </ol>

          <Callout variant="info" title="Stale status is a risk">
            Treat old status data as unknown state. If freshness is outside your expected
            update window, verify directly before making release or incident decisions.
          </Callout>

          <h2 id="action-workflow">Action Workflow</h2>
          <p>
            Once you identify a concerning signal, use a simple response loop:
          </p>
          <ol>
            <li>Confirm whether the signal is current and reproducible.</li>
            <li>Classify impact as local, team-wide, or user-facing.</li>
            <li>Apply the relevant playbook for service, release, or feature status.</li>
            <li>Document the update so the next reader has a clear current state.</li>
          </ol>

          <h2 id="common-playbooks">Common Playbooks</h2>
          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Immediate Action</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Service health downgraded</td>
                  <td>Freeze risky changes and verify telemetry</td>
                  <td>Open incident thread and assign owner</td>
                </tr>
                <tr>
                  <td>Release blocked</td>
                  <td>Pause rollout expansion</td>
                  <td>Track blocker to resolution or rollback</td>
                </tr>
                <tr>
                  <td>Feature marked experimental</td>
                  <td>Limit usage to approved cohort</td>
                  <td>Collect validation data before promotion</td>
                </tr>
                <tr>
                  <td>Status update is stale</td>
                  <td>Re-check source systems</td>
                  <td>Refresh status with timestamp and owner</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="when-to-escalate">When to Escalate</h2>
          <p>
            Escalate immediately when you see user-facing impact, conflicting status
            signals, repeated regression after rollback, or unknown ownership for a
            critical item.
          </p>

          <CodeBlock
            language="text"
            filename="Status Escalation Template"
            code={`State: degraded
Scope: user-facing API latency spike
Observed At: 2026-03-04T11:42:00+11:00
Owner: unassigned
Immediate Action: paused rollout, started incident response
Requested Support: release owner + service owner`}
          />

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
