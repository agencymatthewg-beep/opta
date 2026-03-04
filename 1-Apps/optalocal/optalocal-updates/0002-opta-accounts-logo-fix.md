# Opta Accounts Logo and Avatar Fixes

**Date:** 2026-03-04T14:20:00+11:00
**Target:** Opta Accounts
**Update Type:** Fix
**Commit:** Pending

## Summary

Resolved critical frontend bugs in the Opta Accounts dashboard where the Opta Logo and user avatars were failing to load due to aggressive Next.js built-in `next/image` domain restrictions and `unoptimized` flag behaviors. Switched to standard HTML image rendering to ensure robust cross-origin avatar displaying and reliable local SVG loading without configuration overhead.

## Detailed Changes

- **[components/OptaLogo]:** Replaced `<Image />` component with a native `<img />` tag and disabled the associated lint warning.
- **[app/profile/ProfileContent]:** Replaced `<Image />` component with a native `<img />` tag to handle arbitrary OAuth provider avatar URLs seamlessly.
- **[Deployment]:** Pushed updates successfully to Vercel production under `accounts.optalocal.com`.

## Rollout Impact

Seamless / No action required.
