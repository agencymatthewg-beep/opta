#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const checks = [
  {
    id: 'accounts-server-cookie-domain',
    file: '1R-Opta-Accounts/src/lib/supabase/server.ts',
    patterns: [
      /NODE_ENV\s*===\s*['"]production['"]\s*\?\s*['"]\.optalocal\.com['"]/, 
      /sameSite:\s*['"]lax['"]/,
      /secure:\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/
    ],
  },
  {
    id: 'accounts-middleware-cookie-domain',
    file: '1R-Opta-Accounts/src/lib/supabase/middleware.ts',
    patterns: [
      /NODE_ENV\s*===\s*['"]production['"]\s*\?\s*['"]\.optalocal\.com['"]/, 
      /sameSite:\s*['"]lax['"]/,
      /secure:\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/
    ],
  },
  {
    id: 'admin-server-cookie-domain',
    file: '1X-Opta-Admin/src/lib/supabase/server.ts',
    patterns: [
      /NODE_ENV\s*===\s*['"]production['"]\s*\?\s*['"]\.optalocal\.com['"]/, 
      /sameSite:\s*['"]lax['"]/,
      /secure:\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/
    ],
  },
  {
    id: 'admin-middleware-fail-closed',
    file: '1X-Opta-Admin/src/lib/supabase/middleware.ts',
    patterns: [
      /const\s+ADMIN_ALLOWLIST_ENV\s*=\s*['"]OPTA_ADMIN_ALLOWED_EMAILS['"]/, 
      /const\s+isProduction\s*=\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]/, 
      /if\s*\(!hasAllowlist\)\s*\{[\s\S]*if\s*\(isProduction\)[\s\S]*503/, 
      /if\s*\(path\.startsWith\(['"]\/api\//,
      /return\s+NextResponse\.json\(\{\s*error:\s*['"]Unauthorized['"]\s*\},\s*\{\s*status:\s*403\s*\}\)/,
    ],
  },
  {
    id: 'accounts-redirect-allowlist',
    file: '1R-Opta-Accounts/src/lib/allowed-redirects.ts',
    patterns: [
      '[a-z0-9-]+\\.optalocal\\.com',
      '127\\.0\\.0\\.1:\\d+',
      'localhost:\\d+',
      'opta-init:\\/\\/auth\\/callback',
      'opta-code:\\/\\/auth\\/callback',
      'function sanitizeRedirect(',
      "return '/profile';"
    ],
  },
];

function ok(label) {
  console.log(`PASS ${label}`);
}

function fail(label, reason) {
  console.error(`FAIL ${label}: ${reason}`);
}

async function runCheck(check) {
  const absPath = path.join(WORKSPACE_ROOT, check.file);
  const raw = await readFile(absPath, 'utf8');

  for (const pattern of check.patterns) {
    const matched =
      pattern instanceof RegExp ? pattern.test(raw) : raw.includes(String(pattern));
    if (!matched) {
      throw new Error(`missing required pattern ${pattern}`);
    }
  }

  ok(check.id);
}

async function main() {
  let failures = 0;

  for (const check of checks) {
    try {
      await runCheck(check);
    } catch (error) {
      failures += 1;
      fail(check.id, error instanceof Error ? error.message : String(error));
    }
  }

  if (failures > 0) {
    console.error(`\nSSO contract check failed with ${failures} issue(s).`);
    process.exit(1);
  }

  console.log('\nPASS SSO/admin contract checks');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
