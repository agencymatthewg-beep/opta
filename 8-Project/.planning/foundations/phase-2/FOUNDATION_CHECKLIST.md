# Phase 2: Data Pipeline - Foundation Checklist

## Overview

**Project**: AICompare (Web)
**Phase**: 2 of 7
**Status**: Foundation Complete
**Estimated Complexity**: Medium
**Dependencies**: Phase 1 (UI Framework) - COMPLETE

### Objective
Build automated data collection pipeline to gather AI model information, pricing, and capabilities from provider sources.

---

## Platform Impact Assessment

### Technology Stack
- **Runtime**: Node.js 20+ / Edge Functions
- **Framework**: Next.js 14+ API Routes / Server Actions
- **Hosting**: Vercel (Edge and Serverless)

### Data Sources
| Provider | Data Type | Update Frequency |
|----------|-----------|------------------|
| OpenAI | Models, pricing, rate limits | Daily |
| Anthropic | Models, pricing, context windows | Daily |
| Google | Gemini models, pricing | Daily |
| Meta | Llama models, benchmarks | Weekly |
| Mistral | Models, pricing | Daily |
| Cohere | Models, pricing | Weekly |

### Rate Limiting Compliance
- Respect robots.txt directives
- Implement polite delays (1-2s between requests)
- Use official APIs where available
- Cache aggressively to minimize requests

---

## Architecture Impact

### New Components

```
apps/web/AICompare/
├── src/
│   ├── lib/
│   │   └── pipeline/
│   │       ├── scrapers/           # Per-provider scrapers
│   │       │   ├── openai.ts
│   │       │   ├── anthropic.ts
│   │       │   ├── google.ts
│   │       │   ├── meta.ts
│   │       │   ├── mistral.ts
│   │       │   └── cohere.ts
│   │       ├── normalizers/        # Data normalization
│   │       │   └── model-normalizer.ts
│   │       ├── validators/         # Schema validation
│   │       │   └── model-schema.ts
│   │       └── scheduler.ts        # Cron job management
│   └── app/
│       └── api/
│           └── pipeline/
│               ├── trigger/route.ts # Manual trigger
│               └── status/route.ts  # Pipeline status
└── scripts/
    └── run-pipeline.ts             # CLI runner
```

### Data Schema

```typescript
interface AIModel {
  id: string;                    // Unique identifier
  provider: string;              // openai, anthropic, etc.
  name: string;                  // Display name
  modelId: string;               // API model identifier

  // Capabilities
  contextWindow: number;         // Max tokens
  maxOutput: number;             // Max output tokens
  supportsVision: boolean;
  supportsTools: boolean;
  supportsFunctionCalling: boolean;
  supportsStreaming: boolean;

  // Pricing
  inputPricePerMillion: number;  // USD per 1M input tokens
  outputPricePerMillion: number; // USD per 1M output tokens

  // Performance (from benchmarks)
  benchmarks?: {
    mmlu?: number;
    humanEval?: number;
    hellaswag?: number;
    // ...
  };

  // Metadata
  releaseDate?: Date;
  deprecated: boolean;
  lastUpdated: Date;
  sourceUrl: string;
}
```

### Data Flow

```
Scheduled Trigger (Vercel Cron)
        ↓
    Scraper Pool (parallel by provider)
        ↓
    Raw Data Extraction
        ↓
    Normalization Layer
        ↓
    Schema Validation (Zod)
        ↓
    Diff Detection (what changed?)
        ↓
    Database Upsert
        ↓
    Cache Invalidation
```

---

## Performance Analysis

### Pipeline Execution
| Metric | Target | Notes |
|--------|--------|-------|
| Full pipeline run | <5 min | All providers |
| Single provider | <30s | Parallel execution |
| Rate limit delays | 1-2s | Between requests |
| Retry attempts | 3 | Exponential backoff |

### Resource Usage
- Memory: <512MB per function invocation
- Execution time: Within Vercel limits (10s hobby, 60s pro)
- Bandwidth: <10MB per pipeline run

### Caching Strategy
- Cache raw responses for 1 hour (development)
- Cache normalized data for 24 hours
- Invalidate on successful pipeline run

