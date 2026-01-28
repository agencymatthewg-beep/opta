# **Optimizing Rust Binary Size for Mobile Deployment: A Comprehensive Analysis of Toolchain, Linker, and Dependency Architectures**

## **Executive Summary**

The deployment of Rust libraries within mobile applications (iOS and Android) presents a specific set of constraints regarding artifact size that differs significantly from server-side or desktop environments. While Rust offers unparalleled memory safety and performance characteristics suitable for high-performance graphics (via wgpu) and cross-platform logic (via UniFFI), the default compilation pipeline is optimized for execution speed and debuggability, often resulting in shared libraries exceeding 15MB. For mobile Software Development Kits (SDKs) and embedded modules, such dimensions are frequently prohibitive, impacting over-the-air (OTA) download limits, application startup time, and storage footprints. The target metric of under 2MB represents an order-of-magnitude reduction that necessitates a holistic re-engineering of the build process.

This report provides an exhaustive technical analysis of the methodologies required to minimize Rust binary size for mobile targets. The research indicates that achieving a sub-2MB artifact is not the result of a single configuration change but the aggregate effect of a multi-layered optimization strategy. This strategy encompasses four distinct architectural layers: (1) the Rust compiler (rustc) and LLVM backend configuration, (2) the recompilation of the Rust standard library (libstd) to remove runtime infrastructure, (3) strict symbol visibility control via system linker scripts to enable aggressive Dead Code Elimination (DCE), and (4) the surgical pruning of domain-specific dependencies, specifically the modular backends of wgpu.

Evidence from industry implementations, such as those by Bitdrift, suggests that the combination of "Fat" Link-Time Optimization (LTO), panic abortion, and strict symbol hiding can yield size reductions of over 90% compared to unoptimized release builds.1 This document details the implementation of these strategies, supported by theoretical analysis of binary formats (ELF and Mach-O), precise build configurations, and verification methodologies.

## ---

**1\. Architectural Analysis of Rust Binary Composition**

To effectively mitigate binary bloat, it is imperative to dissect the components of a Rust shared library. Unlike C or C++ development on Android or iOS, where the C standard library (libc) and C++ standard library (libc++) are often dynamically linked from the operating system, Rust binaries are statically linked by default. This static linkage model ensures portability and eliminates "dependency hell," but it imposes a fixed cost on binary size: the resulting artifact includes the user's code, all transitive dependencies, the Rust standard library (std), the memory allocator, and the panic handling runtime.

### **1.1 The Cost of Monomorphization**

A primary driver of code size in Rust applications, particularly those utilizing graphics libraries like wgpu, is monomorphization. Rust translates generic functions into concrete machine code for every unique type parameter set used. For example, a function wgpu::Device::create\_buffer\<T\> used with u8, f32, and a custom struct will result in three distinct blocks of machine code in the .text section of the binary. While this zero-cost abstraction mechanism maximizes runtime execution speed by enabling static dispatch and inlining, it directly correlates to binary size inflation.2

In the context of wgpu, which heavily utilizes generics for resource descriptors and pipeline configurations, monomorphization can lead to significant bloat. Tools such as cargo-llvm-lines have been identified as essential for diagnosing this specific type of inflation, allowing developers to pinpoint generic functions that produce excessive amounts of LLVM Intermediate Representation (IR).4

### **1.2 The Standard Library and Panic Infrastructure**

The pre-compiled Rust standard library distributed via rustup is optimized for general-purpose computing. It includes support for stack unwinding (to catch panics), extensive debug formatting implementations (std::fmt), and backtrace generation. For a mobile library intended to be embedded within a host application (Kotlin or Swift), this infrastructure is often redundant. If the Rust library panics, the Foreign Function Interface (FFI) boundary usually dictates a hard crash or a controlled error return; the ability to unwind the stack safely is rarely utilized by the host application.

However, because the pre-compiled libstd relies on unwinding tables (.eh\_frame on Linux/Android) and formatting logic, the linker cannot strip these sections even if the user code never explicitly invokes them. This creates a "size floor"—a minimum binary size that cannot be breached without recompiling the standard library itself.1

