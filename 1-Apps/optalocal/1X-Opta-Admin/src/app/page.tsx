import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { AdminDashboardUI } from './components/AdminDashboardUI';
import type { GuideManifestEntry, GuideRecord, GuideSection, GuidesManifest } from './lib/types';
import { MANAGED_WEBSITES, checkManagedWebsiteHealth } from './lib/websites';

export const dynamic = 'force-dynamic';

const OPTA_LEARN_DIR = path.resolve(process.cwd(), '../1V-Opta-Learn');
const GUIDES_DIR = path.join(OPTA_LEARN_DIR, 'content/guides');
const MANIFEST_PATH = path.join(OPTA_LEARN_DIR, 'public/guides-manifest.json');
const LEARN_MANIFEST_URL = 'https://learn.optalocal.com/api/guides-manifest';

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

      return {
        heading,
        body,
        visual: toOptionalStringValue(section.visual),
        note: toOptionalStringValue(section.note),
        code: toOptionalStringValue(section.code),
      };
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

  const guides: GuideRecord[] = [];

  if (fs.existsSync(GUIDES_DIR)) {
    const files = fs
      .readdirSync(GUIDES_DIR)
      .filter((fileName) => fileName.endsWith('.ts') && fileName !== 'index.ts' && fileName !== 'templates.ts');

    for (const fileName of files) {
      try {
        const parsedGuide = parseGuideFile(fileName);
        if (!parsedGuide) continue;

        guides.push({
          ...parsedGuide,
          status: statusBySlug.get(parsedGuide.slug) ?? 'draft',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Unable to parse guide ${fileName}: ${message}`);
      }
    }
  }

  const knownSlugs = new Set(guides.map((guide) => guide.slug));
  for (const entry of manifestEntries) {
    if (knownSlugs.has(entry.slug)) continue;
    guides.push({
      slug: entry.slug,
      title: entry.title,
      summary: 'Guide metadata available in manifest. Open source file for full content.',
      status: entry.status,
      sections: [],
      file: entry.file,
    });
  }

  return guides.sort((a, b) => a.title.localeCompare(b.title));
}

export default async function AdminDashboard() {
  const [guides, websiteStatus] = await Promise.all([
    getDynamicGuides(),
    Promise.all(MANAGED_WEBSITES.map((website) => checkManagedWebsiteHealth(website))),
  ]);

  return (
    <main className="min-h-screen bg-void flex flex-col items-center pt-8 relative overflow-hidden admin-perimeter border-x-[3px] border-admin">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-admin text-black font-mono text-[10px] font-bold px-4 py-1 rounded-b-md tracking-widest z-50 shadow-[0_4px_20px_rgba(245,158,11,0.4)]">
        RESTRICTED ADMIN ZONE
      </div>

      <AdminDashboardUI initialGuides={guides} websites={websiteStatus} />
    </main>
  );
}
