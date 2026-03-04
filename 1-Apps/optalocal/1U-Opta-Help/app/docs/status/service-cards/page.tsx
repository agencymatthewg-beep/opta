import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "card-anatomy", title: "Card Anatomy", level: 2 as const },
  { id: "health-states", title: "Health States", level: 2 as const },
  { id: "triage-flow", title: "Triage Flow", level: 2 as const },
  { id: "recommended-actions", title: "Recommended Actions", level: 2 as const },
  { id: "update-discipline", title: "Update Discipline", level: 2 as const },
];

export default function StatusServiceCardsPage() {
  const { prev, next } = getPrevNext("/docs/status/service-cards/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Status", href: "/docs/status/" },
          { label: "Service Cards" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Service Cards</h1>
          <p className="lead">
            Service Cards summarize operational health for each critical service.
            Read them first during incidents, rollout checks, and daily reliability review.
          </p>

          <h2 id="card-anatomy">Card Anatomy</h2>
          <p>
            A service card should give a fast answer to one question: can this service
            safely support current traffic and release activity?
          </p>
          <p>
            Each card should include: service name, current state, key metrics, last
            update timestamp, impact scope, and clear ownership.
          </p>

          <CodeBlock
            language="json"
            filename="Service Card Shape"
            code={`{
  "service": "opta-daemon",
  "state": "degraded",
  "lastUpdated": "2026-03-04T10:58:00+11:00",
  "signals": {
    "errorRatePct": 3.1,
    "p95LatencyMs": 790,
    "availabilityPct": 99.2
  },
  "impact": "CLI sessions intermittently fail to start",
  "owner": "runtime-platform"
}`}
          />

          <h2 id="health-states">Health States</h2>
          <ul>
            <li>
              <strong>Healthy</strong> -- metrics within normal thresholds, no active user impact.
            </li>
            <li>
              <strong>Degraded</strong> -- service is running but with measurable reliability or performance risk.
            </li>
            <li>
              <strong>Down</strong> -- unavailable or non-functional for normal workflows.
            </li>
            <li>
              <strong>Unknown</strong> -- status source missing, stale, or inconsistent.
            </li>
          </ul>

          <h2 id="triage-flow">Triage Flow</h2>
          <ol>
            <li>Check freshness first. If stale, re-validate before acting.</li>
            <li>Confirm whether impact is internal-only or user-facing.</li>
            <li>Compare metric trend with known baseline, not just current value.</li>
            <li>Escalate if degraded/down persists beyond your service SLO window.</li>
          </ol>

          <h2 id="recommended-actions">Recommended Actions</h2>
          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Do Now</th>
                  <th>Do Next</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Healthy</td>
                  <td>Continue planned rollout</td>
                  <td>Monitor trend drift</td>
                </tr>
                <tr>
                  <td>Degraded</td>
                  <td>Pause risky deploys</td>
                  <td>Assign owner and mitigation ETA</td>
                </tr>
                <tr>
                  <td>Down</td>
                  <td>Declare incident, route traffic if possible</td>
                  <td>Begin restore + postmortem trail</td>
                </tr>
                <tr>
                  <td>Unknown</td>
                  <td>Collect direct health checks</td>
                  <td>Fix observability gap</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="update-discipline">Update Discipline</h2>
          <p>
            Keep updates short, timestamped, and ownership-explicit. If a card changes
            state, include one concrete next step so readers can immediately continue work
            without re-triaging the same issue.
          </p>

          <Callout variant="tip" title="Use explicit time windows">
            Prefer exact timestamps and expected re-check windows over words like
            &quot;soon&quot; or &quot;later&quot;. Actionable status requires precise timing.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
