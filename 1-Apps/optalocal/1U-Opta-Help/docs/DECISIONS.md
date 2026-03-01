# Decisions — Opta Help

## D1: Pure React pages over MDX (2026-03-01)
Content is structured data (commands, API endpoints, step lists) better served by typed components than markdown. All 42 pages are finite and known at build time.

## D2: flexsearch for client-side search (2026-03-01)
Static export means no API routes. flexsearch provides fast in-browser full-text search over a manually maintained corpus.

## D3: Three-column docs layout (2026-03-01)
Sidebar (280px) | Content | ToC (right rail). Mobile collapses sidebar to hamburger overlay. Standard docs pattern.

## D4: 1T-Opta-Home as template (2026-03-01)
Reuse verified static export config, obsidian glass design system, font loading, and brand components.