### **1.3 Symbol Visibility and the Linker Barrier**

The most critical factor preventing effective Dead Code Elimination (DCE) in shared libraries is symbol visibility. By default, Rust's cdylib crate type exports a wide array of symbols to ensure usability. The system linker (LLD for Android, ld64 for iOS) operates on a conservative principle: if a symbol is exported (marked as GLOBAL in ELF or present in the export trie in Mach-O), it must be retained, along with every function it calls.

For a UniFFI-based library, the only symbols that strictly require exportation are the generated C-compatible FFI entry points (e.g., uniffi\_my\_lib\_fn\_call). The internal wgpu logic, the naga shader compiler, and the Rust standard library functions should be hidden. If they remain visible, the linker is forced to retain the entire graphics engine, even if only a fraction of it is reachable from the FFI surface. Controlling this visibility via linker scripts (Version Scripts on Android, Export Lists on iOS) transforms the dependency graph, allowing the linker to discard massive sections of unused code.1

## ---

**2\. Compiler Toolchain Configuration**

The first tier of optimization involves configuring the Rust compiler and the LLVM backend via the Cargo.toml profile. These settings control how code is generated and how optimization passes are applied.

### **2.1 Optimization Levels: Speed vs. Size**

The opt-level setting dictates the aggressive nature of the optimization passes.

* **opt-level \= 3 (Default Release):** Prioritizes execution speed. It enables vectorization, loop unrolling, and aggressive inlining. These optimizations often increase binary size by duplicating code to reduce branching or leverage SIMD instructions.  
* **opt-level \= "z" (Minimal Size):** This setting instructs LLVM to prioritize size reduction above all else. It disables vectorization and is highly aggressive in merging identical functions and simplifying control flow graphs. Empirical data suggests that for wgpu workloads, z often yields better size results than s (which optimizes for size but balances speed slightly more), although the difference varies by workload.2

### **2.2 Link-Time Optimization (LTO)**

LTO is a non-negotiable requirement for meeting the \<2MB target.

* **ThinLTO (Default):** Performs optimization within a single crate and limited cross-module optimization. It is fast but misses opportunities for deep pruning.  
* **Fat LTO (lto \= true):** Loads the bitcode for all dependencies (including wgpu, serde, log) into a single giant compilation unit. This allows the optimizer to see the entire call graph. Crucially, it allows the compiler to inline functions across crate boundaries and verify that certain code paths are dead, enabling their removal. Studies indicate Fat LTO can reduce binary size by 15-20% over ThinLTO, primarily through more effective dead code elimination.1

### **2.3 Parallel Code Generation Units**

Cargo defaults to splitting compilation into 16 parallel units (codegen-units \= 16\) to accelerate build times. This partitioning creates "optimization barriers"—the optimizer cannot inline a function from Unit A into Unit B if they are compiled separately.

* **Optimization:** Setting codegen-units \= 1 forces the compiler to process the crate as a single unit. While this significantly increases compilation time, it maximizes the context available to LLVM, ensuring the most efficient compression of logic and removal of redundancy.2

### **2.4 Panic Strategy and Unwinding**

Rust's default behavior upon panic is to unwind the stack, calling destructors for all objects in scope. This requires the generation of unwinding tables (.eh\_frame), which consume substantial space.

* **Optimization:** Setting panic \= "abort" changes this behavior to an immediate termination (SIGABRT). This removes the need for unwinding tables. While this reduces the robustness of error handling within the library, specifically regarding resource cleanup during a crash, it is often an acceptable trade-off for a mobile library where a panic implies an unrecoverable state regardless.1

### **2.5 Baseline Profile Configuration**

The following Cargo.toml snippet represents the aggressive baseline configuration required before exploring advanced techniques.

Ini, TOML

\[profile.release\]  
opt-level \= "z"       \# Optimize for minimal size  
lto \= true            \# Enable Fat LTO for cross-crate optimization  
codegen-units \= 1     \# Maximize optimization context  
panic \= "abort"       \# Disable panic unwinding  
strip \= true          \# Strip symbols automatically  
debug \= false         \# Ensure no debug info is generated  
incremental \= false   \# Disable incremental builds for clean artifacts  
rpath \= false         \# Do not embed RPATH  
overflow-checks \= false \# Disable overflow checks in release

