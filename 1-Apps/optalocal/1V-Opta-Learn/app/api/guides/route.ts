import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { allGuides } from '@/content/guides';

type ManifestEntry = {
  slug?: unknown;
  file?: unknown;
};

const MANIFEST_PATH = path.join(process.cwd(), 'public', 'guides-manifest.json');

function readFileBySlug(): Map<string, string> {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as {
      published?: ManifestEntry[];
      draft?: ManifestEntry[];
    };

    const entries = [
      ...(Array.isArray(parsed.published) ? parsed.published : []),
      ...(Array.isArray(parsed.draft) ? parsed.draft : []),
    ];

    const fileBySlug = new Map<string, string>();
    for (const entry of entries) {
      const slug = typeof entry.slug === 'string' ? entry.slug : '';
      const file = typeof entry.file === 'string' ? entry.file : '';
      if (!slug || !file) continue;
      fileBySlug.set(slug, file);
    }
    return fileBySlug;
  } catch {
    return new Map<string, string>();
  }
}

export async function GET() {
  const fileBySlug = readFileBySlug();
  const guides = allGuides.map((guide) => ({
    ...guide,
    file: fileBySlug.get(guide.slug) ?? `content/guides/${guide.slug}.ts`,
  }));

  return NextResponse.json({ guides });
}
