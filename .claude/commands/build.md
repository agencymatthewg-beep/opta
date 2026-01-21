# /build - Build Pipeline

Run the full build and validation pipeline.

## Process

### 1. Frontend Build (Vite + TypeScript)
```bash
npm run build
```

### 2. Type Checking
```bash
npm run check
```
(Or `npx tsc --noEmit` if check script doesn't exist)

### 3. Rust Validation
```bash
cd src-tauri && cargo check
```

### 4. Report Results

**If all pass:**
```
BUILD RESULTS
═══════════════════════════════════════════════════════════════
Frontend:    PASS
TypeScript:  PASS
Rust:        PASS
═══════════════════════════════════════════════════════════════

Ready to commit? Run /commit
```

**If any fail:**
```
BUILD RESULTS
═══════════════════════════════════════════════════════════════
Frontend:    PASS
TypeScript:  FAIL (3 errors)
Rust:        PASS
═══════════════════════════════════════════════════════════════

ERRORS:
───────────────────────────────────────────────────────────────
src/components/GameCard.tsx:45
  Type 'string' is not assignable to type 'number'

[... additional errors ...]
───────────────────────────────────────────────────────────────

Fix these errors? (y/n)
```

### 5. Offer to Fix

If errors found and user agrees to fix:
- Analyze each error
- Propose fixes
- Apply with confirmation
- Re-run build to verify

## Quick Mode

If called with `--quick` or `-q`:
- Only run `npm run build`
- Skip type checking and Rust
- Faster for quick iterations

## Notes

- Run before committing to catch issues early
- Errors should be fixed before proceeding
- Use `/commit` after successful build
