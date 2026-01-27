# Plan: Package Opta Life Manager as macOS DMG

## Overview
Package the Next.js Opta Life Manager web app as a native macOS desktop application using Tauri v2, distributed as a DMG.

## Approach: Tauri with Embedded Next.js Server

Since this is a Next.js app with server-side features (OAuth, Server Actions, API routes), we'll use Tauri to:
1. Start the Next.js server on app launch
2. Load the app in Tauri's webview
3. Package everything into a DMG

## Implementation Steps

### 1. Initialize Tauri in the Project
```bash
cd /Users/matthewbyrden/Documents/Opta/opta-life-manager
npm install -D @tauri-apps/cli@latest
npm run tauri init
```

### 2. Configure Next.js for Standalone Output
**File: `next.config.ts`**
- Add `output: 'standalone'` to enable self-contained server build

### 3. Create Tauri Configuration
**File: `src-tauri/tauri.conf.json`**
- App identifier: `com.opta.life-manager`
- Window: 1400x900, transparent, with Opta styling
- Bundle: DMG target for macOS
- Security: Allow localhost connections

### 4. Create Tauri Backend to Start Next.js Server
**File: `src-tauri/src/main.rs`**
- On app start: spawn Next.js standalone server
- Find available port dynamically
- Pass URL to webview
- Graceful shutdown on app close

### 5. Handle Environment Variables
**File: `src-tauri/src/main.rs`**
- Embed API keys at build time OR
- Read from secure config file in app data directory

### 6. Update Package Scripts
**File: `package.json`**
```json
"tauri:dev": "tauri dev",
"tauri:build": "npm run build && tauri build --target aarch64-apple-darwin",
"tauri:dmg": "npm run build && tauri build --target aarch64-apple-darwin --bundles dmg"
```

### 7. Add App Icons
**Directory: `src-tauri/icons/`**
- icon.icns (macOS app icon)
- 32x32.png, 128x128.png, etc.

## Critical Files to Create/Modify

| File | Action |
|------|--------|
| `next.config.ts` | Modify - add standalone output |
| `src-tauri/tauri.conf.json` | Create - Tauri config |
| `src-tauri/src/main.rs` | Create - Rust backend |
| `src-tauri/Cargo.toml` | Create - Rust dependencies |
| `src-tauri/build.rs` | Create - Build script |
| `package.json` | Modify - add Tauri scripts |

## Environment Variables Strategy
**Decision: Embed at build time**

Secrets from `.env.local` will be embedded into the Rust binary at compile time:
- `AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TODOIST_API_TOKEN`
- `GEMINI_API_KEY`

This is done via Tauri's build script reading `.env.local` and passing values as compile-time constants.

## Verification
1. Run `npm run tauri:dev` to test in development
2. Run `npm run tauri:dmg` to build the DMG
3. Mount the DMG and drag app to Applications
4. Launch app and verify:
   - OAuth sign-in works
   - Calendar, Email, Todoist sync
   - AI commands function
   - Weather and News load

## Notes
- OAuth redirect will use `http://localhost:PORT` (dynamic port)
- Google OAuth credentials must allow localhost redirects
- The app will require internet for all features (no offline mode)
