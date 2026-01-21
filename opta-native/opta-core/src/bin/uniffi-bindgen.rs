//! UniFFI Bindgen Binary
//!
//! This binary is used to generate Swift and Kotlin bindings from the
//! opta-core library using UniFFI's library-mode binding generation.
//!
//! Usage:
//!   cargo run --bin uniffi-bindgen -- generate \
//!       --library target/release/libopta_core.dylib \
//!       --language swift \
//!       --out-dir target/swift-bindings

fn main() {
    uniffi::uniffi_bindgen_main()
}
