/**
 * Next.js middleware — mandatory auth session refresh.
 *
 * All routes pass through Supabase session refresh to keep auth
 * cookies fresh. No dual-mode detection — authentication is always
 * required and enforced by the SignInOverlay in the client layout.
 */

import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: Parameters<typeof updateSession>[0]) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
