import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { AdminDashboardUI } from './components/AdminDashboardUI';
import { buildAdminOpsSnapshot } from './lib/adminOps';
import type {
  GuideManifestEntry,
  GuideRecord,
  GuideSection,
  GuidesManifest,
  PromotionPolicy,
} from './lib/types';
import { MANAGED_WEBSITES, checkManagedWebsiteHealth } from './lib/websites';

export const dynamic = 'force-dynamic';

const OPTA_LEARN_DIR = path.resolve(process.cwd(), '../1V-Opta-Learn');
const GUIDES_DIR = path.join(OPTA_LEARN_DIR, 'content/guides');
const MANIFEST_PATH = path.join(OPTA_LEARN_DIR, 'public/guides-manifest.json');
const LEARN_MANIFEST_URL = 'https://learn.optalocal.com/api/guides-manifest';
const LEARN_GUIDES_URL = 'https://learn.optalocal.com/api/guides';
// Default-open for authenticated admins so new nightly guide slugs are promotable
// without a redeploy. Restrict via PROMOTION_ALLOWED_SLUGS when needed.
const DEFAULT_PROMOTION_ALLOWED_SLUGS: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toOptionalStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toSections(value: unknown): GuideSection[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((section): GuideSection | null => {
      if (!isRecord(section)) return null;
      const heading = toStringValue(section.heading);
      const body = toStringValue(section.body);
      if (!heading || !body) return null;

      const sectionRecord: Record<string, string> = {
        heading,
        body,
      };
      
      const visual = toOptionalStringValue(section.visual);
      if (visual !== undefined) sectionRecord.visual = visual;
      
      const note = toOptionalStringValue(section.note);
      if (note !== undefined) sectionRecord.note = note;
      
      const code = toOptionalStringValue(section.code);
      if (code !== undefined) sectionRecord.code = code;

      return sectionRecord as unknown as GuideSection;
    })
    .filter((section): section is GuideSection => section !== null);
}

function parseGuideFile(fileName: string): GuideRecord | null {
  const fullPath = path.join(GUIDES_DIR, fileName);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const match = content.match(/export\s+const\s+\w+\s*(?::\s*Guide)?\s*=\s*({[\s\S]*?\n});/);
  if (!match?.[1]) return null;

  const objectLiteral = match[1].replace(/<\/script>/gi, '<\\/script>');
  const evaluated = vm.runInNewContext(`(${objectLiteral})`, Object.create(null), { timeout: 75 });
  if (!isRecord(evaluated)) return null;

  const slug = toStringValue(evaluated.slug);
  const title = toStringValue(evaluated.title);
  if (!slug || !title) return null;

  return {
    slug,
    title,
    summary: toStringValue(evaluated.summary, 'No summary available.'),
    updatedAt: toOptionalStringValue(evaluated.updatedAt),
    app: toOptionalStringValue(evaluated.app),
    category: toOptionalStringValue(evaluated.category),
    sections: toSections(evaluated.sections),
    status: 'draft',
    file: `content/guides/${fileName}`,
  };
}

function normalizeManifest(input: unknown): GuidesManifest {
  if (!isRecord(input)) return { published: [], draft: [] };
  const published = Array.isArray(input.published) ? input.published : [];
  const draft = Array.isArray(input.draft) ? input.draft : [];
  return { published, draft } as GuidesManifest;
}

function toGuideStatus(value: unknown): GuideRecord['status'] {
  return value === 'verified' ? 'verified' : 'draft';
}

function parsePromotionPolicy(rawValue: string | undefined): PromotionPolicy {
  const raw = (rawValue ?? '').trim();
  if (!raw) {
    return { allowAll: true, allowedSlugs: [...DEFAULT_PROMOTION_ALLOWED_SLUGS] };
  }

  const allowed = new Set<string>();
  let allowAll = false;
  for (const token of raw.split(',')) {
    const slug = token.trim().toLowerCase();
    if (!slug) continue;
    if (slug === '*' || slug === 'all') {
      allowAll = true;
      continue;
    }
    allowed.add(slug);
  }

  if (!allowAll && allowed.size === 0) {
    return { allowAll: true, allowedSlugs: [...DEFAULT_PROMOTION_ALLOWED_SLUGS] };
  }
  return { allowAll, allowedSlugs: Array.from(allowed) };
}

