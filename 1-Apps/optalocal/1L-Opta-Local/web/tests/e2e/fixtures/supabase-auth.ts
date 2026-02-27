import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  test as base,
  expect,
  type BrowserContext,
  type BrowserContextOptions,
} from '@playwright/test';
import { createClient, type Session } from '@supabase/supabase-js';

type DotEnvMap = Record<string, string>;

interface SupabaseFixtureConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  testEmail: string;
  testPassword: string;
  serviceRoleKey: string | null;
}

const MAX_COOKIE_CHUNK_SIZE = 3180;
const BASE64_PREFIX = 'base64-';

const dotenvCache = loadDotEnv();

function loadDotEnv(): DotEnvMap {
  const envFile = resolve(process.cwd(), '.env.local');
  if (!existsSync(envFile)) return {};

  const raw = readFileSync(envFile, 'utf8');
  const out: DotEnvMap = {};

  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex < 1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    const unquoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
        ? value.slice(1, -1)
        : value;

    out[key] = unquoted;
  });

  return out;
}

function readEnv(name: string): string | undefined {
  const direct = process.env[name];
  if (direct && direct.trim().length > 0) return direct.trim();

  const fromFile = dotenvCache[name];
  if (fromFile && fromFile.trim().length > 0) return fromFile.trim();

  return undefined;
}

function getConfig(): SupabaseFixtureConfig | null {
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const testEmail = readEnv('E2E_SUPABASE_TEST_EMAIL');
  const testPassword = readEnv('E2E_SUPABASE_TEST_PASSWORD');
  const serviceRoleKey =
    readEnv('E2E_SUPABASE_SERVICE_ROLE_KEY') ??
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    null;

  if (!supabaseUrl || !supabaseAnonKey || !testEmail || !testPassword) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    testEmail,
    testPassword,
    serviceRoleKey,
  };
}

export function hasSupabaseAuthFixtureConfig() {
  return getConfig() !== null;
}

export function missingSupabaseAuthFixtureVars() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'E2E_SUPABASE_TEST_EMAIL',
    'E2E_SUPABASE_TEST_PASSWORD',
  ];

  return required.filter((key) => !readEnv(key));
}

function getStorageKey(supabaseUrl: string) {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

function encodeSessionCookie(session: Session) {
  const payload = JSON.stringify(session);
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return `${BASE64_PREFIX}${encoded}`;
}

function chunkCookieValue(name: string, value: string) {
  if (value.length <= MAX_COOKIE_CHUNK_SIZE) {
    return [{ name, value }];
  }

  const chunks: Array<{ name: string; value: string }> = [];
  for (let i = 0; i < value.length; i += MAX_COOKIE_CHUNK_SIZE) {
    chunks.push({
      name: `${name}.${chunks.length}`,
      value: value.slice(i, i + MAX_COOKIE_CHUNK_SIZE),
    });
  }

  return chunks;
}

async function ensureTestUser(config: SupabaseFixtureConfig) {
  if (!config.serviceRoleKey) return;

  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (usersError) {
    throw new Error(`Failed to list Supabase test users: ${usersError.message}`);
  }

  const existing = usersData.users.find(
    (user) => user.email?.toLowerCase() === config.testEmail.toLowerCase(),
  );

  if (!existing) {
    const { error: createError } = await adminClient.auth.admin.createUser({
      email: config.testEmail,
      password: config.testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Opta E2E',
      },
    });

    if (createError) {
      throw new Error(`Failed to create Supabase test user: ${createError.message}`);
    }

    return;
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password: config.testPassword,
  });

  if (updateError) {
    throw new Error(`Failed to update Supabase test user: ${updateError.message}`);
  }
}

async function createSession(config: SupabaseFixtureConfig) {
  await ensureTestUser(config);

  const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email: config.testEmail,
    password: config.testPassword,
  });

  if (error || !data.session) {
    const reason = error?.message ?? 'No session returned';
    throw new Error(`Failed Supabase password sign-in for e2e fixture: ${reason}`);
  }

  return data.session;
}

async function createAuthenticatedContext(
  context: BrowserContext,
  contextOptions: BrowserContextOptions,
  session: Session,
) {
  const baseURL = contextOptions.baseURL ?? 'http://127.0.0.1:3004';
  const config = getConfig();
  if (!config) return;

  const storageKey = getStorageKey(config.supabaseUrl);
  const encodedCookie = encodeSessionCookie(session);
  const cookieParts = chunkCookieValue(storageKey, encodedCookie);

  await context.addCookies(
    cookieParts.map((part) => ({
      name: part.name,
      value: part.value,
      url: baseURL,
      sameSite: 'Lax',
      secure: baseURL.startsWith('https://'),
    })),
  );
}

export const test = base.extend({
  context: async ({ browser, contextOptions }, run) => {
    const config = getConfig();
    if (!config) {
      throw new Error(
        `Missing Supabase e2e auth vars: ${missingSupabaseAuthFixtureVars().join(', ')}`,
      );
    }

    const session = await createSession(config);
    const context = await browser.newContext(contextOptions);

    await createAuthenticatedContext(context, contextOptions, session);

    await run(context);
    await context.close();
  },
});

export { expect };
