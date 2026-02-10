# /perfect - Perfectionist Code Audit

Launch a comprehensive, meticulous code audit using the perfectionist-code-auditor agent.

## Usage

```
/perfect              # Audit recent changes (git diff)
/perfect [scope]      # Audit specific scope
```

## Scopes

| Scope | Description |
|-------|-------------|
| `recent` | Unstaged git changes (default) |
| `staged` | Staged changes only |
| `branch` | All changes on current branch vs main |
| `file:path` | Specific file or directory |
| `component:name` | Named component and its dependencies |
| `phase` | Current GSD phase work |
| `full` | Complete codebase audit (use sparingly) |

## Examples

```bash
/perfect                           # Audit what you just wrote
/perfect staged                    # Pre-commit audit
/perfect file:src/components/      # Audit all components
/perfect component:OptaRing        # Deep dive on OptaRing
/perfect branch                    # Full branch review before PR
```

## Process

### 1. Determine Scope
Parse the argument to identify which files/changes to audit.

### 2. Launch Agent
Use the Task tool to launch the `perfectionist-code-auditor` agent with:
- The identified scope
- Project context (CLAUDE.md, DESIGN_SYSTEM.md)
- Instruction to use the agent's 6-phase methodology

### 3. Agent Performs Audit
The agent systematically examines:
1. **Structural Analysis** - Architecture, dependencies, modularity
2. **Code Quality** - Naming, types, errors, edge cases, duplication
3. **Performance** - Bottlenecks, memory, optimizations
4. **Security** - Input validation, data exposure, injection risks
5. **Standards** - Design system, project conventions, best practices
6. **Maintainability** - Documentation, complexity, testability

### 4. Deliver Report
Agent produces a structured report with:
- Critical, Important, and Minor issues (with file:line references)
- Strengths observed
- Quality metrics and score
- Prioritized action plan

## Output Format

**Uses GenUI** - Generates an HTML report saved to `/tmp/genui_audit_{timestamp}.html` and opens in browser.

The GenUI report includes:
- **Header**: Scope, file count, quality score badge
- **Critical Issues Card**: Red-highlighted issues with file:line references
- **Important Issues Card**: Yellow-highlighted maintainability concerns
- **Minor Issues Card**: Blue-highlighted polish items
- **Strengths Card**: Green-highlighted good patterns observed
- **Metrics Dashboard**: Issue counts, quality score visualization
- **Action Plan Table**: Prioritized fix list with checkboxes

After generating the HTML report, also output a brief console summary:

```
Audit complete. Report: /tmp/genui_audit_{timestamp}.html

Summary: X critical, Y important, Z minor | Score: X/10
Fix issues? (y/n) or pick specific: (1, 2, 3...)
```

## Post-Audit Options

After the audit completes:
- **Fix all** - Apply all recommended fixes
- **Fix critical** - Only fix critical issues
- **Pick** - Choose specific issues to fix by number
- **Skip** - Review only, no fixes

## Flags

| Flag | Description |
|------|-------------|
| `--design-only` | Focus only on DESIGN_SYSTEM.md compliance |
| `--perf-only` | Focus only on performance issues |
| `--no-fix` | Report only, don't offer fixes |
| `--quick` | Faster audit, less exhaustive |

## When to Use

- **Before committing** - Catch issues before they enter git
- **Before PR** - Ensure branch is production-ready
- **After implementing feature** - Verify quality of new code
- **When something feels off** - Find hidden issues
- **Pre-release** - Final quality gate

## Integration

Pairs well with:
- `/build` - Run after audit passes
- `/commit` - Commit only after audit passes
- `/improve` - Use audit findings as improvement input

## Notes

- Uses Opus model for maximum analytical depth
- Respects CLAUDE.md and DESIGN_SYSTEM.md as authority
- Reports are actionable—every issue has a fix path
- Quality score provides objective measure of code health
