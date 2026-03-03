import { navigation } from "./content";

interface SearchEntry {
  title: string;
  href: string;
  section: string;
  description: string;
  keywords: string[];
}

const sectionKeywords: Record<string, string[]> = {
  "getting-started": ["overview", "install", "npm", "setup", "lan", "network", "tutorial", "quickstart"],
  cli: ["cli", "commands", "terminal", "chat", "do", "models", "sessions", "config", "slash"],
  daemon: ["daemon", "background", "orchestration", "http", "api", "websocket", "ws", "events"],
  lmx: ["lmx", "inference", "mlx", "apple silicon", "openai", "vram", "models", "health"],
  "local-web": ["web", "dashboard", "browser", "chat", "remote", "cloudflare", "tunnel"],
  "code-desktop": ["desktop", "electron", "vite", "monitor", "sessions", "timeline"],
  "browser-automation": ["browser", "playwright", "automation", "recording", "visual", "diff"],
  security: ["security", "permissions", "privacy", "guardrails", "safety", "rules"],
  developer: ["developer", "mcp", "sdk", "auth", "token", "typescript", "integration"],
  support: ["faq", "support", "help", "troubleshooting", "errors", "common issues"],
  "feature-status": ["status", "features", "roadmap", "progress"],
};

export const searchData: SearchEntry[] = navigation.flatMap((section) =>
  section.items.map((item) => ({
    title: section.items.indexOf(item) === 0 ? `${section.title} — ${item.title}` : item.title,
    href: item.href,
    section: section.title,
    description: item.description ?? "",
    keywords: sectionKeywords[section.slug] ?? [],
  }))
);
