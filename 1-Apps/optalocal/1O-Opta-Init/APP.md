---
app: opta-init
type: web-app
platforms: [web]
language: typescript
status: live
version: 1.1.2
depends_on: [opta-cli-ts, opta-lmx, opta-local]
depended_on_by: [opta-local]
port: 3005
opis_version: 2.0
opis_mode: ecosystem
---

# Opta Init — APP.md

> Your local AI stack, managed in one native control surface.

---

## 1. Identity

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **Name**            | Opta Init                                                      |
| **Full Name**       | Opta Initializer                                               |
| **Tagline**         | Your local AI stack, ready in minutes                          |
| **Type**            | Static onboarding website + release metadata portal              |
| **Platform**        | Web (Next.js, statically exported)                             |
| **Language**        | TypeScript                                                     |
| **Status**          | v1.1.2 active — https://init.optalocal.com                    |
| **Owner**           | Matthew Byrden / Opta Operations                               |
| **Domain**          | init.optalocal.com                                              |
| **Parent Platform** | optalocal.com (multi-app LLM platform)                         |

---

## 2. Purpose

### What It Does

Opta Init (**Opta Initializer**, short: **`opta init`** / `/init` in coding references) is the front door for the **Opta Init Desktop Manager**. The website does three things (distinct from the desktop app):

1. Position Opta Init as the managed app manager/updater for the Opta stack.
2. Provide the single user-facing download path for the desktop manager (macOS + Windows).
3. Host the release metadata channels (`desktop/manifest-*.json`) used by the manager for app lifecycle operations.

### What Problem It Solves

Previously, users discovered Opta tooling across repos and fragmented READMEs. The website now acts as the
single canonical gateway: users install only the desktop manager, and that manager orchestrates Opta CLI, LMX,
and future apps through signed manifests.

### What It Does NOT Do

- No direct Opta CLI/LMX/Code app downloads for end users.
- No local model serving or LLM inference.
- No dashboard functionality (that is `lmx.optalocal.com`).
- No account systems or billing flows.

---

## 3. Target Audience

- New operators: one install step into one control surface.
- Existing Opta users: one managed lifecycle, no extra download paths.
- Teams scaling across devices: stable/beta update governance from manifests.

---

## 4. Non-Negotiable Capabilities

| #   | Capability                                                     | Why                                               |
| --- | -------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Single user-visible download target: **Opta Init desktop manager** | Eliminates unmanaged sideloading and drift           |
| 2   | Bootstrap command + onboarding context                            | Helps users start quickly                           |
| 3   | Manifest/metadata-first install/update path for managed apps      | Stable + beta flows controlled from one trusted plane |
| 4   | Dashboard and account handoff links                               | Keeps execution surface (LMX + accounts) separated    |
| 5   | Static web architecture                                          | Zero server risk, instant global edge delivery       |
| 6   | Design language consistency with opta-local aesthetic             | Brand trust and premium motion quality              |

---

## 5. Architecture Overview

`init.optalocal.com (Vercel CDN, static export)`
- Marketing/Onboarding page
- Single download card for **Opta Init Manager**
- Release metadata routes for manifest-driven lifecycle

`desktop-manager`
- Runs as a native Tauri app
- Fetches manifests
- Installs/updates/launches managed applications
- First-run setup wizard persists local manager config
- Auto-discovers Opta LMX on LAN via `_opta-lmx._tcp.local.`
- Persists LMX connection state to shared Opta config files

No backend. No user DB. No auth.

Distribution invariant: Opta Init (the **Opta Initializer**, short: **Opta Init**) is the only user-downloadable app from OptaLocal websites. It is the **Opta Initializer** for the stack.

---

## 6. Current Phase

- v1.1 active: App manager + signed release control plane is in motion and being documented.
- v1.2 alignment: setup-gated onboarding, daemon drawer wiring, and native mDNS discovery are active in desktop manager.
- v1.x direction: keep install surface singular; keep managed-app changes in manifests and workflows.
- Priority directive (2026-03-06): treat complete Windows development for Opta Code and Opta Daemon as P0 and ship ASAP.

---

## 7. Open Questions

- Should beta channel be user-visible by default or hidden until stability checks pass?
