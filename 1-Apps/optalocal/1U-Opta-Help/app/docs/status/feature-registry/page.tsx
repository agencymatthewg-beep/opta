import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "registry-purpose", title: "Registry Purpose", level: 2 as const },
  { id: "maturity-model", title: "Maturity Model", level: 2 as const },
  { id: "availability-signals", title: "Availability Signals", level: 2 as const },
  { id: "operator-actions", title: "Operator Actions", level: 2 as const },
  { id: "promotion-criteria", title: "Promotion Criteria", level: 2 as const },
];

export default function StatusFeatureRegistryPage() {
  const { prev, next } = getPrevNext("/docs/status/feature-registry/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Status", href: "/docs/status/" },
          { label: "Feature Registry" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Feature Registry</h1>
          <p className="lead">
            The Feature Registry tracks what exists, who can use it, and how ready it is
            for broader adoption. It is the source of truth for feature maturity decisions.
          </p>

          <h2 id="registry-purpose">Registry Purpose</h2>
          <p>
            Use the registry when deciding whether to enable, expand, freeze, or retire a
            feature. It helps avoid accidental exposure of incomplete or high-risk behavior.
          </p>

          <h2 id="maturity-model">Maturity Model</h2>
          <ul>
            <li>
              <strong>Prototype</strong> -- exploratory, unstable, developer-only.
            </li>
            <li>
              <strong>Beta</strong> -- functional for limited cohort, may contain known gaps.
            </li>
            <li>
              <strong>General Availability</strong> -- production-ready with support expectations.
            </li>
            <li>
              <strong>Deprecated</strong> -- scheduled for removal; migration required.
            </li>
          </ul>

          <CodeBlock
            language="yaml"
            filename="Feature Registry Entry"
            code={`id: local_web_remote_access
title: Remote Access Tunnel
maturity: beta
availability: allowlist
owner: network-platform
lastUpdated: 2026-03-04T09:20:00+11:00
knownRisks:
  - tunnel setup drift
nextAction: validate onboarding runbook before GA`}
          />

          <h2 id="availability-signals">Availability Signals</h2>
          <p>
            Maturity alone is not enough. Also read availability constraints:
          </p>
          <ul>
            <li>
              <strong>Internal</strong> -- team-only use.
            </li>
            <li>
              <strong>Allowlist</strong> -- controlled external cohort.
            </li>
            <li>
              <strong>Default On</strong> -- enabled for all eligible users.
            </li>
            <li>
              <strong>Hidden/Off</strong> -- disabled pending fixes or policy updates.
            </li>
          </ul>

          <h2 id="operator-actions">Operator Actions</h2>
          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Registry Signal</th>
                  <th>Immediate Action</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Prototype + rising demand</td>
                  <td>Keep access restricted</td>
                  <td>Define beta entry criteria</td>
                </tr>
                <tr>
                  <td>Beta + stable metrics</td>
                  <td>Propose cohort expansion</td>
                  <td>Run GA readiness review</td>
                </tr>
                <tr>
                  <td>GA + recurring incidents</td>
                  <td>Pause expansion</td>
                  <td>Initiate reliability hardening</td>
                </tr>
                <tr>
                  <td>Deprecated + active usage</td>
                  <td>Publish migration deadline</td>
                  <td>Track team-by-team migration</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="promotion-criteria">Promotion Criteria</h2>
          <p>
            Promote a feature only when quality signals and operational readiness both pass:
            clear owner, reliable behavior, support runbook, and rollback path.
          </p>

          <Callout variant="info" title="Promotion is reversible">
            If a promoted feature regresses, downgrade its maturity and availability in the
            registry immediately. Keep status truthful rather than optimistic.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