function toRemoteGuideRecord(
  value: unknown,
  statusBySlug: Map<string, GuideRecord['status']>
): GuideRecord | null {
  if (!isRecord(value)) return null;

  const slug = toStringValue(value.slug);
  const title = toStringValue(value.title);
  if (!slug || !title) return null;

  return {
    slug,
    title,
    summary: toStringValue(value.summary, 'No summary available.'),
    updatedAt: toOptionalStringValue(value.updatedAt),
    app: toOptionalStringValue(value.app),
    category: toOptionalStringValue(value.category),
    sections: toSections(value.sections),
    status: statusBySlug.get(slug) ?? toGuideStatus(value.status),
    file: toOptionalStringValue(value.file),
  };
}

async function readRemoteGuides(
  statusBySlug: Map<string, GuideRecord['status']>
): Promise<GuideRecord[]> {
  try {
    const response = await fetch(LEARN_GUIDES_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.guides)) return [];

    return payload.guides
      .map((guide): GuideRecord | null => toRemoteGuideRecord(guide, statusBySlug))
      .filter((guide): guide is GuideRecord => guide !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Remote guides fetch failed: ${message}`);
    return [];
  }
}

async function readGuidesManifest(): Promise<GuidesManifest> {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      return normalizeManifest(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Local guides manifest parse failed: ${message}`);
    }
  }

  try {
    const response = await fetch(LEARN_MANIFEST_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return normalizeManifest(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Remote guides manifest fetch failed: ${message}`);
    return { published: [], draft: [] };
  }
}

async function getDynamicGuides(): Promise<GuideRecord[]> {
  const manifest = await readGuidesManifest();
  const manifestEntries: GuideManifestEntry[] = [...manifest.published, ...manifest.draft];
  const statusBySlug = new Map(manifestEntries.map((entry) => [entry.slug, entry.status]));
  const guidesBySlug = new Map<string, GuideRecord>();

  if (fs.existsSync(GUIDES_DIR)) {
    const files = fs
      .readdirSync(GUIDES_DIR)
      .filter((fileName) => fileName.endsWith('.ts') && fileName !== 'index.ts' && fileName !== 'templates.ts');

    for (const fileName of files) {
      try {
        const parsedGuide = parseGuideFile(fileName);
        if (!parsedGuide) continue;

        guidesBySlug.set(parsedGuide.slug, {
          ...parsedGuide,
          status: statusBySlug.get(parsedGuide.slug) ?? 'draft',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to parse guide ${fileName}: ${message}`);
      }
    }
  }

  const remoteGuides = await readRemoteGuides(statusBySlug);
  for (const guide of remoteGuides) {
    if (guidesBySlug.has(guide.slug)) continue;
    guidesBySlug.set(guide.slug, guide);
  }

  const knownSlugs = new Set(guidesBySlug.keys());
  for (const entry of manifestEntries) {
    if (knownSlugs.has(entry.slug)) continue;
    guidesBySlug.set(entry.slug, {
      slug: entry.slug,
      title: entry.title,
      summary: 'Guide metadata available in manifest. Open source file for full content.',
      status: entry.status,
      sections: [],
      file: entry.file,
    });
  }

  const guides = Array.from(guidesBySlug.values());
  return guides.sort((a, b) => a.title.localeCompare(b.title));
}

export default async function AdminDashboard() {
  const [guides, websiteStatus, adminOps] = await Promise.all([
    getDynamicGuides(),
    Promise.all(MANAGED_WEBSITES.map((website) => checkManagedWebsiteHealth(website))),
    buildAdminOpsSnapshot(),
  ]);
  const promotionPolicy = parsePromotionPolicy(process.env.PROMOTION_ALLOWED_SLUGS);

  return (
    <main className="min-h-screen bg-void flex flex-col items-center pt-8 relative overflow-hidden admin-perimeter border-x-[3px] border-admin">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-admin text-black font-mono text-[10px] font-bold px-4 py-1 rounded-b-md tracking-widest z-50 shadow-[0_4px_20px_rgba(245,158,11,0.4)]">
        RESTRICTED ADMIN ZONE
      </div>

      <AdminDashboardUI
        initialGuides={guides}
        websites={websiteStatus}
        promotionPolicy={promotionPolicy}
        adminOps={adminOps}
      />
    </main>
  );
}
