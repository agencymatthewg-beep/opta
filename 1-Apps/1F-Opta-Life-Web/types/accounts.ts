// Types for multi-account email integration

export interface LinkedAccount {
    id: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp in seconds
}

export interface LinkedAccountWithColor extends LinkedAccount {
    color: AccountColor;
}

// Account colors for visual distinction in the UI
export type AccountColor = "blue" | "green" | "purple";

export const ACCOUNT_COLORS: AccountColor[] = ["blue", "green", "purple"];

export const ACCOUNT_COLOR_CLASSES: Record<AccountColor, { bg: string; text: string; dot: string }> = {
    blue: {
        bg: "bg-blue-500/20",
        text: "text-blue-400",
        dot: "bg-blue-400",
    },
    green: {
        bg: "bg-emerald-500/20",
        text: "text-emerald-400",
        dot: "bg-emerald-400",
    },
    purple: {
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        dot: "bg-purple-400",
    },
};

// Email with account info for unified inbox
export interface UnifiedEmail {
    id: string;
    accountEmail: string;
    accountColor: AccountColor;
    subject: string;
    from: string;
    senderName: string;
    snippet: string;
    date: Date;
    threadId: string;
}

// AI summary result
export interface InboxSummary {
    urgent: string[];
    actionItems: string[];
    themes: string[];
    overview: string;
    generatedAt: Date;
}