## ---

**3\. Advanced Standard Library Optimization (build-std)**

While panic \= "abort" in Cargo.toml prevents the generation of *new* unwinding code in the user's crate, the binary still links against the pre-compiled standard library (libstd), which was built with unwinding support and debug formatting enabled. This "std bloat" imposes a lower bound on binary size. To breach the 2MB limit with a heavy dependency like wgpu, one must recompiling the standard library.

### **3.1 The build-std Mechanism**

The build-std feature, currently available on the Rust nightly toolchain, allows Cargo to compile the standard library crates (core, alloc, std, panic\_abort) from source as part of the application build. This ensures that the global profile settings (opt-level \= "z", panic \= "abort") are applied to the standard library itself.1

### **3.2 The Nuclear Option: panic\_immediate\_abort**

The standard library contains extensive logic for formatting panic messages (e.g., constructing the string "thread 'main' panicked at 'index out of bounds'..."). This pulls in the fmt machinery and static string tables.

* **panic\_immediate\_abort:** This build feature for libstd transforms the panic handler into a single instruction: a trap (UD2 on x86, BRK on ARM). It eliminates all panic strings, file path strings, and formatting logic. This is critical for size reduction, as text strings and formatting code are resistant to standard dead code elimination.1

### **3.3 Removing Location Details and Debug Formatting**

Advanced compiler flags can further prune metadata:

* **\-Zlocation-detail=none:** This unstable flag instructs rustc not to generate file, line, and column information for caller\_location(). This data is typically used in panic messages. Removing it eliminates a significant volume of string data.2  
* **\-Zfmt-debug=none:** This flag turns \# implementations into no-ops or minimal implementations. Since wgpu and its dependencies often derive Debug for internal types, this can strip a large amount of unused formatting logic.2

### **3.4 Implementation Strategy**

Using build-std requires a specific invocation. This should be codified in the project's build system or CI pipeline.

Bash

cargo \+nightly build \\  
  \--release \\  
  \--target aarch64-linux-android \\  
  \-Z build-std=std,panic\_abort \\  
  \-Z build-std-features=panic\_immediate\_abort,optimize\_for\_size \\  
  \--config 'profile.release.opt-level="z"'

The combination of build-std and panic\_immediate\_abort has been observed to reduce the base footprint of a Rust binary by 300KB to 600KB, effectively neutralizing the fixed cost of the language runtime.1

## ---

**4\. Linker Optimization and Symbol Visibility**

The linker is the final gatekeeper of binary size. Its role involves resolving references and discarding unused sections. However, its effectiveness is strictly bound by symbol visibility.

### **4.1 The Visibility Problem**

In a dynamic library (.so or .dylib), symbols can be either global (exported) or local (hidden). Global symbols are public API endpoints; the linker assumes they may be called by unknown external code. Consequently, the linker must retain the global symbol and every function that symbol calls.  
By default, Rust exposes many symbols. In a project with wgpu, this might accidentally expose internal graphics routines. If these are visible, the linker cannot strip them. For a UniFFI library, only the generated FFI bridge functions need to be global.6

### **4.2 Android Optimization (ELF)**

Android utilizes the ELF binary format. The primary mechanism for controlling visibility is the **Version Script**.

#### **4.2.1 Version Scripts**

A version script is a text file passed to the linker that explicitly defines which symbols should be global and forces all others to be local.

* **Mechanism:** When symbols are demoted to local, the linker can determine if they are called internally. If a local symbol is never called by a global symbol (or another used local symbol), it is discarded.  
* Implementation:  
  The script typically follows this pattern:  
  {  
  global:  
  Java\_; \# JNI entry points for Android  
  uniffi\_; \# UniFFI generated bindings  
  ffi\_\*; \# Common FFI patterns  
  local:  
  \*; \# Hide everything else  
  };  
  This technique has been cited as the single most effective optimization for reducing shared library size, with reports of up to 90% reduction when combined with LTO.1

