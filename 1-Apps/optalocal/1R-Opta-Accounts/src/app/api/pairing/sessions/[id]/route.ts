import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/api/policy';
import { getPairingSession } from '@/lib/control-plane/store';
import { buildPairingSessionMetadata } from '@/lib/control-plane/types';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'invalid_pairing_session_id' }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'supabase_unconfigured' }, { status: 500 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const session = await getPairingSession(id, { supabase });
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'pairing_session_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    session,
    metadata: buildPairingSessionMetadata(session),
  });
}
