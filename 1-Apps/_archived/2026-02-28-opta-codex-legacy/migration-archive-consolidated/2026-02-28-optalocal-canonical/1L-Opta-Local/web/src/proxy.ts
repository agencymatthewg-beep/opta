import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

function requestProtocol(request: NextRequest): 'http' | 'https' {
  const headerProtocol = request.headers.get('x-forwarded-proto');
  if (headerProtocol === 'https' || headerProtocol === 'http') {
    return headerProtocol;
  }

  return request.nextUrl.protocol === 'https:' ? 'https' : 'http';
}

export async function proxy(request: NextRequest): Promise<Response> {
  if (requestProtocol(request) !== 'https') {
    // Local/dev HTTP mode should not enforce auth middleware.
    return NextResponse.next();
  }

  return updateSession(request);
}
