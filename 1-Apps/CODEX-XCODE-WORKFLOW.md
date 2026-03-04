# Codex + Xcode Workflow

## 1) Projects and schemes in this repo
Buildable inventory captured via `xcodebuild -list` on 2026-03-04.

| Project | Workspace | Schemes |
|---|---|---|
| `optamize/1E-Opta-Life-IOS/OptaLMiOS.xcodeproj` | `optamize/1E-Opta-Life-IOS/OptaLMiOS.xcodeproj/project.xcworkspace` | `OptaLMiOS` |
| `optamize/1G-Opta-Mini-MacOS/OptaMini.xcodeproj` | `optamize/1G-Opta-Mini-MacOS/OptaMini.xcodeproj/project.xcworkspace` | `OptaMini` |
| `optamize/1H-Opta-Scan-IOS/Opta Scan.xcodeproj` | `optamize/1H-Opta-Scan-IOS/Opta Scan.xcodeproj/project.xcworkspace` | `w` |
| `optamize/1H-Opta-Scan-IOS/Opta.xcodeproj` | `optamize/1H-Opta-Scan-IOS/Opta.xcodeproj/project.xcworkspace` | `Opta` |
| `optamize/1J-Optamize-MacOS/OptaNative.xcodeproj` | `optamize/1J-Optamize-MacOS/OptaNative.xcodeproj/project.xcworkspace` | `OptaNative`, `com.opta.native.helper` |
| `shared/1I-OptaPlus/Opta Plus IOS Temp/OptaPlusIOSTemp.xcodeproj` | `shared/1I-OptaPlus/Opta Plus IOS Temp/OptaPlusIOSTemp.xcodeproj/project.xcworkspace` | `OptaPlusIOSTemp`, `OptaPlus`, `OptaMolt` |
| `shared/1I-OptaPlus/iOS/OptaPlusIOS.xcodeproj` | `shared/1I-OptaPlus/iOS/OptaPlusIOS.xcodeproj/project.xcworkspace` | `OptaPlusIOS`, `OptaPlus`, `OptaMolt` |
| `shared/1I-OptaPlus/macOS/OptaPlusMacOS.xcodeproj` | `shared/1I-OptaPlus/macOS/OptaPlusMacOS.xcodeproj/project.xcworkspace` | `OptaPlusMacOS`, `OptaPlus`, `OptaMolt` |

Note: `_archived/` contains historical snapshots; some Xcode project folders there are incomplete (for example missing `project.pbxproj`) and are not suitable for active build/test workflows.

## 2) Recommended Codex invocation patterns
Interactive local development:
```bash
codex -p xcode-local -C /Users/matthewbyrden/Synced/Opta/1-Apps
```

Read-only analysis:
```bash
codex -p xcode-readonly -C /Users/matthewbyrden/Synced/Opta/1-Apps
```

Non-interactive CI-like run:
```bash
codex exec -p xcode-ci -C /Users/matthewbyrden/Synced/Opta/1-Apps "Resolve packages, then build and test OptaPlusIOS on iOS Simulator; report failures only."
```

## 3) Simulator defaults and xcodebuild tips
Defaults (runtime-detected in wrappers):
- iOS preferred: `platform=iOS Simulator,name=iPhone 17 Pro`
- iOS fallback: `platform=iOS Simulator,name=iPhone 17`
- iOS final fallback: `platform=iOS Simulator`
- macOS: `platform=macOS`

Useful commands:
```bash
xcodebuild -showdestinations -workspace "<workspace>" -scheme "<scheme>"
xcrun simctl list devices available
```

Practical build/test flags:
- Set deterministic output paths: `-derivedDataPath ./.build/DerivedData`
- Capture test bundles for CI triage: `-resultBundlePath ./.build/TestResults/<scheme>.xcresult`
- Prefer `-workspace` + `-scheme` over target-only invocations.

## 4) Package resolution strategy (resolve first, then locked build/test)
1. Resolve packages explicitly:
```bash
xcodebuild -resolvePackageDependencies \
  -workspace "<workspace>" \
  -scheme "<scheme>" \
  -clonedSourcePackagesDirPath ./.build/SourcePackages
```

2. Build/test with reproducible package behavior:
```bash
xcodebuild test \
  -workspace "<workspace>" \
  -scheme "<scheme>" \
  -destination "platform=iOS Simulator,name=iPhone 17 Pro" \
  -clonedSourcePackagesDirPath ./.build/SourcePackages \
  -derivedDataPath ./.build/DerivedData \
  -disableAutomaticPackageResolution \
  -onlyUsePackageVersionsFromResolvedFile
```

## 5) Worktree and local-environment recommendations (Codex app docs)
- Use **Local** mode when you want Codex to work directly in your current checkout.
- Use **Worktree** mode when you want isolated parallel changes in the same repo.
- Configure shared setup scripts and top-bar actions in Codex app **Local environments**; this is intended for repeatable project setup/actions.
- In worktree flows, do not keep the same branch checked out in both the main checkout and a worktree simultaneously; verify either entirely in the worktree or bring changes back to the main checkout before final verification.

## 6) Repo automation wrappers (recommended entrypoints)
Use the checked-in wrappers under `scripts/xcode` so build/test output lands in deterministic repo paths:

```bash
# List all known target presets/schemes
scripts/xcode/list-schemes.sh --all

# Resolve packages for active OptaPlus projects
scripts/xcode/resolve-packages.sh --target plus-ios --target plus-macos

# iOS build + test
scripts/xcode/build-ios.sh --target plus-ios
scripts/xcode/test-ios.sh --target plus-ios

# macOS build + test
scripts/xcode/build-macos.sh --target plus-macos
scripts/xcode/test-macos.sh --target plus-macos

# Optional: capture .xcresult on build jobs too
XCODE_BUILD_RESULT_BUNDLE=1 scripts/xcode/build-ios.sh --target plus-ios
```

Wrapper behavior highlights:
- Preflight validation checks scheme existence and destination availability before build/test.
- `build-*.sh` skips `.xcresult` by default; set `XCODE_BUILD_RESULT_BUNDLE=1` to enable.
- Set `XCODE_DERIVED_DATA_SUFFIX=<id>` for parallel shards to avoid DerivedData path collisions.

Known preset aliases now include:
- `plus-ios` (`OptaPlusIOS`)
- `plus-ios-shared` (`OptaMolt` on iOS project)
- `plus-macos` (`OptaPlusMacOS`)
- `plus-macos-shared` (`OptaMolt` on macOS project)

Official docs:
- https://developers.openai.com/codex/app/features/
- https://developers.openai.com/codex/app/local-environments/
- https://developers.openai.com/codex/app/worktrees/
- https://developers.openai.com/codex/config-reference/
