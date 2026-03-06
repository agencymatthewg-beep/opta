import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let installed = false;

function toFileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

export function installRouteModuleHooks(): void {
  if (installed) return;

  const supportDir = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.resolve(supportDir, '..', '..');

  const moduleOverrides = new Map<string, string>([
    ['next/server', path.resolve(supportDir, 'next-server-stub.ts')],
    ['next/server.js', path.resolve(supportDir, 'next-server-stub.ts')],
    ['@/lib/supabase/server', path.resolve(supportDir, 'supabase-server-stub.ts')],
    ['@/lib/api/authz', path.resolve(supportDir, 'authz-stub.ts')],
    ['@/lib/api/audit', path.resolve(supportDir, 'audit-stub.ts')],
    ['@/lib/control-plane/store', path.resolve(supportDir, 'control-plane-store-stub.ts')],
  ]);

  registerHooks({
    resolve(specifier, context, nextResolve) {
      const directOverride = moduleOverrides.get(specifier);
      if (directOverride) {
        return {
          shortCircuit: true,
          url: toFileUrl(directOverride),
        };
      }

      if (specifier.startsWith('@/')) {
        const target = path.resolve(srcDir, `${specifier.slice(2)}.ts`);
        return {
          shortCircuit: true,
          url: toFileUrl(target),
        };
      }

      return nextResolve(specifier, context);
    },
  });

  installed = true;
}
