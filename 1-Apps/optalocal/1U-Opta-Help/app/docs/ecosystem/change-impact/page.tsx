import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { getPrevNext } from "@/lib/content";

const tocItems = [
  { id: "workflow-goal", title: "Workflow Goal", level: 2 as const },
  { id: "when-to-run", title: "When to Run", level: 2 as const },
  { id: "required-inputs", title: "Required Inputs", level: 2 as const },
  { id: "workflow-steps", title: "Workflow Steps", level: 2 as const },
  { id: "output-checklist-shape", title: "Output Checklist Shape", level: 2 as const },
  { id: "quick-start", title: "Quick Start", level: 2 as const },
];

export default function ChangeImpactWorkflowPage() {
  const { prev, next } = getPrevNext("/docs/ecosystem/change-impact/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Ecosystem", href: "/docs/ecosystem/" },
          { label: "Change Impact Workflow" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Change Impact Workflow</h1>
          <p className="lead">
            The change-impact workflow converts a natural-language change description into a
            ripple-effect checklist across runtime layer docs, web surfaces, logos, and release nodes.
          </p>

          <h2 id="workflow-goal">Workflow Goal</h2>
          <p>
            Prevent stale ecosystem content after shipping changes. Instead of manually guessing what
            to update, follow the canonical workflow and registry map in <code>content-sync-map</code>.
          </p>

          <h2 id="when-to-run">When to Run</h2>
          <ul>
            <li>Any runtime layer feature or behavior change (CLI, daemon, LMX, Init, Code)</li>
            <li>Any logo or brand-asset update</li>
            <li>Any release cut, channel move, or deployment URL change</li>
            <li>Any app add/remove/rename in the ecosystem</li>
          </ul>

          <h2 id="required-inputs">Required Inputs</h2>
          <p>
            The workflow depends on these canonical files:
          </p>
          <CodeBlock
            language="text"
            filename="content-sync-map inputs"
            code={`docs/content-sync-map/registry/apps.yaml
docs/content-sync-map/registry/logos.yaml
docs/content-sync-map/registry/content-nodes.yaml
docs/content-sync-map/workflow/change-impact.md`}
          />

          <h2 id="workflow-steps">Workflow Steps</h2>
          <ol>
            <li>Identify affected app IDs from the change description.</li>
            <li>Filter content nodes by <code>describes</code> and matching <code>stale_when</code> conditions.</li>
            <li>If logos changed, include all files in <code>referenced_in</code> as mandatory updates.</li>
            <li>Group checklist output by surface (Help, Learn, Status, Home, Init, etc).</li>
            <li>Prioritize as MUST, SHOULD, and CONSIDER.</li>
          </ol>

          <Callout variant="warning" title="No skip path for logo references">
            Logo changes are always MUST-update items for every file listed in
            <code> registry/logos.yaml</code> under <code>referenced_in</code>.
          </Callout>

          <h2 id="output-checklist-shape">Output Checklist Shape</h2>
          <p>
            Keep checklist output file-specific and reason-tagged. Example structure:
          </p>
          <CodeBlock
            language="markdown"
            filename="change-impact checklist format"
            code={`## Update Checklist - [Change Description]

### MUST Update (direct impact)
- [ ] path/to/file - reason

### SHOULD Update (stale conditions match)
- [ ] path/to/file - reason

### CONSIDER Updating (indirect impact)
- [ ] path/to/file - reason`}
          />

          <h2 id="quick-start">Quick Start</h2>
          <p>
            Use the workspace slash command <code>/sync-check</code> or request:
            {' '}&quot;Run change-impact workflow for: [your change]&quot;.
          </p>
          <p>
            Related page: <a href="/docs/ecosystem/synergies/">Synergies</a>.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
