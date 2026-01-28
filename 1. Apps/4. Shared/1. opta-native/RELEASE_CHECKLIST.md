# Opta v9.0 Release Checklist

Comprehensive checklist for releasing Opta across all platforms.

---

## Pre-Release Checks

### Code Quality

- [ ] **All tests pass**
  ```bash
  cargo test --workspace
  cargo test --workspace -- --ignored  # GPU tests
  ```

- [ ] **Clippy passes with no warnings**
  ```bash
  cargo clippy --workspace --all-targets -- -D warnings
  ```

- [ ] **Rustfmt applied**
  ```bash
  cargo fmt --all -- --check
  ```

- [ ] **Documentation builds**
  ```bash
  cargo doc --workspace --no-deps
  ```

- [ ] **No security vulnerabilities**
  ```bash
  cargo audit
  ```

### Version Verification

- [ ] Update version in `Cargo.toml` (workspace)
- [ ] Update version in `OptaApp/OptaApp/Info.plist` (currently 9.0.0)
- [ ] Update CHANGELOG.md with release notes
- [ ] Tag commit with version: `git tag v9.0.0`

### Build Verification

- [ ] **Release build succeeds**
  ```bash
  cargo build --release --workspace
  ```

- [ ] **Binary size is acceptable** (< 50MB for static lib)
  ```bash
  ./scripts/analyze-size.sh
  ```

---

## macOS Release

### Build

- [ ] Build release xcframework
  ```bash
  ./scripts/build-xcframework.sh
  ```

- [ ] Build Xcode project in Release mode
  ```bash
  xcodebuild -project OptaApp/OptaApp.xcodeproj \
    -scheme OptaApp \
    -configuration Release \
    -derivedDataPath build
  ```

- [ ] Verify app bundle structure
  ```bash
  ls -la "build/Build/Products/Release/Opta.app/Contents/"
  ```

### Code Signing & Notarization

- [ ] **Sign with Developer ID**
  ```bash
  export APPLE_ID="your@email.com"
  export TEAM_ID="XXXXXXXXXX"
  export APP_PASSWORD_ITEM="opta-notarize"
  ./scripts/notarize.sh build/Build/Products/Release/Opta.app --sign-only
  ```

- [ ] **Submit for notarization**
  ```bash
  ./scripts/notarize.sh build/Build/Products/Release/Opta.app
  ```

- [ ] **Verify notarization**
  ```bash
  spctl --assess --verbose build/Build/Products/Release/Opta.app
  ```

### App Store Submission

- [ ] Verify entitlements are correct
  ```bash
  codesign -d --entitlements :- build/Build/Products/Release/Opta.app
  ```

- [ ] Verify privacy manifest
  - Check `PrivacyInfo.xcprivacy` is included in bundle

- [ ] Verify App Store Connect compliance
  - App icon (1024x1024) - see `Assets.xcassets/AppIcon.appiconset/README.md`
  - Screenshots (all required sizes) - see `APPSTORE_METADATA.md`
  - App description and keywords
  - Privacy policy URL
  - Support URL

- [ ] **Archive and upload via script**
  ```bash
  ./scripts/archive-and-upload.sh
  ```
  Or manually via Xcode:
  - Product -> Archive
  - Distribute App -> App Store Connect
  - Wait for processing

- [ ] Submit for review in App Store Connect

### v9.0 Specific Verification

- [ ] **Games Library works correctly**
  - Game detection finds installed games
  - Game cards display properly
  - Detail view shows recommendations

- [ ] **Agent Mode functions**
  - Enable agent mode in settings
  - App minimizes to menu bar
  - Notifications appear for optimization opportunities

- [ ] **Notification permissions**
  - Request notification permissions on first launch
  - Alerts appear when CPU/GPU threshold exceeded

- [ ] **Settings profiles**
  - Create/edit/delete custom profiles
  - Profile persistence across restarts

- [ ] **Keyboard shortcuts**
  - Global shortcuts work when enabled
  - No conflicts with system shortcuts

### Direct Distribution (DMG)

- [ ] Create DMG installer
  ```bash
  # Create folder for DMG
  mkdir -p dmg-staging
  cp -R "build/Build/Products/Release/Opta.app" dmg-staging/
  ln -s /Applications dmg-staging/Applications

  # Create DMG
  hdiutil create -volname "Opta" \
    -srcfolder dmg-staging \
    -ov -format UDZO \
    "Opta-v9.0.0-macOS.dmg"
  ```

- [ ] Notarize DMG
  ```bash
  xcrun notarytool submit "Opta-v9.0.0-macOS.dmg" \
    --keychain-profile "$APP_PASSWORD_ITEM" \
    --wait
  xcrun stapler staple "Opta-v9.0.0-macOS.dmg"
  ```

---

## Windows Release

### Build

- [ ] Cross-compile for Windows or build on Windows machine
  ```bash
  ./scripts/build-windows.ps1  # On Windows
  # OR
  cargo build --release --target x86_64-pc-windows-msvc
  ```

