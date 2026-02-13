"use client";

import { cn } from "@/lib/utils";

type CompanyName =
  | "Anthropic"
  | "OpenAI"
  | "Google"
  | "Meta"
  | "Mistral AI"
  | "DeepSeek"
  | "Alibaba"
  | "xAI";

interface CompanyLogoProps {
  company: string;
  className?: string;
  size?: number;
}

export function CompanyLogo({ company, className, size = 32 }: CompanyLogoProps) {
  const logoMap: Record<CompanyName, React.ReactNode> = {
    // Anthropic - Stylized "A" mark
    Anthropic: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="anthropic-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BF40BF" />
            <stop offset="100%" stopColor="#8A2BE2" />
          </linearGradient>
        </defs>
        <path
          d="M16 4L6 28h4.5l2-5h7l2 5H26L16 4zm0 8l2.5 7h-5L16 12z"
          fill="url(#anthropic-grad)"
        />
      </svg>
    ),

    // OpenAI - Hexagonal flower/knot
    OpenAI: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="openai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <path
          d="M16 6a2 2 0 012 2v4.35l3.77-2.18a2 2 0 012.73.73 2 2 0 01-.73 2.73L20 16l3.77 2.37a2 2 0 01.73 2.73 2 2 0 01-2.73.73L18 19.65V24a2 2 0 01-4 0v-4.35l-3.77 2.18a2 2 0 01-2.73-.73 2 2 0 01.73-2.73L12 16l-3.77-2.37a2 2 0 01-.73-2.73 2 2 0 012.73-.73L14 12.35V8a2 2 0 012-2z"
          fill="url(#openai-grad)"
        />
      </svg>
    ),

    // Google - Four dots/Gemini style
    Google: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="google-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
        <circle cx="10" cy="10" r="4" fill="url(#google-grad)" />
        <circle cx="22" cy="10" r="4" fill="url(#google-grad)" opacity="0.8" />
        <circle cx="10" cy="22" r="4" fill="url(#google-grad)" opacity="0.6" />
        <circle cx="22" cy="22" r="4" fill="url(#google-grad)" opacity="0.4" />
      </svg>
    ),

    // Meta - Infinity/Lemniscate shape
    Meta: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="meta-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <path
          d="M8 16c0-4 2-8 5-8s4 4 4 8-1 8-4 8-5-4-5-8zm11 0c0-4 1-8 4-8s5 4 5 8-2 8-5 8-4-4-4-8z"
          stroke="url(#meta-grad)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),

    // Mistral AI - Wind/M shape
    "Mistral AI": (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="mistral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
        </defs>
        <rect x="4" y="8" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="4" y="14" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="4" y="20" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="14" y="8" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="14" y="14" width="4" height="4" fill="url(#mistral-grad)" opacity="0.7" />
        <rect x="14" y="20" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="24" y="8" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="24" y="14" width="4" height="4" fill="url(#mistral-grad)" />
        <rect x="24" y="20" width="4" height="4" fill="url(#mistral-grad)" />
      </svg>
    ),

    // DeepSeek - Wave/Deep "D"
    DeepSeek: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="deepseek-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0891B2" />
          </linearGradient>
        </defs>
        <path
          d="M8 6v20h6c6 0 10-4.5 10-10S20 6 14 6H8zm4 4h2c3.3 0 6 2.7 6 6s-2.7 6-6 6h-2V10z"
          fill="url(#deepseek-grad)"
        />
      </svg>
    ),

    // Alibaba/Qwen - Stylized "Q"
    Alibaba: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="alibaba-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <circle cx="14" cy="14" r="8" stroke="url(#alibaba-grad)" strokeWidth="3" fill="none" />
        <path d="M20 20l6 6" stroke="url(#alibaba-grad)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),

    // xAI - Stylized "X"
    xAI: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="xai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="100%" stopColor="#9CA3AF" />
          </linearGradient>
        </defs>
        <path
          d="M8 8l16 16M24 8L8 24"
          stroke="url(#xai-grad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    ),
  };

  const logo = logoMap[company as CompanyName];

  if (!logo) {
    // Fallback - first letter of company
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-deep/30 to-purple-glow/20 border border-white/10",
          className
        )}
        style={{ width: size, height: size }}
      >
        <span className="text-sm font-bold text-white/80">
          {company.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-black/30 border border-white/10 p-1.5 backdrop-blur-sm",
        className
      )}
      style={{ width: size, height: size }}
    >
      {logo}
    </div>
  );
}
