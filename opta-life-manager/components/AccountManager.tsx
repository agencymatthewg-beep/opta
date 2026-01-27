"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Mail, Loader2 } from "lucide-react";
import { LinkedAccountWithColor, ACCOUNT_COLOR_CLASSES } from "@/types/accounts";
import { getLinkedAccounts, removeLinkedAccount, saveLinkedAccount, clearLinkedAccounts } from "@/lib/account-storage";
import { AccountBadge } from "./AccountBadge";

interface AccountManagerProps {
    sessionToken: string;
    primaryEmail: string;
    onAccountsChange?: (accounts: LinkedAccountWithColor[]) => void;
}

export function AccountManager({ sessionToken, primaryEmail, onAccountsChange }: AccountManagerProps) {
    const [accounts, setAccounts] = useState<LinkedAccountWithColor[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingEmail, setRemovingEmail] = useState<string | null>(null);

    // Load linked accounts on mount
    useEffect(() => {
        async function loadAccounts() {
            const linkedAccounts = await getLinkedAccounts(sessionToken);
            setAccounts(linkedAccounts);
            onAccountsChange?.(linkedAccounts);
            setLoading(false);
        }
        loadAccounts();
    }, [sessionToken, onAccountsChange]);

    // Handle linked account from OAuth callback
    useEffect(() => {
        async function handleLinkedAccount() {
            const url = new URL(window.location.href);
            const linkedAccountParam = url.searchParams.get("linked_account");

            if (linkedAccountParam) {
                try {
                    const accountData = JSON.parse(decodeURIComponent(linkedAccountParam));

                    const result = await saveLinkedAccount(accountData, sessionToken);
                    if ("success" in result) {
                        const updatedAccounts = await getLinkedAccounts(sessionToken);
                        setAccounts(updatedAccounts);
                        onAccountsChange?.(updatedAccounts);
                    }

                    // Clean URL
                    url.searchParams.delete("linked_account");
                    window.history.replaceState({}, "", url.pathname + url.search);
                } catch (error) {
                    console.error("Failed to save linked account:", error);
                }
            }
        }

        handleLinkedAccount();
    }, [sessionToken, onAccountsChange]);

    const handleAddAccount = useCallback(() => {
        // Redirect to OAuth flow
        window.location.href = "/api/auth/link-account";
    }, []);

    const handleRemoveAccount = useCallback(async (email: string) => {
        setRemovingEmail(email);
        const result = await removeLinkedAccount(email, sessionToken);
        if ("success" in result) {
            const updatedAccounts = await getLinkedAccounts(sessionToken);
            setAccounts(updatedAccounts);
            onAccountsChange?.(updatedAccounts);
        }
        setRemovingEmail(null);
    }, [sessionToken, onAccountsChange]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading accounts...
            </div>
        );
    }

    const canAddMore = accounts.length < 2;

    return (
        <div className="space-y-3">
            {/* Primary Account */}
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <Mail className="w-4 h-4 text-blue-400" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{primaryEmail}</p>
                    <p className="text-xs text-text-muted">Primary account</p>
                </div>
            </div>

            {/* Linked Accounts */}
            {accounts.map((account) => (
                <div
                    key={account.email}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                    <div className={`w-2 h-2 rounded-full ${ACCOUNT_COLOR_CLASSES[account.color].dot}`} />
                    <Mail className={`w-4 h-4 ${ACCOUNT_COLOR_CLASSES[account.color].text}`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{account.email}</p>
                        <p className="text-xs text-text-muted">Linked account</p>
                    </div>
                    <button
                        onClick={() => handleRemoveAccount(account.email)}
                        disabled={removingEmail === account.email}
                        className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-neon-red transition-colors"
                        title="Remove account"
                    >
                        {removingEmail === account.email ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <X className="w-4 h-4" />
                        )}
                    </button>
                </div>
            ))}

            {/* Add Account Button */}
            {canAddMore && (
                <button
                    onClick={handleAddAccount}
                    className="flex items-center gap-2 w-full p-2 rounded-lg border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors text-text-muted hover:text-text-primary"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Add another inbox</span>
                    <span className="text-xs ml-auto">({2 - accounts.length} remaining)</span>
                </button>
            )}

            {!canAddMore && (
                <p className="text-xs text-text-muted text-center">Maximum 3 inboxes reached</p>
            )}
        </div>
    );
}

// Compact version for inline use
export function AccountManagerCompact({ sessionToken, accounts, onAccountsChange }: {
    sessionToken: string;
    accounts: LinkedAccountWithColor[];
    onAccountsChange?: (accounts: LinkedAccountWithColor[]) => void;
}) {
    const canAddMore = accounts.length < 2;

    const handleAddAccount = () => {
        window.location.href = "/api/auth/link-account";
    };

    return (
        <div className="flex items-center gap-2">
            {accounts.map((account) => (
                <AccountBadge
                    key={account.email}
                    email={account.email}
                    color={account.color}
                    showEmail
                    size="sm"
                />
            ))}
            {canAddMore && (
                <button
                    onClick={handleAddAccount}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-white/20 hover:border-white/40 text-text-muted hover:text-text-primary transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    <span className="text-xs">Add</span>
                </button>
            )}
        </div>
    );
}