### Code Signing

- [ ] Sign executable with Authenticode certificate
  ```powershell
  # Using signtool (Windows SDK)
  signtool sign /f certificate.pfx /p <password> /tr http://timestamp.digicert.com /td sha256 /fd sha256 Opta.exe
  ```

### Installer Creation

- [ ] Create MSI installer
  ```powershell
  # Using WiX Toolset
  candle Opta.wxs
  light Opta.wixobj -o Opta-v9.0.0-Setup.msi
  ```

- [ ] Sign MSI installer
  ```powershell
  signtool sign /f certificate.pfx /p <password> /tr http://timestamp.digicert.com /td sha256 /fd sha256 Opta-v9.0.0-Setup.msi
  ```

### Verification

- [ ] Test installation on clean Windows VM
- [ ] Verify GPU rendering works (DirectX 12)
- [ ] Test Windows Defender doesn't flag it
- [ ] Verify auto-update mechanism (if applicable)

---

## Linux Release

### Build

- [ ] Build for Linux targets
  ```bash
  ./scripts/build-linux.sh
  # OR
  cargo build --release --target x86_64-unknown-linux-gnu
  ```

### AppImage Creation

- [ ] Create AppImage
  ```bash
  # Using linuxdeploy
  linuxdeploy --appdir AppDir \
    --executable target/release/opta \
    --desktop-file opta.desktop \
    --icon-file opta.png \
    --output appimage
  ```

- [ ] Make AppImage executable and test
  ```bash
  chmod +x Opta-v9.0.0-x86_64.AppImage
  ./Opta-v9.0.0-x86_64.AppImage
  ```

### Package Formats

- [ ] Create .deb package (Debian/Ubuntu)
  ```bash
  dpkg-deb --build opta-package Opta-v9.0.0.deb
  ```

- [ ] Create .rpm package (Fedora/RHEL)
  ```bash
  rpmbuild -ba opta.spec
  ```

- [ ] Create Flatpak (optional)
  ```bash
  flatpak-builder build-dir com.opta.Opta.yaml
  ```

### Verification

- [ ] Test on Ubuntu 22.04 LTS
- [ ] Test on Fedora (latest)
- [ ] Verify Vulkan rendering works
- [ ] Check library dependencies are bundled

---

## Performance Verification

### macOS

- [ ] **Launch time** < 2 seconds
  ```bash
  time open -a Opta --args --measure-startup
  ```

- [ ] **Memory usage** < 100MB idle
  - Open Activity Monitor
  - Filter for "Opta"
  - Check Real Memory column

- [ ] **GPU rendering smooth** (120fps on ProMotion)
  - Open app on ProMotion display
  - Check for frame drops using Performance HUD

- [ ] **CPU usage** < 5% idle
  - Monitor in Activity Monitor

### All Platforms

- [ ] Telemetry collection works correctly
- [ ] Process list populates
- [ ] Optimization features function
- [ ] Settings persist across restarts
- [ ] Ring animation is smooth
- [ ] Haptics work (macOS)

---

## Final Release Steps

### GitHub Release

- [ ] Create GitHub release from tag
  ```bash
  gh release create v9.0.0 \
    --title "Opta v9.0.0 - Native SwiftUI + Metal" \
    --notes-file RELEASE_NOTES.md \
    "Opta-v9.0.0-macOS.dmg" \
    "Opta-v9.0.0-Setup.msi" \
    "Opta-v9.0.0-x86_64.AppImage"
  ```

### Documentation

- [ ] Update README with new features
- [ ] Update installation instructions
- [ ] Publish API documentation (if applicable)

### Communication

- [ ] Announce on social media
- [ ] Update website/landing page
- [ ] Notify beta testers
- [ ] Send newsletter (if applicable)

### Post-Release

- [ ] Monitor crash reports
- [ ] Check App Store reviews
- [ ] Respond to user feedback
- [ ] Plan hotfix if critical issues found

---

## Rollback Plan

If critical issues are discovered post-release:

1. **Immediate Actions**
   - Remove download links from website
   - Halt App Store distribution (if possible)
   - Post incident notice

2. **For macOS Direct Distribution**
   - Replace DMG with previous version
   - Update release notes with warning

3. **For App Store**
   - Submit expedited review with fix
   - Or request removal from sale

4. **For Windows/Linux**
   - Replace installers with previous version
   - Update package repositories

---

## Useful Commands Reference

```bash
# Check binary size
du -h target/release/libopta_*.a

# Analyze dependencies
cargo tree --workspace

# Check for outdated dependencies
cargo outdated

# Run specific test
cargo test --package opta-render test_name

# Profile build time
cargo build --release --timings

# Check LLVM IR size
cargo llvm-lines --release | head -20

# Archive and upload in one command
./scripts/archive-and-upload.sh

# Archive only (for manual upload)
./scripts/archive-and-upload.sh --archive-only
```

---

**Last Updated:** January 2026
**Version:** 9.0.0
