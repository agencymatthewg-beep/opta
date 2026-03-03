import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { GuideManifestEntry, GuidesManifest } from '../../lib/types';

const execAsync = promisify(exec);

// Path to the guides registry index.ts
const OPTA_LEARN_DIR = path.resolve(process.cwd(), '../1V-Opta-Learn');
const GUIDES_INDEX_PATH = path.join(OPTA_LEARN_DIR, 'content/guides/index.ts');
const MANIFEST_PATH = path.join(OPTA_LEARN_DIR, 'public/guides-manifest.json');

interface PromotePayload {
    slug?: unknown;
}

export async function POST(request: Request) {
    try {
        const payload = (await request.json()) as PromotePayload;
        const slug = typeof payload.slug === 'string' ? payload.slug.trim() : '';

        if (!slug) {
            return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
        }

        // 1. Read manifest to find the exportName of the drafted guide
        const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
        const manifest = JSON.parse(manifestRaw) as GuidesManifest;

        const draftGuide = manifest.draft.find((guide: GuideManifestEntry) => guide.slug === slug);
        if (!draftGuide) {
            return NextResponse.json({ error: `Draft guide with slug '${slug}' not found in manifest.` }, { status: 404 });
        }

        const exportName = draftGuide.exportName;

        // 2. Read content/guides/index.ts
        let indexContent = fs.readFileSync(GUIDES_INDEX_PATH, 'utf-8');

        // 3. Regex to replace { ...exportName, status: 'draft' } with status: 'verified'
        // This looks for `{ ...exportName, status: 'draft' }` ignoring whitespace
        const regex = new RegExp(`\\{\\s*\\.\\.\\.${exportName}\\s*,\\s*status\\s*:\\s*'draft'\\s*\\}`, 'g');

        if (!regex.test(indexContent)) {
            return NextResponse.json({ error: `Could not find draft registration for ${exportName} in index.ts.` }, { status: 500 });
        }

        indexContent = indexContent.replace(regex, `{ ...${exportName}, status: 'verified' }`);
        fs.writeFileSync(GUIDES_INDEX_PATH, indexContent);

        // 4. Run the inventory script in Opta Learn
        await execAsync(`npm run guides:inventory`, { cwd: OPTA_LEARN_DIR });

        return NextResponse.json({ success: true, message: `Promoted ${slug} to verified!` });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Promotion error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
