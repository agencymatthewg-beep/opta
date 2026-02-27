/**
 * Next.js proxy — dual-mode auth gate.
 *
 * Opta Local runs in two modes:
 *
 * 1. **LAN mode** (HTTP): No authentication required. The app is
 *    accessed directly on the local network. All requests pass through.
 *
 * 2. **Cloud mode** (HTTPS): Supabase Auth is enforced. The middleware
 *    refreshes the session on every request via `updateSession`, which
 *    ensures auth cookies stay fresh and expired tokens are renewed.
 *
 * Detection logic: If the request arrives over HTTPS (either via
 * `x-forwarded-proto` from a reverse proxy/CDN, or the URL protocol
 * itself), cloud mode is active.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  // Detect cloud mode: HTTPS = cloud, HTTP = LAN
  const isCloudMode =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.nextUrl.protocol === 'https:';

  // LAN mode: no auth required, passthrough
  if (!isCloudMode) {
    return NextResponse.next();
  }

  // Cloud mode: refresh session via Supabase
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
