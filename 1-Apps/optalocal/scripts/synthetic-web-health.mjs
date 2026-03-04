#!/usr/bin/env node

const SITE_TARGETS = [
  { id: 'home', name: 'Home', url: 'https://optalocal.com' },
  { id: 'init', name: 'Init', url: 'https://init.optalocal.com' },
  { id: 'accounts', name: 'Accounts', url: 'https://accounts.optalocal.com' },
  { id: 'status', name: 'Status', url: 'https://status.optalocal.com' },
  { id: 'help', name: 'Help', url: 'https://help.optalocal.com' },
  { id: 'learn', name: 'Learn', url: 'https://learn.optalocal.com' },
  { id: 'admin', name: 'Admin', url: 'https://admin.optalocal.com' },
  { id: 'lmx', name: 'LMX', url: 'https://lmx.optalocal.com' },
];

const HEALTH_ENDPOINTS = [
  { id: 'home', name: 'Home Health', url: 'https://optalocal.com/api/health' },
  { id: 'accounts', name: 'Accounts Health', url: 'https://accounts.optalocal.com/api/health/supabase' },
  { id: 'status-admin', name: 'Status Admin Probe', url: 'https://status.optalocal.com/api/health/admin' },
  { id: 'status-lmx', name: 'Status LMX Probe', url: 'https://status.optalocal.com/api/health/lmx' },
  { id: 'status-daemon', name: 'Status Daemon Probe', url: 'https://status.optalocal.com/api/health/daemon' },
  { id: 'admin', name: 'Admin Health', url: 'https://admin.optalocal.com/api/health' },
];

const REQUIRED_SECURITY_HEADERS = [
  { key: 'content-security-policy', label: 'CSP' },
  { key: 'x-frame-options', label: 'X-Frame-Options' },
  { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
  { key: 'referrer-policy', label: 'Referrer-Policy' },
];

const REQUEST_TIMEOUT_MS = 12000;

function hasFlag(flag) {
  return process.argv.includes(flag);
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
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: '*/*',
        'User-Agent': 'optalocal-synthetic-health/1.0',
        ...(init.headers ?? {}),
      },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSite(site) {
  const rootUrl = new URL('/', site.url).toString();
  const faviconUrl = new URL('/favicon.ico', site.url).toString();

  const result = {
    id: site.id,
    name: site.name,
    url: site.url,
    pass: false,
    checks: {
      root: { url: rootUrl, ok: false, status: null, error: null },
      favicon: { url: faviconUrl, ok: false, status: null, error: null },
      canonical: { present: false },
      headers: {
        ok: false,
        required: REQUIRED_SECURITY_HEADERS.map((header) => header.label),
        missing: [],
      },
    },
  };

  try {
    const rootResponse = await fetchWithTimeout(rootUrl);
    result.checks.root.status = rootResponse.status;
    result.checks.root.ok = rootResponse.status === 200;

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
    const faviconResponse = await fetchWithTimeout(faviconUrl);
    result.checks.favicon.status = faviconResponse.status;
    result.checks.favicon.ok = faviconResponse.status === 200;
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

async function checkHealthEndpoint(endpoint) {
  const result = {
    id: endpoint.id,
    name: endpoint.name,
    url: endpoint.url,
    pass: false,
    status: null,
    error: null,
  };

  try {
    const response = await fetchWithTimeout(endpoint.url);
    result.status = response.status;
    result.pass = response.status === 200;
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

function printHumanOutput(siteResults, healthResults, summary) {
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
}

async function main() {
  const siteResults = await Promise.all(SITE_TARGETS.map((site) => checkSite(site)));
  const healthResults = await Promise.all(HEALTH_ENDPOINTS.map((endpoint) => checkHealthEndpoint(endpoint)));
  const summary = summarize(siteResults, healthResults);

  if (hasFlag('--json')) {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      sites: siteResults,
      healthEndpoints: healthResults,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHumanOutput(siteResults, healthResults, summary);
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
