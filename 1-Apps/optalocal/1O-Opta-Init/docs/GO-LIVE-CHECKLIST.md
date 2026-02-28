# Opta Init - Download and Run Go-Live Checklist

> Goal: a new user can open `init.optalocal.com`, download real artifacts, install, and successfully run the Opta Local stack end to end.

## Ownership Map

| Area              | Primary Owner        | Backup Owner | Scope                                                |
| ----------------- | -------------------- | ------------ | ---------------------------------------------------- |
| 1O Opta Init      | Web owner (1O)       | Matthew      | Download links, onboarding copy, CTA flow            |
| 1D Opta CLI TS    | CLI owner (1D)       | Matthew      | CLI packaging, install verification, post-install UX |
| 1M Opta LMX       | LMX owner (1M)       | Matthew      | LMX packaging, runtime health, API availability      |
| 1L Opta Local web | Dashboard owner (1L) | Matthew      | Dashboard reachability and first-load health         |
| DNS + Vercel      | Infra owner          | Matthew      | Domain routing, HTTPS, cache behavior                |

## Release Gates (must all be green)

| Gate                                                          | Owner         | Status |
| ------------------------------------------------------------- | ------------- | ------ |
| Real CLI package URL returns `200`                            | 1D            | [x]    |
| Real LMX macOS package URL returns `200`                      | 1M            | [ ]    |
| Bootstrap endpoint `https://optalocal.com/init` returns `200` | Infra + 1D/1M | [ ]    |
| Init site points only to valid links                          | 1O            | [x]    |
| Dashboard URL `https://lmx.optalocal.com` reachable           | 1L            | [x]    |
| End-to-end install test passes on clean machine               | 1D + 1M + 1O  | [ ]    |

## Task List by App

### 1D Opta CLI TS (download and local command surface)

- [x] Build and publish CLI release artifact to GitHub Releases.
- [x] Confirm final artifact name and path used by Init links (`opta-cli-npm.tgz`).
- [x] Ensure post-install command works (`opta`, `opta doctor`, `opta chat --help`).
- [x] Verify CLI can connect to LMX after fresh install (no manual patching).
- [x] Provide release notes with known hardware constraints.

Verification:

```bash
curl -I -L "https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz"
```

### 1M Opta LMX (inference runtime and packaging)

- [ ] Build and publish signed macOS installer artifact to GitHub Releases.
- [ ] Ensure install config starts service cleanly and remains healthy.
- [ ] Verify OpenAI-compatible endpoint responds after install.
- [ ] Validate graceful behavior under constrained memory conditions.
- [ ] Document minimum hardware and storage requirements.

Verification:

```bash
curl -I -L "https://github.com/optaops/opta-lmx/releases/latest/download/<final-lmx-pkg-name>.pkg"
curl -sSf "http://127.0.0.1:1234/v1/models" >/dev/null
```

### 1O Opta Init (onboarding and conversion)

- [x] Replace placeholder-only download wiring with GitHub release asset detection (`lib/download-artifacts.ts`).
- [ ] Ensure bootstrap command shown in UI points to a live script endpoint.
- [x] Add install-state messaging (available/coming soon) based on real artifact status.
- [ ] Add version labels from latest release metadata (planned v1.1).
- [ ] Run Lighthouse and cross-browser pass before final deploy.

Verification:

```bash
npm run build
curl -I "https://init.optalocal.com"
```

### 1L Opta Local web (dashboard handoff)

- [ ] Validate landing page loads from public internet with TLS.
- [ ] Confirm first-run dashboard behavior when LMX is not yet ready.
- [ ] Confirm first-run dashboard behavior when LMX is healthy.
- [ ] Ensure errors are actionable for non-technical users.

Verification:

```bash
curl -I "https://lmx.optalocal.com"
```

### Infra (DNS, script hosting, deployment)

- [ ] Host bootstrap script at `https://optalocal.com/init` and return `200`.
- [ ] Keep `init.optalocal.com` CNAME and TLS stable.
- [x] Confirm cache headers are safe for static HTML + immutable static assets.
- [ ] Verify rollback path (previous deploy) for both Init and bootstrap script.

Verification:

```bash
curl -I "https://optalocal.com/init"
curl -I "https://init.optalocal.com"
```

## End-to-End Acceptance Test (clean machine)

1. Open `https://init.optalocal.com`.
2. Download CLI from page link and confirm LMX state reflects real release assets (not hardcoded copy).
3. Install both packages without manual file edits.
4. Run documented startup command.
5. Confirm LMX API is healthy.
6. Open dashboard and confirm app can interact with local model runtime.

Pass criteria:

- No 404 links from the landing page.
- No dead bootstrap command.
- Time-to-first-successful-chat is within target onboarding window.

## Immediate Blockers (current state)

- [x] `init.optalocal.com` is live.
- [x] Current CLI release asset URL returns `200`.
- [ ] LMX package artifact still pending in release feed (UI auto-falls back to unavailable state).
- [ ] `https://optalocal.com/init` returns `404`.
- [x] `https://lmx.optalocal.com` returns `200`.

## Recommended Execution Order

1. Ship real CLI and LMX release assets.
2. Bring `optalocal.com/init` bootstrap endpoint live.
3. Update Init constants and UI messaging.
4. Run clean-machine E2E acceptance test.
5. Deploy Init and mark go-live gates complete.
