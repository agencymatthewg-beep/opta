import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opta Init Downloads Gateway",
  description:
    "Opta Init artifact gateway for CLI, runtime, daemon, and desktop package links.",
};

export default function DownloadsGatewayPage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2.5rem 1rem 3rem" }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/">Back to Opta Init</Link>
      </p>
      <h1 style={{ marginBottom: "0.75rem" }}>Opta Init Downloads Gateway</h1>
      <p style={{ marginBottom: "1rem", lineHeight: 1.55 }}>
        This endpoint acts as the canonical artifact URL space for Opta Init manager manifests.
        Some packages are still finalizing release storage cutover and may route to release notes
        while publishing completes.
      </p>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Direct Download</h2>
        <p style={{ lineHeight: 1.55 }}>
          Opta CLI latest package:{" "}
          <a
            href="https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz"
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz
          </a>
        </p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Release Notes</h2>
        <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li>
            <Link href="/releases/2026-03-02-stable-1">Stable release 2026.03.02-stable.1</Link>
          </li>
          <li>
            <Link href="/releases/2026-03-02-beta-2">Beta release 2026.03.02-beta.2</Link>
          </li>
        </ul>
      </section>

      <section>
        <h2 style={{ marginBottom: "0.5rem" }}>Cutover Plan</h2>
        <p style={{ lineHeight: 1.55 }}>
          Artifact URLs remain stable on <code>init.optalocal.com/downloads/...</code>. Once
          release storage for <code>downloads.optalocal.com</code> is online, routing can switch
          underneath without changing manager manifests.
        </p>
      </section>
    </main>
  );
}
