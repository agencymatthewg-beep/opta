# Phase 4: Dashboard Core - Foundation Checklist

## Overview

**Project**: AICompare (Web)
**Phase**: 4 of 7
**Status**: Foundation Complete
**Estimated Complexity**: High
**Dependencies**: Phase 3 (Data Storage)

### Objective
Build the main dashboard interface for browsing, filtering, and comparing AI models with rich visualizations and responsive design.

---

## Platform Impact Assessment

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Rendering**: Server Components (default) + Client Components (interactive)
- **Styling**: Tailwind CSS + CSS Variables
- **Components**: Custom + shadcn/ui primitives
- **State**: URL state + React Query (TanStack)

### Browser Support
| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | 90+ | Full |
| Firefox | 90+ | Full |
| Safari | 15+ | Full |
| Edge | 90+ | Full |
| Mobile Safari | iOS 15+ | Full |
| Mobile Chrome | Android 10+ | Full |

### Responsive Breakpoints
```css
/* Tailwind defaults */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

---

## Architecture Impact

### Page Structure

```
apps/web/AICompare/src/app/
├── page.tsx                      # Landing/overview
├── models/
│   ├── page.tsx                  # Model browser
│   ├── [id]/page.tsx             # Model detail
│   └── compare/page.tsx          # Side-by-side comparison
├── providers/
│   ├── page.tsx                  # Provider list
│   └── [id]/page.tsx             # Provider detail
├── pricing/
│   └── page.tsx                  # Pricing calculator
├── benchmarks/
│   └── page.tsx                  # Benchmark explorer
└── api/
    └── (routes)                  # API endpoints
```

### Component Library

```
src/components/
├── ui/                           # Base primitives (shadcn)
│   ├── button.tsx
│   ├── card.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   └── ...
├── models/                       # Model-specific
│   ├── ModelCard.tsx
│   ├── ModelTable.tsx
│   ├── ModelFilters.tsx
│   ├── ModelComparison.tsx
│   └── ModelSearch.tsx
├── charts/                       # Visualizations
│   ├── PricingChart.tsx
│   ├── BenchmarkRadar.tsx
│   ├── CapabilityMatrix.tsx
│   └── ProviderBreakdown.tsx
├── layout/                       # Layout components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── MobileNav.tsx
└── shared/                       # Shared utilities
    ├── Badge.tsx
    ├── Tooltip.tsx
    └── Loading.tsx
```

### State Management

```typescript
// URL State for sharable filters
// /models?provider=openai&vision=true&sort=price

// React Query for server state
const { data: models } = useQuery({
  queryKey: ['models', filters],
  queryFn: () => fetchModels(filters),
});

