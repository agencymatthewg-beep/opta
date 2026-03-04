# Duplication Matrix (2026-03)

## Confirmed duplicate groups (content hash)
1. `1P-Opta-Code-Universal/src-tauri/gen/schemas/desktop-schema.json`
   = `1P-Opta-Code-Universal/src-tauri/gen/schemas/macOS-schema.json`
   - Size: 129,753 bytes each
   - Impact: generated artifact duplication; maintenance/noise cost.

2. `1M-Opta-LMX/ANALYSIS-REPORT.md`
   = `1M-Opta-LMX/docs/research/artifacts/ANALYSIS-REPORT.md`
   - Size: 18,152 bytes each
   - Impact: documentation drift risk from duplicated authoritative text.

## Functional duplication patterns (non-identical but overlapping)
- 1P has both local runtime client wrappers and shared package types (`@opta/daemon-client/types`) which can diverge if not pinned tightly.
- 1D + 1P each maintain operation/UI mapping metadata for parity; drift already visible via unmatched op signal.

## Recommendations (not applied)
- Generated artifacts: keep one canonical schema output + symlink/copy-on-build strategy.
- Duplicate docs: retain one canonical report location; replace duplicate with backlink pointer.
- Add duplication check CI (`hash scan`) for non-generated markdown/json under docs + contracts.
