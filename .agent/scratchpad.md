# Ralph Scratchpad - Opta Native Performance Debug

## Current Tasks

- [x] **COMPLETED**: Fix opta-mcp sidecar spam
  - Added try/except to all Python scripts for graceful failure
  - Added one-time warning flag in conflicts.rs
  - Scripts now return default values when opta_mcp unavailable

- [x] **COMPLETED**: Fix Onboarding rendering issue
  - Added explicit animation transition to AnimatePresence content
  - Content now properly animates in

- [x] **COMPLETED**: Improve window responsiveness for ultrawide
  - Updated tauri.conf.json with larger default size (1400x900)
  - Added explicit resizable/maximizable flags
  - Removed max width/height restrictions

## Remaining Tasks

- [x] Test app performance after fixes ✅
- [ ] Verify 60fps rendering (requires gameplay testing)
- [ ] Test memory usage and potential leaks (requires extended use)

## Previous Session (Ring Debug) - COMPLETED ✅

- [x] Debug and verify Ring Design is complete and working
- [x] Fixed GLSL shader errors (function ordering, reserved words)
- [x] Verified all Ring animation phases working

## Notes

- Production build at `/Applications/Opta.app`
- Running on Apple Silicon (aarch64-apple-darwin)
- Version 6.0.0
