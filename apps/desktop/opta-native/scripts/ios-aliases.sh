#!/bin/bash
# Opta iOS development aliases for macOS
#
# Add to your ~/.zshrc:
#   source "/Users/matthewbyrden/Documents/Opta/1. Apps/2. Desktop/1. Opta Native/scripts/ios-aliases.sh"
#
# Note: Download iOS simulators from Xcode > Settings > Platforms
# Run: sim-list to see available devices after installation

OPTA_IOS_DIR="/Users/matthewbyrden/Documents/Opta/1. Apps/1. iOS/1. Opta"
OPTA_DESKTOP_DIR="/Users/matthewbyrden/Documents/Opta/1. Apps/2. Desktop/1. Opta Native"
BRAIN_DIR="/Users/matthewbyrden/Documents/Syncthing Claude Brain"

# ============================================
# iOS SIMULATOR MANAGEMENT
# ============================================

# List available simulators
alias sim-list="xcrun simctl list devices available"

# Boot common iPhone models (iOS 26.2 devices)
alias sim-boot="xcrun simctl boot 'iPhone 17 Pro'"
alias sim-17="xcrun simctl boot 'iPhone 17 Pro'"
alias sim-pro="xcrun simctl boot 'iPhone 17 Pro Max'"
alias sim-air="xcrun simctl boot 'iPhone Air'"
alias sim-16e="xcrun simctl boot 'iPhone 16e'"

# Shutdown all simulators
alias sim-kill="xcrun simctl shutdown all"

# Open Simulator app
alias sim-open="open -a Simulator"

# Boot + Open in one command
alias sim="xcrun simctl boot 'iPhone 17 Pro' 2>/dev/null; open -a Simulator"

# Screenshot from simulator
alias sim-screenshot="xcrun simctl io booted screenshot ~/Desktop/simulator-$(date +%Y%m%d-%H%M%S).png"

# ============================================
# iOS BUILD COMMANDS (for future Xcode project)
# ============================================

# Build iOS app with pretty output
alias ios-build="xcodebuild -scheme Opta -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | xcbeautify"

# Build and run on simulator
alias ios-run="xcodebuild -scheme Opta -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build 2>&1 | xcbeautify && xcrun simctl launch booted com.opta.app"

# Clean build
alias ios-clean="xcodebuild clean -scheme Opta 2>&1 | xcbeautify"

# List schemes in project
alias ios-schemes="xcodebuild -list 2>&1 | xcbeautify"

# ============================================
# FASTLANE SHORTCUTS
# ============================================

# Run Fastlane beta (TestFlight)
alias fl-beta="cd \"$OPTA_IOS_DIR\" && fastlane beta"

# Run Fastlane tests
alias fl-test="cd \"$OPTA_IOS_DIR\" && fastlane test"

# Check code signing
alias fl-match="cd \"$OPTA_IOS_DIR\" && fastlane match"

# Init Fastlane in project
alias fl-init="cd \"$OPTA_IOS_DIR\" && fastlane init"

# ============================================
# WORKSPACE LAUNCHERS
# ============================================

# Launch Opta macOS workspace (Alt+1)
function work-opta() {
    cd "$OPTA_DESKTOP_DIR"
    aerospace workspace 1
    open -a Ghostty
    sleep 0.3
    osascript -e 'tell application "Ghostty" to activate'
    echo "Opta Desktop workspace ready (Alt+1). Run 'claude' to start Claude Code."
}

# Launch Opta iOS workspace (Alt+2)
function work-ios() {
    cd "$OPTA_IOS_DIR"
    aerospace workspace 2
    xcrun simctl boot 'iPhone 17 Pro' 2>/dev/null
    open -a Simulator
    open -a Ghostty
    sleep 0.3
    osascript -e 'tell application "Ghostty" to activate'
    echo "iOS workspace ready (Alt+2). Simulator booted."
}

# Launch Claude Brain workspace (Alt+3)
function work-brain() {
    cd "$BRAIN_DIR"
    aerospace workspace 3
    open -a Ghostty
    sleep 0.3
    osascript -e 'tell application "Ghostty" to activate'
    echo "Claude Brain workspace ready (Alt+3)."
}

# Quick workspace switch without launching apps
alias ws-opta="aerospace workspace 1"
alias ws-ios="aerospace workspace 2"
alias ws-brain="aerospace workspace 3"
alias ws-research="aerospace workspace 4"
alias ws-comms="aerospace workspace 5"

# ============================================
# XCODE HELPERS
# ============================================

# Open Xcode in current directory
alias xc="open -a Xcode ."

# Open specific Xcode project/workspace
alias xc-opta-ios="open -a Xcode \"$OPTA_IOS_DIR\"/*.xcodeproj 2>/dev/null || open -a Xcode \"$OPTA_IOS_DIR\"/*.xcworkspace 2>/dev/null || echo 'No Xcode project found'"
alias xc-opta-desktop="open -a Xcode \"$OPTA_DESKTOP_DIR\"/*.xcodeproj 2>/dev/null || open -a Xcode \"$OPTA_DESKTOP_DIR\"/*.xcworkspace 2>/dev/null || echo 'No Xcode project found'"

# Kill Xcode (useful when it hangs)
alias xc-kill="killall Xcode 2>/dev/null && echo 'Xcode killed' || echo 'Xcode not running'"

# Clear Xcode derived data
alias xc-clear="rm -rf ~/Library/Developer/Xcode/DerivedData && echo 'DerivedData cleared'"

echo "iOS aliases loaded. Commands: sim, sim-list, sim-kill, work-opta, work-ios, work-brain, ios-build"
