import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { storeGoogleTokens } from "@/lib/supabase/tokens";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    // If this is a Google sign-in, store the tokens
    if (data.session) {
      const { provider_token, provider_refresh_token, user } = data.session;

      if (provider_token && user) {
        // Determine if this is a Google sign-in by checking the user's identity
        const googleIdentity = user.identities?.find(
          (identity) => identity.provider === "google",
        );

        if (googleIdentity) {
          // Store the Google OAuth tokens in the credentials table
          await storeGoogleTokens(
            user.id,
            provider_token,
            provider_refresh_token || undefined,
          );
        }
      }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(`${origin}/`);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
