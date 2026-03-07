# Opta Status Logo Fix

**Date:** 2026-03-07
**Apps:** 1S-Opta-Status
**Environment:** Production
**Author:** Antigravity

## Overview

Removed an unintended white border around the logo in the Opta Status top navigation bar.

## Highlights

- Removed the `border`, `border-border/60`, and `bg-surface/70` classes from the logo span wrapper in `1S-Opta-Status/app/layout.tsx`.
- Conducted an ecosystem-wide CSS audit of `border-white` classes in navbars; confirmed no other core apps were affected.
- Deployed update directly to production Vercel.

## Validation

- `npm run build` confirmed zero compilation issues.
- Deployed dynamically to `status.optalocal.com` via Vercel.
