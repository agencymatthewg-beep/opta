# Opta Init Features

Opta Init (`1O-Opta-Init`) is the public landing and setup portal at `init.optalocal.com`.

## Landing Page

- [x] Hero section — value proposition and CTA
- [x] Download section — CLI installer links (macOS, versioned)
- [x] Stack overview — visual diagram of the Opta local stack
- [x] Feature highlights — key capabilities of CLI + LMX
- [x] Ecosystem links — connect to optalocal.com, status.optalocal.com

## Setup Guides

- [x] CLI installation — step-by-step terminal instructions
- [x] LMX setup guide — install and configure LMX on Apple Silicon
- [x] Daemon setup — start background daemon and verify connection
- [x] First model download — guide to pulling the first LMX model
- [x] Interactive setup wizard — browser-based step-by-step configurator
- [x] OS detection — auto-detect macOS/Linux and show relevant guide

## Documentation Pages

- [x] Architecture overview — how CLI, daemon, and LMX fit together
- [x] FAQ — common setup questions and troubleshooting
- [x] Changelog page — release history with dates
- [x] API reference — LMX and daemon API documentation

## Technical

- [x] Static export — deployed to CDN via Vercel (`output: 'export'`)
- [x] Sora + JetBrains Mono fonts — local font serving
- [x] Obsidian glass aesthetic — consistent Opta design system
- [x] Framer Motion animations — entrance animations and scroll effects
- [x] Responsive layout — mobile and desktop optimized
- [x] SEO meta tags — Open Graph and Twitter cards
- [x] Health badge — live status.optalocal.com indicator embedded in footer
- [x] RSS feed — subscribe to release announcements

## Recent Updates

- 2026-03-07 — Opta Daemon v0.

- 2026-03-07 — Opta Code Desktop v0.

- 2026-03-07 — Restored the core "Opta Code" 3D dashboard layout for the Opta Init environment selection screen.

- 2026-03-05 — Shipped the Ecosystem Smart Setup features: LMX Dashboard magic-link `/connect` route for zero-co...

- 2026-02-26 — Production readiness and content improvements
- 2026-02-23 — Glass aesthetic polish pass
- 2026-02-17 — Documentation content additions

## Auto-Synced Features
- [x] Feature: Opta Daemon v0.4.1 is now shipping on the stable channel with full macOS and Win
- [x] Feature: Opta Code Desktop v0.2.1 is now listed as a downloadable product on init.optaloc
- [x] Fix: Restored the core "Opta Code" 3D dashboard layout for the Opta Init environment
- [x] `magicLink.ts` utility to construct `/connect` URLs. LMX app node click handler opens the magic URL. Globe icon button opens the Cloudflare Tunnel wizard.
- [x] 5 new Tauri commands — `install_cloudflared` (brew + progress streaming), `start_cloudflared_login` (polls cert.pem), `provision_cloudflared_tunnel` (create + config), `write_tunnel_to_address_book` (shared ~/.config/opta/lmx-connections.json), `get_lmx_connection` (reads stored config).
- [x] `download-artifacts.ts` updated to point to v0.7.0 GitHub Release.

<!-- opta-sync-applied: 0010-ecosystem-smart-setup -->

<!-- opta-sync-applied: 0013-opta-init-manager-v073-release -->

<!-- opta-sync-applied: 0013-opta-init-code-desktop-download -->

<!-- opta-sync-applied: 0015-opta-daemon-v041-stable-windows -->
