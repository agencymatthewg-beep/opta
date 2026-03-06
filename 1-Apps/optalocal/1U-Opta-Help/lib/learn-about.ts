import learnRouteGuideMap from "./learn-route-guide-map.json";
import syncedGuideManifest from "./generated/learn-guides-manifest.json";
import fallbackGuideManifest from "./learn-guides-fallback-manifest.json";

export interface LearnGuideLink {
  slug: string;
  title: string;
  summary: string;
  app: "lmx" | "cli" | "accounts" | "code" | "general";
}

interface LearnRouteRule {
  docsPrefix: string;
  guides: string[];
}

interface LearnManifestGuide {
  slug: string;
  title: string;
  summary?: string;
}

interface LearnManifestData {
  guides?: LearnManifestGuide[];
}

const LEARN_GUIDE_BASE_URL = "https://learn.optalocal.com/guides";
const DEFAULT_REMOTE_SUMMARY = "Guide metadata synced from Opta Learn. Open to view the full walkthrough.";

const LOCAL_GUIDE_FALLBACK: Record<string, Omit<LearnGuideLink, "slug">> = {
  "opta-local-intro": {
    title: "Introduction to Local",
    summary: "Opta Local operating model, architecture, and execution surfaces.",
    app: "general",
  },
  cli: {
    title: "CLI Masterclass",
    summary: "Deep command workflows, session control, and production operator patterns.",
    app: "cli",
  },
  lmx: {
    title: "Getting Started with LMX",
    summary: "LMX host setup, model lifecycle, and local inference operations.",
    app: "lmx",
  },
  "lmx-masterclass": {
    title: "LMX Masterclass",
    summary: "Advanced LMX runtime behavior, memory strategy, and performance tuning.",
    app: "lmx",
  },
  "code-desktop": {
    title: "Code Desktop Overview",
    summary: "Desktop control-surface essentials and day-to-day operator usage.",
    app: "code",
  },
  "code-desktop-masterclass": {
    title: "Code Desktop Masterclass",
    summary: "Deep architecture and operational workflow patterns for the desktop app.",
    app: "code",
  },
  accounts: {
    title: "Accounts Local Sync",
    summary: "Identity, sync boundaries, and local/cloud account coordination.",
    app: "accounts",
  },
  "accounts-masterclass": {
    title: "Accounts Masterclass",
    summary: "Account-control strategy, token posture, and multi-surface auth flows.",
    app: "accounts",
  },
};

function isManifestGuide(candidate: unknown): candidate is LearnManifestGuide {
  return Boolean(
    candidate
      && typeof candidate === "object"
      && typeof (candidate as LearnManifestGuide).slug === "string"
      && (candidate as LearnManifestGuide).slug.trim().length > 0
      && typeof (candidate as LearnManifestGuide).title === "string"
      && (candidate as LearnManifestGuide).title.trim().length > 0,
  );
}

function resolveManifestSummary(candidate: LearnManifestGuide): string | undefined {
  if (typeof candidate.summary === "string" && candidate.summary.trim().length > 0) {
    return candidate.summary.trim();
  }
  return undefined;
}

function normalizeManifestGuides(
  manifest: LearnManifestData | null | undefined,
): Map<string, { title: string; summary?: string }> {
  const guides = new Map<string, { title: string; summary?: string }>();
  for (const guide of manifest?.guides ?? []) {
    if (!isManifestGuide(guide)) continue;
    guides.set(guide.slug.trim(), {
      title: guide.title.trim(),
      summary: resolveManifestSummary(guide),
    });
  }
  return guides;
}

function buildGuideCatalog(): Record<string, Omit<LearnGuideLink, "slug">> {
  const catalog: Record<string, Omit<LearnGuideLink, "slug">> = { ...LOCAL_GUIDE_FALLBACK };
  const syncedGuides = normalizeManifestGuides(syncedGuideManifest as LearnManifestData);
  const fallbackGuides = normalizeManifestGuides(fallbackGuideManifest as LearnManifestData);
  const effectiveGuides = syncedGuides.size > 0 ? syncedGuides : fallbackGuides;

  for (const [slug, guideMeta] of effectiveGuides.entries()) {
    const existing = catalog[slug];
    if (existing) {
      catalog[slug] = {
        ...existing,
        title: guideMeta.title,
        summary: guideMeta.summary ?? existing.summary,
      };
      continue;
    }

    catalog[slug] = {
      title: guideMeta.title,
      summary: guideMeta.summary ?? DEFAULT_REMOTE_SUMMARY,
      app: "general",
    };
  }

  return catalog;
}

const GUIDE_CATALOG = buildGuideCatalog();
const DOCS_TO_GUIDE_RULES = learnRouteGuideMap as LearnRouteRule[];

function normalizeDocsPath(pathname: string): string {
  if (!pathname.startsWith("/")) return `/${pathname}/`;
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

export function getLearnAboutLinks(pathname: string): LearnGuideLink[] {
  const normalizedPath = normalizeDocsPath(pathname);
  const sortedRules = [...DOCS_TO_GUIDE_RULES].sort((a, b) => b.docsPrefix.length - a.docsPrefix.length);
  const matchingRule = sortedRules.find((rule) => normalizedPath.startsWith(rule.docsPrefix));
  if (!matchingRule) return [];

  return matchingRule.guides
    .map((slug) => {
      const meta = GUIDE_CATALOG[slug];
      if (!meta) return null;
      return { slug, ...meta };
    })
    .filter((guide): guide is LearnGuideLink => guide !== null);
}

export function getLearnGuideUrl(slug: string): string {
  return `${LEARN_GUIDE_BASE_URL}/${slug}`;
}