#### **4.2.2 Linker Flags**

To apply this, specific flags must be passed to the linker (ld.lld) via rustc.

* \-Wl,--version-script=android\_version\_script.map: Applies the visibility logic.  
* \-Wl,--gc-sections: Enables garbage collection of unused sections. This relies on the compiler having placed functions in separate sections (-C function-sections is default in Rust release builds).  
* \-Wl,--exclude-libs,ALL: Prevents symbols from statically linked C libraries (like spirv-cross if used) from being exported.11

### **4.3 iOS Optimization (Mach-O)**

iOS uses the Mach-O format. The concept is identical, but the terminology differs. Apple's linker (ld64 or lld) uses an **Exported Symbols List**.

#### **4.3.1 Exported Symbols List**

This is a simple text file listing the symbols to keep.

* **Note on Mangling:** C symbols on Darwin (iOS/macOS) are prefixed with an underscore \_. A Rust function uniffi\_entry will appear as \_uniffi\_entry to the linker.  
* Content:  
  \_uniffi\_start  
  \_uniffi\_contract\_version  
  Wildcards are supported by the linker but require specific flags or newer linker versions.

#### **4.3.2 Linker Flags**

* \-exported\_symbols\_list \<path\>: Specifies the allowlist.  
* \-dead\_strip: The Mach-O equivalent of \--gc-sections. It removes unreachable blocks of code and data.12

## ---

**5\. Domain-Specific Optimization: wgpu**

wgpu is a comprehensive graphics abstraction that includes multiple backend implementations (Vulkan, Metal, DX12, GLES) and a shader translation infrastructure (naga). For a specific mobile target, much of this is dead weight.

### **5.1 Backend Pruning via Feature Flags**

wgpu compiles all backends by default. However, a specific mobile platform only requires its native API.

* **Android:** Requires vulkan. It may fallback to gles (OpenGL ES). It strictly does *not* need metal or dx12.  
* **iOS:** Requires metal. It does *not* need vulkan, gles, or dx12.

This pruning must be enforced in Cargo.toml. Since Cargo features are additive, one must disable default-features and then conditionally enable backends based on the target OS. This removes the code for the unused drivers entirely.14

Ini, TOML

\[dependencies.wgpu\]  
version \= "0.19"  
default-features \= false  
features \= \["wgsl"\] \# Core features

\[target.'cfg(target\_os \= "android")'.dependencies.wgpu\]  
features \= \["vulkan", "gles"\]

\[target.'cfg(target\_os \= "ios")'.dependencies.wgpu\]  
features \= \["metal"\]

### **5.2 The Naga Shader Compiler**

wgpu uses naga to translate shaders (e.g., from WGSL to SPIR-V or MSL) at runtime. naga includes parsers and writers for various languages.

* **Optimization:** If the application only loads WGSL shaders, the GLSL and SPIR-V *parsers* are unnecessary. By ensuring the spirv and glsl features are disabled in wgpu (they are often enabled by default-features), we prevent this code from being linked.14  
* **Advanced:** In theory, one could pre-compile shaders to the target format (SPIR-V for Android, MSL for iOS) during the build process and strip the wgsl parser from the runtime. However, wgpu currently relies on naga for pipeline layout validation and introspection, making it difficult to remove the compiler entirely without extensive forking. Limiting the *input languages* to just WGSL is the most practical optimization.14

### **5.3 Validation Layers**

The wgpu-core crate includes extensive validation logic to ensure API usage correctness. This is vital for development but adds size to the release binary.

* **Strict Asserts:** Ensure the strict\_asserts feature is disabled in release.  
* **Debug Assertions:** Ensure debug\_assertions are disabled in the profile.  
* **Runtime Checks:** While wgpu tries to optimize these out in release, ensure that any "trace" or "replay" features are disabled.17

## ---

**6\. Domain-Specific Optimization: UniFFI**

UniFFI generates the scaffolding that allows the native mobile languages (Kotlin, Swift) to communicate with Rust. While efficient, it generates a substantial amount of bridge code.

### **6.1 Scaffolding Analysis**

