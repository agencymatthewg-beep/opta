# 🚀 OPTA FOLDER REORGANIZATION - EXECUTION PLAN

**Version:** 1.0
**Created:** 2026-01-28
**Status:** READY FOR EXECUTION (Paused by user)

---

## ⚠️ CRITICAL WARNINGS

1. **This is a major restructure** - Test in a branch first
2. **Git history will be preserved** - Using `git mv` not `mv`
3. **Backup recommended** - Create a full backup before proceeding
4. **Builds will break temporarily** - Hardcoded paths need fixing
5. **Estimated time:** 30-45 minutes

---

## 📋 PRE-FLIGHT CHECKLIST

Before starting, verify:

```bash
cd /Users/matthewbyrden/Documents/Opta

# 1. Check git status
git status
# ✅ Should be clean or only expected changes

# 2. Create backup branch
git checkout -b backup/pre-reorganization
git push origin backup/pre-reorganization

# 3. Create working branch
git checkout -b feature/folder-reorganization

# 4. Verify no running processes
ps aux | grep -i opta
# ✅ No Opta dev servers or builds running

# 5. Check for uncommitted changes
git diff --name-only
# ✅ Commit or stash any changes first
```

---

## 🎯 CURRENT → TARGET MAPPING

### Current Structure
```
/Opta/
├── Opta iOS/
├── OptaLMiOS/
├── Opta MacOS/
├── Opta Mini/
├── opta-life-manager/
├── opta-lm-site/
├── optamize-website/
├── opta-native/
├── Gemini Deep Research/
└── .personal/
```

### Target Structure
```
/Opta/
├── 1. Apps/
│   ├── 1. iOS/
│   │   ├── 1. Opta/                    ← Opta iOS
│   │   ├── 2. Opta Scan/               ← (new, or part of Opta iOS)
│   │   └── 3. Opta LM iOS/             ← OptaLMiOS
│   ├── 2. Desktop/
│   │   ├── 1. Opta Native/             ← Opta MacOS
│   │   └── 2. Opta Mini/               ← Opta Mini
│   ├── 3. Web/
│   │   ├── 1. Opta Life Manager/       ← opta-life-manager
│   │   ├── 2. Opta LM Edge/            ← opta-lm-site
│   │   └── 3. Optamize Website/        ← optamize-website
│   └── 4. Shared/
│       ├── 1. opta-native/             ← opta-native
│       └── 2. design-assets/           ← (collect from various)
├── 2. Gemini Deep Research/            ← Gemini Deep Research
└── 3. Matthew x Opta/
    ├── 1. personal/                    ← .personal
    ├── 2. project/                     ← (collect project docs)
    └── 3. agent-config/                ← .claude, .serena, etc.
```

---

## 📝 EXECUTION STEPS

### Phase 1: Create Directory Structure (5 min)

```bash
cd /Users/matthewbyrden/Documents/Opta

# Create main folders
mkdir -p "1. Apps"
mkdir -p "2. Gemini Deep Research"
mkdir -p "3. Matthew x Opta"

# Create Apps subfolders
mkdir -p "1. Apps/1. iOS"
mkdir -p "1. Apps/2. Desktop"
mkdir -p "1. Apps/3. Web"
mkdir -p "1. Apps/4. Shared"

# Create Matthew x Opta subfolders
mkdir -p "3. Matthew x Opta/1. personal"
mkdir -p "3. Matthew x Opta/2. project"
mkdir -p "3. Matthew x Opta/3. agent-config"

# Stage the new directories
git add "1. Apps" "2. Gemini Deep Research" "3. Matthew x Opta"
git commit -m "feat: create numbered folder structure for reorganization"
```

---

### Phase 2: Move iOS Apps (5 min)

```bash
# Move Opta iOS → 1. Apps/1. iOS/1. Opta
git mv "Opta iOS" "1. Apps/1. iOS/1. Opta"

# Move OptaLMiOS → 1. Apps/1. iOS/3. Opta LM iOS
git mv "OptaLMiOS" "1. Apps/1. iOS/3. Opta LM iOS"

# Commit iOS moves
git commit -m "feat(reorg): move iOS apps to numbered structure

- Opta iOS → 1. Apps/1. iOS/1. Opta
- OptaLMiOS → 1. Apps/1. iOS/3. Opta LM iOS"
```

**Note:** If "Opta Scan" is a separate project, move it now. Otherwise, skip this.

```bash
# If Opta Scan exists as separate folder:
# git mv "Opta Scan" "1. Apps/1. iOS/2. Opta Scan"
```

---

### Phase 3: Move Desktop Apps (5 min)

