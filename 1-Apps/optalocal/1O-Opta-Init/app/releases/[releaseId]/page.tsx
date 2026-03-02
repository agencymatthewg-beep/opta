import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllReleaseIds, getReleaseNotesById } from "@/lib/release-notes";

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

      <section>
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
    </main>
  );
}
