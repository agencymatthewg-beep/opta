#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'websites.registry.json');

const FALLBACK_SITE_TARGETS = [
  { id: 'home', name: 'Home', url: 'https://optalocal.com' },
  { id: 'init', name: 'Init', url: 'https://init.optalocal.com' },
  { id: 'accounts', name: 'Accounts', url: 'https://accounts.optalocal.com' },
  { id: 'status', name: 'Status', url: 'https://status.optalocal.com' },
  { id: 'help', name: 'Help', url: 'https://help.optalocal.com' },
  { id: 'learn', name: 'Learn', url: 'https://learn.optalocal.com' },
  { id: 'admin', name: 'Admin', url: 'https://admin.optalocal.com' },
  { id: 'lmx', name: 'LMX', url: 'https://lmx.optalocal.com' },
];

const FALLBACK_HEALTH_ENDPOINTS = [
  { id: 'home', name: 'Home Health', url: 'https://optalocal.com/api/health' },
  { id: 'accounts', name: 'Accounts Health', url: 'https://accounts.optalocal.com/api/health/supabase' },
  { id: 'status-admin', name: 'Status Admin Probe', url: 'https://status.optalocal.com/api/health/admin' },
  { id: 'status-lmx', name: 'Status LMX Probe', url: 'https://status.optalocal.com/api/health/lmx' },
  { id: 'status-lmx-site', name: 'Status LMX Site Probe', url: 'https://status.optalocal.com/api/health/lmx-site' },
  { id: 'status-daemon', name: 'Status Daemon Probe', url: 'https://status.optalocal.com/api/health/daemon' },
  { id: 'admin', name: 'Admin Health', url: 'https://admin.optalocal.com/api/health' },
];

function titleCaseLabel(value) {
  return String(value)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortWebsiteName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return 'Site';
  return trimmed.replace(/^Opta\s+/i, '') || trimmed;
}

function loadWebsiteRegistry() {
  try {
    const raw = readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.websites)) {
      return null;
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`warning: failed to load websites registry (${REGISTRY_PATH}): ${message}`);
    return null;
  }
}

function buildTargetsFromRegistry() {
  const registry = loadWebsiteRegistry();
  if (!registry) {
    return {
      siteTargets: FALLBACK_SITE_TARGETS,
      healthEndpoints: FALLBACK_HEALTH_ENDPOINTS,
    };
  }

  const websites = registry.websites
    .filter((website) => website && typeof website === 'object')
    .filter((website) => typeof website.key === 'string' && website.key.trim().length > 0)
    .filter((website) => typeof website.domain === 'string' && website.domain.trim().length > 0)
    .map((website) => ({
      ...website,
      key: website.key.trim().toLowerCase(),
      domain: website.domain.trim(),
      name: typeof website.name === 'string' ? website.name : website.key,
      healthPath:
        typeof website.healthPath === 'string' && website.healthPath.trim().length > 0
          ? website.healthPath.trim()
          : '/',
      statusServiceId:
        typeof website.statusServiceId === 'string' && website.statusServiceId.trim().length > 0
          ? website.statusServiceId.trim().toLowerCase()
          : null,
    }));

  if (websites.length === 0) {
    return {
      siteTargets: FALLBACK_SITE_TARGETS,
      healthEndpoints: FALLBACK_HEALTH_ENDPOINTS,
    };
  }

  const siteTargets = websites.map((website) => ({
    id: website.key,
    name: shortWebsiteName(website.name),
    url: `https://${website.domain}`,
  }));

  const healthEndpointById = new Map(
    websites.map((website) => [
      website.key,
      {
        id: website.key,
        name: `${shortWebsiteName(website.name)} Health`,
        url: `https://${website.domain}${website.healthPath}`,
      },
    ]),
  );

  const statusDomain =
    websites.find((website) => website.statusServiceId === 'status')?.domain ??
    'status.optalocal.com';
  const probeServiceIds = Array.isArray(registry.syntheticStatusProbeServiceIds)
    ? registry.syntheticStatusProbeServiceIds.filter(
        (serviceId) => typeof serviceId === 'string' && serviceId.trim().length > 0,
      )
    : [];

  for (const serviceId of probeServiceIds) {
    const normalizedServiceId = serviceId.trim().toLowerCase();
    healthEndpointById.set(`status-${normalizedServiceId}`, {
      id: `status-${normalizedServiceId}`,
      name: `Status ${titleCaseLabel(normalizedServiceId)} Probe`,
      url: `https://${statusDomain}/api/health/${normalizedServiceId}`,
    });
  }

  return {
    siteTargets,
    healthEndpoints: [...healthEndpointById.values()],
  };
}