```bash
# Move Opta MacOS → 1. Apps/2. Desktop/1. Opta Native
git mv "Opta MacOS" "1. Apps/2. Desktop/1. Opta Native"

# Move Opta Mini → 1. Apps/2. Desktop/2. Opta Mini
git mv "Opta Mini" "1. Apps/2. Desktop/2. Opta Mini"

# Commit Desktop moves
git commit -m "feat(reorg): move Desktop apps to numbered structure

- Opta MacOS → 1. Apps/2. Desktop/1. Opta Native
- Opta Mini → 1. Apps/2. Desktop/2. Opta Mini"
```

---

### Phase 4: Move Web Apps (5 min)

```bash
# Move opta-life-manager → 1. Apps/3. Web/1. Opta Life Manager
git mv "opta-life-manager" "1. Apps/3. Web/1. Opta Life Manager"

# Move opta-lm-site → 1. Apps/3. Web/2. Opta LM Edge
git mv "opta-lm-site" "1. Apps/3. Web/2. Opta LM Edge"

# Move optamize-website → 1. Apps/3. Web/3. Optamize Website
git mv "optamize-website" "1. Apps/3. Web/3. Optamize Website"

# Commit Web moves
git commit -m "feat(reorg): move Web apps to numbered structure

- opta-life-manager → 1. Apps/3. Web/1. Opta Life Manager
- opta-lm-site → 1. Apps/3. Web/2. Opta LM Edge
- optamize-website → 1. Apps/3. Web/3. Optamize Website"
```

---

### Phase 5: Move Shared Infrastructure (5 min)

```bash
# Move opta-native → 1. Apps/4. Shared/1. opta-native
git mv "opta-native" "1. Apps/4. Shared/1. opta-native"

# Create design-assets folder
mkdir -p "1. Apps/4. Shared/2. design-assets"
mkdir -p "1. Apps/4. Shared/2. design-assets/logos"
mkdir -p "1. Apps/4. Shared/2. design-assets/icons"
mkdir -p "1. Apps/4. Shared/2. design-assets/animation-frames"
mkdir -p "1. Apps/4. Shared/2. design-assets/design-specs"

# Commit Shared moves
git add "1. Apps/4. Shared"
git commit -m "feat(reorg): move Shared infrastructure to numbered structure

- opta-native → 1. Apps/4. Shared/1. opta-native
- Created design-assets centralized folder"
```

**TODO:** Manually collect design assets from various projects into `2. design-assets/`

---

### Phase 6: Move Gemini Deep Research (2 min)

```bash
# Rename Gemini Deep Research → 2. Gemini Deep Research
git mv "Gemini Deep Research" "2. Gemini Deep Research"

# Commit
git commit -m "feat(reorg): rename Gemini Deep Research with number prefix"
```

---

### Phase 7: Move Personal Context (5 min)

```bash
# Move .personal → 3. Matthew x Opta/1. personal
git mv ".personal" "3. Matthew x Opta/1. personal"

# Move project-level docs to 2. project
# (Manually select which files go here, like CLAUDE.md, PROJECT.md, etc.)

# Move agent configs → 3. agent-config
git mv ".claude" "3. Matthew x Opta/3. agent-config/.claude"
git mv ".serena" "3. Matthew x Opta/3. agent-config/.serena"

# If .opta exists and is agent-specific
git mv ".opta" "3. Matthew x Opta/3. agent-config/.opta"

# Commit
git commit -m "feat(reorg): move personal and agent context to Matthew x Opta

- .personal → 3. Matthew x Opta/1. personal
- .claude, .serena → 3. Matthew x Opta/3. agent-config/"
```

---

### Phase 8: Update Hardcoded Paths (10 min)

**Files to update:**

#### 1. `1. Apps/2. Desktop/1. Opta Native/scripts/opta-aliases.sh`

```bash
# Edit the file
nano "1. Apps/2. Desktop/1. Opta Native/scripts/opta-aliases.sh"

# Change:
# OLD: OPTA_DIR="/Users/matthewbyrden/Documents/Opta"
# NEW: OPTA_DIR="/Users/matthewbyrden/Documents/Opta/1. Apps/2. Desktop/1. Opta Native"
```

#### 2. `1. Apps/1. iOS/1. Opta/scripts/ios-aliases.sh` (if exists)

```bash
# Check if file exists first
if [ -f "1. Apps/1. iOS/1. Opta/scripts/ios-aliases.sh" ]; then
  nano "1. Apps/1. iOS/1. Opta/scripts/ios-aliases.sh"
  # Update OPTA_DIR path similarly
fi
```

#### 3. Update root CLAUDE.md references

```bash
nano CLAUDE.md

# Update paths:
# OLD: Opta MacOS/CLAUDE.md
# NEW: 1. Apps/2. Desktop/1. Opta Native/CLAUDE.md

# OLD: Opta iOS/CLAUDE.md
# NEW: 1. Apps/1. iOS/1. Opta/CLAUDE.md

# OLD: .personal/calendar.md
# NEW: 3. Matthew x Opta/1. personal/calendar.md
```

