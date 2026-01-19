# /oddmg - Opta DMG Debugger

Debug the Opta DMG and macOS native launchers. Ensures build configuration is correct and up to date.

## Trigger
- User runs `/oddmg`
- User asks about DMG build issues
- User wants to build/debug the macOS app

## Execution Steps

### Phase 1: Configuration Audit

Run these checks in sequence:

1. **Version Sync Check**
   ```bash
   # Check version consistency across files
   echo "=== Version Check ===" && \
   grep '"version"' src-tauri/tauri.conf.json && \
   grep 'version =' src-tauri/Cargo.toml | head -1 && \
   grep 'CFBundleVersion' src-tauri/Info.plist && \
   grep '"version"' package.json | head -1
   ```

2. **DMG Assets Check**
   ```bash
   echo "=== DMG Assets ===" && \
   ls -la src-tauri/dmg/ && \
   file src-tauri/dmg/background.png
   ```

3. **Icon Assets Check**
   ```bash
   echo "=== Icon Assets ===" && \
   ls -la src-tauri/icons/ && \
   file src-tauri/icons/icon.icns
   ```

4. **Entitlements Validation**
   ```bash
   echo "=== Entitlements ===" && \
   plutil -lint src-tauri/entitlements.plist && \
   echo "Valid ✓"
   ```

5. **Info.plist Validation**
   ```bash
   echo "=== Info.plist ===" && \
   plutil -lint src-tauri/Info.plist && \
   echo "Valid ✓"
   ```

### Phase 2: Dependency Check

1. **Rust Toolchain**
   ```bash
   echo "=== Rust Toolchain ===" && \
   rustc --version && \
   cargo --version && \
   rustup target list --installed | grep darwin
   ```

2. **Tauri CLI**
   ```bash
   echo "=== Tauri CLI ===" && \
   npx tauri --version
   ```

3. **Node/npm**
   ```bash
   echo "=== Node/npm ===" && \
   node --version && \
   npm --version
   ```

### Phase 3: Build Test

1. **Frontend Build**
   ```bash
   echo "=== Frontend Build ===" && \
   npm run build 2>&1 | tail -10
   ```

2. **Tauri Build (Debug)**
   ```bash
   echo "=== Tauri Debug Build ===" && \
   npx tauri build --debug 2>&1 | tail -30
   ```

### Phase 4: DMG Verification

After build completes:

1. **Check Output**
   ```bash
   echo "=== Build Output ===" && \
   ls -la src-tauri/target/release/bundle/dmg/ 2>/dev/null || echo "No DMG yet" && \
   ls -la src-tauri/target/release/bundle/macos/ 2>/dev/null || echo "No .app yet"
   ```

2. **Verify App Bundle**
   ```bash
   # Check app bundle structure
   APP_PATH="src-tauri/target/release/bundle/macos/Opta.app"
   if [ -d "$APP_PATH" ]; then
       echo "=== App Bundle ===" && \
       ls -la "$APP_PATH/Contents/" && \
       plutil -lint "$APP_PATH/Contents/Info.plist" && \
       codesign -dv "$APP_PATH" 2>&1 | head -10
   fi
   ```

### Phase 5: Issue Detection

Check for common issues:

1. **Missing External Binaries**
   ```bash
   echo "=== External Binaries ===" && \
   ls -la src-tauri/binaries/ && \
   file src-tauri/binaries/opta-mcp-* 2>/dev/null || echo "WARNING: opta-mcp binary not found"
   ```

2. **Cargo.toml Target**
   ```bash
   echo "=== Build Target ===" && \
   grep -A5 '\[target.aarch64-apple-darwin\]' src-tauri/Cargo.toml
   ```

3. **Environment Variables**
   ```bash
   echo "=== Environment ===" && \
   echo "MACOSX_DEPLOYMENT_TARGET: ${MACOSX_DEPLOYMENT_TARGET:-not set}" && \
   xcode-select -p
   ```

## Common Issues & Fixes

### Issue: Version Mismatch
**Symptom**: Different versions in tauri.conf.json, Cargo.toml, Info.plist, package.json
**Fix**: Sync all version numbers to match

### Issue: Missing DMG Background
**Symptom**: DMG builds but has no custom background
**Fix**: Ensure `src-tauri/dmg/background.png` exists and is 660x400 pixels

### Issue: Code Signing Failures
**Symptom**: `codesign` errors during build
**Fix**: Check entitlements.plist is valid and signingIdentity is set to "-" for local builds

### Issue: App Not Launching
**Symptom**: DMG installs but app crashes on launch
**Fix**:
1. Check Console.app for crash logs
2. Verify all external binaries have execute permissions
3. Check entitlements match required capabilities

### Issue: "App is damaged" Warning
**Symptom**: macOS says app is damaged and can't be opened
**Fix**:
```bash
xattr -cr /Applications/Opta.app
```

## Output Format

Present results as:

```
╔══════════════════════════════════════════════════════════╗
║                    OPTA DMG DEBUGGER                     ║
╠══════════════════════════════════════════════════════════╣
║ Version: 6.0.0                                           ║
║ Target: aarch64-apple-darwin (Apple Silicon)             ║
║ macOS Min: 12.0 (Monterey)                               ║
╠══════════════════════════════════════════════════════════╣
║ CHECKS                                                   ║
╠══════════════════════════════════════════════════════════╣
║ ✓ Version sync          All files match                  ║
║ ✓ DMG assets            background.png (660x400)         ║
║ ✓ Icon assets           icon.icns found                  ║
║ ✓ Entitlements          Valid plist                      ║
║ ✓ Info.plist            Valid plist                      ║
║ ✓ Rust toolchain        1.xx.x (aarch64)                 ║
║ ✓ External binaries     opta-mcp found                   ║
╠══════════════════════════════════════════════════════════╣
║ BUILD STATUS                                             ║
╠══════════════════════════════════════════════════════════╣
║ Frontend: ✓ Built successfully                           ║
║ Tauri:    ✓ Compiled                                     ║
║ DMG:      ✓ Created at target/release/bundle/dmg/        ║
╚══════════════════════════════════════════════════════════╝
```

## Quick Commands

After debugging, suggest:
- `o-build` - Full production build
- `npx tauri build` - Tauri build only
- `npx tauri build --debug` - Debug build (faster)
- `open src-tauri/target/release/bundle/dmg/` - Open DMG output folder
