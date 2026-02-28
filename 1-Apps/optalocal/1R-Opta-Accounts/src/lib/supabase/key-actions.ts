'use server';

import { createClient } from '@/lib/supabase/server';
import { maskKey, type ApiKeyProvider } from '@/lib/provider-detection';

export interface ApiKey {
  id: string;
  provider: ApiKeyProvider;
  label: string | null;
  maskedValue: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
}

interface DbApiKey {
  id: string;
  provider: string;
  label: string | null;
  key_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}

function toApiKey(row: DbApiKey): ApiKey {
  return {
    id: row.id,
    provider: row.provider as ApiKeyProvider,
    label: row.label,
    maskedValue: maskKey(row.key_value),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

export async function getApiKeys(): Promise<ApiKey[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_id', user.id)
    .order('provider', { ascending: true });

  if (error || !data) return [];
  return (data as DbApiKey[]).map(toApiKey);
}

export async function getApiKeyValue(id: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('api_keys')
    .select('key_value')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;
  return (data as { key_value: string }).key_value;
}

export async function upsertApiKey(
  provider: string,
  keyValue: string,
  label?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const trimmedKey = keyValue.trim();
  if (!trimmedKey) return { ok: false, error: 'Key value cannot be empty.' };

  const normalizedLabel = label?.trim() || null;

  const { error } = await supabase
    .from('api_keys')
    .upsert(
      {
        user_id: user.id,
        provider,
        label: normalizedLabel,
        key_value: trimmedKey,
        is_active: true,
      },
      { onConflict: 'user_id,provider,label' },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteApiKey(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated.' };

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function verifyApiKey(
  id: string,
): Promise<{ valid: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { valid: false, error: 'Supabase is not configured.' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { valid: false, error: 'Not authenticated.' };

  const { data, error } = await supabase
    .from('api_keys')
    .select('provider, key_value')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return { valid: false, error: 'Key not found.' };

  const { provider, key_value } = data as { provider: string; key_value: string };
  const isValid = await probeProviderEndpoint(provider, key_value);

  if (isValid) {
    await supabase
      .from('api_keys')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  return { valid: isValid, error: isValid ? undefined : 'Key failed validation against provider API.' };
}

async function probeProviderEndpoint(provider: string, key: string): Promise<boolean> {
  const timeout = AbortSignal.timeout(6_000);
  try {
    switch (provider) {
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
          signal: timeout,
        });
        return res.ok;
      }
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { authorization: `Bearer ${key}` },
          signal: timeout,
        });
        return res.ok;
      }
      case 'gemini': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
          { signal: timeout },
        );
        return res.ok;
      }
      case 'tavily': {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ api_key: key, query: 'health check', max_results: 1 }),
          signal: timeout,
        });
        return res.ok;
      }
      case 'exa': {
        const res = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key },
          body: JSON.stringify({ query: 'health check', numResults: 1 }),
          signal: timeout,
        });
        return res.ok;
      }
      case 'brave': {
        const url = new URL('https://api.search.brave.com/res/v1/web/search');
        url.searchParams.set('q', 'health check');
        url.searchParams.set('count', '1');
        const res = await fetch(url.toString(), {
          headers: { accept: 'application/json', 'x-subscription-token': key },
          signal: timeout,
        });
        return res.ok;
      }
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { authorization: `Bearer ${key}` },
          signal: timeout,
        });
        return res.ok;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
