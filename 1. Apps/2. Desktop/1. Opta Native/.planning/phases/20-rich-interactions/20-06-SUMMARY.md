# Plan 20-06 Summary: Global Keyboard Shortcuts and Haptic Feedback

## Status: COMPLETE

## Implementation Details

### 1. Tauri Plugin Configuration

**Cargo.toml (`src-tauri/Cargo.toml`):**
- Added `tauri-plugin-global-shortcut = "2"` for system-wide keyboard shortcuts
- Added `tauri-plugin-os = "2"` for platform detection (macOS vs Windows vs Linux)

**Plugin Registration (`src-tauri/src/lib.rs`):**
- Registered `tauri_plugin_global_shortcut::Builder::new().build()` plugin
- Registered `tauri_plugin_os::init()` plugin

**Capabilities (`src-tauri/capabilities/default.json`):**
- Added `"global-shortcut:default"` permission
- Added `"os:default"` permission

### 2. Frontend NPM Packages

Installed via npm:
- `@tauri-apps/plugin-global-shortcut` - Frontend bindings for global shortcuts
- `@tauri-apps/plugin-os` - Frontend bindings for OS detection

### 3. New Files Created

**`src/hooks/useGlobalShortcut.ts`:**
- React hook wrapping Tauri's global-shortcut plugin
- Handles registration/unregistration lifecycle
- Supports `CommandOrControl` modifier for cross-platform shortcuts
- Type definitions for supported shortcut keys
- Returns `isRegistered` and `error` state

**`src/lib/haptics.ts`:**
- Haptic feedback utilities for macOS Force Touch trackpads
- Semantic intent system: `success`, `warning`, `error`, `selection`
- Maps intents to native `NSHapticFeedbackPattern` values
- Platform detection via `@tauri-apps/plugin-os`
- Graceful no-op on non-macOS platforms
- Global enable/disable toggle
- NOTE: Actual haptic triggering requires `tauri-plugin-macos-haptics` (deferred - plugin not yet stable)

**`src/components/GlobalShortcuts.tsx`:**
- Renders nothing visible - manages global shortcuts
- Registers `Cmd/Ctrl+Shift+O` for Quick Optimization
- Shows toast notifications when shortcuts triggered
- Integrates with haptic feedback on optimization complete
- Respects user preferences from localStorage

### 4. Modified Files

**`src/App.tsx`:**
- Added `GlobalShortcuts` component to render tree

**`src/pages/Settings.tsx`:**
- Added "Keyboard Shortcuts" section with:
  - Toggle for Quick Optimization shortcut (Cmd/Ctrl+Shift+O)
  - Shortcut reference showing Command Palette (Cmd/Ctrl+K) and Quick Optimize
- Added "Feedback" section (macOS only) with:
  - Toggle for haptic feedback on key actions
  - Only renders when `isHapticsSupported()` returns true
- Imports for shortcut preferences and haptics utilities
- State management for shortcut/haptic preferences

## Keyboard Shortcuts Implemented

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Cmd/Ctrl+Shift+O` | Quick Optimization | Global (background) |
| `Cmd/Ctrl+K` | Command Palette | In-app |

## Build Verification

- `cargo check` in `src-tauri`: PASSED (with pre-existing warnings)
- TypeScript type check for new files: PASSED (no errors)
- Full `npm run build`: Pre-existing TypeScript errors in unrelated files (ChromaticShader.ts, Chess.tsx, etc.) - these are NOT related to this plan's changes

## Technical Notes

### Global Shortcut Architecture

1. **Registration**: `useGlobalShortcut` hook registers shortcuts on mount
2. **Handler Reference**: Uses `useRef` for handler to avoid re-registration
3. **Cleanup**: Auto-unregisters on unmount or when `enabled` becomes false
4. **State Check**: Checks `isRegistered` before re-registering to avoid conflicts

### Haptic Feedback Design

1. **Semantic Intents**: Use `haptic('success')` instead of raw patterns
2. **Sparse Usage**: Target 3-4 haptic triggers per session to avoid fatigue
3. **Platform Graceful Degradation**: No-ops silently on non-macOS
4. **Future Ready**: Placeholder for `tauri-plugin-macos-haptics` when stable

### Settings Persistence

- Shortcut preferences stored in `localStorage` under `opta_shortcut_preferences`
- Changes dispatch `storage` event for cross-component sync
- GlobalShortcuts component listens for storage events to refresh

## Outstanding Items

1. **Haptic Native Plugin**: The `tauri-plugin-macos-haptics` is not yet available as a stable npm package. The haptics utility is fully implemented but actual native haptic triggering is deferred until the plugin is available. Currently logs to console in development mode.

2. **Additional Shortcuts**: Framework is in place to easily add more shortcuts (Cmd+Shift+S for score, Cmd+Shift+G for games, Cmd+Shift+D for dashboard).

## Files Changed

### New Files
- `/Users/matthewbyrden/Documents/Opta/src/hooks/useGlobalShortcut.ts`
- `/Users/matthewbyrden/Documents/Opta/src/lib/haptics.ts`
- `/Users/matthewbyrden/Documents/Opta/src/components/GlobalShortcuts.tsx`

### Modified Files
- `/Users/matthewbyrden/Documents/Opta/src-tauri/Cargo.toml`
- `/Users/matthewbyrden/Documents/Opta/src-tauri/src/lib.rs`
- `/Users/matthewbyrden/Documents/Opta/src-tauri/capabilities/default.json`
- `/Users/matthewbyrden/Documents/Opta/src/App.tsx`
- `/Users/matthewbyrden/Documents/Opta/src/pages/Settings.tsx`
- `/Users/matthewbyrden/Documents/Opta/package.json` (npm packages added)
