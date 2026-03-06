import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import type {
  GuideManifestEntry,
  GuidesManifest,
  PromoteApiResponse,
  PromoteNextStep,
  PromotionPolicy,
} from '../../lib/types';
import { createAdminRequestId, recordAdminAction } from '../../lib/adminOps';

const execAsync = promisify(exec);

const OPTA_LEARN_DIR = path.resolve(process.cwd(), '../1V-Opta-Learn');
const GUIDES_INDEX_PATH = path.join(OPTA_LEARN_DIR, 'content/guides/index.ts');
const MANIFEST_PATH = path.join(OPTA_LEARN_DIR, 'public/guides-manifest.json');
const LEARN_MANIFEST_URL = 'https://learn.optalocal.com/api/guides-manifest';
// Default-open for authenticated admins so newly generated guide slugs can be
// promoted without config churn. Restrict via PROMOTION_ALLOWED_SLUGS if needed.
const DEFAULT_PROMOTION_ALLOWED_SLUGS: string[] = [];

interface PromotePayload {
  slug?: unknown;
}

function json(status: number, payload: PromoteApiResponse, requestId?: string) {
  if (requestId) {
    return NextResponse.json({ ...payload, requestId }, { status });
  }

  return NextResponse.json(payload, { status });
}

function atomicWrite(filePath: string, content: string) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeManifest(input: unknown): GuidesManifest {
  if (!isRecord(input)) return { published: [], draft: [] };
  return {
    published: Array.isArray(input.published) ? (input.published as GuideManifestEntry[]) : [],
    draft: Array.isArray(input.draft) ? (input.draft as GuideManifestEntry[]) : [],
  };
}

function normalizeSlug(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function parsePromotionPolicy(rawValue: string | undefined): PromotionPolicy {
  const raw = (rawValue ?? '').trim();
  if (!raw) {
    return { allowAll: true, allowedSlugs: [...DEFAULT_PROMOTION_ALLOWED_SLUGS] };
  }

  const seen = new Set<string>();
  let allowAll = false;
  for (const token of raw.split(',')) {
    const slug = token.trim().toLowerCase();
    if (!slug) continue;
    if (slug === '*' || slug === 'all') {
      allowAll = true;
      continue;
    }
    seen.add(slug);
  }

  if (!allowAll && seen.size === 0) {
    return { allowAll: true, allowedSlugs: [...DEFAULT_PROMOTION_ALLOWED_SLUGS] };
  }
  return { allowAll, allowedSlugs: Array.from(seen) };
}

function canPromoteSlug(slug: string, policy: PromotionPolicy): boolean {
  if (policy.allowAll) return true;
  return policy.allowedSlugs.includes(slug);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => values[key] ?? '');
}

async function readManifestFromLocalOrRemote(): Promise<GuidesManifest> {
  if (fs.existsSync(MANIFEST_PATH)) {
    const local = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return normalizeManifest(JSON.parse(local));
  }

  const response = await fetch(LEARN_MANIFEST_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Unable to read guides manifest (HTTP ${response.status}).`);
  }
  const payload = await response.json();
  return normalizeManifest(payload);
}

function getLocalMutationState(): { writable: boolean; reason?: string } {
  if (!fs.existsSync(OPTA_LEARN_DIR)) {
    return { writable: false, reason: `Missing ${OPTA_LEARN_DIR}` };
  }
  if (!fs.existsSync(GUIDES_INDEX_PATH)) {
    return { writable: false, reason: `Missing ${GUIDES_INDEX_PATH}` };
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { writable: false, reason: `Missing ${MANIFEST_PATH}` };
  }

  try {
    fs.accessSync(GUIDES_INDEX_PATH, fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(path.dirname(GUIDES_INDEX_PATH), fs.constants.W_OK);
    fs.accessSync(MANIFEST_PATH, fs.constants.R_OK);
    return { writable: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { writable: false, reason: message };
  }
}

function buildFallbackSteps(draftGuide: GuideManifestEntry): PromoteNextStep[] {
  const steps: PromoteNextStep[] = [
    {
      title: 'Promote in a writable checkout',
      detail:
        'This runtime cannot safely mutate the Learn repo. Run the promotion in a local/dev checkout and commit the manifest update.',
      command: [
        'cd 1V-Opta-Learn',
        `# update ${draftGuide.exportName} to verified in content/guides/index.ts`,
        'npm run guides:inventory',
        'git add content/guides/index.ts public/guides-manifest.json',
        `git commit -m "promote(${draftGuide.slug}): verify guide"`,
      ].join('\n'),
    },
    {
      title: 'Deploy after merge',
      detail: 'Deploy Opta Learn, then refresh Opta Admin to verify the promoted status.',
    },
  ];

  const prTemplate = process.env.PROMOTION_PR_URL_TEMPLATE?.trim();
  if (prTemplate) {
    steps.push({
      title: 'Open PR draft',
      detail: 'Use this generated PR URL template for the promotion change.',
      url: renderTemplate(prTemplate, {
        slug: draftGuide.slug,
        exportName: draftGuide.exportName,
        title: draftGuide.title,
      }),
    });
  }

  return steps;
}

