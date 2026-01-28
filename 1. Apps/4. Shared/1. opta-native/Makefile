# Opta Native - Rust Core Build System
# Targets: macOS, iOS, Android (future)

.PHONY: all clean build-macos build-ios build-xcframework check test setup dev fmt

# Default target
all: check build-macos

# ============================================
# DEVELOPMENT
# ============================================

# Fast development build (debug, native)
dev:
	cargo build

# Run checks (compile + clippy)
check:
	cargo check --all-features
	cargo clippy --all-features -- -D warnings

# Run all tests
test:
	cargo test --all-features

# Format code
fmt:
	cargo fmt --all

# Format check (CI)
fmt-check:
	cargo fmt --all -- --check

# ============================================
# MACOS BUILDS
# ============================================

# Build for macOS (Apple Silicon)
build-macos:
	cargo build --release --target aarch64-apple-darwin

# Build for macOS (Intel)
build-macos-intel:
	cargo build --release --target x86_64-apple-darwin

# Build universal macOS binary
build-macos-universal: build-macos build-macos-intel
	mkdir -p target/universal-macos
	lipo -create \
		target/aarch64-apple-darwin/release/libopta_core.a \
		target/x86_64-apple-darwin/release/libopta_core.a \
		-output target/universal-macos/libopta_core.a
	@echo "Universal macOS binary: target/universal-macos/libopta_core.a"

# ============================================
# IOS BUILDS
# ============================================

# Build for iOS device
build-ios:
	cargo build --release --target aarch64-apple-ios

# Build for iOS Simulator (Apple Silicon)
build-ios-sim:
	cargo build --release --target aarch64-apple-ios-sim

# Build for iOS Simulator (Intel)
build-ios-sim-intel:
	cargo build --release --target x86_64-apple-ios

# ============================================
# XCFRAMEWORK
# ============================================

# Build XCFramework (macOS + iOS)
build-xcframework:
	./scripts/build-xcframework.sh

# ============================================
# BINDINGS GENERATION
# ============================================

# Generate Swift bindings only
gen-swift:
	mkdir -p generated/swift
	cargo run -p uniffi --bin uniffi-bindgen generate \
		opta-core/src/opta.udl \
		--language swift \
		--out-dir generated/swift

# Generate Kotlin bindings only
gen-kotlin:
	mkdir -p generated/kotlin
	cargo run -p uniffi --bin uniffi-bindgen generate \
		opta-core/src/opta.udl \
		--language kotlin \
		--out-dir generated/kotlin

# ============================================
# SETUP
# ============================================

# Install required Rust targets
setup:
	@echo "Installing Apple targets..."
	rustup target add aarch64-apple-darwin x86_64-apple-darwin
	rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
	@echo ""
	@echo "Installing Android targets (for future use)..."
	rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android || true
	@echo ""
	@echo "Setup complete!"

# ============================================
# CLEAN
# ============================================

# Clean all build artifacts
clean:
	cargo clean
	rm -rf target/xcframework
	rm -rf target/android
	rm -rf target/universal-macos
	rm -rf generated

# ============================================
# CI/CD
# ============================================

# Full CI pipeline
ci: fmt-check check test

# Release build pipeline
release: clean check test build-xcframework
	@echo "Release build complete!"

# ============================================
# HELP
# ============================================

help:
	@echo "Opta Native Build System"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Fast debug build"
	@echo "  make check            - Run cargo check + clippy"
	@echo "  make test             - Run all tests"
	@echo "  make fmt              - Format code"
	@echo ""
	@echo "macOS Builds:"
	@echo "  make build-macos      - Build for macOS (Apple Silicon)"
	@echo "  make build-macos-intel - Build for macOS (Intel)"
	@echo "  make build-macos-universal - Build universal binary"
	@echo ""
	@echo "iOS Builds:"
	@echo "  make build-ios        - Build for iOS device"
	@echo "  make build-ios-sim    - Build for iOS Simulator"
	@echo ""
	@echo "Frameworks:"
	@echo "  make build-xcframework - Build XCFramework (macOS + iOS)"
	@echo ""
	@echo "Bindings:"
	@echo "  make gen-swift        - Generate Swift bindings"
	@echo "  make gen-kotlin       - Generate Kotlin bindings"
	@echo ""
	@echo "Setup:"
	@echo "  make setup            - Install required Rust targets"
	@echo "  make clean            - Clean all build artifacts"
