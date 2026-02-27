import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const APP_ROOT = path.resolve(SRC_ROOT, 'app');

function walk(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function toRoutePattern(pageFile: string): string {
  const relative = path.relative(APP_ROOT, pageFile).replace(/\\/g, '/');
  if (relative === 'page.tsx') {
    return '/';
  }

  const segments = relative
    .replace(/\/page\.tsx$/, '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .filter((segment) => !segment.startsWith('('))
    .filter((segment) => !segment.startsWith('@'));

  return `/${segments.join('/')}`;
}

function routePatternToRegex(routePattern: string): RegExp {
  const escaped = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withCatchAll = escaped
    .replace(/\\\[\\\[\\\.\\\.\\\.[^/\]]+\\\]\\\]/g, '.*')
    .replace(/\\\[\\\.\\\.\\\.[^/\]]+\\\]/g, '.+');
  const withSegments = withCatchAll.replace(/\\\[[^/\]]+\\\]/g, '[^/]+');

  return new RegExp(`^${withSegments}/?$`);
}

function collectAppRouteRegexes(): RegExp[] {
  const pageFiles = walk(APP_ROOT).filter((filePath) =>
    filePath.endsWith('/page.tsx'),
  );
  const patterns = pageFiles.map(toRoutePattern);
  return patterns.map(routePatternToRegex);
}

function normalizeInternalRoute(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  if (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/v1/') ||
    trimmed.startsWith('/admin/') ||
    trimmed.startsWith('/mcp/')
  ) {
    return null;
  }

  const withoutHash = trimmed.split('#')[0] ?? trimmed;
  const withoutQuery = withoutHash.split('?')[0] ?? withoutHash;
  return withoutQuery;
}

function collectInternalRouteRefs(): string[] {
  const files = walk(SRC_ROOT).filter(
    (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx'),
  );

  const refs = new Set<string>();
  const patterns = [
    /href\s*=\s*["'`]([^"'`]+)["'`]/g,
    /window\.location\.assign\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /router\.(?:push|replace|prefetch)\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const raw = match[1];
        if (!raw) continue;
        const normalized = normalizeInternalRoute(raw);
        if (normalized) {
          refs.add(normalized);
        }
      }
    }
  }

  return [...refs].sort((left, right) => left.localeCompare(right));
}

describe('route location consistency', () => {
  it('keeps internal route references aligned with current app page locations', () => {
    const routeRegexes = collectAppRouteRegexes();
    const refs = collectInternalRouteRefs();

    const unmatched = refs.filter(
      (route) => !routeRegexes.some((regex) => regex.test(route)),
    );

    expect(unmatched).toEqual([]);
  });
});
