import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function updateSession(request: NextRequest): Promise<Response> {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.next();
  }

  try {
    await supabase.auth.getUser();
  } catch {
    // Session refresh failures should not break navigation.
  }

  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}