UniFFI works by "lifting" Rust types into a generic RustBuffer and "lowering" them back into foreign types. This involves serialization logic.

* **API Surface Area:** The size of the generated scaffolding is proportional to the number of exported functions and the complexity of the data types. Minimizing the FFI surface area—by using opaque pointers (Objects) rather than serializing large structs—can reduce the generated code size.18  
* **Include Macro:** Ensure uniffi::include\_scaffolding\!("libname"); is only called once in the lib.rs.

### **6.2 Symbol Management**

UniFFI generates symbols with specific prefixes (usually based on the namespace defined in the .udl or proc-macro).

* **Pattern Matching:** Identifying these patterns (e.g., ffi\_libname\_...) is crucial for the Linker Optimization step (Section 4). If these symbols are accidentally hidden, the library will fail to load at runtime. If extra symbols are exported, the binary size balloons.  
* **Strategy:** Use nm to inspect the unstripped binary and identify the exact prefixes used by the version of UniFFI in use, then add these to the linker script.19

## ---

**7\. Measurement and Analysis Methodology**

Optimization without measurement is guesswork. The following tools provide the visibility required to guide the optimization process.

### **7.1 cargo-bloat**

This tool analyzes the compiled binary to attribute size to specific crates and functions.

* **Usage:** cargo bloat \--release \--crates \-n 20  
* **Insight:** It reveals if std is still the dominant factor (indicating build-std failure) or if wgpu is pulling in unexpected components like spirv\_cross or gfx-backend-dx12.20

### **7.2 cargo-udeps**

Identifies unused dependencies in Cargo.toml.

* **Usage:** cargo \+nightly udeps \--all-targets  
* **Insight:** It detects crates that are listed in Cargo.toml but never actually imported or used in the code. Removing these simplifies the dependency graph and build times, though Link-Time Optimization would theoretically strip their code regardless.22

### **7.3 cargo-machete**

A faster, albeit less precise, alternative to udeps that relies on static analysis of use statements.

* **Usage:** cargo machete  
* **Insight:** Good for quick sanitary checks of the manifest files.23

### **7.4 Native Symbol Inspection (nm)**

* **Usage:** llvm-nm \-g \--defined-only target/release/libapp.so  
* **Insight:** This is the ultimate verification of the linker script. In a properly optimized binary, this command should output **only** the JNI/UniFFI symbols. If internal Rust symbols (e.g., \_ZN4core3fmt...) appear, the visibility restrictions are not working, and the binary is likely significantly larger than necessary.25

## ---

**8\. Implementation Guide**

This section provides the concrete configuration files and scripts required to execute the strategies discussed above.

### **8.1 Complete Cargo.toml**

Ini, TOML

\[package\]  
name \= "mobile\_gpu\_core"  
version \= "0.1.0"  
edition \= "2021"

\[lib\]  
\# 'cdylib' for Android.so, 'staticlib' for iOS.a  
crate-type \= \["cdylib", "staticlib"\]

\[features\]  
default \=

\[dependencies\]  
\# UniFFI for bindings \- enable CLI for bindgen tools  
uniffi \= { version \= "0.27", features \= \["cli"\] }

\# Logging facade \- essential but can be heavy; verify if needed  
log \= "0.4"

\# wgpu configuration  
\# Disable default features to prevent compiling unused backends  
\[dependencies.wgpu\]  
version \= "0.19"  
default-features \= false  
features \= \["wgsl"\] \# Enable only WGSL parser; disable SPIR-V/GLSL

\# \--- Platform Specific Dependencies \---

\# Android: Enable Vulkan (primary) and GLES (compatibility)  
\[target.'cfg(target\_os \= "android")'.dependencies.wgpu\]  
features \= \["vulkan", "gles"\]

\# iOS: Enable Metal only  
\[target.'cfg(target\_os \= "ios")'.dependencies.wgpu\]  
features \= \["metal"\]

\# \--- Build Profile Configuration \---

