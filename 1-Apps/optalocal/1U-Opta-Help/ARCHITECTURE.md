# Architecture — Opta Help

## Overview

Static documentation site built with Next.js 16 App Router, exported as static HTML/CSS/JS. No backend, no API routes.

## Layout

Three-column responsive layout for documentation pages:
1. **Sidebar** (280px, collapsible) — Section navigation with nested page links
2. **Content** (flexible) — Main documentation content with `.prose-opta` styling
3. **Table of Contents** (right rail, hidden on mobile) — In-page heading navigation

Landing page uses full-width layout without sidebar.

## Content Model

All content is structured as React components (not MDX). Page metadata and navigation tree are defined in `lib/content.ts`. Search corpus in `lib/search-data.ts`.

## Component Library

| Component | Purpose |
|-----------|---------|
| CodeBlock | Syntax-highlighted code with copy button |
| CommandBlock | Terminal command with copy-paste support |
| Callout | Info/warning/danger callout boxes |
| ApiEndpoint | REST API endpoint documentation card |
| FeatureTable | Feature comparison/status tables |
| TabGroup | Tabbed content switcher |
| StepList | Numbered step-by-step instructions |
| SearchDialog | Cmd+K search overlay |
