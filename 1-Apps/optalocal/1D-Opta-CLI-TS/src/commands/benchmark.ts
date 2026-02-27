import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { routeResearchQuery } from '../research/router.js';
import { buildBenchmarkNewsReport, normalizeProviderOrder } from '../benchmark/news.js';
import { renderAiNewsPage, renderBenchmarkHomePage, renderChessPage, renderLandingPage } from '../benchmark/pages.js';

const DEFAULT_NEWS_QUERY =
  'Summarize the most important AI news announced in the last 14 days. Cover model launches, product updates, regulation, funding, and open-source momentum with source links.';

const DEFAULT_WORD_TARGET = 650;
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_PORT = 4789;
const DEFAULT_HOST = '127.0.0.1';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

export interface BenchmarkOptions {
  output?: string;
  query?: string;
  words?: string | number;
  maxResults?: string | number;
  providerOrder?: string;
  serve?: boolean;
  host?: string;
  port?: string | number;
  force?: boolean;
  json?: boolean;
}

interface BenchmarkManifest {
  generatedAt: string;
  outputDir: string;
  apps: {
    landing: string;
    chess: string;
    aiNews: string;
  };
  news: {
    provider: string;
    wordCount: number;
    citationCount: number;
    attemptedProviders: string[];
    query: string;
    fallbackReason?: string;
  };
}

function parseInteger(value: string | number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return fallback;
}

