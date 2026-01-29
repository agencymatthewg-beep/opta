# AICompare (aicomp.optamize.biz)

## What This Is

A comprehensive AI intelligence hub that tracks, compares, and analyzes AI models with always up-to-date data from automated sources. Built for AI enthusiasts who want a single source of truth for model benchmarks, pricing, capabilities, and industry news — presented with beautiful Opta-style visualizations.

## Core Value

**Always up-to-date.** If the data is stale, nothing else matters. The automated scraping pipeline that keeps information fresh is the foundation everything else builds on.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Automated data scraping from major AI benchmark sources (Chatbot Arena, MMLU, HumanEval, GPQA)
- [ ] Automated scraping of provider announcements (OpenAI, Anthropic, Google, Meta blogs)
- [ ] Model benchmark comparison dashboard with interactive visualizations
- [ ] Pricing and capabilities database (API costs, context windows, features, rate limits)
- [ ] Release/news timeline tracking new model announcements
- [ ] AI-powered recommendation engine ("For your use case, Model X is best because...")
- [ ] Trend analysis with charts ("Claude improved 15% on coding benchmarks since v3")
- [ ] Interactive chat for data-grounded questions about models
- [ ] Hybrid visual design: Life Manager clean layout + MacOS visual flair for data viz

### Out of Scope

- User accounts/authentication — read-only public site, no login
- Community features — no comments, ratings, or user-submitted data
- API/paid features — no monetization, everything free and public
- User personalization — no saved preferences or custom dashboards
- Mobile app — web-only for v1

## Context

**Target audience:** AI enthusiasts who track the AI space and want to stay informed about model capabilities, benchmarks, and industry developments.

**Success metric:** Daily personal use — this becomes the go-to resource for checking AI updates.

**Data sources to scrape:**
- LMSYS Chatbot Arena (ELO rankings, human preference data)
- Official benchmarks (MMLU, HumanEval, GPQA, coding evals)
- Provider blogs (OpenAI, Anthropic, Google DeepMind, Meta AI)
- API documentation (pricing, rate limits, context windows)

**Design direction:** Hybrid approach combining opta-life-manager's clean dashboard layout with Opta MacOS's visual flair (glass effects, neon accents) specifically for data visualizations and charts.

## Constraints

- **Repository**: Separate repo from Opta monorepo — standalone project
- **Stack**: Next.js 15 + Vercel — familiar from opta-life-manager, excellent for data-heavy sites
- **Data freshness**: Automated scraping required — manual curation is not sustainable
- **Simplicity**: Read-only informational site — no user interaction complexity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Automated scraping over manual curation | Core value is freshness; manual updates don't scale | — Pending |
| Next.js + Vercel stack | Familiar, proven for data-heavy sites, fast iteration | — Pending |
| Separate repository | Clean separation from Opta ecosystem, focused scope | — Pending |
| Hybrid design approach | Best of both worlds: Life Manager UX + MacOS visual polish | — Pending |

---
*Last updated: 2026-01-28 after initialization*
