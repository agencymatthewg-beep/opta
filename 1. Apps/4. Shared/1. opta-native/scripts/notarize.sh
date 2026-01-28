#!/bin/bash
#
# notarize.sh - macOS App Notarization Script for Opta v8.0
#
# This script handles the complete notarization workflow:
# 1. Code signing with hardened runtime
# 2. Creating a ZIP for notarization
# 3. Submitting to Apple's notarization service
# 4. Waiting for completion
# 5. Stapling the notarization ticket
#
# Prerequisites:
# - Xcode Command Line Tools installed
# - Valid Apple Developer ID Application certificate in Keychain
# - App-specific password stored in Keychain (for xcrun notarytool)
#
# Usage:
#   ./scripts/notarize.sh <app_path> [--submit-only] [--staple-only]
#
# Environment Variables (required):
#   APPLE_ID           - Apple ID email
#   TEAM_ID            - Apple Developer Team ID
#   APP_PASSWORD_ITEM  - Keychain item name for app-specific password
#
# Environment Variables (optional):
#   SIGNING_IDENTITY   - Code signing identity (defaults to "Developer ID Application")
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SIGNING_IDENTITY="${SIGNING_IDENTITY:-Developer ID Application}"
NOTARIZATION_TIMEOUT=3600  # 1 hour timeout for notarization

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for required tools
    if ! command -v xcrun &> /dev/null; then
        log_error "xcrun not found. Install Xcode Command Line Tools."
        exit 1
    fi

    if ! command -v codesign &> /dev/null; then
        log_error "codesign not found. Install Xcode Command Line Tools."
        exit 1
    fi

    # Check for required environment variables
    if [[ -z "${APPLE_ID:-}" ]]; then
        log_error "APPLE_ID environment variable not set."
        log_error "Export your Apple ID: export APPLE_ID=\"your@email.com\""
        exit 1
    fi

    if [[ -z "${TEAM_ID:-}" ]]; then
        log_error "TEAM_ID environment variable not set."
        log_error "Export your Team ID: export TEAM_ID=\"XXXXXXXXXX\""
        exit 1
    fi

    if [[ -z "${APP_PASSWORD_ITEM:-}" ]]; then
        log_error "APP_PASSWORD_ITEM environment variable not set."
        log_error "Create an app-specific password at appleid.apple.com"
        log_error "Store it in Keychain: xcrun notarytool store-credentials <name> --apple-id <email> --team-id <team>"
        log_error "Then export: export APP_PASSWORD_ITEM=\"<name>\""
        exit 1
    fi

    # Check for signing identity
    if ! security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
        log_error "Signing identity '$SIGNING_IDENTITY' not found in Keychain."
        log_error "Available identities:"
        security find-identity -v -p codesigning
        exit 1
    fi

    log_success "Prerequisites check passed."
}

# =============================================================================
# Code Signing
# =============================================================================

sign_app() {
    local app_path="$1"

    log_info "Signing app with hardened runtime..."

    # Find entitlements file
    local entitlements="$PROJECT_ROOT/OptaApp/OptaApp/OptaApp.entitlements"
    if [[ ! -f "$entitlements" ]]; then
        log_warning "Entitlements file not found at $entitlements"
        log_warning "Signing without entitlements..."
        entitlements=""
    fi

    # Sign all nested frameworks and dylibs first
    log_info "Signing nested components..."
    find "$app_path" -type f \( -name "*.dylib" -o -name "*.framework" \) -print0 | while IFS= read -r -d '' file; do
        log_info "  Signing: $(basename "$file")"
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$file" 2>/dev/null || true
    done

    # Sign the main app bundle
    log_info "Signing main app bundle..."
    local sign_cmd=(
        codesign
        --force
        --deep
        --options runtime
        --timestamp
        --sign "$SIGNING_IDENTITY"
    )

    if [[ -n "$entitlements" ]]; then
        sign_cmd+=(--entitlements "$entitlements")
    fi

    sign_cmd+=("$app_path")

    "${sign_cmd[@]}"

    # Verify signature
    log_info "Verifying signature..."
    codesign --verify --deep --strict --verbose=2 "$app_path"

    # Additional Gatekeeper assessment
    log_info "Running Gatekeeper assessment..."
    if spctl --assess --type exec --verbose "$app_path" 2>&1; then
        log_success "Gatekeeper assessment passed."
    else
        log_warning "Gatekeeper assessment failed (may succeed after notarization)."
    fi

    log_success "App signed successfully."
}

# =============================================================================
# Notarization
# =============================================================================

create_zip() {
    local app_path="$1"
    local zip_path="${app_path%.app}.zip"

    log_info "Creating ZIP archive for notarization..."

    # Remove existing ZIP
    rm -f "$zip_path"

    # Create ZIP (ditto preserves code signatures)
    ditto -c -k --keepParent "$app_path" "$zip_path"

    log_success "ZIP created: $zip_path"
    echo "$zip_path"
}