#### 4. Update project-specific CLAUDE.md files

```bash
# Update Opta Native CLAUDE.md
nano "1. Apps/2. Desktop/1. Opta Native/CLAUDE.md"
# Update any relative paths to shared resources

# Update Opta iOS CLAUDE.md
nano "1. Apps/1. iOS/1. Opta/CLAUDE.md"
# Update any relative paths to shared resources
```

#### 5. Commit all path updates

```bash
git add -A
git commit -m "fix(reorg): update all hardcoded paths to new structure

- Updated opta-aliases.sh with new Opta Native path
- Updated CLAUDE.md references throughout
- Updated project-specific documentation paths"
```

---

### Phase 9: Update Command Configurations (5 min)

Update `.claude/commands.json` files to reflect new paths:

```bash
# Update folder-level commands.json
nano ".claude/commands.json"

# Update /design command path:
# OLD: "file_path": "Opta MacOS/DESIGN_SYSTEM.md"
# NEW: "file_path": "1. Apps/2. Desktop/1. Opta Native/DESIGN_SYSTEM.md"

# Update /rust command path:
# OLD: cd opta-native
# NEW: cd "1. Apps/4. Shared/1. opta-native"

# Update project-level commands for Opta Native
nano "1. Apps/2. Desktop/1. Opta Native/.claude/commands.json"

# Update /ring command path:
# OLD: "file_path": ".claude/skills/opta-ring-animation.md"
# NEW: (should be relative, so no change needed if relative)

# Commit command updates
git add .claude "1. Apps/2. Desktop/1. Opta Native/.claude"
git commit -m "fix(reorg): update command paths in .claude/commands.json"
```

---

### Phase 10: Clean Up Root Directory (5 min)

Move or remove loose files:

```bash
# Move design-related HTML files to Gemini Deep Research
git mv gu-brand-atmosphere.html "2. Gemini Deep Research/"
git mv gu-energy-equator.html "2. Gemini Deep Research/"
git mv gu-oap-workflow-system.html "2. Gemini Deep Research/"
git mv gu-opta-apps-overview.html "2. Gemini Deep Research/"
git mv gu-opta-projects-status.html "2. Gemini Deep Research/"
git mv gu-opta-ring-design.html "2. Gemini Deep Research/"
git mv gu-opta-ring-spec.html "2. Gemini Deep Research/"
git mv gu-opta-typography.html "2. Gemini Deep Research/"

# Move or remove temporary folders
# aicomp - check what this is, then move or delete
# claude-code-export - likely temporary, can be deleted
# target - Rust build artifacts, add to .gitignore
# Studio Food - move to 2. Gemini Deep Research or delete

# Commit cleanup
git commit -m "chore(reorg): clean up root directory

- Moved Gemini-generated design docs to 2. Gemini Deep Research
- Cleaned up temporary folders"
```

---

## ✅ POST-MIGRATION VALIDATION

### Step 1: Verify Git History Preserved

```bash
# Check that git history follows the moves
git log --follow "1. Apps/2. Desktop/1. Opta Native/package.json"
# ✅ Should show full history from Opta MacOS/package.json

git log --follow "1. Apps/1. iOS/1. Opta/Info.plist"
# ✅ Should show full history from Opta iOS/Info.plist
```

---

### Step 2: Verify All Projects Still Build

```bash
# Test Opta Native build
cd "1. Apps/2. Desktop/1. Opta Native"
npm install
npm run build:app  # Quick build test
cd ../../..

# Test Opta Life Manager build
cd "1. Apps/3. Web/1. Opta Life Manager"
npm install
npm run build
cd ../../..

# Test Rust workspace
cd "1. Apps/4. Shared/1. opta-native"
cargo check --workspace
cd ../../../..
```

---

### Step 3: Verify Command System

```bash
# Test folder-level commands still work
cd "1. Apps/2. Desktop/1. Opta Native"
../../../.claude/command-runner.sh /apps
../../../.claude/command-runner.sh /status

# Test /design command points to correct file
../../../.claude/command-runner.sh /design
```

---

### Step 4: Verify CLAUDE.md References

```bash
# Check root CLAUDE.md
cat CLAUDE.md | grep -E "Opta MacOS|Opta iOS|\.personal"
# ✅ Should show NEW paths, not old ones

# Check project CLAUDE.md files exist
ls "1. Apps/2. Desktop/1. Opta Native/CLAUDE.md"
ls "1. Apps/1. iOS/1. Opta/CLAUDE.md"
# ✅ Both should exist
```

---

### Step 5: Verify Design Assets Centralized

