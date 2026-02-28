/**
 * Supabase middleware helper — session refresh with .optalocal.com cookie domain.
 *
 * Creates a Supabase server client that bridges cookies between the
 * incoming request and outgoing response. Calls `auth.getUser()` to
 * refresh the session token if it has expired. The refreshed cookies
 * are forwarded on the response with the parent domain for SSO.
 *
 * IMPORTANT: Do not add logic between `createServerClient` and
 * `supabase.auth.getUser()` — doing so can cause intermittent
 * session drops that are extremely difficult to debug.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_DOMAIN =
  process.env.NODE_ENV === "production" ? ".optalocal.com" : undefined;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase configured — pass through
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>,
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            domain: COOKIE_DOMAIN,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
          }),
        );
      },
    },
  });

  // IMPORTANT: Do not add logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could cause users
  // to be randomly logged out.

  await supabase.auth.getUser();

  // IMPORTANT: Return the supabaseResponse as-is. If you create a
  // new NextResponse, you must copy over the cookies to keep the
  // browser and server sessions in sync.

  return supabaseResponse;
}
