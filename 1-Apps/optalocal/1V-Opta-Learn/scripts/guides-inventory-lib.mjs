import fs from 'node:fs';
import path from 'node:path';

const STATUS_VALUES = new Set(['verified', 'draft']);
const NON_GUIDE_MODULES = new Set(['index.ts', 'templates.ts']);

function toRelative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function listGuideFiles(guidesRoot) {
  return fs
    .readdirSync(guidesRoot)
    .filter((name) => name.endsWith('.ts') && !NON_GUIDE_MODULES.has(name))
    .sort();
}

function extractModuleData(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const fileBase = path.basename(filePath, '.ts');
  const exportName =
    source.match(/export const\s+([A-Za-z_$][\w$]*)\s*:\s*Guide\b/)?.[1] ??
    source.match(/export const\s+([A-Za-z_$][\w$]*)\s*=/)?.[1] ??
    null;
  const slug = source.match(/slug:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
  const title = source.match(/title:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
  const template = source.match(/template:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
  const headingCount = (source.match(/\bheading:\s*['"`]/g) || []).length;
  const hasCode = /\bcode:\s*['"`]/.test(source);
  const visualCount = (source.match(/\bvisual:\s*['"`]/g) || []).length;
  const links = Array.from(
    source.matchAll(/href=["']\/guides\/([a-z0-9-]+)["']/gi),
    (match) => match[1].toLowerCase(),
  );
  const format = source.match(/\bformat:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
  const guFile = source.match(/\bguFile:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;

  const textCorpus = source
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = textCorpus ? textCorpus.split(' ').length : 0;

  return {
    filePath,
    fileBase,
    exportName,
    slug,
    title,
    template,
    headingCount,
    hasCode,
    visualCount,
    links,
    wordCount,
    source,
    format,
    guFile,
  };
}

function extractIndexImports(indexSource) {
  return Array.from(
    indexSource.matchAll(
      /import\s+\{\s*([A-Za-z_$][\w$]*)\s*\}\s+from\s+'\.\/([a-z0-9-]+)';/g,
    ),
    (match) => ({
      exportName: match[1],
      fileBase: match[2],
    }),
  ).filter((entry) => entry.fileBase !== 'templates');
}

function extractAllGuidesEntries(indexSource) {
  const blockMatch = indexSource.match(
    /export const allGuides:[\s\S]*?=\s*\[([\s\S]*?)\n\];/m,
  );
  if (!blockMatch) {
    return {
      entries: [],
      parseError: 'Could not parse allGuides array block in content/guides/index.ts.',
    };
  }

  const entries = Array.from(
    blockMatch[1].matchAll(/\{\s*\.\.\.([A-Za-z_$][\w$]*)([^}]*)\}/g),
    (match) => {
      const exportName = match[1];
      const tail = match[2] ?? '';
      const statusMatch = tail.match(/\bstatus:\s*['"]([a-z-]+)['"]/i);
      const statusRaw = statusMatch ? statusMatch[1].toLowerCase() : null;
      const status = statusRaw && STATUS_VALUES.has(statusRaw) ? statusRaw : null;
      return {
        exportName,
        hasExplicitStatus: Boolean(statusMatch),
        status,
        statusRaw,
      };
    },
  );

  return { entries, parseError: null };
}

export function collectGuidesInventory(projectRoot = process.cwd()) {
  const guidesRoot = path.join(projectRoot, 'content', 'guides');
  const indexPath = path.join(guidesRoot, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`index.ts not found at ${indexPath}`);
  }

  const moduleFiles = listGuideFiles(guidesRoot).map((name) =>
    path.join(guidesRoot, name),
  );
  const modules = moduleFiles.map((filePath) => extractModuleData(filePath));
  const modulesByFileBase = new Map(modules.map((entry) => [entry.fileBase, entry]));

  const indexSource = fs.readFileSync(indexPath, 'utf8');
  const imports = extractIndexImports(indexSource);
  const importByExport = new Map(imports.map((entry) => [entry.exportName, entry.fileBase]));
  const { entries: registrations, parseError } = extractAllGuidesEntries(indexSource);

  const registrationDetails = registrations.map((registration) => {
    const fileBase = importByExport.get(registration.exportName) ?? null;
    const guideModule = fileBase ? modulesByFileBase.get(fileBase) ?? null : null;
    return {
      ...registration,
      fileBase,
      filePath: guideModule?.filePath ?? null,
      slug: guideModule?.slug ?? null,
      title: guideModule?.title ?? null,
    };
  });

  const registeredFileBases = new Set(
    registrationDetails
      .map((detail) => detail.fileBase)
      .filter((value) => typeof value === 'string'),
  );

  const published = registrationDetails
    .filter((detail) => detail.status === 'verified' && detail.filePath)
    .map((detail) => ({
      slug: detail.slug,
      title: detail.title,
      file: toRelative(projectRoot, detail.filePath),
      exportName: detail.exportName,
      status: detail.status,
    }));

  const draft = registrationDetails
    .filter((detail) => detail.status === 'draft' && detail.filePath)
    .map((detail) => ({
      slug: detail.slug,
      title: detail.title,
      file: toRelative(projectRoot, detail.filePath),
      exportName: detail.exportName,
      status: detail.status,
    }));

  const orphan = modules
    .filter((guideModule) => !registeredFileBases.has(guideModule.fileBase))
    .map((guideModule) => ({
      slug: guideModule.slug,
      title: guideModule.title,
      file: toRelative(projectRoot, guideModule.filePath),
      exportName: guideModule.exportName,
    }));

  const slugBuckets = new Map();
  for (const guideModule of modules) {
    if (!guideModule.slug) continue;
    if (!slugBuckets.has(guideModule.slug)) {
      slugBuckets.set(guideModule.slug, []);
    }
    slugBuckets.get(guideModule.slug).push(guideModule);
  }
  const duplicateSlugs = Array.from(slugBuckets.entries())
    .filter(([, bucket]) => bucket.length > 1)
    .map(([slug, bucket]) => ({
      slug,
      files: bucket.map((guideModule) => toRelative(projectRoot, guideModule.filePath)),
      exports: bucket.map((guideModule) => guideModule.exportName).filter(Boolean),
    }));

  const missingStatus = registrationDetails
    .filter((detail) => !detail.hasExplicitStatus)
    .map((detail) => ({
      exportName: detail.exportName,
      file:
        detail.filePath && fs.existsSync(detail.filePath)
          ? toRelative(projectRoot, detail.filePath)
          : null,
    }));

  const invalidStatus = registrationDetails
    .filter((detail) => detail.hasExplicitStatus && !detail.status)
    .map((detail) => ({
      exportName: detail.exportName,
      status: detail.statusRaw,
    }));

  const registrationWithoutImport = registrationDetails
    .filter((detail) => !detail.fileBase)
    .map((detail) => detail.exportName);

  const importWithoutRegistration = imports
    .filter((entry) => !registrations.some((reg) => reg.exportName === entry.exportName))
    .map((entry) => ({
      exportName: entry.exportName,
      file: `content/guides/${entry.fileBase}.ts`,
    }));

  return {
    generatedAt: new Date().toISOString(),
    root: 'content/guides',
    published,
    draft,
    orphan,
    diagnostics: {
      duplicateSlugs,
      missingStatus,
      invalidStatus,
      registrationWithoutImport,
      importWithoutRegistration,
      parseError,
    },
    modules: modules.map((module) => ({
      filePath: module.filePath,
      file: toRelative(projectRoot, module.filePath),
      fileBase: module.fileBase,
      exportName: module.exportName,
      slug: module.slug,
      title: module.title,
      template: module.template,
      headingCount: module.headingCount,
      hasCode: module.hasCode,
      visualCount: module.visualCount,
      links: module.links,
      wordCount: module.wordCount,
      format: module.format,
      guFile: module.guFile,
    })),
  };
}

export function buildGuidesManifest(inventory) {
  return {
    generatedAt: inventory.generatedAt,
    root: inventory.root,
    counts: {
      published: inventory.published.length,
      draft: inventory.draft.length,
      orphan: inventory.orphan.length,
    },
    published: inventory.published,
    draft: inventory.draft,
    orphan: inventory.orphan,
    diagnostics: {
      duplicateSlugs: inventory.diagnostics.duplicateSlugs,
      missingStatus: inventory.diagnostics.missingStatus,
      invalidStatus: inventory.diagnostics.invalidStatus,
      registrationWithoutImport: inventory.diagnostics.registrationWithoutImport,
      importWithoutRegistration: inventory.diagnostics.importWithoutRegistration,
      parseError: inventory.diagnostics.parseError,
    },
  };
}

export function normalizeManifestForComparison(manifest) {
  return {
    ...manifest,
    generatedAt: '__IGNORE__',
  };
}
