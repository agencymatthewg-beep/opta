import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CAPABILITY_PARITY_CATEGORIES = [
  'in_dashboard',
  'in_lmx_not_dashboard',
  'dashboard_only',
] as const;

type CapabilityParityCategory = (typeof CAPABILITY_PARITY_CATEGORIES)[number];

interface CapabilityParityEntry {
  path: string;
  category: CapabilityParityCategory;
}

interface CapabilityParityByCategory {
  in_dashboard: string[];
  in_lmx_not_dashboard: string[];
  dashboard_only: string[];
}

interface CapabilityParityArtifact {
  categories: readonly CapabilityParityCategory[];
  endpoints: CapabilityParityEntry[];
  byCategory: CapabilityParityByCategory;
  sources: {
    lmxApiDir: string;
    dashboardClientPath: string;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const DASHBOARD_CLIENT_PATH = path.resolve(WEB_ROOT, 'src/lib/lmx-client.ts');
const OUTPUT_PATH = path.resolve(
  WEB_ROOT,
  'src/lib/capabilities/parity.generated.json',
);

const ROUTER_ASSIGNMENT_RE = /(\w+)\s*=\s*APIRouter\(/g;
const ROUTE_DECORATOR_RE =
  /@(\w+)\.(get|post|put|patch|delete|options|head|websocket)\(/g;
const DASHBOARD_PATH_RE = /(\/(?:admin|v1)\/[A-Za-z0-9_./:{}-]*)/g;

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function resolveFromRepoOrAbsolute(value: string): string {
  if (path.isAbsolute(value)) {
    return path.resolve(value);
  }
  return path.resolve(REPO_ROOT, value);
}

function isLmxApiDir(candidate: string): boolean {
  if (!fs.existsSync(candidate)) {
    return false;
  }
  if (!fs.statSync(candidate).isDirectory()) {
    return false;
  }
  return fs
    .readdirSync(candidate)
    .some((fileName) => fileName.endsWith('.py'));
}

function discoverLmxApiDir(): string {
  const envCandidateRaw = process.env.OPTA_LMX_API_DIR?.trim();
  if (envCandidateRaw) {
    const envCandidate = resolveFromRepoOrAbsolute(envCandidateRaw);
    if (!isLmxApiDir(envCandidate)) {
      throw new Error(
        `OPTA_LMX_API_DIR does not point to a valid API directory: ${envCandidate}`,
      );
    }
    return envCandidate;
  }

  const candidates = new Set<string>();

  const knownCandidates = [
    path.resolve(REPO_ROOT, '../1M-Opta-LMX/src/opta_lmx/api'),
    path.resolve(REPO_ROOT, '1M-Opta-LMX/src/opta_lmx/api'),
  ];
  for (const candidate of knownCandidates) {
    if (isLmxApiDir(candidate)) {
      candidates.add(path.resolve(candidate));
    }
  }

  const siblingRoot = path.resolve(REPO_ROOT, '..');
  if (fs.existsSync(siblingRoot) && fs.statSync(siblingRoot).isDirectory()) {
    for (const entry of fs.readdirSync(siblingRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = path.join(siblingRoot, entry.name, 'src/opta_lmx/api');
      if (isLmxApiDir(candidate)) {
        candidates.add(path.resolve(candidate));
      }
    }
  }

  const resolvedCandidates = [...candidates].sort((left, right) =>
    left.localeCompare(right),
  );

  if (resolvedCandidates.length === 0) {
    throw new Error(
      'Could not locate LMX API directory. Set OPTA_LMX_API_DIR to src/opta_lmx/api.',
    );
  }

  if (resolvedCandidates.length > 1) {
    const listing = resolvedCandidates.map((value) => `- ${value}`).join('\n');
    throw new Error(
      `Multiple LMX API directories found. Set OPTA_LMX_API_DIR to the active one:\n${listing}`,
    );
  }

  const [lmxApiDir] = resolvedCandidates;
  if (!lmxApiDir) {
    throw new Error('LMX API directory resolution failed.');
  }
  return lmxApiDir;
}

function findMatchingParen(source: string, openParenIndex: number): number {
  let depth = 0;
  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function normalizePrefix(rawPrefix: string): string {
  const trimmed = rawPrefix.trim();
  if (!trimmed) {
    return '';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

function normalizePath(rawPath: string): string {
  let value = rawPath.trim();
  value = value.replace(/\/:[A-Za-z0-9_]+/g, '/{param}');
  value = value.replace(/\$\{[^}]+\}/g, '{param}');
  value = value.replace(/\{[^}]+\}/g, '{param}');
  value = value.replace(
    /\{param\}(?=[^/]|$)/g,
    (token: string, offset: number, source: string) =>
      offset > 0 && source[offset - 1] !== '/' ? '' : token,
  );
  value = value.replace(/[?#].*$/, '');
  value = value.replace(/\/+/g, '/');
  if (!value.startsWith('/')) {
    value = `/${value}`;
  }
  if (value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

function combinePrefixAndRoute(prefix: string, routePath: string): string {
  const normalizedPrefix = normalizePrefix(prefix);
  const trimmedRoute = routePath.trim();
  if (!trimmedRoute) {
    return normalizedPrefix || '/';
  }
  const normalizedRoute = trimmedRoute.startsWith('/')
    ? trimmedRoute
    : `/${trimmedRoute}`;
  return `${normalizedPrefix}${normalizedRoute}`;
}

function extractRouterPrefixes(source: string): Map<string, string> {
  const prefixes = new Map<string, string>();
  for (const match of source.matchAll(ROUTER_ASSIGNMENT_RE)) {
    const routerName = match[1];
    if (!routerName) {
      continue;
    }
    const matchIndex = match.index;
    if (matchIndex == null) {
      continue;
    }
    const openParenIndex = matchIndex + match[0].length - 1;
    const closeParenIndex = findMatchingParen(source, openParenIndex);
    if (closeParenIndex === -1) {
      continue;
    }
    const args = source.slice(openParenIndex + 1, closeParenIndex);
    const prefixMatch = args.match(/prefix\s*=\s*['"]([^'"]*)['"]/);
    const rawPrefix = prefixMatch?.[1] ?? '';
    prefixes.set(routerName, normalizePrefix(rawPrefix));
  }
  return prefixes;
}

function extractLmxPathsFromFile(source: string): Set<string> {
  const routerPrefixes = extractRouterPrefixes(source);
  const paths = new Set<string>();

  for (const match of source.matchAll(ROUTE_DECORATOR_RE)) {
    const routerName = match[1];
    if (!routerName) {
      continue;
    }
    const matchIndex = match.index;
    if (matchIndex == null) {
      continue;
    }
    const openParenIndex = matchIndex + match[0].length - 1;
    const closeParenIndex = findMatchingParen(source, openParenIndex);
    if (closeParenIndex === -1) {
      continue;
    }
    const args = source.slice(openParenIndex + 1, closeParenIndex);
    const pathMatch = args.match(/['"]([^'"]*)['"]/);
    if (!pathMatch) {
      continue;
    }
    const routePath = pathMatch[1];
    if (routePath == null) {
      continue;
    }
    const prefix = routerPrefixes.get(routerName) ?? '';
    const normalizedPath = normalizePath(
      combinePrefixAndRoute(prefix, routePath),
    );
    paths.add(normalizedPath);
  }

  return paths;
}

function extractLmxPaths(apiDir: string): Set<string> {
  if (!fs.existsSync(apiDir)) {
    throw new Error(`LMX API directory not found: ${apiDir}`);
  }
  const fileNames = fs
    .readdirSync(apiDir)
    .filter((fileName) => fileName.endsWith('.py'))
    .sort((left, right) => left.localeCompare(right));

  const paths = new Set<string>();
  for (const fileName of fileNames) {
    const filePath = path.join(apiDir, fileName);
    const source = fs.readFileSync(filePath, 'utf8');
    for (const endpointPath of extractLmxPathsFromFile(source)) {
      paths.add(endpointPath);
    }
  }
  return paths;
}

function extractDashboardPaths(clientPath: string): Set<string> {
  if (!fs.existsSync(clientPath)) {
    throw new Error(`Dashboard client file not found: ${clientPath}`);
  }
  const source = fs.readFileSync(clientPath, 'utf8');
  const normalizedSource = source.replace(/\$\{[^}]+\}/g, '{param}');
  const paths = new Set<string>();
  for (const match of normalizedSource.matchAll(DASHBOARD_PATH_RE)) {
    const rawPath = match[1];
    if (!rawPath) {
      continue;
    }
    paths.add(normalizePath(rawPath));
  }
  return paths;
}

function comparePaths(left: string, right: string): number {
  return left.localeCompare(right);
}

function classifyPath(
  endpointPath: string,
  lmxPaths: Set<string>,
  dashboardPaths: Set<string>,
): CapabilityParityCategory {
  const inLmx = lmxPaths.has(endpointPath);
  const inDashboard = dashboardPaths.has(endpointPath);

  if (inLmx && inDashboard) {
    return 'in_dashboard';
  }
  if (inLmx) {
    return 'in_lmx_not_dashboard';
  }
  return 'dashboard_only';
}

function buildArtifact(
  lmxPaths: Set<string>,
  dashboardPaths: Set<string>,
  sources: { lmxApiDir: string; dashboardClientPath: string },
): CapabilityParityArtifact {
  const allPaths = Array.from(new Set([...lmxPaths, ...dashboardPaths])).sort(
    comparePaths,
  );

  const byCategory: CapabilityParityByCategory = {
    in_dashboard: [],
    in_lmx_not_dashboard: [],
    dashboard_only: [],
  };

  const endpoints: CapabilityParityEntry[] = allPaths.map((endpointPath) => {
    const category = classifyPath(endpointPath, lmxPaths, dashboardPaths);
    byCategory[category].push(endpointPath);
    return {
      path: endpointPath,
      category,
    };
  });

  for (const category of CAPABILITY_PARITY_CATEGORIES) {
    byCategory[category].sort(comparePaths);
  }

  return {
    categories: [...CAPABILITY_PARITY_CATEGORIES],
    endpoints,
    byCategory,
    sources,
  };
}

function writeArtifact(artifact: CapabilityParityArtifact): void {
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, json, 'utf8');
}

function main(): void {
  const lmxApiDir = discoverLmxApiDir();
  const lmxPaths = extractLmxPaths(lmxApiDir);
  const dashboardPaths = extractDashboardPaths(DASHBOARD_CLIENT_PATH);
  const artifact = buildArtifact(lmxPaths, dashboardPaths, {
    lmxApiDir: toPosixPath(path.relative(REPO_ROOT, lmxApiDir)),
    dashboardClientPath: toPosixPath(
      path.relative(REPO_ROOT, DASHBOARD_CLIENT_PATH),
    ),
  });
  writeArtifact(artifact);
}

main();
