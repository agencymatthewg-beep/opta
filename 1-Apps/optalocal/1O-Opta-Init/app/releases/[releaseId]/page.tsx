import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllReleaseIds, getReleaseNotesById } from "@/lib/release-notes";

// Component download links — keyed by component id
const COMPONENT_DOWNLOAD_LINKS: Record<string, { label: string; url: string }[]> = {
  "opta-cli": [
    {
      label: "Download macOS / Windows (npm .tgz)",
      url: "https://github.com/agencymatthewg-beep/opta/releases/download/v0.5.0-alpha.15/opta-cli-npm.tgz",
    },
    {
      label: "Install via npm: npm install -g @opta/opta-cli",
      url: "https://init.optalocal.com/#downloads",
    },
  ],
  "opta-daemon": [
    {
      label: "Download macOS (universal .tar.gz)",
      url: "https://github.com/agencymatthewg-beep/opta/releases/download/opta-daemon-v0.0.0-beta.test.5/opta-daemon-macos-universal.tar.gz",
    },
    {
      label: "Download Windows x64 (.zip)",
      url: "https://github.com/agencymatthewg-beep/opta/releases/download/opta-daemon-v0.0.0-beta.test.5/opta-daemon-windows-x64.zip",
    },
  ],
};

type ReleasePageProps = {
  params: Promise<{
    releaseId: string;
  }>;
};

export async function generateStaticParams() {
  return getAllReleaseIds().map((releaseId) => ({ releaseId }));
}

export async function generateMetadata({ params }: ReleasePageProps): Promise<Metadata> {
  const { releaseId } = await params;
  const release = getReleaseNotesById(releaseId);
  if (!release) {
    return {
      title: "Release Notes Not Found",
    };
  }

  return {
    title: `Opta Init Release ${release.releaseId}`,
    description: `Release notes for ${release.channel} channel (${release.releaseId}).`,
  };
}

export default async function ReleaseNotesPage({ params }: ReleasePageProps) {
  const { releaseId } = await params;
  const release = getReleaseNotesById(releaseId);

  if (!release) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2.5rem 1rem 3rem" }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href="/">Back to Opta Init</Link>
      </p>
      <h1 style={{ marginBottom: "0.5rem" }}>Release {release.releaseId}</h1>
      <p style={{ marginBottom: "1rem" }}>
        Channel: <strong>{release.channel}</strong> | Published: <strong>{release.publishedAt}</strong>
      </p>
      <p style={{ marginBottom: "1.5rem" }}>
        Minimum manager version: <strong>{release.minManagerVersion}</strong>
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Component Versions</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #2f3850", padding: "0.5rem 0.25rem" }}>
                Component
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #2f3850", padding: "0.5rem 0.25rem" }}>
                ID
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #2f3850", padding: "0.5rem 0.25rem" }}>
                Version
              </th>
            </tr>
          </thead>
          <tbody>
            {release.components.map((component) => (
              <tr key={component.id}>
                <td style={{ borderBottom: "1px solid #20263a", padding: "0.5rem 0.25rem" }}>{component.displayName}</td>
                <td style={{ borderBottom: "1px solid #20263a", padding: "0.5rem 0.25rem" }}>{component.id}</td>
                <td style={{ borderBottom: "1px solid #20263a", padding: "0.5rem 0.25rem" }}>{component.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ marginBottom: "0.75rem" }}>Downloads</h2>
        <p style={{ marginBottom: "1rem", lineHeight: 1.55, color: "#a1a1aa" }}>
          To install Opta stack components, download the{" "}
          <Link href="/#downloads">Opta Init Manager</Link> — it manages all components automatically.
          Individual component downloads are listed below for advanced users.
        </p>
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Opta Init Manager</h3>
          <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
            <li>
              <a href="https://init.optalocal.com/downloads/opta-init/latest/Opta-Init-Manager_x64-setup.nsis.zip">
                Download Windows x64 — Opta-Init-Manager_x64-setup.nsis.zip
              </a>
            </li>
            <li>
              <a href="https://init.optalocal.com/downloads/opta-init/latest/opta-init-mac.dmg">
                Download macOS (Apple Silicon) — opta-init-mac.dmg
              </a>
            </li>
          </ul>
        </div>
        {release.components.map((component) => {
          const links = COMPONENT_DOWNLOAD_LINKS[component.id];
          if (!links || links.length === 0) return null;
          return (
            <div key={component.id} style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.4rem" }}>{component.displayName} v{component.version}</h3>
              <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.8 }}>
                {links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}
