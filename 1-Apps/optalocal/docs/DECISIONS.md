---
title: Decisions
type: workspace-docs
status: active
last_updated: 2026-03-06
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

## D-07: CSP Script Hardening First, Style Hardening Deferred

- Date: 2026-03-06
- Decision: `script-src 'unsafe-inline'` is disallowed in Vercel CSP; static-export apps must use deterministic `sha256` hashes for inline scripts.
- Why: this removes executable inline-script allowance immediately while preserving static export compatibility.
- Note: `style-src 'unsafe-inline'` remains temporarily allowed until Next.js inline style paths (including fallback/error markup) are migrated to a non-inline strategy.

## D-08: Deterministic Gates Are Enforced at Workspace Root

- Date: 2026-03-06
- Decision: workspace release verification uses explicit gate order (`typecheck -> lint -> test -> build -> live probe`) via `scripts/ops/run-deterministic-gates.mjs`.
- Why: a single enforceable gate order removes ambiguity and prevents partial checks from being treated as release-ready evidence.

## D-09: Phased Release Progression Is Machine-Gated

- Date: 2026-03-06
- Decision: rollout progression is enforced as four blocked waves via `scripts/ops/run-phased-release-gates.mjs`:
  1. Accounts + Status
  2. Init + LMX Dashboard
  3. Home + Help + Learn
  4. Admin
- Why: this matches blast-radius priorities and prevents narrative/admin updates from shipping ahead of control-plane and onboarding readiness.

## D-10: SSO/Admin Contracts Are CI-Checked

- Date: 2026-03-06
- Decision: SSO cookie-domain behavior, redirect allowlist protections, and admin fail-closed enforcement are validated via `scripts/ops/check-sso-contracts.mjs`.
- Why: these controls are security-critical and must fail fast in CI if drift occurs.
