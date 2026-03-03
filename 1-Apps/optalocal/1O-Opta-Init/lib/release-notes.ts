import betaManifest from "@/channels/beta.json";
import stableManifest from "@/channels/stable.json";

type ChannelManifest = {
  channel: string;
  publishedAt?: string;
  release: {
    id: string;
    minManagerVersion?: string;
  };
  components: Array<{
    id: string;
    displayName?: string;
    version: string;
  }>;
};

export type ReleaseNotes = {
  releaseId: string;
  notesSlug: string;
  channel: string;
  publishedAt: string;
  minManagerVersion: string;
  components: Array<{
    id: string;
    displayName: string;
    version: string;
  }>;
};

function toNotesSlug(releaseId: string): string {
  return releaseId.replaceAll(".", "-");
}

function toReleaseNotes(manifest: ChannelManifest): ReleaseNotes {
  return {
    releaseId: manifest.release.id,
    notesSlug: toNotesSlug(manifest.release.id),
    channel: manifest.channel,
    publishedAt: manifest.publishedAt ?? "unknown",
    minManagerVersion: manifest.release.minManagerVersion ?? "unknown",
    components: manifest.components.map((component) => ({
      id: component.id,
      displayName: component.displayName ?? component.id,
      version: component.version,
    })),
  };
}

const NOTES = [toReleaseNotes(stableManifest as ChannelManifest), toReleaseNotes(betaManifest as ChannelManifest)];

function toTimestamp(value: string): number {
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

export function getReleaseNotesById(releaseIdOrSlug: string): ReleaseNotes | null {
  return (
    NOTES.find(
      (entry) => entry.releaseId === releaseIdOrSlug || entry.notesSlug === releaseIdOrSlug,
    ) ?? null
  );
}

export function getAllReleaseIds(): string[] {
  return getAllReleaseNotes().map((entry) => entry.notesSlug);
}

export function getAllReleaseNotes(): ReleaseNotes[] {
  return [...NOTES].sort((a, b) => {
    const delta = toTimestamp(b.publishedAt) - toTimestamp(a.publishedAt);
    if (delta !== 0) return delta;
    return b.releaseId.localeCompare(a.releaseId);
  });
}