function ensureInRange(value: number, min: number, max: number, name: string): number {
  if (value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureOutputDirectory(path: string, force: boolean): Promise<void> {
  const exists = await pathExists(path);
  if (!exists) {
    await mkdir(path, { recursive: true });
    return;
  }

  const info = await stat(path);
  if (!info.isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${path}`);
  }

  if (force) return;

  const benchmarkMarker = join(path, 'benchmark-manifest.json');
  const markerExists = await pathExists(benchmarkMarker);
  if (!markerExists) {
    throw new Error(`Output directory already exists and is not a benchmark suite: ${path}. Use --force to continue.`);
  }
}

function safeJoin(root: string, requestPath: string): string | null {
  try {
    const cleanPath = requestPath.split('?')[0] ?? '/';
    const decoded = decodeURIComponent(cleanPath);
    const normalizedPath = normalize(decoded).replace(/^\.{2}(\/|\\|$)+/, '');
    const relative = normalizedPath === '/' ? '/index.html' : normalizedPath;
    const candidate = resolve(root, `.${relative}`);
    return candidate.startsWith(root) ? candidate : null;
  } catch {
    return null;
  }
}

async function respondFile(path: string, response: ServerResponse): Promise<void> {
  const extension = extname(path).toLowerCase();
  const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';

  try {
    const file = await readFile(path);
    response.statusCode = 200;
    response.setHeader('content-type', contentType);
    response.end(file);
  } catch {
    if (!extension) {
      try {
        const nested = await readFile(join(path, 'index.html'));
        response.statusCode = 200;
        response.setHeader('content-type', CONTENT_TYPES['.html'] ?? 'text/html; charset=utf-8');
        response.end(nested);
        return;
      } catch {
        // Fall through.
      }
    }

    response.statusCode = 404;
    response.setHeader('content-type', 'text/plain; charset=utf-8');
    response.end('Not found');
  }
}

async function requestHandler(root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const target = safeJoin(root, request.url ?? '/');
  if (!target) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  const resolvedPath = target.endsWith('/') ? `${target}index.html` : target;
  await respondFile(resolvedPath, response);
}

async function startStaticServer(outputDir: string, host: string, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const server = createServer((request, response) => {
      void requestHandler(outputDir, request, response);
    });

    server.on('error', (error) => {
      rejectPromise(error);
    });

    server.listen(port, host, () => {
      resolvePromise();
    });
  });
}

export async function benchmark(opts: BenchmarkOptions = {}): Promise<void> {
  const outputDir = resolve(opts.output ? opts.output : join(process.cwd(), 'apps', 'opta-benchmark-suite'));
  const force = opts.force === true;
  const query = (opts.query ?? DEFAULT_NEWS_QUERY).trim();

  const wordTarget = ensureInRange(parseInteger(opts.words, DEFAULT_WORD_TARGET), 500, 4000, 'words');
  const maxResults = ensureInRange(parseInteger(opts.maxResults, DEFAULT_MAX_RESULTS), 3, 20, 'maxResults');
  const port = ensureInRange(parseInteger(opts.port, DEFAULT_PORT), 1024, 65535, 'port');
  const host = opts.host?.trim() || DEFAULT_HOST;
  const providerOrder = normalizeProviderOrder(opts.providerOrder);

  if (!query) throw new Error('query must not be empty.');

  await ensureOutputDirectory(outputDir, force);
  await mkdir(outputDir, { recursive: true });

  const generatedAt = new Date();
  const config = await loadConfig();

  const routeResult = await routeResearchQuery(
    {
      query,
      intent: 'news',
      maxResults,
    },
    {
      config,
      providerOrder,
    },
  );

  const newsReport = buildBenchmarkNewsReport({
    generatedAt,
    query,
    wordTarget,
    routeResult,
  });

  const landingDir = join(outputDir, 'landing');
  const chessDir = join(outputDir, 'chess');
  const aiNewsDir = join(outputDir, 'ai-news');

  await Promise.all([
    mkdir(landingDir, { recursive: true }),
    mkdir(chessDir, { recursive: true }),
    mkdir(aiNewsDir, { recursive: true }),
  ]);

  await Promise.all([
    writeFile(join(outputDir, 'index.html'), renderBenchmarkHomePage({ generatedAt, newsReport }), 'utf-8'),
    writeFile(join(landingDir, 'index.html'), renderLandingPage({ generatedAt, newsReport }), 'utf-8'),
    writeFile(join(chessDir, 'index.html'), renderChessPage({ generatedAt, newsReport }), 'utf-8'),
    writeFile(join(aiNewsDir, 'index.html'), renderAiNewsPage({ generatedAt, newsReport }), 'utf-8'),
  ]);

  const manifest: BenchmarkManifest = {
    generatedAt: generatedAt.toISOString(),
    outputDir,
    apps: {
      landing: join(outputDir, 'landing', 'index.html'),
      chess: join(outputDir, 'chess', 'index.html'),
      aiNews: join(outputDir, 'ai-news', 'index.html'),
    },
    news: {
      provider: newsReport.provider,
      wordCount: newsReport.wordCount,
      citationCount: newsReport.citations.length,
      attemptedProviders: newsReport.attemptedProviders,
      query: newsReport.query,
      fallbackReason: newsReport.providerFailure,
    },
  };

  await writeFile(join(outputDir, 'benchmark-manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  if (opts.json) {
    console.log(JSON.stringify({
      ok: true,
      outputDir,
      manifest,
      served: opts.serve === true,
      url: opts.serve ? `http://${host}:${port}` : undefined,
    }, null, 2));
  } else {
    console.log(chalk.green('✓') + ` Generated benchmark suite at ${outputDir}`);
    console.log(chalk.dim(`  Landing: ${manifest.apps.landing}`));
    console.log(chalk.dim(`  Chess:   ${manifest.apps.chess}`));
    console.log(chalk.dim(`  AI News: ${manifest.apps.aiNews}`));
    console.log(chalk.dim(`  News provider: ${newsReport.provider}`));
    console.log(chalk.dim(`  Word count:    ${newsReport.wordCount}`));
    if (newsReport.providerFailure) {
      console.log(chalk.yellow('!') + ` Research fallback: ${newsReport.providerFailure}`);
    }
  }

  if (!opts.serve) return;

  await startStaticServer(outputDir, host, port);

  if (!opts.json) {
    console.log(chalk.cyan(`\nBenchmark suite serving at http://${host}:${port}`));
    console.log(chalk.dim('Press Ctrl+C to stop.'));
  }
}
