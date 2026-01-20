# macOS Known Issues

## Verified Working

### App Launch and Initialization
- [x] App launches successfully on Apple Silicon (M4 Max tested)
- [x] Platform context initializes correctly with macOS detection
- [x] Metal GPU acceleration detected and enabled
- [x] App Nap configuration applied at launch
- [x] Retina display support enabled

### Window Management
- [x] Overlay title bar style for native traffic lights
- [x] Transparent window for glass effects
- [x] Minimum window size prevents UI breakage (800x600)
- [x] Window centers on launch
- [x] Resize, minimize, fullscreen work correctly

### Native Features
- [x] Native notifications available (macOS 10.9+)
- [x] Menu bar integration detected
- [x] Dock badge capability available
- [x] System tray (menu bar) support
- [x] Power management (IOKit) available
- [x] Spotlight integration capability

### GPU Detection
- [x] Apple Silicon GPU detected via system_profiler
- [x] Metal framework support confirmed
- [x] High DPI rendering enabled for Retina

### File System Access
- [x] Profile stored at ~/.opta/
- [x] Badges stored at ~/.opta/badges/
- [x] Sessions stored at ~/.opta/sessions/
- [x] Python MCP server accessible

### Build and Compilation
- [x] Frontend builds successfully (TypeScript + Vite)
- [x] Rust backend compiles (cargo check passes)
- [x] ARM64 native build support

## Known Limitations

### macOS Intel
- [ ] Not tested in this session (ARM64 only)
- [ ] Intel builds should work via universal binary but not verified

### Native Features (Future Implementation)
- App Nap runtime control is stubbed (uses NSProcessInfo in production)
- Dock badge updates are stubbed (uses cocoa crate in production)
- Menu bar item creation is stubbed
- Notification center registration is stubbed

### Glass Effects
- Backdrop blur requires WebKit (-webkit-backdrop-filter)
- May have reduced vibrancy on older macOS versions

### Window Behavior
- Overlay title bar style moves traffic lights; app content must account for 28px top spacing
- Transparent window required for backdrop-filter to work through window chrome

## Workarounds

### Traffic Light Spacing
Use the `.titlebar-drag-region` CSS class for areas that should be draggable:
```css
.titlebar-drag-region {
  -webkit-app-region: drag;
  height: 28px;
}
```

### Reduced Motion
CSS respects `prefers-reduced-motion` media query - all custom animations disabled when user preference is set.

### Vibrancy Fallback
Glass effects use standard backdrop-filter with -webkit- prefix fallback for Safari/WebKit.

## Performance Notes

- Build time: ~1.8s for frontend production build
- Bundle size: ~1.4MB total (gzipped ~400KB)
- Lazy loading implemented for all pages
- Vendor chunks split for better caching

## Version Information

Tested on:
- macOS: Apple Silicon (M4 Max)
- Architecture: ARM64
- Minimum supported: macOS 10.13 (High Sierra)
- Tauri: v2
- React: 19
- TypeScript: 5.x
- Vite: 7.x

---
*Last updated: 2026-01-16*
*Phase: 15-02 macOS-Specific Polish*