---

## Security Considerations

### Data Collection Ethics
- [ ] Public data only (no authentication bypass)
- [ ] Respect rate limits and robots.txt
- [ ] No credential scraping
- [ ] Terms of service compliance review

### API Security
- [ ] Pipeline trigger endpoint protected
- [ ] Admin authentication for manual triggers
- [ ] Rate limiting on status endpoint
- [ ] No sensitive data in logs

### Data Validation
- [ ] Strict schema validation (reject malformed)
- [ ] Sanitize all scraped content
- [ ] Validate numeric ranges (pricing sanity check)

---

## Rollback Strategy

### Feature Flag
```typescript
const PIPELINE_CONFIG = {
  enabled: true,
  providers: {
    openai: true,
    anthropic: true,
    google: true,
    meta: false,     // Disabled for testing
    mistral: true,
    cohere: false,   // Disabled for testing
  },
  dryRun: false,     // Don't write to DB
};
```

### Graceful Degradation
1. **Full Rollback**: Use static JSON data (last known good)
2. **Partial**: Disable failing provider scrapers
3. **Manual Mode**: Admin-triggered updates only

### Data Backup
- Daily database snapshots
- Keep last 7 days of pipeline output
- Rollback to previous dataset via admin UI

---

## Design System Compliance

### Admin Dashboard (Pipeline Status)
- Status indicators: Running (blue), Success (green), Failed (red)
- Last run timestamp
- Per-provider status
- Error logs (collapsible)

### Data Preview
- Table view of scraped data
- Diff view showing changes
- Validation error highlighting

---

## Testing Requirements

### Unit Tests
- [ ] Each scraper extracts correct fields
- [ ] Normalizer handles edge cases
- [ ] Schema validator rejects malformed data
- [ ] Diff detection accuracy

### Integration Tests
- [ ] End-to-end pipeline execution (mock sources)
- [ ] Database upsert correctness
- [ ] Cache invalidation works
- [ ] Error recovery (retry logic)

### Monitoring Tests
- [ ] Source availability checks
- [ ] Data freshness validation
- [ ] Schema change detection

### Manual Testing
- [ ] Verify scraped data against source
- [ ] Test with rate limiting enabled
- [ ] Test failure scenarios

---

## Implementation Checklist

### Wave 1: Core Infrastructure
- [ ] Define AIModel schema (Zod)
- [ ] Create base scraper interface
- [ ] Implement OpenAI scraper (reference)
- [ ] Set up pipeline orchestrator

### Wave 2: Provider Scrapers
- [ ] Anthropic scraper
- [ ] Google (Gemini) scraper
- [ ] Meta (Llama) scraper
- [ ] Mistral scraper
- [ ] Cohere scraper

### Wave 3: Processing
- [ ] Normalization layer
- [ ] Diff detection
- [ ] Database integration
- [ ] Cache management

### Wave 4: Operations
- [ ] Vercel Cron job setup
- [ ] Admin status endpoint
- [ ] Error alerting
- [ ] Monitoring dashboard

---

## Success Criteria

| Criterion | Target | Validation |
|-----------|--------|------------|
| All provider scrapers functional | 6/6 | Integration tests |
| Data freshness | <24 hours old | Timestamp check |
| Schema compliance | 100% | Zod validation |
| Error recovery | <3 retries | Failure simulation |
| Pipeline duration | <5 min | Timing logs |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Source structure change | High | Medium | Schema change detection, alerts |
| Rate limiting blocks | Medium | Medium | Polite delays, IP rotation |
| Data accuracy issues | Medium | High | Validation, human review |
| API deprecation | Low | High | Monitor provider changelogs |

---

## Notes

### Scraping Strategy per Provider
- **OpenAI**: Official API + pricing page parsing
- **Anthropic**: API docs + pricing page
- **Google**: AI Studio docs + Vertex pricing
- **Meta**: GitHub releases + papers
- **Mistral**: API docs + pricing page
- **Cohere**: API docs + dashboard

### Future Enhancements
- Webhook notifications for price changes
- Historical pricing tracking
- Automated benchmark updates
- Community-contributed model data
