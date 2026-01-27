// OAuth callback for linking additional Google accounts
// Exchanges code for tokens and returns them to the client

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(request: NextRequest) {
    // Ensure user is already signed in with primary account
    const session = await auth();
    if (!session) {
        return NextResponse.redirect(new URL("/?error=not_authenticated", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
        return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL("/?error=no_code", request.url));
    }

    // Validate state to prevent CSRF
    const storedState = request.cookies.get("link_account_state")?.value;
    if (!storedState || storedState !== state) {
        return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
    }

    try {
        // Exchange code for tokens
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${process.env.AUTH_URL || "http://localhost:3000"}/api/auth/link-account/callback`;

        if (!clientId || !clientSecret) {
            throw new Error("OAuth not configured");
        }

        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            }),
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Token exchange failed:", tokens);
            throw new Error(tokens.error_description || "Token exchange failed");
        }

        // Get user info to get email
        const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        const userInfo = await userInfoResponse.json();

        if (!userInfoResponse.ok) {
            throw new Error("Failed to get user info");
        }

        // Check if trying to link the same account as primary
        if (userInfo.email === session.user?.email) {
            return NextResponse.redirect(new URL("/?error=same_account", request.url));
        }

        // Build account data to pass to client
        const accountData = {
            id: userInfo.id,
            email: userInfo.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
        };

        // Redirect to home with account data in URL fragment (client-side only)
        // Using fragment so it doesn't get logged on server
        const encodedData = encodeURIComponent(JSON.stringify(accountData));
        const response = NextResponse.redirect(new URL(`/?linked_account=${encodedData}`, request.url));

        // Clear the state cookie
        response.cookies.delete("link_account_state");

        return response;
    } catch (error) {
        console.error("Link account error:", error);
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, request.url));
    }
}
