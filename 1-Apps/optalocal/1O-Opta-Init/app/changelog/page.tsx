import Link from "next/link";
import { getAllReleaseNotes } from "@/lib/release-notes";

function formatPublishedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toUTCString();
}

export default function ChangelogPage() {
  const releases = getAllReleaseNotes();

  return (
    <main className="min-h-screen bg-void text-text-primary px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">Opta Init</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Changelog</h1>
        <p className="mt-3 text-text-secondary">
          Release history for Opta Init manager channels. Each release links to component-level notes.
        </p>

        <div className="mt-8 space-y-4">
          {releases.map((release) => (
            <article key={`${release.channel}-${release.releaseId}`} className="obsidian rounded-xl border border-white/10 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{release.channel} channel</p>
                  <h2 className="mt-1 text-lg font-semibold">{release.releaseId}</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Published: {formatPublishedAt(release.publishedAt)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    Minimum manager version: {release.minManagerVersion}
                  </p>
                </div>
                <Link
                  href={`/releases/${release.notesSlug}`}
                  className="inline-flex items-center rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  View Notes
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-text-muted">
          Subscribe for updates via{" "}
          <a href="/rss.xml" className="text-primary hover:text-primary-glow">
            RSS
          </a>
          .
        </p>
      </div>
    </main>
  );
}
