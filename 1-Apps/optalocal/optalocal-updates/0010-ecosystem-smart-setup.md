# Ecosystem Smart Setup — LMX Dashboard + Opta Init v0.7.0

**Date:** 2026-03-05T12:45:00+11:00
**Target:** LMX Dashboard, Opta Init
**Update Type:** Feature
**Commit:** af97a520, 4b6845ad

## Summary

Shipped the Ecosystem Smart Setup features: LMX Dashboard magic-link `/connect` route for zero-config connection handoff, an "Open LMX Dashboard" button in Opta Init that pre-fills LAN config, and a 5-step Cloudflare Tunnel setup wizard for remote access provisioning. Opta Init bumped from v0.6.1 to v0.7.0.

## Detailed Changes

- **LMX Dashboard:** New `/connect` route with `ConnectAutoSetup` client component — validates URL params, hydrates connection context, auto-redirects on success with animated connecting splash and LMX logo.
- **Opta Init (Frontend):** `magicLink.ts` utility to construct `/connect` URLs. LMX app node click handler opens the magic URL. Globe icon button opens the Cloudflare Tunnel wizard.
- **Opta Init (Rust Backend):** 5 new Tauri commands — `install_cloudflared` (brew + progress streaming), `start_cloudflared_login` (polls cert.pem), `provision_cloudflared_tunnel` (create + config), `write_tunnel_to_address_book` (shared ~/.config/opta/lmx-connections.json), `get_lmx_connection` (reads stored config).
- **Opta Init Website:** `download-artifacts.ts` updated to point to v0.7.0 GitHub Release.

## Rollout Impact

Seamless / No action required. Existing Opta Init users will see the update available in the manager. LMX Dashboard changes are live on lmx.optalocal.com.