\[profile.release\]  
opt-level \= "z"       \# Optimize for minimal size  
lto \= true            \# Enable Fat LTO  
codegen-units \= 1     \# Single compilation unit for max optimization  
panic \= "abort"       \# Disable panic unwinding  
strip \= true          \# Strip symbols from binary  
debug \= false         \# Disable debug info  
incremental \= false   \# Clean builds  
rpath \= false         \# No RPATH  
overflow-checks \= false

\# Aggressively optimize dependencies  
\[profile.release.package."\*"\]  
opt-level \= "z"

### **8.2 Build Script (build.rs) for Linker Flags**

This script dynamically generates the appropriate linker arguments based on the target OS.

Rust

use std::env;  
use std::fs;  
use std::path::PathBuf;

fn main() {  
    let target\_os \= env::var("CARGO\_CFG\_TARGET\_OS").unwrap();  
    let out\_dir \= PathBuf::from(env::var("OUT\_DIR").unwrap());

    if target\_os \== "android" {  
        // \--- Android Version Script \---  
        // Explicitly list ONLY the symbols that must be visible.  
        // JNI symbols follow Java\_package\_name\_Method pattern.  
        // UniFFI symbols typically start with the namespace or uniffi prefix.  
        let version\_script \= r\#"  
        {  
            global:  
                Java\_\*;  
                uniffi\_\*;  
                ffi\_\*;  
            local:  
                \*;  
        };  
        "\#;  
        let script\_path \= out\_dir.join("android\_version\_script.map");  
        fs::write(\&script\_path, version\_script).expect("Failed to write version script");

        // Pass flags to the linker  
        println\!("cargo:rustc-link-arg=-Wl,--version-script={}", script\_path.display());  
        // Enable garbage collection of sections  
        println\!("cargo:rustc-link-arg=-Wl,--gc-sections");  
        // Prevent exporting symbols from static libraries linked into this one  
        println\!("cargo:rustc-link-arg=-Wl,--exclude-libs,ALL");

    } else if target\_os \== "ios" {  
        // \--- iOS Exported Symbols List \---  
        // Note: Symbols on iOS have a leading underscore.  
        let exports \= "  
\_uniffi\_\*  
\_ffi\_\*  
";  
        let exports\_path \= out\_dir.join("ios\_exports.txt");  
        fs::write(\&exports\_path, exports).expect("Failed to write exports list");

        println\!("cargo:rustc-link-arg=-exported\_symbols\_list");  
        println\!("cargo:rustc-link-arg={}", exports\_path.display());  
        // Dead strip is the Mach-O equivalent of gc-sections  
        println\!("cargo:rustc-link-arg=-dead\_strip");  
    }  
}

### **8.3 Build and Measurement Commands**

The following commands utilize the Nightly toolchain to enable build-std and perform the build.

**Step 1: Setup Nightly**

Bash

rustup toolchain install nightly  
rustup component add rust-src \--toolchain nightly

**Step 2: Build for Android (Example: ARM64)**

Bash

\# \-Z build-std: Recompiles std, panic\_abort  
\# \-Z build-std-features: Enables panic\_immediate\_abort (strips strings)  
\# \--target: Specifies the Android target  
cargo \+nightly build \\  
    \--target aarch64-linux-android \\  
    \--release \\  
    \-Z build-std=std,panic\_abort \\  
    \-Z build-std-features=panic\_immediate\_abort,optimize\_for\_size

**Step 3: Build for iOS (Example: ARM64)**

Bash

cargo \+nightly build \\  
    \--target aarch64-apple-ios \\  
    \--release \\  
    \-Z build-std=std,panic\_abort \\  
    \-Z build-std-features=panic\_immediate\_abort,optimize\_for\_size

**Step 4: Measurement & Analysis**

Bash

\# Check Android Binary Size  
ls \-lh target/aarch64-linux-android/release/libmobile\_gpu\_core.so

\# Verify Symbols (Ensure internal wgpu/rust symbols are hidden)  
\# The output should be minimal, containing only 'T' (Text) symbols for the API.  
llvm-nm \-g \--defined-only target/aarch64-linux-android/release/libmobile\_gpu\_core.so | grep " T "

\# Check Bloat (if size is still high)  
cargo bloat \--release \--target aarch64-linux-android \-n 20

