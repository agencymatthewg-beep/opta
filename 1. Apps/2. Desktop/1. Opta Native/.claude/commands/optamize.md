# /Optamize - Perfectionist Codebase Optimization Loop

Run a comprehensive, iterative optimization loop on the Opta codebase until ALL errors, concerns, issues, and incomplete parts are fully resolved in a perfectionist manner.

## Usage

```
/Optamize                    # Full codebase optimization (default)
/Optamize [scope]            # Optimize specific scope
/Optamize --max-iterations N # Override max iterations (default: 30)
```

## Process Overview

This command implements the **Atpo-Opta Cycle**:
1. **Atpo Phase** (Analysis): Comprehensive code audit identifying ALL issues
2. **Opta Phase** (Optimization): Systematic fixes for identified issues
3. **Validation Phase**: Build, type-check, verify fixes
4. **Repeat** until perfection achieved or max iterations reached

---

## Execution Flow

### 1. Initialize Loop State

Create/update `.agent/optamize-state.md`:

```markdown
# Optamize Session State

**Started**: [timestamp]
**Max Iterations**: 30
**Current Iteration**: 0
**Status**: RUNNING

## Iteration History
| # | Issues Found | Issues Fixed | Build | Notes |
|---|--------------|--------------|-------|-------|

## Outstanding Issues
[List of remaining issues]

## Completed Fixes
[List of fixes applied]
```

### 2. Gather Codebase Context

Read essential context files (in parallel):
- `.planning/STATE.md` - Current project status
- `.planning/PROJECT.md` - Requirements and constraints
- `/DESIGN_SYSTEM.md` - Design compliance rules
- `/CLAUDE.md` - Project instructions

Run initial diagnostics:
```bash
npm run build 2>&1
npx tsc --noEmit 2>&1
git status
```

### 3. Enter Optimization Loop

```
FOR iteration = 1 TO 30:

    === ATPO PHASE (Analysis) ===

    1. Run comprehensive code audit:
       - TypeScript errors (npx tsc --noEmit)
       - Build errors (npm run build)
       - ESLint warnings/errors
       - Design system compliance violations
       - Performance concerns
       - Security vulnerabilities
       - Code quality issues
       - Incomplete implementations
       - TODO/FIXME comments
       - Inconsistent patterns

    2. Categorize findings:
       - CRITICAL: Blocking errors, security issues
       - HIGH: Build failures, type errors
       - MEDIUM: Quality issues, warnings
       - LOW: Style, minor improvements

    3. If NO issues found:
       → EXIT LOOP (perfection achieved!)

    === OPTA PHASE (Optimization) ===

    4. Prioritize fixes by severity

    5. For each issue (highest priority first):
       - Read affected file(s)
       - Understand the context
       - Apply fix using Edit tool
       - Verify fix doesn't break other code
       - Update state tracking

    === VALIDATION PHASE ===

    6. Run validation:
       ```bash
       npx tsc --noEmit
       npm run build
       ```

    7. If validation FAILS:
       - Revert problematic changes if necessary
       - Add to issues list for next iteration

    8. Update iteration state

    9. If iteration >= 30:
       → EXIT LOOP (max iterations reached)

    CONTINUE to next iteration
```

### 4. Generate Final Report

```
OPTAMIZE COMPLETE
═══════════════════════════════════════════════════════════════════════════════

Session Summary
───────────────────────────────────────────────────────────────────────────────
Started:        [timestamp]
Completed:      [timestamp]
Duration:       [elapsed time]
Iterations:     [count] / 30
Final Status:   [PERFECTION_ACHIEVED | MAX_ITERATIONS | USER_CANCELLED]

Issue Resolution
───────────────────────────────────────────────────────────────────────────────
Total Issues Found:    [N]
Issues Resolved:       [N]
Issues Remaining:      [N]

By Severity:
  Critical:  [found] → [remaining]
  High:      [found] → [remaining]
  Medium:    [found] → [remaining]
  Low:       [found] → [remaining]

Files Modified
───────────────────────────────────────────────────────────────────────────────
[List of files with change summaries]

Quality Metrics
───────────────────────────────────────────────────────────────────────────────
TypeScript Errors:     [before] → [after]
Build Errors:          [before] → [after]
ESLint Warnings:       [before] → [after]
Design Compliance:     [score]%

Iteration Breakdown
───────────────────────────────────────────────────────────────────────────────
[Table showing issues found/fixed per iteration]

═══════════════════════════════════════════════════════════════════════════════

Next Steps:
- [ ] Review changes: git diff
- [ ] Run tests: npm test (if applicable)
- [ ] Commit: /commit
```