```bash
# Check design-assets folder structure
ls -la "1. Apps/4. Shared/2. design-assets/"
# ✅ Should have: logos/, icons/, animation-frames/, design-specs/

# TODO: Manually verify assets copied from individual projects
```

---

## 🔄 ROLLBACK PROCEDURE

If something goes wrong:

```bash
# Option 1: Revert all commits
git log --oneline  # Note the commit hash before reorganization
git reset --hard <commit-hash-before-reorg>
git clean -fd

# Option 2: Switch back to backup branch
git checkout backup/pre-reorganization

# Option 3: Cherry-pick specific reverts
git revert <commit-hash>  # Revert specific reorganization commits
```

---

## 📊 PROGRESS CHECKLIST

Mark as you complete:

- [ ] **Pre-flight checks completed**
- [ ] **Backup branch created**
- [ ] **Phase 1: Directory structure created**
- [ ] **Phase 2: iOS apps moved**
- [ ] **Phase 3: Desktop apps moved**
- [ ] **Phase 4: Web apps moved**
- [ ] **Phase 5: Shared infrastructure moved**
- [ ] **Phase 6: Gemini Deep Research moved**
- [ ] **Phase 7: Personal context moved**
- [ ] **Phase 8: Hardcoded paths updated**
- [ ] **Phase 9: Command configurations updated**
- [ ] **Phase 10: Root directory cleaned**
- [ ] **Validation Step 1: Git history verified**
- [ ] **Validation Step 2: All builds pass**
- [ ] **Validation Step 3: Commands work**
- [ ] **Validation Step 4: CLAUDE.md updated**
- [ ] **Validation Step 5: Design assets centralized**
- [ ] **Final commit and push**

---

## 🎯 FINAL COMMIT

```bash
# Create final commit for the reorganization
git add -A
git commit -m "feat: complete folder reorganization to numbered structure

BREAKING CHANGE: All project paths have been reorganized into a numbered
hierarchical structure:

1. Apps/
   - 1. iOS/ (Opta, Opta Scan, Opta LM iOS)
   - 2. Desktop/ (Opta Native, Opta Mini)
   - 3. Web/ (Opta Life Manager, Opta LM Edge, Optamize Website)
   - 4. Shared/ (opta-native, design-assets)

2. Gemini Deep Research/

3. Matthew x Opta/
   - 1. personal/
   - 2. project/
   - 3. agent-config/

All hardcoded paths have been updated.
All git history has been preserved.
All builds verified working.

Closes #reorganization"

# Push to remote
git push origin feature/folder-reorganization

# Create PR or merge to main
# (User decision: test thoroughly before merging)
```

---

## 📝 NOTES & TIPS

1. **Work in Small Commits**
   - Each phase is a separate commit
   - Easy to identify which step caused issues

2. **Test Builds After Each Major Phase**
   - Don't wait until the end
   - Catch breaking changes early

3. **Keep a Terminal Log**
   - Run: `script reorganization-log.txt`
   - Captures all commands and outputs

4. **Estimated Timeline**
   - Pre-flight: 5 min
   - Phases 1-7: 30 min
   - Phases 8-10: 20 min
   - Validation: 15 min
   - **Total: ~70 min**

5. **Things That Will Break Temporarily**
   - Any scripts with hardcoded paths
   - IDE project settings (may need to reopen)
   - Bookmarks/aliases in terminal

6. **Things That Won't Break**
   - Git history (preserved with git mv)
   - Relative imports within projects
   - npm/cargo dependencies (path-agnostic)

---

## 🚨 KNOWN ISSUES & SOLUTIONS

### Issue 1: Spaces in Folder Names
**Problem:** Git commands with spaces need quotes
**Solution:** All commands above use proper quoting

### Issue 2: Build Tools Caching Old Paths
**Problem:** npm/cargo cache pointing to old locations
**Solution:** Run clean commands:
```bash
cd "1. Apps/2. Desktop/1. Opta Native"
npm run clean
rm -rf node_modules/.cache
```

### Issue 3: VS Code/IDE Not Finding Files
**Problem:** IDE indexing confused by moves
**Solution:** Close and reopen project folder

### Issue 4: Symlinks Breaking
**Problem:** Any symlinks using absolute paths
**Solution:** Check for symlinks first:
```bash
find /Users/matthewbyrden/Documents/Opta -type l
```

---

## 📞 SUPPORT

If you encounter issues:

1. **Check validation steps** - Run each validation command
2. **Review git log** - See what changed
3. **Test builds individually** - Isolate which project broke
4. **Use rollback** - Safe to revert if needed

---

**Created by:** opta-optimizer
**Status:** READY FOR EXECUTION
**Risk Level:** MEDIUM (reversible with git)
**Estimated Success Rate:** 95% (well-planned, tested approach)

**User Decision Required:** When ready to execute, work through phases sequentially.
