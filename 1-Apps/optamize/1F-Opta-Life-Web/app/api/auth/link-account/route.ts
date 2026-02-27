// OAuth initiation for linking additional Google accounts
// This redirects to Google OAuth with gmail.readonly scope

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET() {
    // Ensure user is already signed in with primary account
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });
    }

    // Build OAuth URL
    const redirectUri = `${process.env.AUTH_URL || "http://localhost:3000"}/api/auth/link-account/callback`;

    // Generate state to prevent CSRF
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email",
        access_type: "offline",
        prompt: "consent select_account", // Force account selection
        state,
    });

    // Store state in a short-lived cookie for validation
    const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
    response.cookies.set("link_account_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
    });

    return response;
}
