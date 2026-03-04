import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "why-synergies-matter", title: "Why Synergies Matter", level: 2 as const },
  { id: "runtime-synergies", title: "Runtime Synergies", level: 2 as const },
  { id: "runtime-web-synergies", title: "Runtime + Web Synergies", level: 2 as const },
  { id: "boundary-rules", title: "Boundary Rules", level: 2 as const },
  { id: "release-synergy-loop", title: "Release Synergy Loop", level: 2 as const },
];

export default function EcosystemSynergiesPage() {
  const { prev, next } = getPrevNext("/docs/ecosystem/synergies/");

  return (
    <>
      <Breadcrumb items={[{ label: "Ecosystem", href: "/docs/ecosystem/" }, { label: "Synergies" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Synergies</h1>
          <p className="lead">
            Synergy in Opta Local means each app stays in its role while amplifying adjacent layers:
            runtime contracts stay centralized, and web surfaces stay synchronized.
          </p>

          <h2 id="why-synergies-matter">Why Synergies Matter</h2>
          <p>
            Most regressions in a multi-app ecosystem are not isolated code bugs. They are mismatch
            bugs: one app changed but adjacent docs, status surfaces, or onboarding flows did not.
            Synergy work prevents that drift.
          </p>

          <h2 id="runtime-synergies">Runtime Synergies</h2>
          <p>
            The runtime layer has strong, intentional couplings:
          </p>
          <ul>
            <li><strong>1D (CLI/daemon)</strong> defines control-plane behavior and session semantics.</li>
            <li><strong>1M (LMX)</strong> owns inference/runtime semantics and discovery contract.</li>
            <li><strong>1P (Code)</strong> consumes daemon contracts rather than reimplementing orchestration logic.</li>
            <li><strong>1O (Init)</strong> handles lifecycle and distribution of runtime components.</li>
            <li><strong>1L (Dashboard)</strong> is an operational client of LMX APIs.</li>
          </ul>
          <p>
            Healthy runtime synergy means shared contracts, shared terminology, and explicit ownership.
          </p>

          <h2 id="runtime-web-synergies">Runtime + Web Synergies</h2>
          <p>
            Web surfaces should reflect runtime truth across support, marketing, status, and learning.
            Examples include feature status alignment, updated setup paths, and accurate API/port
            references after release changes.
          </p>
          <p>
            Opta Help (this app) sits in the web surfaces layer and should mirror runtime authority,
            not compete with it.
          </p>

          <h2 id="boundary-rules">Boundary Rules</h2>
          <ul>
            <li>Runtime contract changes originate from runtime-layer authorities.</li>
            <li>Web surfaces consume and communicate those contracts.</li>
            <li>Cross-surface updates are tracked through the <code>content-sync-map</code> registry.</li>
            <li>Any change with ecosystem blast radius should trigger the change-impact workflow.</li>
          </ul>

          <Callout variant="info" title="Practical check">
            Before shipping, ask: &quot;Did I update only my app, or did I update the ecosystem surfaces
            that describe my app?&quot; If unsure, run the change-impact workflow.
          </Callout>

          <h2 id="release-synergy-loop">Release Synergy Loop</h2>
          <ol>
            <li>Implement change in runtime or surface owner app.</li>
            <li>Run change-impact workflow against <code>content-sync-map</code>.</li>
            <li>Apply required updates across affected web surfaces and docs nodes.</li>
            <li>Publish with synchronized docs/status/training references.</li>
          </ol>

          <p>
            Next: use <a href="/docs/ecosystem/change-impact/">Change Impact Workflow</a> to turn
            this into a file-level checklist.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