submit_for_notarization() {
    local zip_path="$1"

    log_info "Submitting for notarization..."
    log_info "  Apple ID: $APPLE_ID"
    log_info "  Team ID: $TEAM_ID"
    log_info "  Credentials: $APP_PASSWORD_ITEM"

    # Submit using stored credentials
    local output
    output=$(xcrun notarytool submit "$zip_path" \
        --keychain-profile "$APP_PASSWORD_ITEM" \
        --wait \
        --timeout "$NOTARIZATION_TIMEOUT" \
        2>&1) || {
        log_error "Notarization submission failed!"
        log_error "$output"
        exit 1
    }

    echo "$output"

    # Extract submission ID
    local submission_id
    submission_id=$(echo "$output" | grep -o 'id: [a-f0-9-]*' | head -1 | cut -d' ' -f2)

    if [[ -z "$submission_id" ]]; then
        log_error "Could not extract submission ID from output."
        exit 1
    fi

    log_info "Submission ID: $submission_id"

    # Check status
    if echo "$output" | grep -q "status: Accepted"; then
        log_success "Notarization succeeded!"
        return 0
    elif echo "$output" | grep -q "status: Invalid"; then
        log_error "Notarization rejected!"

        # Get detailed log
        log_info "Fetching notarization log..."
        xcrun notarytool log "$submission_id" \
            --keychain-profile "$APP_PASSWORD_ITEM" \
            notarization-log.json || true

        if [[ -f notarization-log.json ]]; then
            log_error "See notarization-log.json for details."
            cat notarization-log.json
        fi

        exit 1
    else
        log_warning "Notarization status unclear. Check manually:"
        log_warning "  xcrun notarytool info $submission_id --keychain-profile $APP_PASSWORD_ITEM"
        exit 1
    fi
}

staple_ticket() {
    local app_path="$1"

    log_info "Stapling notarization ticket..."

    xcrun stapler staple "$app_path"

    # Verify stapling
    log_info "Verifying stapled ticket..."
    xcrun stapler validate "$app_path"

    log_success "Notarization ticket stapled successfully."
}

# =============================================================================
# Main
# =============================================================================

usage() {
    echo "Usage: $0 <app_path> [options]"
    echo ""
    echo "Options:"
    echo "  --submit-only    Only submit for notarization (skip signing and stapling)"
    echo "  --staple-only    Only staple the ticket (skip signing and submission)"
    echo "  --sign-only      Only sign the app (skip notarization)"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Required Environment Variables:"
    echo "  APPLE_ID           Apple ID email"
    echo "  TEAM_ID            Apple Developer Team ID"
    echo "  APP_PASSWORD_ITEM  Keychain item name for app-specific password"
    echo ""
    echo "Optional Environment Variables:"
    echo "  SIGNING_IDENTITY   Code signing identity (default: 'Developer ID Application')"
    echo ""
    echo "Example:"
    echo "  export APPLE_ID=\"dev@example.com\""
    echo "  export TEAM_ID=\"ABCD1234EF\""
    echo "  export APP_PASSWORD_ITEM=\"opta-notarize\""
    echo "  $0 build/Opta.app"
}

main() {
    local app_path=""
    local submit_only=false
    local staple_only=false
    local sign_only=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --submit-only)
                submit_only=true
                shift
                ;;
            --staple-only)
                staple_only=true
                shift
                ;;
            --sign-only)
                sign_only=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                app_path="$1"
                shift
                ;;
        esac
    done

    # Validate app path
    if [[ -z "$app_path" ]]; then
        log_error "App path is required."
        usage
        exit 1
    fi

    if [[ ! -d "$app_path" ]]; then
        log_error "App not found: $app_path"
        exit 1
    fi

    echo ""
    echo "=============================================="
    echo "  Opta v8.0 Notarization Script"
    echo "=============================================="
    echo ""

    check_prerequisites

    # Full workflow
    if [[ "$submit_only" == false && "$staple_only" == false && "$sign_only" == false ]]; then
        sign_app "$app_path"
        local zip_path
        zip_path=$(create_zip "$app_path")
        submit_for_notarization "$zip_path"
        staple_ticket "$app_path"

        # Cleanup
        log_info "Cleaning up temporary files..."
        rm -f "$zip_path"

        log_success "Notarization complete! App is ready for distribution."
        return 0
    fi

    # Sign only
    if [[ "$sign_only" == true ]]; then
        sign_app "$app_path"
        log_success "Signing complete!"
        return 0
    fi

    # Submit only
    if [[ "$submit_only" == true ]]; then
        local zip_path
        zip_path=$(create_zip "$app_path")
        submit_for_notarization "$zip_path"
        rm -f "$zip_path"
        return 0
    fi

    # Staple only
    if [[ "$staple_only" == true ]]; then
        staple_ticket "$app_path"
        log_success "Stapling complete!"
        return 0
    fi
}

main "$@"
