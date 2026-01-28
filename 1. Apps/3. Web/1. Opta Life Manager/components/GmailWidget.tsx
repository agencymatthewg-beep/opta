"use client";

import { useEffect, useState, useCallback } from "react";
import { getAllInboxEmails } from "@/lib/actions";
import { Mail, Plus, Settings } from "lucide-react";
import { UnifiedEmail, LinkedAccountWithColor, ACCOUNT_COLOR_CLASSES } from "@/types/accounts";
import { getLinkedAccounts, saveLinkedAccount } from "@/lib/account-storage";
import { refreshAllExpiredTokens } from "@/lib/token-refresh";
import { AccountDot } from "./AccountBadge";
import { InboxSummaryWidget } from "./widgets/InboxSummary";

interface GmailWidgetProps {
    sessionToken?: string;
    primaryEmail?: string;
}

export function GmailWidget({ sessionToken, primaryEmail }: GmailWidgetProps) {
    const [emails, setEmails] = useState<UnifiedEmail[]>([]);
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountWithColor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showManageAccounts, setShowManageAccounts] = useState(false);

    const loadEmails = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Get linked accounts if we have a session token
            let accounts: LinkedAccountWithColor[] = [];
            if (sessionToken) {
                accounts = await getLinkedAccounts(sessionToken);
                // Refresh expired tokens
                accounts = await refreshAllExpiredTokens(accounts, sessionToken);
                setLinkedAccounts(accounts);
            }

            // Fetch all emails
            const linkedTokens = accounts.map(a => ({
                email: a.email,
                accessToken: a.accessToken,
                color: a.color,
            }));

            const result = await getAllInboxEmails(linkedTokens);

            if ("error" in result) {
                setError(result.error);
            } else {
                setEmails(result.emails);
            }
        } catch (err) {
            console.error("Failed to load emails:", err);
            setError("Failed to load emails");
        }

        setLoading(false);
    }, [sessionToken]);

    // Handle linked account from OAuth callback
    useEffect(() => {
        async function handleLinkedAccount() {
            if (!sessionToken) return;

            const url = new URL(window.location.href);
            const linkedAccountParam = url.searchParams.get("linked_account");

            if (linkedAccountParam) {
                try {
                    const accountData = JSON.parse(decodeURIComponent(linkedAccountParam));
                    await saveLinkedAccount(accountData, sessionToken);

                    // Clean URL
                    url.searchParams.delete("linked_account");
                    window.history.replaceState({}, "", url.pathname + url.search);

                    // Reload emails with new account
                    loadEmails();
                } catch (error) {
                    console.error("Failed to save linked account:", error);
                }
            }
        }

        handleLinkedAccount();
    }, [sessionToken, loadEmails]);

    useEffect(() => {
        loadEmails();
    }, [loadEmails]);

    const handleAddAccount = () => {
        window.location.href = "/api/auth/link-account";
    };

    const canAddMore = linkedAccounts.length < 2;

    if (loading) {
        return <div className="text-sm text-text-muted animate-pulse">Checking inboxes...</div>;
    }

    if (error === "Not authenticated") return null;

    if (error) {
        return <div className="text-sm text-neon-red">Connection interrupted.</div>;
    }

    // Group emails by account for count display
    const emailCounts = new Map<string, number>();
    for (const email of emails) {
        const count = emailCounts.get(email.accountEmail) || 0;
        emailCounts.set(email.accountEmail, count + 1);
    }

    return (
        <div className="space-y-4">
            {/* Account indicators and add button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Primary account indicator */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-xs text-blue-400">
                            {primaryEmail?.split("@")[0] || "Primary"}
                        </span>
                        {emailCounts.get(primaryEmail || "") && (
                            <span className="text-xs text-blue-300">
                                ({emailCounts.get(primaryEmail || "")})
                            </span>
                        )}
                    </div>

                    {/* Linked accounts */}
                    {linkedAccounts.map((account) => (
                        <div
                            key={account.email}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${ACCOUNT_COLOR_CLASSES[account.color].bg}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${ACCOUNT_COLOR_CLASSES[account.color].dot}`} />
                            <span className={`text-xs ${ACCOUNT_COLOR_CLASSES[account.color].text}`}>
                                {account.email.split("@")[0]}
                            </span>
                            {emailCounts.get(account.email) && (
                                <span className={`text-xs ${ACCOUNT_COLOR_CLASSES[account.color].text} opacity-75`}>
                                    ({emailCounts.get(account.email)})
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add account button */}
                {canAddMore && (
                    <button
                        onClick={handleAddAccount}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-white/20 hover:border-white/40 text-text-muted hover:text-text-primary transition-colors"
                        title="Add another inbox"
                    >
                        <Plus className="w-3 h-3" />
                        <span className="text-xs">Add</span>
                    </button>
                )}
            </div>

            {/* AI Summary (only show if we have multiple accounts or many emails) */}
            {(linkedAccounts.length > 0 || emails.length > 3) && (
                <InboxSummaryWidget emails={emails} onRefresh={loadEmails} />
            )}

            {/* Email list */}
            {emails.length === 0 ? (
                <div className="text-sm text-text-muted">
                    {linkedAccounts.length > 0 ? "All inboxes clear." : "Inbox zero."}
                </div>
            ) : (
                <div className="space-y-3">
                    {emails.slice(0, 10).map((email) => (
                        <div
                            key={`${email.accountEmail}-${email.id}`}
                            className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded px-2 -mx-2"
                        >
                            <AccountDot color={email.accountColor} email={email.accountEmail} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-text-primary truncate">{email.subject}</p>
                                <p className="text-xs text-text-muted truncate">{email.senderName}</p>
                            </div>
                        </div>
                    ))}
                    {emails.length > 10 && (
                        <p className="text-xs text-text-muted text-center">
                            +{emails.length - 10} more emails
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
