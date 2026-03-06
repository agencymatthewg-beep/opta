import { NextResponse } from 'next/server';
import {
  isValidCliHandoff,
  isValidCliState,
  parseCliCallbackPort,
} from '@/lib/cli/handoff';
import {
  consumeCliTokenRelay,
  isValidCliRelayCode,
} from '@/lib/cli/token-relay';

interface CliExchangeRequestBody {
  code?: string;
  state?: string;
  port?: number | string;
  handoff?: string | null;
}

export async function POST(request: Request) {
  let body: CliExchangeRequestBody;
  try {
    body = (await request.json()) as CliExchangeRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const port = parseCliCallbackPort(String(body.port ?? ''));
  const handoffRaw = typeof body.handoff === 'string' ? body.handoff.trim() : '';

  if (!isValidCliRelayCode(code)) {
    return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 400 });
  }
  if (!isValidCliState(state)) {
    return NextResponse.json({ ok: false, error: 'invalid_state' }, { status: 400 });
  }
  if (!port) {
    return NextResponse.json({ ok: false, error: 'invalid_port' }, { status: 400 });
  }
  if (handoffRaw.length > 0 && !isValidCliHandoff(handoffRaw)) {
    return NextResponse.json({ ok: false, error: 'invalid_handoff' }, { status: 400 });
  }

  let exchange: Awaited<ReturnType<typeof consumeCliTokenRelay>>;
  try {
    exchange = await consumeCliTokenRelay({
      code,
      state,
      port,
      handoff: handoffRaw.length > 0 ? handoffRaw : null,
    });
  } catch (error) {
    console.error('[api/cli/exchange] replay-store consume failed', error);
    return NextResponse.json({ ok: false, error: 'replay_store_unavailable' }, { status: 503 });
  }

  if (!exchange) {
    return NextResponse.json({ ok: false, error: 'exchange_not_found' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    access_token: exchange.accessToken,
    refresh_token: exchange.refreshToken,
    token_type: exchange.tokenType,
    expires_in: exchange.expiresIn,
    expires_at: exchange.expiresAt,
    provider_token: exchange.providerToken,
    provider_refresh_token: exchange.providerRefreshToken,
    return_to: exchange.returnTo,
  });
}
