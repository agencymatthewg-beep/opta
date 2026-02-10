"use client";

import { AccountColor, ACCOUNT_COLOR_CLASSES } from "@/types/accounts";

interface AccountBadgeProps {
    email: string;
    color: AccountColor;
    showEmail?: boolean;
    size?: "sm" | "md";
}

export function AccountBadge({ email, color, showEmail = false, size = "sm" }: AccountBadgeProps) {
    const colorClasses = ACCOUNT_COLOR_CLASSES[color];
    const sizeClasses = size === "sm" ? "w-2 h-2" : "w-3 h-3";

    // Extract initials from email (first two letters)
    const initials = email.split("@")[0].slice(0, 2).toUpperCase();

    if (showEmail) {
        return (
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${colorClasses.bg}`}>
                <div className={`${sizeClasses} rounded-full ${colorClasses.dot}`} />
                <span className={`text-xs ${colorClasses.text}`}>{email.split("@")[0]}</span>
            </div>
        );
    }

    return (
        <div
            className={`${sizeClasses} rounded-full ${colorClasses.dot}`}
            title={email}
        />
    );
}

// Dot indicator for inline use in email lists
export function AccountDot({ color, email }: { color: AccountColor; email: string }) {
    const colorClasses = ACCOUNT_COLOR_CLASSES[color];

    return (
        <div
            className={`w-2 h-2 rounded-full ${colorClasses.dot} flex-shrink-0`}
            title={email}
        />
    );
}
