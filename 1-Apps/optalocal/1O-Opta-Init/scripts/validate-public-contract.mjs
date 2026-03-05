#!/usr/bin/env node

import process from 'node:process';

const URLS = [
  'https://optalocal.com',
  'https://init.optalocal.com',
  'https://status.optalocal.com',
  'https://learn.optalocal.com',
  'https://help.optalocal.com',
  'https://accounts.optalocal.com/sign-in',
  'https://lmx.optalocal.com',
  'https://init.optalocal.com/downloads/cli',
  'https://init.optalocal.com/downloads/opta-cli/latest',
  'https://init.optalocal.com/downloads/opta-init/latest',
  'https://init.optalocal.com/downloads/opta-init/latest/opta-init-mac.dmg',
  'https://init.optalocal.com/downloads/opta-init/latest/opta-init-windows-x64.exe',
  'https://init.optalocal.com/desktop-updates/stable.json',
  'https://init.optalocal.com/desktop-updates/beta.json',
];

const timeoutMs = Number.parseInt(process.env.OPTA_PUBLIC_CONTRACT_TIMEOUT_MS ?? '10000', 10);

async function request(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'OptaInitPublicContract/1.0',
        ...(method === 'GET' ? { range: 'bytes=0-0' } : {}),
      },
    });
    // Avoid downloading installer payloads; headers and status are sufficient here.
    await res.body?.cancel();
    return { ok: res.ok, status: res.status, finalUrl: res.url, method };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: '',
      method,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function check(url) {
  const head = await request(url, 'HEAD');
  if (head.ok) return head;

  // Some providers do not support HEAD on signed/binary URLs.
  const shouldRetryWithGet =
    head.status === 0 ||
    head.status === 401 ||
    head.status === 403 ||
    head.status === 405 ||
    head.status === 501;

  if (!shouldRetryWithGet) return head;
  return request(url, 'GET');
}

(async () => {
  let failed = 0;
  for (const url of URLS) {
    const result = await check(url);
    if (!result.ok) {
      failed += 1;
      console.error(
        `FAIL [${result.status || 'ERR'} ${result.method}] ${url} -> ${result.finalUrl || result.error}`
      );
    } else {
      console.log(`PASS [${result.status} ${result.method}] ${url} -> ${result.finalUrl}`);
    }
  }

  if (failed > 0) {
    console.error(`Public contract failed (${failed}/${URLS.length} checks)`);
    process.exit(1);
  }

  console.log(`Public contract passed (${URLS.length} checks)`);
})();