## ---

**9\. Real-World Results and Case Study Synthesis**

Applying the methodology outlined above yields a predictable trajectory of binary size reduction. The following data is synthesized from industry benchmarks, specifically the optimization efforts documented by Bitdrift for their mobile SDKs, and tailored to the wgpu context.1

### **9.1 Reduction Trajectory**

| Optimization Stage | Estimated Size (Android.so) | Primary Reduction Mechanism |
| :---- | :---- | :---- |
| **Baseline (Debug)** | \~50 MB+ | None (Includes full debug info & unoptimized code) |
| **Release Mode** | \~15 MB | opt-level=3 (Speed), partial stripping |
| **Strip Symbols** | \~10 MB | Removal of .symtab / DWARF info |
| **LTO \+ Opt-Level 'z'** | \~6 \- 7 MB | Cross-crate dead code elimination, loop simplification |
| **Feature Pruning** | \~4 \- 5 MB | Removing unused wgpu backends (Metal/DX12 on Android) |
| **build-std \+ abort** | \~2.5 MB | Removal of panic strings, formatting logic, and unwind tables |
| **Linker Visibility** | **\< 2 MB** | **Hiding internals allows LTO to delete unused wgpu logic** |

### **9.2 Analysis of the Final Cut**

The transition from \~2.5MB to \<2MB via Linker Visibility is the most significant architectural insight. Even with build-std and LTO, if the wgpu symbols are legally callable from the outside (because the default is global visibility), the linker *must* preserve them. By applying the Version Script, we contract the library's public interface to just the UniFFI layer. This renders the vast majority of wgpu's internal state management unreachable "dead code" from the perspective of the library boundary, allowing LLVM's LTO pass to aggressively strip it.

## **10\. Conclusion**

Minimizing a Rust binary for mobile deployment from 15MB to under 2MB is a deterministic engineering process, not a matter of chance. It requires a fundamental shift from "default" configurations to a constrained compilation model.

The strategy relies on three pillars:

1. **Foundation:** Recompiling libstd with panic\_immediate\_abort to eliminate the fixed overhead of the language runtime.  
2. **Selection:** Aggressive feature pruning in Cargo.toml to ensure only the strictly necessary graphics backends and parsers are compiled.  
3. **Isolation:** Enforcing strict symbol visibility via linker scripts. This is the catalyst that empowers Link-Time Optimization to discard the substantial weight of the dependencies that are implementation details rather than public API.

By adhering to the configurations and scripts provided in this report, developers can reliably deploy high-performance Rust components within the strict size budgets of modern mobile ecosystems.

#### **Works cited**

