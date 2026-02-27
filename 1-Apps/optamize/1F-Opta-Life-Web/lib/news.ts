"use server";

// ============================================================================
// News API Integration
// Uses Hacker News API (free) + RSS feeds for AI/Tech news
// ============================================================================

export interface NewsItem {
    id: string;
    title: string;
    url: string;
    source: string;
    score?: number;
    time: string;
    category: "ai" | "tech" | "general";
}

// Hacker News API
async function fetchHackerNews(): Promise<NewsItem[]> {
    try {
        // Get top stories
        const topStoriesRes = await fetch(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            { next: { revalidate: 900 } } // Cache for 15 minutes
        );
        const storyIds: number[] = await topStoriesRes.json();

        // Fetch details for top 30 stories
        const storyPromises = storyIds.slice(0, 30).map(async (id) => {
            const res = await fetch(
                `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
                { next: { revalidate: 900 } }
            );
            return res.json();
        });

        const stories = await Promise.all(storyPromises);

        // Filter for AI/tech related stories
        const aiKeywords = [
            "ai", "artificial intelligence", "machine learning", "ml", "gpt",
            "llm", "neural", "deep learning", "openai", "anthropic", "claude",
            "chatgpt", "gemini", "copilot", "automation", "robot", "model",
            "transformer", "diffusion", "stable diffusion", "midjourney"
        ];

        const techKeywords = [
            "startup", "programming", "developer", "software", "code", "api",
            "cloud", "aws", "google", "apple", "microsoft", "meta", "tech",
            "engineering", "silicon valley", "vc", "funding", "typescript",
            "rust", "python", "javascript", "react", "ios", "android", "web"
        ];

        return stories
            .filter((story) => story && story.title && story.url)
            .map((story) => {
                const titleLower = story.title.toLowerCase();
                const isAI = aiKeywords.some((kw) => titleLower.includes(kw));
                const isTech = techKeywords.some((kw) => titleLower.includes(kw));

                return {
                    id: `hn-${story.id}`,
                    title: story.title,
                    url: story.url,
                    source: "Hacker News",
                    score: story.score,
                    time: new Date(story.time * 1000).toISOString(),
                    category: isAI ? "ai" : isTech ? "tech" : "general",
                } as NewsItem;
            })
            .filter((item) => item.category === "ai" || item.category === "tech");
    } catch (error) {
        console.error("Hacker News fetch error:", error);
        return [];
    }
}

// Fetch from multiple sources and combine
export async function getNews(limit: number = 10): Promise<{ success: true; data: NewsItem[] } | { error: string }> {
    try {
        const hnNews = await fetchHackerNews();

        // Sort by score (popularity) and limit
        const sortedNews = hnNews
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, limit);

        return { success: true, data: sortedNews };
    } catch (error) {
        console.error("News fetch error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch news" };
    }
}

// Get AI-specific news
export async function getAINews(limit: number = 8): Promise<{ success: true; data: NewsItem[] } | { error: string }> {
    const result = await getNews(30);
    if ("error" in result) return result;

    const aiNews = result.data
        .filter((item) => item.category === "ai")
        .slice(0, limit);

    return { success: true, data: aiNews };
}

