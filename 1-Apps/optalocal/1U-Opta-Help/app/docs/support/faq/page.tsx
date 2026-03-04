"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";

const tocItems = [
  { id: "setup-and-connectivity", title: "Setup & Connectivity", level: 2 as const },
  { id: "sessions-and-models", title: "Sessions & Models", level: 2 as const },
  { id: "security-and-permissions", title: "Security & Permissions", level: 2 as const },
  { id: "web-surfaces", title: "Web Surfaces", level: 2 as const },
];

export default function SupportFaqPage() {
  const { prev, next } = getPrevNext("/docs/support/faq/");

  return (
    <>
      <Breadcrumb items={[{ label: "Support" }, { label: "FAQ" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Support FAQ</h1>
          <p className="lead">
            Quick answers for the most common setup, connectivity, and runtime issues in the
            Opta Local stack.
          </p>

          <Callout variant="info" title="Need guided help?">
            For walkthrough-style onboarding, use <a href="https://learn.optalocal.com">Opta Learn</a>.
            Opta Help is the technical reference surface.
          </Callout>

          <h2 id="setup-and-connectivity">Setup & Connectivity</h2>

          <h3>Why does `opta chat` fail to connect?</h3>
          <p>
            Verify daemon health first, then LMX reachability. Typical checks are daemon on{" "}
            <code>127.0.0.1:9999</code> and LMX on your configured LAN host.
          </p>

          <h3>Do I install CLI, LMX, and Code separately?</h3>
          <p>
            Distribution is managed through Opta Init Manager. Treat Init as the canonical
            lifecycle entrypoint for local stack components.
          </p>

          <h3>Can I run everything on one machine?</h3>
          <p>
            Yes, but production setups typically keep LMX on a high-memory host and run CLI/Code
            from workstation clients.
          </p>

          <h2 id="sessions-and-models">Sessions & Models</h2>

          <h3>Where are sessions managed?</h3>
          <p>
            Session orchestration is owned by the daemon. CLI and Code Desktop are clients of the
            same session/control plane.
          </p>

          <h3>Why is a model available in LMX but not in my client?</h3>
          <p>
            The client view depends on daemon and LMX sync. Re-check daemon model operations and
            LMX health/model list endpoints.
          </p>

          <h2 id="security-and-permissions">Security & Permissions</h2>

          <h3>Are prompts and responses sent to cloud services?</h3>
          <p>
            Local inference flows remain local by default. Cloud providers are optional and only
            used when explicitly configured.
          </p>

          <h3>Why am I being asked to approve tool calls?</h3>
          <p>
            Tool permission prompts are enforced by daemon policy and guardrail mode. Review your
            current permission profile in CLI configuration.
          </p>

          <h2 id="web-surfaces">Web Surfaces</h2>

          <h3>What&apos;s the difference between Help and Learn?</h3>
          <p>
            Help is reference documentation. Learn is guide-driven onboarding and workflow training.
          </p>

          <h3>Where do I check current incidents and release state?</h3>
          <p>
            Use Opta Status at <a href="https://status.optalocal.com">status.optalocal.com</a> for
            live service and feature-state visibility.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}