export async function POST(request: Request) {
  const requestId = createAdminRequestId('promote');
  const policy = parsePromotionPolicy(process.env.PROMOTION_ALLOWED_SLUGS);
  let slug = '';

  const audit = (outcome: 'attempt' | 'success' | 'failure', message: string) => {
    recordAdminAction({
      action: 'guide.promote',
      outcome,
      slug: slug || undefined,
      requestId,
      message,
    });
  };

  audit('attempt', 'Promotion request received.');

  let payload: PromotePayload;
  try {
    payload = (await request.json()) as PromotePayload;
  } catch {
    audit('failure', 'Promotion rejected: invalid JSON payload.');
    return json(400, {
      outcome: 'error',
      mode: 'fallback',
      promoted: false,
      message: 'Invalid JSON payload.',
      error: 'INVALID_JSON',
      policy,
    }, requestId);
  }

  slug = normalizeSlug(payload.slug);
  if (!slug) {
    audit('failure', 'Promotion rejected: slug is required.');
    return json(400, {
      outcome: 'error',
      mode: 'fallback',
      promoted: false,
      message: 'Slug is required.',
      error: 'SLUG_REQUIRED',
      policy,
    }, requestId);
  }

  if (!canPromoteSlug(slug, policy)) {
    audit('failure', `Promotion blocked by allowlist policy for slug '${slug}'.`);
    return json(403, {
      outcome: 'blocked',
      mode: 'fallback',
      promoted: false,
      slug,
      message: `Promotion is locked for '${slug}'.`,
      error: 'PROMOTION_LOCKED',
      policy,
      nextSteps: [
        {
          title: 'Adjust promotion allowlist',
          detail:
            "Set PROMOTION_ALLOWED_SLUGS to include this slug (comma-separated), then redeploy Opta Admin. Use '*' to unlock all slugs.",
        },
      ],
    }, requestId);
  }

  let manifest: GuidesManifest;
  try {
    manifest = await readManifestFromLocalOrRemote();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    audit('failure', `Promotion failed: unable to load guides manifest (${message}).`);
    return json(503, {
      outcome: 'action_required',
      mode: 'fallback',
      promoted: false,
      slug,
      message: 'Unable to load guides manifest for promotion.',
      error: message,
      policy,
      nextSteps: [
        {
          title: 'Retry after Learn API/local manifest is available',
          detail: 'Ensure learn.optalocal.com/api/guides-manifest is reachable or mount a writable local Learn checkout.',
        },
      ],
    }, requestId);
  }

  const draftGuide = manifest.draft.find((guide) => normalizeSlug(guide.slug) === slug);
  if (!draftGuide) {
    audit('failure', `Promotion failed: draft guide '${slug}' was not found in manifest.`);
    return json(404, {
      outcome: 'error',
      mode: 'fallback',
      promoted: false,
      slug,
      message: `Draft guide '${slug}' was not found in manifest.`,
      error: 'DRAFT_NOT_FOUND',
      policy,
    }, requestId);
  }

  const localState = getLocalMutationState();
  if (!localState.writable) {
    audit('failure', `Promotion requires manual action: local mutation is unavailable (${localState.reason ?? 'writable repo not found'}).`);
    return json(202, {
      outcome: 'action_required',
      mode: 'fallback',
      promoted: false,
      slug,
      message: `Automatic local promotion is unavailable: ${localState.reason ?? 'writable repo not found'}.`,
      error: 'LOCAL_MUTATION_UNAVAILABLE',
      policy,
      nextSteps: buildFallbackSteps(draftGuide),
    }, requestId);
  }

  const indexContent = fs.readFileSync(GUIDES_INDEX_PATH, 'utf-8');
  const draftRegistrationPattern = new RegExp(
    `\\{\\s*\\.\\.\\.${escapeRegExp(draftGuide.exportName)}\\s*,\\s*status\\s*:\\s*'draft'\\s*\\}`
  );
  if (!draftRegistrationPattern.test(indexContent)) {
    audit('failure', `Promotion failed: draft registration for ${draftGuide.exportName} was not found in index.ts.`);
    return json(409, {
      outcome: 'error',
      mode: 'local',
      promoted: false,
      slug,
      message: `Could not find draft registration for ${draftGuide.exportName} in content/guides/index.ts.`,
      error: 'DRAFT_REGISTRATION_NOT_FOUND',
      policy,
      nextSteps: [
        {
          title: 'Review index registration',
          detail: "Confirm the guide export exists and is currently tagged as status: 'draft'.",
        },
      ],
    }, requestId);
  }

  const updatedIndex = indexContent.replace(
    draftRegistrationPattern,
    `{ ...${draftGuide.exportName}, status: 'verified' }`
  );

  try {
    atomicWrite(GUIDES_INDEX_PATH, updatedIndex);
    await execAsync('npm run guides:inventory', { cwd: OPTA_LEARN_DIR });
    audit('success', `Guide '${slug}' promoted to verified.`);

    return json(200, {
      outcome: 'promoted',
      mode: 'local',
      promoted: true,
      slug,
      message: `Promoted '${slug}' to verified.`,
      policy,
    }, requestId);
  } catch (error: unknown) {
    atomicWrite(GUIDES_INDEX_PATH, indexContent);
    const message = error instanceof Error ? error.message : String(error);
    audit('failure', `Promotion failed during local mutation and was rolled back (${message}).`);
    return json(500, {
      outcome: 'action_required',
      mode: 'local',
      promoted: false,
      slug,
      message: 'Local promotion failed and was rolled back.',
      error: message,
      policy,
      nextSteps: buildFallbackSteps(draftGuide),
    }, requestId);
  }
}