const { siteTargets: SITE_TARGETS, healthEndpoints: HEALTH_ENDPOINTS } = buildTargetsFromRegistry();

const REQUIRED_SECURITY_HEADERS = [
  { key: 'content-security-policy', label: 'CSP' },
  { key: 'x-frame-options', label: 'X-Frame-Options' },
  { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
  { key: 'referrer-policy', label: 'Referrer-Policy' },
];

const REQUEST_TIMEOUT_MS = 12000;
const FAVICON_PATHS = ['/favicon.ico', '/favicon.svg'];

function parsePositiveNumber(rawValue, flagName) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${flagName}: ${rawValue}`);
  }
  return parsed;
}

function parseCliOptions(argv) {
  const options = {
    json: false,
    latencySummary: false,
    warnLatencyMs: null,
    failLatencyMs: null,
    siteIds: null,
    endpointIds: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--latency-summary') {
      options.latencySummary = true;
      continue;
    }
    if (arg === '--warn-latency-ms' || arg === '--fail-latency-ms') {
      const nextValue = argv[index + 1];
      if (nextValue == null) {
        throw new Error(`Missing value for ${arg}`);
      }
      const parsedValue = parsePositiveNumber(nextValue, arg);
      if (arg === '--warn-latency-ms') {
        options.warnLatencyMs = parsedValue;
      } else {
        options.failLatencyMs = parsedValue;
      }
      index += 1;
      continue;
    }
    if (arg === '--sites' || arg === '--endpoints') {
      const nextValue = argv[index + 1];
      if (nextValue == null) {
        throw new Error(`Missing value for ${arg}`);
      }
      const values = nextValue
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      if (values.length === 0) {
        throw new Error(`Invalid value for ${arg}: ${nextValue}`);
      }
      if (arg === '--sites') {
        options.siteIds = new Set(values);
      } else {
        options.endpointIds = new Set(values);
      }
      index += 1;
    }
  }

  return options;
}

function filterByIds(items, ids, itemType) {
  if (!ids || ids.size === 0) {
    return items;
  }
  const filtered = items.filter((item) => ids.has(item.id.toLowerCase()));
  if (filtered.length === 0) {
    throw new Error(
      `No ${itemType} matched requested ids: ${[...ids].sort().join(', ')}`
    );
  }
  return filtered;
}

function canonicalTagPresent(html) {
  if (!html || typeof html !== 'string') {
    return false;
  }

  const canonicalLinkMatch = html.match(
    /<link\b[^>]*\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i
  );
  if (!canonicalLinkMatch) {
    return false;
  }
  return /\bhref\s*=\s*["'][^"']+["']/i.test(canonicalLinkMatch[0]);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        'User-Agent': 'optalocal-synthetic-health/1.0',
        ...(init.headers ?? {}),
      },
      redirect: 'follow',
    });
    return { response, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSite(site, includeLatencyMetrics = false) {
  const rootUrl = new URL('/', site.url).toString();

  const result = {
    id: site.id,
    name: site.name,
    url: site.url,
    pass: false,
    checks: {
      root: { url: rootUrl, ok: false, status: null, error: null },
      favicon: { url: null, ok: false, status: null, error: null },
      canonical: { present: false },
      headers: {
        ok: false,
        required: REQUIRED_SECURITY_HEADERS.map((header) => header.label),
        missing: [],
      },
    },
  };
  if (includeLatencyMetrics) {
    result.checks.root.latencyMs = null;
    result.checks.favicon.latencyMs = null;
  }

  try {
    const rootRequest = await fetchWithTimeout(rootUrl);
    const rootResponse = rootRequest.response;
    result.checks.root.status = rootResponse.status;
    result.checks.root.ok = rootResponse.status === 200;
    if (includeLatencyMetrics) {
      result.checks.root.latencyMs = rootRequest.latencyMs;
    }

    const missingHeaders = REQUIRED_SECURITY_HEADERS.filter(
      (header) => !rootResponse.headers.get(header.key)
    ).map((header) => header.label);
    result.checks.headers.missing = missingHeaders;
    result.checks.headers.ok = missingHeaders.length === 0;

    const rootBody = await rootResponse.text();
    result.checks.canonical.present = canonicalTagPresent(rootBody);
  } catch (error) {
    result.checks.root.error = error instanceof Error ? error.message : String(error);
  }

  try {
    for (const faviconPath of FAVICON_PATHS) {
      const faviconUrl = new URL(faviconPath, site.url).toString();
      result.checks.favicon.url = faviconUrl;

      const faviconRequest = await fetchWithTimeout(faviconUrl);
      const faviconResponse = faviconRequest.response;
      result.checks.favicon.status = faviconResponse.status;
      result.checks.favicon.ok = faviconResponse.status === 200;
      if (includeLatencyMetrics) {
        result.checks.favicon.latencyMs = faviconRequest.latencyMs;
      }
      if (result.checks.favicon.ok) {
        break;
      }
    }
  } catch (error) {
    result.checks.favicon.error = error instanceof Error ? error.message : String(error);
  }

  result.pass =
    result.checks.root.ok &&
    result.checks.favicon.ok &&
    result.checks.canonical.present &&
    result.checks.headers.ok;

  return result;
}

async function checkHealthEndpoint(endpoint, includeLatencyMetrics = false) {
  const result = {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    pass: false,
    status: null,
    error: null,
  };
  if (includeLatencyMetrics) {
    result.latencyMs = null;
  }

  try {
    const request = await fetchWithTimeout(endpoint.url);
    const response = request.response;
    result.status = response.status;
    result.pass = response.status === 200;
    if (includeLatencyMetrics) {
      result.latencyMs = request.latencyMs;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

function buildTable(headers, rows) {
  const widths = headers.map((header, index) => {
    const values = rows.map((row) => String(row[index] ?? ''));
    return Math.max(header.length, ...values.map((value) => value.length));
  });

  const formatRow = (cells) =>
    cells
      .map((cell, index) => String(cell ?? '').padEnd(widths[index], ' '))
      .join('  ');

  const divider = widths.map((width) => '-'.repeat(width)).join('  ');

  return [formatRow(headers), divider, ...rows.map((row) => formatRow(row))].join('\n');
}

function summarize(siteResults, healthResults) {
  const failedSites = siteResults.filter((site) => !site.pass).length;
  const failedHealthEndpoints = healthResults.filter((endpoint) => !endpoint.pass).length;
  return {
    siteChecks: siteResults.length,
    failedSites,
    passedSites: siteResults.length - failedSites,
    healthChecks: healthResults.length,
    failedHealthEndpoints,
    passedHealthEndpoints: healthResults.length - failedHealthEndpoints,
    ok: failedSites === 0 && failedHealthEndpoints === 0,
  };
}

function percentile(sortedValues, targetPercentile) {
  if (sortedValues.length === 0) {
    return null;
  }
  const index = Math.ceil((targetPercentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

function collectLatencySamples(siteResults, healthResults) {
  const samples = [];

  siteResults.forEach((site) => {
    if (typeof site?.checks?.root?.latencyMs === 'number') {
      samples.push({ target: `${site.name} (root)`, latencyMs: site.checks.root.latencyMs });
    }
    if (typeof site?.checks?.favicon?.latencyMs === 'number') {
      samples.push({ target: `${site.name} (favicon)`, latencyMs: site.checks.favicon.latencyMs });
    }
  });

  healthResults.forEach((endpoint) => {
    if (typeof endpoint?.latencyMs === 'number') {
      samples.push({ target: endpoint.name, latencyMs: endpoint.latencyMs });
    }
  });

  return samples;
}

function buildLatencySummary(siteResults, healthResults, options) {
  const samples = collectLatencySamples(siteResults, healthResults);
  const sorted = [...samples].sort((a, b) => a.latencyMs - b.latencyMs);
  const values = sorted.map((sample) => sample.latencyMs);
  const count = values.length;
  const minMs = count > 0 ? values[0] : null;
  const maxMs = count > 0 ? values[count - 1] : null;
  const averageMs = count > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / count).toFixed(1)) : null;
  const p95Ms = percentile(values, 95);

  const warnExceededCount =
    options.warnLatencyMs == null ? 0 : samples.filter((sample) => sample.latencyMs > options.warnLatencyMs).length;
  const failExceededCount =
    options.failLatencyMs == null ? 0 : samples.filter((sample) => sample.latencyMs > options.failLatencyMs).length;

  return {
    requestCount: count,
    minMs,
    averageMs,
    p95Ms,
    maxMs,
    thresholds: {
      warnLatencyMs: options.warnLatencyMs,
      failLatencyMs: options.failLatencyMs,
      warnExceededCount,
      failExceededCount,
    },
    slowest: [...samples].sort((a, b) => b.latencyMs - a.latencyMs).slice(0, 5),
  };
}

function printHumanOutput(siteResults, healthResults, summary, latencySummary) {
  const siteRows = siteResults.map((site) => {
    const rootCell = site.checks.root.error
      ? `ERR (${site.checks.root.error})`
      : String(site.checks.root.status ?? 'n/a');
    const faviconCell = site.checks.favicon.error
      ? `ERR (${site.checks.favicon.error})`
      : String(site.checks.favicon.status ?? 'n/a');
    const canonicalCell = site.checks.canonical.present ? 'yes' : 'no';
    const headersCell =
      site.checks.headers.missing.length === 0
        ? 'ok'
        : `missing: ${site.checks.headers.missing.join(',')}`;

    return [site.name, rootCell, faviconCell, canonicalCell, headersCell, site.pass ? 'PASS' : 'FAIL'];
  });

  const healthRows = healthResults.map((endpoint) => [
    endpoint.name,
    endpoint.error ? `ERR (${endpoint.error})` : String(endpoint.status ?? 'n/a'),
    endpoint.pass ? 'PASS' : 'FAIL',
  ]);

  console.log('\nSynthetic Web Health - Site Checks');
  console.log(buildTable(['Site', 'Root', 'Favicon', 'Canonical', 'Headers', 'Result'], siteRows));
  console.log('\nSynthetic Web Health - Endpoint Checks');
  console.log(buildTable(['Endpoint', 'Status', 'Result'], healthRows));
  console.log(
    `\nSummary: sites ${summary.passedSites}/${summary.siteChecks} passed, endpoints ${summary.passedHealthEndpoints}/${summary.healthChecks} passed`
  );

  if (latencySummary) {
    console.log('\nSynthetic Web Health - Latency');
    const latencyRows = [
      ['Request count', String(latencySummary.requestCount)],
      ['Min (ms)', String(latencySummary.minMs ?? 'n/a')],
      ['Avg (ms)', String(latencySummary.averageMs ?? 'n/a')],
      ['P95 (ms)', String(latencySummary.p95Ms ?? 'n/a')],
      ['Max (ms)', String(latencySummary.maxMs ?? 'n/a')],
    ];
    if (latencySummary.thresholds.warnLatencyMs != null) {
      latencyRows.push([
        `Warn > ${latencySummary.thresholds.warnLatencyMs}ms`,
        String(latencySummary.thresholds.warnExceededCount),
      ]);
    }
    if (latencySummary.thresholds.failLatencyMs != null) {
      latencyRows.push([
        `Fail > ${latencySummary.thresholds.failLatencyMs}ms`,
        String(latencySummary.thresholds.failExceededCount),
      ]);
    }
    console.log(buildTable(['Metric', 'Value'], latencyRows));

    if (latencySummary.slowest.length > 0) {
      console.log('\nSlowest Requests');
      const slowestRows = latencySummary.slowest.map((sample) => [sample.target, `${sample.latencyMs}ms`]);
      console.log(buildTable(['Target', 'Latency'], slowestRows));
    }
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const selectedSites = filterByIds(SITE_TARGETS, options.siteIds, 'sites');
  const selectedEndpoints = filterByIds(
    HEALTH_ENDPOINTS,
    options.endpointIds,
    'health endpoints',
  );
  const shouldEvaluateLatency =
    options.latencySummary || options.warnLatencyMs != null || options.failLatencyMs != null;

  const siteResults = await Promise.all(
    selectedSites.map((site) => checkSite(site, shouldEvaluateLatency))
  );
  const healthResults = await Promise.all(
    selectedEndpoints.map((endpoint) =>
      checkHealthEndpoint(endpoint, shouldEvaluateLatency)
    )
  );
  let summary = summarize(siteResults, healthResults);

  let latencySummary = null;
  if (shouldEvaluateLatency) {
    latencySummary = buildLatencySummary(siteResults, healthResults, options);
    const latencyFailTriggered =
      latencySummary.thresholds.failLatencyMs != null && latencySummary.thresholds.failExceededCount > 0;
    summary = {
      ...summary,
      latencyWarnings: latencySummary.thresholds.warnExceededCount,
      latencyFailures: latencySummary.thresholds.failExceededCount,
      latencyFailTriggered,
      ok: summary.ok && !latencyFailTriggered,
    };
  }

  if (options.json) {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      sites: siteResults,
      healthEndpoints: healthResults,
    };
    if (latencySummary) {
      payload.latency = latencySummary;
    }
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHumanOutput(siteResults, healthResults, summary, options.latencySummary ? latencySummary : null);
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
