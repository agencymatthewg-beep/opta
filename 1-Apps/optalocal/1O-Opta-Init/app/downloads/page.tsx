import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opta Initializer — Downloads Gateway",
  description:
    "Downloads gateway for the Opta Initializer (Opta Init): desktop manager artifacts and signed release metadata only.",
};

export default function DownloadsGatewayPage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2.5rem 1rem 3rem" }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/">Back to Opta Init</Link>
      </p>
      <h1 style={{ marginBottom: "0.75rem" }}>Opta Initializer Downloads Gateway</h1>
      <p style={{ marginBottom: "1rem", lineHeight: 1.55 }}>
        This is the canonical artifact index for the <strong>Opta Initializer (Opta Init) desktop manager</strong> only.
        End users should download only this app from <strong>init.optalocal.com</strong>; all Opta stack
        components are managed inside the manager via signed manifests.
      </p>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Canonical manager release metadata</h2>
        <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li>
            <Link href="/desktop-updates/stable.json">Stable channel manifest</Link>
          </li>
          <li>
            <Link href="/desktop-updates/beta.json">Beta channel manifest</Link>
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Manager channels</h2>
        <p style={{ lineHeight: 1.55 }}>
          Stable and beta package links are published through the channel manifests above. If a manager
          link is unavailable, the manifest state is authoritative and update flow remains governed by
          signed manifest contracts.
        </p>
      </section>

      <section>
        <h2 style={{ marginBottom: "0.5rem" }}>Rollout notes</h2>
        <p style={{ lineHeight: 1.55 }}>
          Once the manager release pipeline is cut over to final artifact storage, this endpoint can continue
          serving the same immutable manifest contracts without changing user-facing pages.
        </p>
      </section>
    </main>
  );
}
