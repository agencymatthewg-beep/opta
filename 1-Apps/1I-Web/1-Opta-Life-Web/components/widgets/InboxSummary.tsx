"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, AlertCircle, CheckCircle, Hash, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { UnifiedEmail, InboxSummary as InboxSummaryType } from "@/types/accounts";
import { generateInboxSummary } from "@/lib/ai-summary";

interface InboxSummaryWidgetProps {
    emails: UnifiedEmail[];
    onRefresh?: () => void;
}

export function InboxSummaryWidget({ emails, onRefresh }: InboxSummaryWidgetProps) {
    const [summary, setSummary] = useState<InboxSummaryType | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);

    const generateSummary = useCallback(async () => {
        if (emails.length === 0) {
            setSummary({
                urgent: [],
                actionItems: [],
                themes: [],
                overview: "All inboxes are clear. Inbox zero achieved.",
                generatedAt: new Date(),
            });
            return;
        }

        setLoading(true);
        setError(null);

        const result = await generateInboxSummary(emails);

        if ("error" in result) {
            setError(result.error);
        } else {
            setSummary(result.summary);
        }

        setLoading(false);
    }, [emails]);

    // Generate summary when emails change significantly
    useEffect(() => {
        let cancelled = false;

        const runSummary = async () => {
            if (emails.length > 0) {
                if (!cancelled) await generateSummary();
            } else {
                if (!cancelled) {
                    setSummary({
                        urgent: [],
                        actionItems: [],
                        themes: [],
                        overview: "All inboxes are clear. Inbox zero achieved.",
                        generatedAt: new Date(),
                    });
                }
            }
        };

        runSummary();

        return () => { cancelled = true; };
    }, [emails.length, generateSummary]);

    if (loading) {
        return (
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 text-purple-400">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Analyzing your inboxes...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-red-400">{error}</span>
                    <button
                        onClick={generateSummary}
                        className="text-xs text-red-400 hover:text-red-300"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!summary) return null;

    const hasContent = summary.urgent.length > 0 || summary.actionItems.length > 0;

    return (
        <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">AI Inbox Summary</span>
                    {summary.urgent.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                            {summary.urgent.length} urgent
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            generateSummary();
                        }}
                        className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                        title="Refresh summary"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                </div>
            </button>

            {/* Content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* Overview */}
                    <p className="text-sm text-text-primary leading-relaxed">
                        {summary.overview}
                    </p>

                    {/* Urgent Items */}
                    {summary.urgent.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium uppercase tracking-wide">Urgent</span>
                            </div>
                            <ul className="space-y-1">
                                {summary.urgent.map((item, i) => (
                                    <li key={i} className="text-sm text-text-primary pl-5 relative before:content-['•'] before:absolute before:left-1.5 before:text-red-400">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Action Items */}
                    {summary.actionItems.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-blue-400">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium uppercase tracking-wide">Action Items</span>
                            </div>
                            <ul className="space-y-1">
                                {summary.actionItems.map((item, i) => (
                                    <li key={i} className="text-sm text-text-primary pl-5 relative before:content-['•'] before:absolute before:left-1.5 before:text-blue-400">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Themes */}
                    {summary.themes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {summary.themes.map((theme, i) => (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-xs text-text-muted"
                                >
                                    <Hash className="w-3 h-3" />
                                    {theme}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-text-muted pt-2 border-t border-white/5">
                        Generated {summary.generatedAt.toLocaleTimeString()}
                    </p>
                </div>
            )}
        </div>
    );
}
