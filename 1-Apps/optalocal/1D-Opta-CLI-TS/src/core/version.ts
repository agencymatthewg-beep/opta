import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadVersion(): string {
  // Build output is emitted under dist/, so static relative paths are brittle.
  // Walk up from the current module directory until a package.json is found.
  let current = __dirname;
  for (let depth = 0; depth < 5; depth += 1) {
    const pkgPath = join(current, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
        if (typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
          return pkg.version.trim();
        }
      } catch {
        // Continue searching parent directories.
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return '0.0.0';
}

export const VERSION: string = loadVersion();