// Zustand for UI state (if needed)
const useUIStore = create((set) => ({
  sidebarOpen: true,
  theme: 'dark',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

---

## Performance Analysis

### Core Web Vitals Targets
| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | <2.5s | Largest Contentful Paint |
| FID | <100ms | First Input Delay |
| CLS | <0.1 | Cumulative Layout Shift |
| TTFB | <200ms | Time to First Byte |

### Bundle Size Budget
| Chunk | Target | Notes |
|-------|--------|-------|
| Initial JS | <100KB | Critical path |
| Full page | <200KB | With vendors |
| Route chunk | <50KB | Per route |
| Total vendor | <150KB | All dependencies |

### Optimization Strategies
- Server Components (no JS shipped)
- Dynamic imports for heavy components
- Image optimization (next/image)
- Font subsetting (Sora variable)
- ISR for model pages (revalidate: 3600)

### Data Fetching Pattern

```typescript
// Server Component (default) - no client JS
async function ModelList() {
  const models = await getModels(); // Direct DB query
  return <ModelTable models={models} />;
}

// Client Component (interactive)
'use client';
function ModelFilters() {
  const [filters, setFilters] = useState({});
  // Interactive filtering
}
```

---

## Security Considerations

### Input Validation
- [ ] URL parameters sanitized
- [ ] Search queries escaped
- [ ] Filter values validated
- [ ] No SQL injection possible (ORM)

### XSS Prevention
- [ ] React auto-escapes by default
- [ ] No dangerouslySetInnerHTML without sanitization
- [ ] CSP headers configured

### Rate Limiting
- [ ] API routes rate limited
- [ ] Search debounced (300ms)
- [ ] Infinite scroll throttled

---

## Rollback Strategy

### Feature Flags

```typescript
const DASHBOARD_FLAGS = {
  newModelCards: false,      // A/B test new design
  advancedFilters: true,     // Enable/disable
  chartAnimations: true,     // Performance toggle
  experimentalSearch: false, // New search algorithm
};
```

### Graceful Degradation
1. **Full Rollback**: Static model list (no interactivity)
2. **Partial**: Disable charts, keep table
3. **Feature**: Toggle individual features

---

## Design System Compliance

### Color Palette (Dark Mode Default)

```css
:root {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 7%;
  --card-foreground: 0 0% 98%;
  --primary: 270 50% 60%;        /* Opta purple */
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 14.9%;
  --muted: 0 0% 14.9%;
  --accent: 270 50% 40%;
  --border: 0 0% 14.9%;
}
```

### Typography Scale

```css
/* Sora font family */
--font-sans: 'Sora', system-ui, sans-serif;

/* Size scale */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
```

### Component Patterns

**Model Card**
```
┌─────────────────────────────────────┐
│ Provider Logo    Model Name    [★]  │
│                                     │
│ GPT-4 Turbo                         │
│ 128K context • Vision • Tools       │
│                                     │
│ Input: $10/M    Output: $30/M       │
│                                     │
│ [Compare] [Details]                 │
└─────────────────────────────────────┘
```

**Comparison Table**
```
┌─────────────────────────────────────────────────────┐
│ Feature        │ GPT-4 Turbo │ Claude 3   │ Gemini │
├────────────────┼─────────────┼────────────┼────────┤
│ Context        │ 128K        │ 200K       │ 1M     │
│ Vision         │ ✓           │ ✓          │ ✓      │
│ Tools          │ ✓           │ ✓          │ ✓      │
│ Input Price    │ $10/M       │ $15/M      │ $7/M   │
│ Output Price   │ $30/M       │ $75/M      │ $21/M  │
│ MMLU Score     │ 86.4        │ 88.7       │ 90.0   │
└─────────────────────────────────────────────────────┘
```

### Animation Guidelines
- Transitions: 200ms ease-out
- Hover states: Scale 1.02, shadow increase
- Loading: Skeleton placeholders
- Charts: Entrance animations (staggered)

---

## Testing Requirements

### Component Tests
- [ ] ModelCard renders correctly
- [ ] ModelTable sorting works
- [ ] Filters update URL state
- [ ] Comparison selection works

### E2E Tests (Playwright)
- [ ] Landing page loads
- [ ] Model browser navigation
- [ ] Filter combination
- [ ] Comparison flow
- [ ] Responsive breakpoints

### Visual Regression
- [ ] Screenshot comparison (Percy/Chromatic)
- [ ] Dark mode consistency
- [ ] Mobile layouts

### Accessibility Tests
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] Color contrast validation

---

## Implementation Checklist

### Wave 1: Layout Shell
- [ ] App layout (header, sidebar, main)
- [ ] Navigation component
- [ ] Mobile responsive nav
- [ ] Theme system (dark default)

### Wave 2: Model Browser
- [ ] ModelCard component
- [ ] ModelTable with sorting
- [ ] Filter sidebar
- [ ] Search functionality
- [ ] Pagination/infinite scroll

### Wave 3: Model Detail & Comparison
- [ ] Model detail page
- [ ] Provider detail page
- [ ] Comparison selection
- [ ] Side-by-side view

### Wave 4: Visualizations
- [ ] Pricing calculator
- [ ] Benchmark charts
- [ ] Capability matrix
- [ ] Provider breakdown

---

## Success Criteria

| Criterion | Target | Validation |
|-----------|--------|------------|
| Core Web Vitals | All green | PageSpeed Insights |
| Bundle size | <200KB initial | Build output |
| Accessibility | WCAG 2.1 AA | axe-core audit |
| Browser matrix | 100% | BrowserStack |
| Responsive | All breakpoints | Manual + E2E |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance issues | Medium | High | Profiling, lazy loading |
| Bundle bloat | Medium | Medium | Size monitoring, tree shaking |
| Accessibility gaps | Medium | High | Early auditing |
| Browser inconsistency | Low | Medium | BrowserStack testing |

---

## Notes

### shadcn/ui Integration
- Install components via CLI: `npx shadcn@latest add button`
- Customize in `components/ui/`
- Don't modify `@/lib/utils.ts`

### Chart Library Decision
- **Recharts**: Good for static charts
- **Visx**: Low-level, performant
- **Chart.js**: Simple, well-documented
- **Recommendation**: Recharts for simplicity, Visx for performance

### Search Implementation
- Start with simple client-side filter
- Add Algolia/Typesense if needed later
- Consider fuzzy matching (fuse.js)
