---
title: Decisions
type: workspace-docs
status: active
last_updated: 2026-03-04
---

# OptaLocal Key Decisions

## D-01: App Registry as Workspace Authority

- Date: 2026-03-04
- Decision: `apps.registry.json` is the canonical source for app IDs, paths, ports, and workspace task wiring.
- Why: avoids path/name drift across scripts and docs.

## D-02: Three-Tier Documentation Model

- Date: 2026-03-04
- Decision: docs are classified into canonical, operational, and historical tiers.
- Why: keeps active docs accurate while preserving dated audits as immutable evidence.

## D-03: Canonical Docs Require Freshness + Placeholder-Free Content

- Date: 2026-03-04
- Decision: canonical docs must include explicit update metadata and must not contain template placeholders.
- Why: prevents incomplete docs from appearing authoritative.

## D-04: Legacy App Names Are Disallowed in Canonical Docs

- Date: 2026-03-04
- Decision: canonical docs must use current app identifiers (for example `1L-Opta-LMX-Dashboard`).
- Why: eliminates operational confusion during release and incident workflows.

## D-05: Discovery-First Connectivity Is Canonical Runtime Pattern

- Date: 2026-03-04
- Decision: discovery contract (`/.well-known/opta-lmx`, `/v1/discovery`) is the preferred connectivity reference for runtime docs.
- Why: aligns docs with implemented resilient connection behavior.

## D-06: Docs Health Check Is Part of Merge-Ready Verification

- Date: 2026-03-04
- Decision: `npm run docs:check` is required whenever docs-affecting changes ship.
- Why: automated detection of drift beats manual review-only enforcement.