1. Optimizing bitdrift's Rust mobile SDK for binary size \- Blog, accessed January 20, 2026, [https://blog.bitdrift.io/post/optimizing-rust-mobile-sdk-binary-size](https://blog.bitdrift.io/post/optimizing-rust-mobile-sdk-binary-size)  
2. johnthagen/min-sized-rust: How to minimize Rust binary size \- GitHub, accessed January 20, 2026, [https://github.com/johnthagen/min-sized-rust](https://github.com/johnthagen/min-sized-rust)  
3. Binary Size Optimization \- Rust Project Primer, accessed January 20, 2026, [https://rustprojectprimer.com/building/size.html](https://rustprojectprimer.com/building/size.html)  
4. Reducing binary size of (Rust) programs with debuginfo | Kobzol's blog, accessed January 20, 2026, [https://kobzol.github.io/rust/2025/09/22/reducing-binary-size-of-rust-programs-with-debuginfo.html](https://kobzol.github.io/rust/2025/09/22/reducing-binary-size-of-rust-programs-with-debuginfo.html)  
5. Improve compile time and executable size by counting lines of LLVM IR \- Rust Users Forum, accessed January 20, 2026, [https://users.rust-lang.org/t/improve-compile-time-and-executable-size-by-counting-lines-of-llvm-ir/14203](https://users.rust-lang.org/t/improve-compile-time-and-executable-size-by-counting-lines-of-llvm-ir/14203)  
6. Control symbol visibility \- NDK \- Android Developers, accessed January 20, 2026, [https://developer.android.com/ndk/guides/symbol-visibility](https://developer.android.com/ndk/guides/symbol-visibility)  
7. Reduce the binary size · Issue \#1464 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu-rs/issues/696](https://github.com/gfx-rs/wgpu-rs/issues/696)  
8. Profiles \- The Cargo Book \- Rust Documentation, accessed January 20, 2026, [https://doc.rust-lang.org/cargo/reference/profiles.html](https://doc.rust-lang.org/cargo/reference/profiles.html)  
9. Reducing App Size | Tauri v1, accessed January 20, 2026, [https://tauri.app/v1/guides/building/app-size/](https://tauri.app/v1/guides/building/app-size/)  
10. What is making a static library in Rust being much large than Go, Zig, and C\#? : r/rust, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1inh4vk/what\_is\_making\_a\_static\_library\_in\_rust\_being/](https://www.reddit.com/r/rust/comments/1inh4vk/what_is_making_a_static_library_in_rust_being/)  
11. Clang does not strip symbols for local static libraries \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/53182634/clang-does-not-strip-symbols-for-local-static-libraries](https://stackoverflow.com/questions/53182634/clang-does-not-strip-symbols-for-local-static-libraries)  
12. How to create static library for iOS without making all symbols public \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/6894214/how-to-create-static-library-for-ios-without-making-all-symbols-public](https://stackoverflow.com/questions/6894214/how-to-create-static-library-for-ios-without-making-all-symbols-public)  
13. Minimizing Your Exported Symbols \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/library/archive/documentation/Performance/Conceptual/CodeFootprint/Articles/ReducingExports.html](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/CodeFootprint/Articles/ReducingExports.html)  
14. wgpu \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/wgpu/](https://docs.rs/wgpu/)  
15. gfx-rs/wgpu: A cross-platform, safe, pure-Rust graphics API. \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu](https://github.com/gfx-rs/wgpu)  
16. Precompiled Shaders · Issue \#3103 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/3103](https://github.com/gfx-rs/wgpu/issues/3103)  
17. InstanceFlags in wgpu \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/wgpu/latest/wgpu/struct.InstanceFlags.html](https://docs.rs/wgpu/latest/wgpu/struct.InstanceFlags.html)  
18. Lifting, Lowering and Serialization \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/0.27/internals/lifting\_and\_lowering.html](https://mozilla.github.io/uniffi-rs/0.27/internals/lifting_and_lowering.html)  
19. Rust scaffolding \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/next/tutorial/Rust\_scaffolding.html](https://mozilla.github.io/uniffi-rs/next/tutorial/Rust_scaffolding.html)  
20. RazrFalcon/cargo-bloat: Find out what takes most of the space in your executable. \- GitHub, accessed January 20, 2026, [https://github.com/RazrFalcon/cargo-bloat](https://github.com/RazrFalcon/cargo-bloat)  
21. cargo-bloat 0.6.4 \- Docs.rs, accessed January 20, 2026, [https://docs.rs/cargo-bloat/0.6.4](https://docs.rs/cargo-bloat/0.6.4)  
22. est31/cargo-udeps: Find unused dependencies in Cargo.toml \- GitHub, accessed January 20, 2026, [https://github.com/est31/cargo-udeps](https://github.com/est31/cargo-udeps)  
23. Unused Dependencies \- Rust Project Primer, accessed January 20, 2026, [https://rustprojectprimer.com/checks/unused.html](https://rustprojectprimer.com/checks/unused.html)  
24. cargo-machete: Remove unused dependencies with this one weird trick\! : r/rust \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/ucysu7/cargomachete\_remove\_unused\_dependencies\_with\_this/](https://www.reddit.com/r/rust/comments/ucysu7/cargomachete_remove_unused_dependencies_with_this/)  
25. How do I find out what all symbols are exported from a shared object? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/1237575/how-do-i-find-out-what-all-symbols-are-exported-from-a-shared-object](https://stackoverflow.com/questions/1237575/how-do-i-find-out-what-all-symbols-are-exported-from-a-shared-object)