// Secure storage for linked account tokens in localStorage
// Uses Web Crypto API for encryption with a session-derived key

import { LinkedAccount, LinkedAccountWithColor, AccountColor, ACCOUNT_COLORS } from "@/types/accounts";

const STORAGE_KEY = "opta_linked_accounts";
const MAX_LINKED_ACCOUNTS = 2; // Primary account is separate, so 2 additional

// Generate encryption key from session info
async function getEncryptionKey(sessionToken: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(sessionToken),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode("opta-linked-accounts-salt"),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// Encrypt data
async function encrypt(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(data)
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
}

// Decrypt data
async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = new Uint8Array(
        atob(encryptedData).split("").map(c => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
    );

    return new TextDecoder().decode(decrypted);
}

// Save a linked account
export async function saveLinkedAccount(
    account: LinkedAccount,
    sessionToken: string
): Promise<{ success: true } | { error: string }> {
    try {
        const key = await getEncryptionKey(sessionToken);
        const existingAccounts = await getLinkedAccounts(sessionToken);

        // Check if account already exists
        const existingIndex = existingAccounts.findIndex(a => a.email === account.email);
        if (existingIndex >= 0) {
            // Update existing account
            existingAccounts[existingIndex] = {
                ...account,
                color: existingAccounts[existingIndex].color,
            };
        } else {
            // Check max accounts limit
            if (existingAccounts.length >= MAX_LINKED_ACCOUNTS) {
                return { error: `Maximum ${MAX_LINKED_ACCOUNTS} linked accounts allowed` };
            }

            // Assign next available color
            const usedColors = existingAccounts.map(a => a.color);
            const availableColor = ACCOUNT_COLORS.find(c => !usedColors.includes(c)) || ACCOUNT_COLORS[0];

            existingAccounts.push({
                ...account,
                color: availableColor,
            });
        }

        const encrypted = await encrypt(JSON.stringify(existingAccounts), key);
        localStorage.setItem(STORAGE_KEY, encrypted);

        return { success: true };
    } catch (error) {
        console.error("Failed to save linked account:", error);
        return { error: "Failed to save account" };
    }
}

// Get all linked accounts
export async function getLinkedAccounts(sessionToken: string): Promise<LinkedAccountWithColor[]> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const key = await getEncryptionKey(sessionToken);
        const decrypted = await decrypt(stored, key);
        return JSON.parse(decrypted) as LinkedAccountWithColor[];
    } catch (error) {
        console.error("Failed to get linked accounts:", error);
        // If decryption fails (e.g., different session), clear stale data
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
}

// Remove a linked account
export async function removeLinkedAccount(
    email: string,
    sessionToken: string
): Promise<{ success: true } | { error: string }> {
    try {
        const key = await getEncryptionKey(sessionToken);
        const accounts = await getLinkedAccounts(sessionToken);

        const filtered = accounts.filter(a => a.email !== email);
        if (filtered.length === accounts.length) {
            return { error: "Account not found" };
        }

        if (filtered.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            const encrypted = await encrypt(JSON.stringify(filtered), key);
            localStorage.setItem(STORAGE_KEY, encrypted);
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to remove linked account:", error);
        return { error: "Failed to remove account" };
    }
}

// Clear all linked accounts (e.g., on logout)
export function clearLinkedAccounts(): void {
    localStorage.removeItem(STORAGE_KEY);
}

// Check if an account is linked
export async function isAccountLinked(email: string, sessionToken: string): Promise<boolean> {
    const accounts = await getLinkedAccounts(sessionToken);
    return accounts.some(a => a.email === email);
}

// Update tokens for a linked account (after refresh)
export async function updateLinkedAccountTokens(
    email: string,
    accessToken: string,
    expiresAt: number,
    refreshToken: string | undefined,
    sessionToken: string
): Promise<{ success: true } | { error: string }> {
    try {
        const key = await getEncryptionKey(sessionToken);
        const accounts = await getLinkedAccounts(sessionToken);

        const accountIndex = accounts.findIndex(a => a.email === email);
        if (accountIndex < 0) {
            return { error: "Account not found" };
        }

        accounts[accountIndex] = {
            ...accounts[accountIndex],
            accessToken,
            expiresAt,
            refreshToken: refreshToken || accounts[accountIndex].refreshToken,
        };

        const encrypted = await encrypt(JSON.stringify(accounts), key);
        localStorage.setItem(STORAGE_KEY, encrypted);

        return { success: true };
    } catch (error) {
        console.error("Failed to update account tokens:", error);
        return { error: "Failed to update tokens" };
    }
}
