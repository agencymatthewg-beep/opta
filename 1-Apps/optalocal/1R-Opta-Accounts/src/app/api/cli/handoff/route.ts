import { NextResponse } from 'next/server';
import { isAllowedRedirect } from '@/lib/allowed-redirects';
import {
  isValidCliHandoff,
  isValidCliState,
  parseCliCallbackPort,
  registerCliHandoff,
} from '@/lib/cli/handoff';

interface CliHandoffRequestBody {
  state?: string;
  port?: number | string;
  handoff?: string | null;
  return_to?: string | null;
}

export async function POST(request: Request) {
  let body: CliHandoffRequestBody;
  try {
    body = (await request.json()) as CliHandoffRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const port = parseCliCallbackPort(String(body.port ?? ''));
  const handoffRaw = typeof body.handoff === 'string' ? body.handoff.trim() : '';
  const returnToRaw = typeof body.return_to === 'string' ? body.return_to.trim() : '';

  if (!isValidCliState(state)) {
    return NextResponse.json({ ok: false, error: 'invalid_state' }, { status: 400 });
  }
  if (!port) {
    return NextResponse.json({ ok: false, error: 'invalid_port' }, { status: 400 });
  }
  if (handoffRaw.length > 0 && !isValidCliHandoff(handoffRaw)) {
    return NextResponse.json({ ok: false, error: 'invalid_handoff' }, { status: 400 });
  }
  if (returnToRaw.length > 0 && !isAllowedRedirect(returnToRaw)) {
    return NextResponse.json({ ok: false, error: 'invalid_return_to' }, { status: 400 });
  }

  const record = registerCliHandoff({
    state,
    port,
    handoff: handoffRaw.length > 0 ? handoffRaw : null,
    returnTo: returnToRaw.length > 0 ? returnToRaw : null,
  });

  return NextResponse.json({
    ok: true,
    state: record.state,
    port: record.port,
    expiresAt: new Date(record.expiresAt).toISOString(),
    proof: record.proof,
    strategy: record.strategy,
  });
}
