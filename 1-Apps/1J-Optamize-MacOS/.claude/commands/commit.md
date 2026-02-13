# /commit - Guided Commit

Create a well-formatted commit with conventional commit style.

## Process

### 1. Check Status
```bash
git status
git diff --stat
```

Show summary:
```
CHANGES TO COMMIT
═══════════════════════════════════════════════════════════════
Modified:    5 files
Added:       2 files
Deleted:     0 files

 src/components/GameCard.tsx    | 45 ++++++++++++++++++++
 src/hooks/useGames.ts          | 23 +++++++++++
 ...
═══════════════════════════════════════════════════════════════
```

### 2. Analyze Changes

Read the changed files to understand:
- What feature/fix was implemented
- The scope of changes
- Any breaking changes

### 3. Draft Commit Message

Use conventional commit format:
```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `style` - Formatting, no code change
- `test` - Adding tests
- `chore` - Maintenance tasks

### 4. Present for Approval

```
PROPOSED COMMIT
═══════════════════════════════════════════════════════════════
feat(games): add game detection and optimization preview

- Implement GameCard component with glass styling
- Add useGames hook for game library management
- Create GameOptimizationPreview for settings display

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
═══════════════════════════════════════════════════════════════

Approve? (y/edit/n)
```

### 5. Execute Commit

If approved:
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(games): add game detection and optimization preview

- Implement GameCard component with glass styling
- Add useGames hook for game library management
- Create GameOptimizationPreview for settings display

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### 6. Confirm

```
COMMITTED
═══════════════════════════════════════════════════════════════
Hash:    abc1234
Message: feat(games): add game detection and optimization preview
Files:   7 changed, 245 insertions(+), 12 deletions(-)
═══════════════════════════════════════════════════════════════

Push to remote? (y/n)
```

## Options

- `--push` or `-p`: Auto-push after commit
- `--amend` or `-a`: Amend previous commit (with safety checks)

## Safety

- Never commit .env, credentials, or secrets
- Warn if committing large binary files
- Verify no debug code (console.log) in production code
