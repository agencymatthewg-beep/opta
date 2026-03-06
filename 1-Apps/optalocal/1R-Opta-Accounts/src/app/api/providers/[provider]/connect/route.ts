import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { asObject, parseProvider, parseString } from '@/lib/api/policy';
import { encryptOAuthToken } from '@/lib/oauth/token-crypto';

type RouteContext = { params: Promise<{ provider: string }> };

// Providers whose tokens come through the OAuth Device Flow or redirect flows
// — they connect via /api/oauth/[provider]/* routes, not this endpoint.
const OAUTH_PROVIDERS = new Set(['github-copilot', 'gemini-cli']);

// Providers that connect by providing an API key directly
const API_KEY_PROVIDERS = new Set(['openai', 'anthropic', 'gemini', 'google', 'apple']);

/**
 * POST /api/providers/[provider]/connect
 *
 * For OAuth providers (github-copilot, gemini-cli): returns the start URL
 * so the client can initiate the correct flow.
 *
 * For API-key providers (openai, anthropic, gemini, …): accepts { apiKey }
 * in the request body, encrypts it, and writes to accounts_provider_connections.
 */
export async function POST(request: Request, context: RouteContext) {
  const { provider: rawProvider } = await context.params;
  const provider = parseProvider(rawProvider);
  if (!provider) {
    return NextResponse.json({ error: 'unsupported_provider' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // OAuth-flow providers: tell client which URL to navigate to
  if (OAUTH_PROVIDERS.has(provider)) {
    const startUrls: Record<string, string> = {
      'github-copilot': '/api/oauth/copilot/device/start',
      'gemini-cli': '/api/oauth/gemini-cli/start',
    };
    return NextResponse.json({
      ok: false,
      reason: 'use_oauth_flow',
      startUrl: startUrls[provider],
      provider,
    });
  }

  // API-key providers: accept and store encrypted key
  if (API_KEY_PROVIDERS.has(provider)) {
    const body = asObject(await request.json().catch(() => ({})));
    const apiKey = parseString(body.apiKey, 512);
    if (!apiKey) {
      return NextResponse.json({ error: 'api_key_required' }, { status: 400 });
    }

    const tokenPayload = JSON.stringify({
      api_key: apiKey,
      obtained_at: new Date().toISOString(),
      connected_method: 'api_key',
    });

    const { data, error } = await supabase
      .from('accounts_provider_connections')
      .upsert(
        {
          user_id: user.id,
          provider,
          status: 'connected',
          token_encrypted: encryptOAuthToken(tokenPayload),
          connected_via: 'api_key',
          meta: {
            connectedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' },
      )
      .select('id,provider,status,meta,updated_at')
      .maybeSingle();

    if (error?.code === 'PGRST205') {
      return NextResponse.json({ error: 'schema_not_migrated' }, { status: 503 });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, provider: data });
  }

  return NextResponse.json({ error: 'unsupported_provider' }, { status: 400 });
}
