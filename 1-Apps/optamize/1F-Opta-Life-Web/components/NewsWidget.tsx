"use client";

import { useEffect, useState } from "react";
import { Newspaper, ExternalLink, TrendingUp, RefreshCw, Sparkles, Code } from "lucide-react";
import { getNews, NewsItem } from "@/lib/news";
import { cn } from "@/lib/utils";

// Format time ago (client-side utility)
function formatTimeAgo(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsWidget() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "ai" | "tech">("all");

    const loadNews = async () => {
        setLoading(true);
        const result = await getNews(20);
        if ("error" in result) {
            setError(result.error);
        } else {
            setNews(result.data);
            setError(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadNews();
        // Refresh every 15 minutes
        const interval = setInterval(loadNews, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const filteredNews = news.filter(item =>
        filter === "all" || item.category === filter
    );

    if (loading && news.length === 0) {
        return (
            <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 bg-white/5 rounded-lg" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-4">
                <Newspaper className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">{error}</p>
                <button onClick={loadNews} className="text-xs text-primary mt-2">
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header with filter */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    <button
                        onClick={() => setFilter("all")}
                        className={cn(
                            "px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-colors",
                            filter === "all"
                                ? "bg-primary/20 text-primary"
                                : "text-text-muted hover:text-text-secondary"
                        )}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter("ai")}
                        className={cn(
                            "px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-colors flex items-center gap-1",
                            filter === "ai"
                                ? "bg-neon-purple/20 text-neon-purple"
                                : "text-text-muted hover:text-text-secondary"
                        )}
                    >
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                    </button>
                    <button
                        onClick={() => setFilter("tech")}
                        className={cn(
                            "px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-colors flex items-center gap-1",
                            filter === "tech"
                                ? "bg-neon-cyan/20 text-neon-cyan"
                                : "text-text-muted hover:text-text-secondary"
                        )}
                    >
                        <Code className="w-2.5 h-2.5" />
                        Tech
                    </button>
                </div>
                <button
                    onClick={loadNews}
                    disabled={loading}
                    aria-label="Refresh news"
                    className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                >
                    <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                </button>
            </div>

            {/* News list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredNews.slice(0, 10).map((item) => (
                    <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                        <div className="flex items-start gap-3">
                            <div className={cn(
                                "mt-0.5 p-1.5 rounded-md",
                                item.category === "ai"
                                    ? "bg-neon-purple/20 text-neon-purple"
                                    : "bg-neon-cyan/20 text-neon-cyan"
                            )}>
                                {item.category === "ai" ? (
                                    <Sparkles className="w-3 h-3" />
                                ) : (
                                    <Code className="w-3 h-3" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm text-text-primary line-clamp-2 group-hover:text-primary transition-colors">
                                    {item.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-text-muted">
                                        {item.source}
                                    </span>
                                    {item.score && (
                                        <span className="flex items-center gap-0.5 text-[10px] text-neon-amber">
                                            <TrendingUp className="w-2.5 h-2.5" />
                                            {item.score}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-text-muted">
                                        {formatTimeAgo(item.time)}
                                    </span>
                                </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                    </a>
                ))}
            </div>

            {filteredNews.length === 0 && (
                <div className="text-center py-4">
                    <p className="text-sm text-text-muted">No {filter === "all" ? "" : filter.toUpperCase()} news found</p>
                </div>
            )}
        </div>
    );
}
