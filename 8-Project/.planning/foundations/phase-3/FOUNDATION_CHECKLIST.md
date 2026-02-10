# Phase 3: Data Storage - Foundation Checklist

## Overview

**Project**: AICompare (Web)
**Phase**: 3 of 7
**Status**: Foundation Complete
**Estimated Complexity**: Medium
**Dependencies**: Phase 2 (Data Pipeline)

### Objective
Design and implement the database layer for storing AI model data with efficient querying, caching, and backup strategies.

---

## Platform Impact Assessment

### Database Options Evaluated

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Vercel Postgres | Native integration, edge-ready | Cost at scale | **Primary** |
| Supabase | Rich features, real-time | Additional service | Alternative |
| PlanetScale | MySQL, branching | Complexity | Not chosen |
| SQLite (Turso) | Edge-native, fast | Limited features | Backup option |

### Recommended: Vercel Postgres
- Native Vercel integration
- Edge-compatible queries
- Automatic connection pooling
- Reasonable free tier

### Caching Layer
- **Vercel KV** (Redis): Hot data caching
- **CDN**: Static API responses
- **ISR**: Incremental Static Regeneration for pages

---

## Architecture Impact

### Database Schema

```sql
-- Core tables
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  api_docs_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE models (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(id),
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,          -- API identifier

  -- Capabilities
  context_window INTEGER,
  max_output INTEGER,
  supports_vision BOOLEAN DEFAULT FALSE,
  supports_tools BOOLEAN DEFAULT FALSE,
  supports_function_calling BOOLEAN DEFAULT FALSE,
  supports_streaming BOOLEAN DEFAULT FALSE,

  -- Status
  deprecated BOOLEAN DEFAULT FALSE,
  release_date DATE,

  -- Metadata
  source_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(provider_id, model_id)
);

CREATE TABLE pricing (
  id SERIAL PRIMARY KEY,
  model_id TEXT REFERENCES models(id),
  input_price_per_million DECIMAL(10, 4),
  output_price_per_million DECIMAL(10, 4),
  cached_input_price DECIMAL(10, 4),  -- For providers with caching
  effective_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(model_id, effective_date)
);

CREATE TABLE benchmarks (
  id SERIAL PRIMARY KEY,
  model_id TEXT REFERENCES models(id),
  benchmark_name TEXT NOT NULL,      -- mmlu, humaneval, etc.
  score DECIMAL(5, 2),
  source_url TEXT,
  measured_at DATE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(model_id, benchmark_name)
);

CREATE TABLE pipeline_runs (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL,              -- running, success, failed
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  models_updated INTEGER DEFAULT 0,
  errors JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_models_provider ON models(provider_id);
CREATE INDEX idx_models_deprecated ON models(deprecated);
CREATE INDEX idx_pricing_model ON pricing(model_id);
CREATE INDEX idx_pricing_date ON pricing(effective_date DESC);
CREATE INDEX idx_benchmarks_model ON benchmarks(model_id);
```

### Drizzle ORM Schema

```typescript
// schema.ts
import { pgTable, text, integer, boolean, decimal, date, timestamp, serial, jsonb } from 'drizzle-orm/pg-core';

export const providers = pgTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  website: text('website'),
  apiDocsUrl: text('api_docs_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const models = pgTable('models', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').references(() => providers.id),
  name: text('name').notNull(),
  modelId: text('model_id').notNull(),
  contextWindow: integer('context_window'),
  maxOutput: integer('max_output'),
  supportsVision: boolean('supports_vision').default(false),
  supportsTools: boolean('supports_tools').default(false),
  supportsFunctionCalling: boolean('supports_function_calling').default(false),
  supportsStreaming: boolean('supports_streaming').default(false),
  deprecated: boolean('deprecated').default(false),
  releaseDate: date('release_date'),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ... additional tables
```

### Query Patterns

```typescript
// Common queries
const getAllModels = () => db.select().from(models).where(eq(models.deprecated, false));

const getModelsByProvider = (providerId: string) =>
  db.select().from(models).where(eq(models.providerId, providerId));

const getModelWithPricing = (modelId: string) =>
  db.select()
    .from(models)
    .leftJoin(pricing, eq(models.id, pricing.modelId))
    .where(eq(models.id, modelId))
    .orderBy(desc(pricing.effectiveDate))
    .limit(1);

const compareModels = (modelIds: string[]) =>
  db.select()
    .from(models)
    .leftJoin(pricing, eq(models.id, pricing.modelId))
    .leftJoin(benchmarks, eq(models.id, benchmarks.modelId))
    .where(inArray(models.id, modelIds));
```

---

## Performance Analysis

