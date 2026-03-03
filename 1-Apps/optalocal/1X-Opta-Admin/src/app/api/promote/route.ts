import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { GuideManifestEntry, GuidesManifest } from '../../lib/types';

const execAsync = promisify(exec);

const OPTA_LEARN_DIR = path.resolve(process.cwd(), '../1V-Opta-Learn');
const GUIDES_INDEX_PATH = path.join(OPTA_LEARN_DIR, 'content/guides/index.ts');
const MANIFEST_PATH = path.join(OPTA_LEARN_DIR, 'public/guides-manifest.json');

interface PromotePayload {
  slug?: unknown;
}

function atomicWrite(filePath: string, content: string) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readManifestSafe(): GuidesManifest {
  const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const parsed = JSON.parse(manifestRaw) as Partial<GuidesManifest>;
  return {
    published: Array.isArray(parsed.published) ? parsed.published : [],
    draft: Array.isArray(parsed.draft) ? parsed.draft : [],
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PromotePayload;
    const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const manifest = readManifestSafe();
    const draftGuide = manifest.draft.find((guide: GuideManifestEntry) => guide.slug === slug);
    if (!draftGuide) {
      return NextResponse.json({ error: `Draft guide with slug '${slug}' not found in manifest.` }, { status: 404 });
    }

    const indexContent = fs.readFileSync(GUIDES_INDEX_PATH, 'utf-8');
    const regex = new RegExp(`\\{\\s*\\.\\.\\.${draftGuide.exportName}\\s*,\\s*status\\s*:\\s*'draft'\\s*\\}`, 'g');

    if (!regex.test(indexContent)) {
      return NextResponse.json({ error: `Could not find draft registration for ${draftGuide.exportName} in index.ts.` }, { status: 500 });
    }

    const updatedIndex = indexContent.replace(regex, `{ ...${draftGuide.exportName}, status: 'verified' }`);
    atomicWrite(GUIDES_INDEX_PATH, updatedIndex);

    await execAsync('npm run guides:inventory', { cwd: OPTA_LEARN_DIR });

    return NextResponse.json({ success: true, message: `Promoted ${slug} to verified.` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Promotion error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