---

## Issue Categories to Address

### Build & Compilation
- TypeScript errors
- Module resolution failures
- Import/export issues
- Build configuration problems

### Type Safety
- `any` types that should be specific
- Missing type annotations
- Type assertion problems
- Generic type issues

### Design System Compliance
- Non-Lucide icons (inline SVGs)
- Non-Framer Motion animations
- Arbitrary colors (should be CSS variables)
- Missing glass effects
- Incorrect component patterns

### Code Quality
- Dead code / unused imports
- Code duplication
- Complex functions needing refactor
- Missing error handling
- Magic numbers/strings

### Performance
- Unnecessary re-renders
- Missing memoization
- Inefficient algorithms
- Memory leaks

### Security
- Input validation gaps
- Exposed sensitive data
- Injection vulnerabilities

### Completeness
- TODO/FIXME comments
- Incomplete implementations
- Missing features
- Stub functions

### Consistency
- Naming convention violations
- Inconsistent patterns
- Mixed coding styles

---

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--max-iterations` | 30 | Maximum loop iterations |
| `--scope` | `full` | Target scope (full, src, component:X) |
| `--severity-min` | `low` | Minimum severity to address |
| `--no-design` | false | Skip design system checks |
| `--dry-run` | false | Analyze only, no fixes |
| `--verbose` | false | Show detailed progress |

---

## State Tracking

Session state is persisted in `.agent/optamize-state.md` for:
- Progress tracking across long sessions
- Resume capability if interrupted
- Historical record of changes made

---

## Exit Conditions

The loop terminates when ANY of these conditions are met:

1. **PERFECTION_ACHIEVED**: No issues found in Atpo phase
2. **MAX_ITERATIONS**: Reached 30 iterations
3. **USER_CANCELLED**: User interrupts the process
4. **CRITICAL_FAILURE**: Unrecoverable error state

---

## Integration

After Optamize completes:
- Run `/build` to verify final state
- Run `/perfect` for a final audit (should be clean!)
- Run `/commit` to save the optimized codebase

---

## Example Session

```
> /Optamize

OPTAMIZE LOOP STARTING
═══════════════════════════════════════════════════════════════════════════════
Target:     Full Opta codebase
Max Iter:   30
Mode:       Perfectionist

Gathering codebase context...
Running initial diagnostics...

ITERATION 1
───────────────────────────────────────────────────────────────────────────────
[ATPO] Analyzing codebase...
  Found: 3 TypeScript errors, 2 design violations, 5 code quality issues

[OPTA] Fixing issues (priority order)...
  ✓ Fixed: TS error in src/components/OptaRing.tsx:45
  ✓ Fixed: TS error in src/hooks/useTelemetry.ts:23
  ✓ Fixed: TS error in src/pages/Dashboard.tsx:112
  ✓ Fixed: Replaced inline SVG with Lucide icon in Header.tsx
  ✓ Fixed: Added glass effect to Card component
  ... (5 more fixes)

[VALIDATE] Running build check...
  ✓ TypeScript: PASS
  ✓ Build: PASS

Iteration 1 complete: 10 issues found, 10 resolved

ITERATION 2
───────────────────────────────────────────────────────────────────────────────
[ATPO] Analyzing codebase...
  Found: 1 code quality issue

[OPTA] Fixing issues...
  ✓ Fixed: Removed unused import in utils.ts

[VALIDATE] Running build check...
  ✓ TypeScript: PASS
  ✓ Build: PASS

Iteration 2 complete: 1 issue found, 1 resolved

ITERATION 3
───────────────────────────────────────────────────────────────────────────────
[ATPO] Analyzing codebase...
  Found: 0 issues

PERFECTION ACHIEVED in 3 iterations!
═══════════════════════════════════════════════════════════════════════════════
```

---

## Notes

- This command may take significant time for large codebases
- Each iteration commits logical units of work to state tracking
- The perfectionist standard means addressing ALL issues, not just critical ones
- Use `--dry-run` first to see what would be addressed
- Pairs with `/perfect` for final verification
