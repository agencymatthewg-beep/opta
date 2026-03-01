import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSupabaseAuthConfig } from '../../src/accounts/supabase.js';

const createdDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

afterEach(async () => {
  const fs = await import('node:fs/promises');
  await Promise.all(createdDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('resolveSupabaseAuthConfig', () => {
  it('prefers explicit process env values', () => {
    const config = resolveSupabaseAuthConfig({
      OPTA_SUPABASE_URL: 'https://proj-ref.supabase.co',
      OPTA_SUPABASE_ANON_KEY: 'anon-key',
    });

    expect(config).toEqual({
      url: 'https://proj-ref.supabase.co',
      anonKey: 'anon-key',
      project: 'proj-ref',
    });
  });

  it('discovers local workspace .env when explicit env is absent', async () => {
    const root = await makeTempDir('opta-supabase-discovery-');
    const accountsDir = join(root, '1R-Opta-Accounts');
    await mkdir(accountsDir, { recursive: true });
    await writeFile(
      join(accountsDir, '.env.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://discovered-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=discovered-anon',
        '',
      ].join('\n'),
      'utf-8',
    );

    const config = resolveSupabaseAuthConfig(
      { NODE_ENV: 'development' },
      { cwd: root },
    );

    expect(config).toEqual({
      url: 'https://discovered-project.supabase.co',
      anonKey: 'discovered-anon',
      project: 'discovered-project',
    });
  });

  it('does not auto-discover .env in test mode', async () => {
    const root = await makeTempDir('opta-supabase-test-guard-');
    const accountsDir = join(root, '1R-Opta-Accounts');
    await mkdir(accountsDir, { recursive: true });
    await writeFile(
      join(accountsDir, '.env.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://ignored-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=ignored-anon',
        '',
      ].join('\n'),
      'utf-8',
    );

    const config = resolveSupabaseAuthConfig(
      { NODE_ENV: 'test' },
      { cwd: root },
    );

    expect(config).toBeNull();
  });
});

