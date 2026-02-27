import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Google Token Management
// ============================================================================

interface TokenData {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
}

/**
 * Store Google OAuth tokens in the credentials table
 */
export async function storeGoogleTokens(
    userId: string,
    accessToken: string,
    refreshToken?: string
): Promise<void> {
    const supabase = await createClient();

    // Calculate expiry time (Google tokens typically expire in 1 hour)
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Store access token
    await supabase.from("credentials").upsert(
        {
            user_id: userId,
            service_name: "google",
            credential_type: "oauth_access_token",
            encrypted_value: accessToken,
            updated_at: new Date().toISOString(),
            // Store expiry in credential_data for easy access
            credential_data: { expires_at: expiresAt },
        },
        {
            onConflict: "user_id,service_name,credential_type",
        }
    );

    // Store refresh token if provided
    if (refreshToken) {
        await supabase.from("credentials").upsert(
            {
                user_id: userId,
                service_name: "google",
                credential_type: "oauth_refresh_token",
                encrypted_value: refreshToken,
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "user_id,service_name,credential_type",
            }
        );
    }
}

/**
 * Refresh Google access token using refresh token
 */
export async function refreshGoogleToken(
    userId: string,
    refreshToken: string
): Promise<string | null> {
    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("Failed to refresh Google token:", error);
            return null;
        }

        const data: TokenData = await response.json();

        // Store the new access token
        await storeGoogleTokens(userId, data.access_token, data.refresh_token);

        return data.access_token;
    } catch (error) {
        console.error("Error refreshing Google token:", error);
        return null;
    }
}

/**
 * Get a valid Google access token for the user
 * Automatically refreshes if expired
 */
export async function getGoogleAccessToken(
    userId: string
): Promise<string | null> {
    const supabase = await createClient();

    // Get the access token
    const { data: accessTokenRow, error: accessError } = await supabase
        .from("credentials")
        .select("encrypted_value, credential_data")
        .eq("user_id", userId)
        .eq("service_name", "google")
        .eq("credential_type", "oauth_access_token")
        .single();

    if (accessError || !accessTokenRow) {
        console.error("No Google access token found for user:", userId);
        return null;
    }

    // Check if token is expired (with 5 min buffer)
    const expiresAt = accessTokenRow.credential_data?.expires_at;
    const isExpired = expiresAt
        ? new Date(expiresAt).getTime() < Date.now() + 300000
        : true;

    if (!isExpired) {
        return accessTokenRow.encrypted_value;
    }

    // Token is expired, try to refresh
    const { data: refreshTokenRow, error: refreshError } = await supabase
        .from("credentials")
        .select("encrypted_value")
        .eq("user_id", userId)
        .eq("service_name", "google")
        .eq("credential_type", "oauth_refresh_token")
        .single();

    if (refreshError || !refreshTokenRow) {
        console.error("No Google refresh token found for user:", userId);
        return null;
    }

    // Refresh the token
    return await refreshGoogleToken(userId, refreshTokenRow.encrypted_value);
}
