// Token refresh for linked Google accounts
// Client-side utility to refresh expired access tokens

import { LinkedAccountWithColor } from "@/types/accounts";
import { updateLinkedAccountTokens } from "./account-storage";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

export interface RefreshResult {
    success: boolean;
    accessToken?: string;
    expiresAt?: number;
    error?: string;
}

// Check if token needs refresh
export function needsRefresh(account: LinkedAccountWithColor): boolean {
    const expiresAtMs = account.expiresAt * 1000;
    return Date.now() >= expiresAtMs - TOKEN_REFRESH_BUFFER_MS;
}

// Refresh an access token using the refresh token
// This calls a server-side API to avoid exposing client secret
export async function refreshAccessToken(
    account: LinkedAccountWithColor,
    sessionToken: string
): Promise<RefreshResult> {
    try {
        const response = await fetch("/api/auth/refresh-linked", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                refreshToken: account.refreshToken,
                email: account.email,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || "Refresh failed" };
        }

        // Update stored tokens
        await updateLinkedAccountTokens(
            account.email,
            data.accessToken,
            data.expiresAt,
            data.refreshToken,
            sessionToken
        );

        return {
            success: true,
            accessToken: data.accessToken,
            expiresAt: data.expiresAt,
        };
    } catch (error) {
        console.error("Token refresh error:", error);
        return { success: false, error: "Network error" };
    }
}

// Get a valid access token, refreshing if needed
export async function getValidAccessToken(
    account: LinkedAccountWithColor,
    sessionToken: string
): Promise<{ accessToken: string } | { error: string }> {
    if (!needsRefresh(account)) {
        return { accessToken: account.accessToken };
    }

    const result = await refreshAccessToken(account, sessionToken);
    if (result.success && result.accessToken) {
        return { accessToken: result.accessToken };
    }

    return { error: result.error || "Failed to refresh token" };
}

// Refresh all accounts that need it
export async function refreshAllExpiredTokens(
    accounts: LinkedAccountWithColor[],
    sessionToken: string
): Promise<LinkedAccountWithColor[]> {
    const refreshedAccounts: LinkedAccountWithColor[] = [];

    for (const account of accounts) {
        if (needsRefresh(account)) {
            const result = await refreshAccessToken(account, sessionToken);
            if (result.success && result.accessToken && result.expiresAt) {
                refreshedAccounts.push({
                    ...account,
                    accessToken: result.accessToken,
                    expiresAt: result.expiresAt,
                });
            } else {
                // Keep old account data if refresh fails
                refreshedAccounts.push(account);
            }
        } else {
            refreshedAccounts.push(account);
        }
    }

    return refreshedAccounts;
}
