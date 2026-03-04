import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "two-layer-model", title: "Two-Layer Model", level: 2 as const },
  { id: "runtime-layer", title: "Runtime Layer", level: 2 as const },
  { id: "web-surfaces", title: "Web Surfaces", level: 2 as const },
  { id: "content-sync-map", title: "content-sync-map", level: 2 as const },
  { id: "next-actions", title: "Next Actions", level: 2 as const },
];

export default function EcosystemOverviewPage() {
  const { prev, next } = getPrevNext("/docs/ecosystem/");

  return (
    <>
      <Breadcrumb items={[{ label: "Ecosystem" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Ecosystem &amp; Synergies</h1>
          <p className="lead">
            Opta Local is organized as a two-layer ecosystem: a <strong>runtime layer</strong>
            {' '}that executes product behavior, and <strong>web surfaces</strong> that explain,
            distribute, support, and govern that runtime.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            This page is the bridge between architecture and documentation ownership. Use it to
            understand which apps are contract authorities, which apps are presentation surfaces,
            and where to run change-impact checks before shipping updates.
          </p>

          <h2 id="two-layer-model">Two-Layer Model</h2>
          <p>
            Canonical workspace architecture separates operational runtime from web delivery and
            management surfaces. This separation is intentional so runtime contracts stay stable
            while website content can evolve quickly.
          </p>

          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Primary Apps</th>
                  <th>Primary Responsibility</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Runtime layer</strong></td>
                  <td><code>1D</code>, <code>1L</code>, <code>1M</code>, <code>1O</code>, <code>1P</code></td>
                  <td>Inference, daemon control plane, desktop clients, and distribution lifecycle</td>
                </tr>
                <tr>
                  <td><strong>Web surfaces</strong></td>
                  <td><code>1R</code>, <code>1S</code>, <code>1T</code>, <code>1U</code>, <code>1V</code>, <code>1X</code></td>
                  <td>Accounts, status, marketing, help docs, learn content, and admin control plane</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="runtime-layer">Runtime Layer</h2>
          <p>
            The runtime layer owns protocol and behavior contracts. For example, daemon operations
            and session orchestration are authority-owned by CLI/daemon docs and code; UI clients
            should consume those contracts rather than redefining them.
          </p>
          <p>
            Runtime changes commonly impact command behavior, API semantics, model operations,
            discovery flows, and lifecycle tooling. These are high-blast-radius updates across the
            ecosystem.
          </p>

          <h2 id="web-surfaces">Web Surfaces</h2>
          <p>
            Web surfaces describe and operationalize runtime behavior for end users and operators.
            They include onboarding paths, feature status, release communication, troubleshooting,
            and account/control workflows.
          </p>
          <p>
            A web surface should never become a hidden contract authority. It should reference the
            runtime layer and remain consistent with it.
          </p>

          <Callout variant="warning" title="Contract authority rule">
            If a runtime contract changes, update runtime docs first, then update dependent web
            surfaces using the change-impact workflow. Do not let web pages define runtime truth.
          </Callout>

          <h2 id="content-sync-map">content-sync-map</h2>
          <p>
            The workspace uses <code>docs/content-sync-map/</code> as the cross-ecosystem map for
            change ripple analysis. It tracks app identities, content nodes, and stale conditions.
          </p>

          <CodeBlock
            language="text"
            filename="docs/content-sync-map/"
            code={`docs/content-sync-map/
+-- registry/apps.yaml
+-- registry/logos.yaml
+-- registry/content-nodes.yaml
\\-- workflow/change-impact.md`}
          />

          <p>
            For the procedural checklist, continue to{' '}
            <a href="/docs/ecosystem/change-impact/">Change Impact Workflow</a>. For cross-layer
            relationship guidance, see <a href="/docs/ecosystem/synergies/">Synergies</a>.
          </p>

          <h2 id="next-actions">Next Actions</h2>
          <ul>
            <li>Read <a href="/docs/ecosystem/synergies/">Synergies</a> to understand contract-safe collaboration patterns.</li>
            <li>Run <a href="/docs/ecosystem/change-impact/">Change Impact Workflow</a> for any runtime, web, logo, or release change.</li>
          </ul>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
