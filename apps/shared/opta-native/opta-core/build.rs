//! Build script for opta-core
//!
//! This generates UniFFI scaffolding from the opta.udl interface definition.
//! The generated code provides FFI bindings for Swift (macOS/iOS) and Kotlin (Android).

fn main() {
    // Generate UniFFI scaffolding from the UDL file
    uniffi::generate_scaffolding("src/opta.udl").expect("Failed to generate UniFFI scaffolding");
}