### Query Performance Targets
| Query Type | Target | Index Required |
|------------|--------|----------------|
| All models | <100ms | idx_models_deprecated |
| Single model + pricing | <50ms | idx_pricing_model |
| Comparison (5 models) | <100ms | Composite |
| Full-text search | <200ms | pg_trgm extension |

### Connection Management
- Vercel Postgres pooling (automatic)
- Edge function compatible (HTTP-based)
- Connection reuse for batch operations

### Caching Strategy

```typescript
// Vercel KV caching
const CACHE_TTL = {
  modelList: 60 * 60,        // 1 hour
  modelDetail: 60 * 15,      // 15 minutes
  pricing: 60 * 60 * 24,     // 24 hours
  benchmarks: 60 * 60 * 24,  // 24 hours
};

async function getCachedModels() {
  const cached = await kv.get('models:all');
  if (cached) return cached;

  const models = await db.select().from(models);
  await kv.set('models:all', models, { ex: CACHE_TTL.modelList });
  return models;
}
```

---

## Security Considerations

### Database Access
- [ ] Environment variables for credentials
- [ ] Read-only connection for public API
- [ ] Write access restricted to pipeline functions
- [ ] No direct database exposure to client

### Data Integrity
- [ ] Foreign key constraints enforced
- [ ] Unique constraints prevent duplicates
- [ ] Check constraints on numeric values
- [ ] Audit trail via timestamps

### Backup Strategy
- [ ] Daily automated backups (Vercel)
- [ ] Point-in-time recovery enabled
- [ ] Export scripts for manual backup
- [ ] Tested restore procedure

---

## Rollback Strategy

### Schema Migrations
```typescript
// Use Drizzle migrations
// drizzle/migrations/0001_initial_schema.sql
// drizzle/migrations/0002_add_benchmarks.sql

// Rollback: drizzle-kit drop
```

### Data Recovery
1. **Full Rollback**: Restore from backup
2. **Partial**: Soft delete with `deleted_at` column
3. **Point-in-time**: Vercel Postgres PITR

### Migration Safety
- Always backward-compatible migrations
- Test migrations on staging first
- Keep rollback SQL ready

---

## Design System Compliance

### Admin Data Views
- Table component with sorting/filtering
- Pagination (50 items per page)
- CSV export functionality
- Inline editing (admin only)

### API Response Format

```typescript
// Consistent API response structure
interface ApiResponse<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    pageSize: number;
    lastUpdated: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Schema validation with Zod
- [ ] Query builder functions
- [ ] Cache invalidation logic
- [ ] Migration scripts (dry run)

### Integration Tests
- [ ] CRUD operations end-to-end
- [ ] Query performance benchmarks
- [ ] Connection pooling behavior
- [ ] Cache hit/miss scenarios

### Load Tests
- [ ] 100 concurrent read queries
- [ ] Bulk insert performance (pipeline)
- [ ] Connection limit behavior

### Data Integrity Tests
- [ ] Foreign key enforcement
- [ ] Unique constraint enforcement
- [ ] Cascade delete behavior

---

## Implementation Checklist

### Wave 1: Database Setup
- [ ] Create Vercel Postgres instance
- [ ] Configure environment variables
- [ ] Set up Drizzle ORM
- [ ] Create initial schema migration

### Wave 2: Core Tables
- [ ] Implement providers table
- [ ] Implement models table
- [ ] Implement pricing table
- [ ] Implement benchmarks table
- [ ] Create indexes

### Wave 3: Caching Layer
- [ ] Set up Vercel KV
- [ ] Implement caching wrapper
- [ ] Cache invalidation on updates
- [ ] TTL configuration

### Wave 4: Operations
- [ ] Backup automation
- [ ] Monitoring queries
- [ ] Admin data viewer
- [ ] Migration CI/CD

---

## Success Criteria

| Criterion | Target | Validation |
|-----------|--------|------------|
| Query latency | <100ms p95 | Database logs |
| Cache hit rate | >80% | KV metrics |
| Backup frequency | Daily | Vercel dashboard |
| Migration safety | Zero downtime | Staging test |
| Data integrity | 100% | Constraint checks |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema migration failure | Low | High | Test on staging, rollback ready |
| Connection pool exhaustion | Medium | High | Monitor, increase limits |
| Cache inconsistency | Medium | Medium | TTL + invalidation |
| Backup failure | Low | Critical | Monitoring alerts |

---

## Notes

### Drizzle vs Prisma Decision
- **Drizzle chosen** for:
  - Better TypeScript inference
  - Smaller bundle size (edge compatible)
  - SQL-like query syntax
  - Better performance

### Future Enhancements
- Read replicas for geographic distribution
- Full-text search with pg_trgm
- Historical pricing trends table
- User-contributed data table
