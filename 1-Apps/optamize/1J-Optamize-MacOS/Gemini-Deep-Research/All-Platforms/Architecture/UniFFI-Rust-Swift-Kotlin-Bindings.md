# **Technical Architecture Report: High-Performance Cross-Platform Engineering with Mozilla UniFFI**

## **1\. Architectural Vision and Executive Summary**

In the domain of modern mobile application development, the dichotomy between native performance and cross-platform code sharing presents a persistent engineering challenge. The "Opta" project, defined by the requirement to encapsulate 100% of business logic in Rust while driving native SwiftUI and Kotlin shells at a frame rate of 120Hz, occupies a particularly demanding segment of this spectrum. A 120Hz refresh rate imposes a rigid frame budget of approximately 8.33 milliseconds. Within this window, the application must perform state calculations, serialize data, cross the Foreign Function Interface (FFI) boundary, deserialize data, and update the UI tree. Traditional cross-platform frameworks often introduce bridge penalties or runtime overheads that threaten this strict latency budget.

This report establishes a comprehensive technical blueprint for leveraging **Mozilla’s UniFFI** (Universal Foreign Function Interface) to architect such a high-performance system. UniFFI distinguishes itself from manual FFI bindings by automating the generation of scaffolding (Rust side) and bindings (foreign side) to ensure memory safety and type correctness.1 While originally designed to consolidate business logic for Mozilla’s mobile browsers (Firefox on iOS/Android), its adoption of procedural macros in versions 0.25+ allows for a tighter integration with Rust’s type system, enabling the robust architecture required by Opta.1

The analysis indicates that while standard UniFFI patterns provide safety and convenience, the default serialization mechanisms (Lifting/Lowering) incur significant CPU costs acceptable for network I/O but potentially prohibitive for high-frequency animation loops.3 Consequently, this report delineates a hybrid architecture: utilizing standard UniFFI bindings for command-control logic and configuration, while employing "Zero-Copy" shared memory patterns—specifically bypassing UniFFI’s serialization layer for the 120Hz rendering path—to achieve the requisite performance.

## ---

**2\. Foundation and Environment Setup**

The foundational setup of a UniFFI-driven project requires meticulous configuration of the build environment to ensure seamless compilation across three distinct toolchains: Cargo (Rust), Gradle (Android), and Xcode (iOS). The transition from the legacy UniFFI Definition Language (UDL) to the modern procedural macro system represents a paradigm shift in how interfaces are defined, favoring code-first definitions over schema-first files.1

### **2.1 The Modern UniFFI Ecosystem (0.25+): Proc-Macros vs. UDL**

Historically, UniFFI relied on .udl files—an Interface Definition Language based on WebIDL—to describe the API surface. While UDL provides a language-agnostic schema, it introduces friction through the duplication of definitions and the potential for desynchronization between the schema and the implementation. The architectural recommendation for Opta is the exclusive use of **Procedural Macros** (\#\[derive(uniffi::Object)\], \#\[uniffi::export\]). This approach allows the Rust compiler to treat the interface definition as an integral part of the codebase, ensuring that the exported signature exactly matches the implementation and reducing the maintenance burden of the FFI layer.5

However, the analysis suggests that UDL files may still be referenced in legacy documentation or used for specific edge cases not yet fully supported by macros, though the macro system now covers functions, enums, records, objects, and errors comprehensively.1

### **2.2 Directory Structure for Monorepos**

A workspace-based monorepo structure is essential for isolating the core business logic from the platform-specific build artifacts. This separation concerns not just code organization but also compilation targets and linking strategies.

**Recommended Directory Structure:**

opta-monorepo/  
├── Cargo.toml \# Workspace root  
├── core/ \# The Rust Business Logic (Opta Core)  
│ ├── Cargo.toml  
│ ├── build.rs \# UniFFI scaffolding generation hook  
│ ├── uniffi.toml \# Bindings configuration  
│ └── src/  
│ ├── lib.rs \# Library entry point  
│ ├── api.rs \# Exported UniFFI interface  
│ ├── state.rs \# Internal state management  
│ └── bin/  
│ └── uniffi-bindgen.rs \# CLI tool for generating bindings  
├── bindings/ \# Generated bindings (git-ignored or checked in)  
│ ├── ios/  
│ │ ├── OptaFFI.h  
│ │ └── Opta.swift  
│ └── android/  
│ └── com/opta/core/  
├── android-app/ \# Native Android Project (Kotlin)  
│ ├── app/  
│ ├── build.gradle  
│ └── settings.gradle  
└── ios-app/ \# Native iOS Project (Swift)  
├── Opta.xcodeproj  
└── Opta/

### **2.3 Crate Configuration (Cargo.toml)**

The core crate must be configured to produce artifacts compatible with both Android's JNI loading mechanism and iOS's static linking requirements. The crate-type field is critical here. Android requires a dynamic system library (cdylib) to generate the .so files, while iOS typically links against a static library (staticlib) to be embedded in an XCFramework.6

**File:** core/Cargo.toml

Ini, TOML

\[package\]  
name \= "opta\_core"  
version \= "0.1.0"  
edition \= "2021"

\[lib\]  
\# 'cdylib' for Android (.so), 'staticlib' for iOS (.a)  
crate-type \= \["cdylib", "staticlib"\]  
name \= "opta\_core" 

\[dependencies\]  
\# The runtime component of UniFFI. Ensure features matches build-dependencies.  
uniffi \= { version \= "0.28", features \= \["cli", "tokio"\] }

\# Async runtime is required for non-blocking operations in the UI  
tokio \= { version \= "1.0", features \= \["full"\] }

\# Serialization is useful for complex state transfer, even if specialized  
\# zero-copy paths are used for the hot loop.  
serde \= { version \= "1.0", features \= \["derive"\] }  
thiserror \= "1.0"  
bytes \= "1.5" \# For efficient byte manipulation

\[build-dependencies\]  
\# The build-time component to generate scaffolding  
uniffi \= { version \= "0.28", features \= \["build"\] }

### **2.4 The Build Script (build.rs)**

The build.rs script is the integration point where UniFFI analyzes the Rust code to generate the C-compatible extern functions (scaffolding). In the proc-macro approach, this script invokes generate\_scaffolding, pointing it to the crate entry point.

**File:** core/build.rs

Rust

fn main() {  
    // This function generates the Rust scaffolding for proc-macro defined interfaces.  
    // It scans the source code for \#\[uniffi::export\] attributes.  
    // It does NOT generate the Swift/Kotlin code; that is handled by the CLI tool.  
    uniffi::generate\_scaffolding("./src/lib.rs").unwrap();  
}

### **2.5 Bindings Generator Binary**

Unlike UDL-based setups where the uniffi-bindgen binary could be installed globally, the proc-macro architecture strongly suggests creating a local binary within the crate. This ensures that the version of the bindgen tool exactly matches the version of the uniffi runtime dependency, preventing subtle ABI mismatches.8

**File:** core/src/bin/uniffi-bindgen.rs

Rust

fn main() {  
    uniffi::uniffi\_bindgen\_main();  
}

This binary can then be invoked via cargo run \--bin uniffi-bindgen to generate the Swift and Kotlin files, guaranteeing version parity.

## ---

**3\. Type Marshaling and Interface Definition**

UniFFI operates by "lowering" high-level Rust types into primitive C-compatible types (integers, pointers, byte buffers) that can cross the FFI boundary, and then "lifting" them back into high-level types in the target language.4 Understanding this mechanism is crucial for Opta's performance tuning.

### **3.1 Primitives and Strings**

Primitive types such as u8, i32, f64, and bool are mapped directly to their platform equivalents (e.g., UInt8, Int32, Double in Swift; Byte, Int, Double in Kotlin). This marshaling is extremely fast as it involves simple value copying.

Strings, however, incur allocation overhead. A Rust String is lowered into a RustBuffer containing UTF-8 bytes. The foreign binding (Swift/Kotlin) must then read this buffer and allocate a new native String object. For high-frequency loops (120Hz), repeated String passing should be minimized.10

**Rust Implementation:**

Rust

\#\[uniffi::export\]  
pub fn calculate\_velocity(distance: f64, time: f64) \-\> f64 {  
    if time \== 0.0 { return 0.0; }  
    distance / time  
}

// CAUTION: Frequent calling of string-returning functions   
// at 120Hz will cause GC pressure in Kotlin.  
\#\[uniffi::export\]  
pub fn get\_status\_message(code: u32) \-\> String {  
    match code {  
        0 \=\> "Idle".to\_string(),  
        1 \=\> "Active".to\_string(),  
        \_ \=\> format\!("Unknown status: {}", code),  
    }  
}

### **3.2 Complex Enums and Records**

UniFFI maps Rust structs to Swift structs and Kotlin data classes. These are passed by value. When a Rust struct is returned, it is serialized into a RustBuffer (a byte array), passed over FFI, and then deserialized on the other side. This is known as the "serialization overhead".4

**Rust Definition:**

Rust

\#  
pub struct RenderConfig {  
    pub frame\_rate: u32,  
    pub enable\_blur: bool,  
    pub canvas\_id: String,  
}

\#\[derive(uniffi::Enum)\] // Use \[Enum\] for C-like enums or ADTs  
pub enum ConnectionState {  
    Disconnected,  
    Connecting { retry\_count: u8 },  
    Connected { session\_id: String, latency\_ms: u64 },  
}

**Implications:**

* **Swift:** ConnectionState becomes a native Swift enum with associated values, offering seamless pattern matching.  
* **Kotlin:** It becomes a sealed class hierarchy.  
* **Performance:** Passing large records at 120Hz will saturate the memory allocator due to the serialize-copy-deserialize cycle.

### **3.3 Object Pattern (Stateful Services)**

To maintain the "100% business logic in Rust" requirement, the application state must persist on the Rust side. The \#\[derive(uniffi::Object)\] macro enables this by exposing opaque pointers (handles) to the foreign language. The foreign object (e.g., a Swift class) holds this pointer, and methods called on it are forwarded to Rust.5

**Rust Definition:**

Rust

use std::sync::{Arc, Mutex};

\#\[derive(uniffi::Object)\]  
pub struct AnimationEngine {  
    // Internal mutability is required because exposed methods take \&self,  
    // not \&mut self, to ensure thread safety across FFI.  
    state: Mutex\<f64\>,   
}

\#\[uniffi::export\]  
impl AnimationEngine {  
    \#\[uniffi::constructor\]  
    pub fn new(initial\_value: f64) \-\> Arc\<Self\> {  
        Arc::new(Self {  
            state: Mutex::new(initial\_value),  
        })  
    }

    pub fn tick(&self, delta: f64) \-\> f64 {  
        let mut guard \= self.state.lock().unwrap();  
        \*guard \+= delta;  
        \*guard  
    }  
}

### **3.4 Callback Interfaces**

For the UI to react to asynchronous events (e.g., a network packet arriving), Rust must call into the foreign language. This is achieved via callback\_interface. The foreign code implements a protocol/interface, and passes an instance to Rust.

**Rust Definition:**

Rust

\#\[uniffi::export(callback\_interface)\]  
pub trait FrameListener: Send \+ Sync {  
    fn on\_frame(&self, timestamp: u64);  
}

\#\[uniffi::export\]  
pub fn register\_listener(listener: Box\<dyn FrameListener\>) {  
    // Rust can now call listener.on\_frame()  
    // The foreign object is kept alive by the Box  
}

**Insight:** The trait bounds Send \+ Sync are mandatory.12 UniFFI enforces this because the callback might be invoked from a background Rust thread, different from the thread where the object was created. This is a critical safety feature preventing race conditions common in manual JNI implementations.

## ---

**4\. High-Performance Patterns: Solving the 120Hz Challenge**

The requirement to update state at 120Hz creates a specific performance constraint that standard UniFFI patterns may fail to meet. The default behavior involves serializing arguments into a RustBuffer, invoking the FFI, and deserializing on the target side.

**The Bottleneck:** At 120Hz, you have 8.33ms per frame. If serialization of a large vertex buffer or state object takes 2ms, and the subsequent deserialization and object allocation in Kotlin takes 3ms, over 60% of the frame budget is consumed just by moving data. Furthermore, the constant allocation of temporary buffers triggers frequent Garbage Collection (GC) events in the JVM, causing visible "jank".13

### **4.1 Comparison of Data Transfer Strategies**

| Strategy | Mechanism | Pros | Cons | Suitability for 120Hz |
| :---- | :---- | :---- | :---- | :---- |
| **Standard UniFFI** | Serialize to RustBuffer \-\> Deserialize | Type-safe, idiomatic | High CPU usage, GC pressure | Low (Simple data only) |
| **FlatBuffers** | Zero-parse serialization | Low parsing overhead | Still copies memory to Swift/Kotlin | Medium |
| **Zero-Copy (Raw Pointers)** | Pass memory address (u64) | No Copy, Instant | unsafe, requires manual lifetime mgmt | **High** |

### **4.2 Strategy 1: The "Zero-Copy" Shared Memory Pattern**

To achieve true 120Hz performance for large datasets (e.g., pixel buffers, vertex arrays, massive entity lists), we must eliminate the copy entirely. We do this by exposing a pointer to a Rust-owned memory region and allowing the foreign language to read it directly.

#### **4.2.1 Rust Side: Leaking the Buffer**

We allocate memory in Rust and prevent it from being dropped, returning a pointer and length wrapped in a simple struct.

Rust

// core/src/memory.rs

\#  
pub struct BufferView {  
    pub ptr: u64, // We use u64 to transport the pointer address safely  
    pub len: u64,  
}

// Simulating a persistent render state  
struct RenderState {  
    data: Vec\<f32\>,  
}

// A global or Arc-shared state container  
static mut RENDER\_STATE: Option\<RenderState\> \= None;

\#\[uniffi::export\]  
pub fn get\_render\_buffer\_view() \-\> BufferView {  
    // 1\. Initialize or update data  
    // In a real app, this would be behind a Mutex or RwLock  
    let data \= vec\!\[1.0f32; 10\_000\];   
      
    let (ptr, len) \= unsafe {  
        if RENDER\_STATE.is\_none() {  
             RENDER\_STATE \= Some(RenderState { data });  
        }  
        let state \= RENDER\_STATE.as\_ref().unwrap();  
        // Return the pointer to the existing Vec's buffer.  
        // We do NOT clone the Vec.  
        (state.data.as\_ptr(), state.data.len())  
    };

    BufferView {  
        ptr: ptr as u64,  
        len: len as u64,  
    }  
}

#### **4.2.2 Swift Side: Unsafe Consumption**

In Swift, we reconstruct an UnsafeBufferPointer from the address. This allows Swift to read the memory without copying it.15

Swift

// Swift Implementation  
func renderLoop() {  
    let view \= getRenderBufferView()  
      
    // 1\. Recover the raw pointer from the u64  
    guard let rawPtr \= UnsafeRawPointer(bitPattern: UInt(view.ptr)) else { return }  
      
    // 2\. Bind the memory to the expected type (Float)  
    // This creates a view, it does NOT copy the data.  
    let buffer \= UnsafeBufferPointer(  
        start: rawPtr.assumingMemoryBound(to: Float.self),  
        count: Int(view.len)  
    )  
      
    // 3\. Pass directly to graphics API (e.g., Metal)  
    // The memory is owned by Rust. Do NOT free it here.  
    metalDevice.makeBuffer(bytes: buffer.baseAddress\!, length: buffer.count \* 4, options:)  
}

#### **4.2.3 Kotlin Side: Direct ByteBuffers**

In Kotlin, accessing raw memory is achieved via java.nio.ByteBuffer or JNA Pointer. Since UniFFI for Kotlin already uses JNA internally, utilizing JNA's Pointer class is the most robust bridge.17

Kotlin

// Kotlin Implementation  
import com.sun.jna.Pointer  
import java.nio.ByteOrder

fun renderLoop() {  
    val view \= getRenderBufferView()  
      
    // 1\. Create a JNA Pointer from the address  
    val pointer \= Pointer(view.ptr.toLong())  
      
    // 2\. Map a DirectByteBuffer to the memory (Zero Copy)  
    // Note: length is element count, so multiply by 4 for Float (32-bit)  
    val byteBuffer \= pointer.getByteBuffer(0, view.len.toLong() \* 4)  
       .order(ByteOrder.nativeOrder())  
      
    // 3\. Create a Float view  
    val floatBuffer \= byteBuffer.asFloatBuffer()  
      
    // 4\. Pass to OpenGL/Vulkan  
    GLES20.glUniform1fv(location, view.len.toInt(), floatBuffer)  
}

**Critical Safety Warning:** This pattern relies on the Rust memory remaining valid while the UI thread reads it. If Rust reallocates the Vec (e.g., via push), the pointer held by Swift/Kotlin becomes a dangling pointer, leading to a crash (Use-After-Free).

* **Mitigation:** Use a **Double Buffering** pattern. Rust writes to Buffer A. UI reads Buffer B. When both are done, they swap indices atomically. This ensures the UI never reads memory that Rust is actively resizing or writing to.

### **4.3 High-Performance Data Types: FlatBuffers**

While raw pointers offer raw speed, they lack schema evolution. FlatBuffers is a compromise. UniFFI can return a Vec\<u8\> containing a FlatBuffer. While UniFFI *will* copy this Vec\<u8\> into a Swift Data or Kotlin ByteArray 4, the deserialization step is skipped. You simply point the FlatBuffer accessor to the byte array. This is suitable for complex structured data (e.g., a scene graph) where the overhead of serde deserialization is the bottleneck, rather than the memory copy itself.19

## ---

**5\. Error Handling Patterns**

Robust error handling is non-negotiable. UniFFI maps Rust Result types to checked exceptions in the target languages.

### **5.1 Defining Custom Errors**

Use the thiserror crate to define errors and derive uniffi::Error. The flat\_error attribute is particularly useful for wrapping external errors without manual mapping.5

Rust

\#  
pub enum OptaError {  
    \#\[error("Network connection failed: {0}")\]  
    NetworkError(String),  
      
    \#\[error("Invalid state: {0}")\]  
    InvalidState(String),  
      
    \#\[error("IO failure")\]  
    IoError(\#\[from\] std::io::Error), // Auto-conversion  
}

### **5.2 Result Return Types**

Expose functions returning Result\<T, OptaError\>.

Rust

\#\[uniffi::export\]  
pub fn load\_scene(id: String) \-\> Result\<SceneObject, OptaError\> {  
    if id.is\_empty() {  
        return Err(OptaError::InvalidState("Empty ID provided".into()));  
    }  
    //... logic...  
    Ok(SceneObject::new())  
}

### **5.3 Handling in Shells**

* **Swift:** The function is marked throws.  
  Swift  
  do {  
      let scene \= try loadScene(id: "main")  
  } catch let error as OptaError {  
      print("Error: \\(error)")  
  } catch {  
      print("Unknown error")  
  }

* **Kotlin:** The function throws an Exception.  
  Kotlin  
  try {  
      val scene \= loadScene("main")  
  } catch (e: Exception) {  
      // UniFFI wraps the error; utilize e.message or cast if generated specific exceptions  
      Log.e("Opta", "Error: ${e.message}")  
  }

### **5.4 Panics vs. Results**

UniFFI acts as a panic firewall. If Rust panics (e.g., unwrap() on None), UniFFI catches the unwind at the FFI boundary and translates it into a RustPanic exception in the foreign language.12 This prevents the OS from killing the app instantly, but the Rust state may be poisoned. **Guideline:** Never intentionally panic. Always return Result.

## ---

**6\. Thread Safety and Concurrency**

Opta's architecture implies heavy concurrency (UI thread, Animation thread, Background logic). UniFFI enforces strict thread-safety rules.

### **6.1 The Send \+ Sync Requirement**

UniFFI mandates that all exposed Object types implement Send and Sync. This is because a Swift object wrapping a Rust pointer might be passed from the Main Thread to a background Dispatch Queue. If the underlying Rust struct isn't thread-safe, this would cause data races.

If your logic uses Rc\<RefCell\<T\>\> (non-thread-safe), you cannot expose it via UniFFI. You must use Arc\<Mutex\<T\>\> or Arc\<RwLock\<T\>\>.20

### **6.2 The Actor Pattern**

For state management, the **Actor Pattern** is superior to simple Mutexes, especially when bridging async Rust with synchronous UI.

Rust

use tokio::sync::{mpsc, oneshot};

struct State {  
    count: i32,  
}

enum Command {  
    Increment,  
    Get(oneshot::Sender\<i32\>),  
}

\#\[derive(uniffi::Object)\]  
pub struct AppActor {  
    tx: mpsc::Sender\<Command\>,  
}

\#\[uniffi::export\]  
impl AppActor {  
    \#\[uniffi::constructor\]  
    pub fn new() \-\> Arc\<Self\> {  
        let (tx, mut rx) \= mpsc::channel(100);  
          
        // Spawn the actor on the Tokio runtime  
        tokio::spawn(async move {  
            let mut state \= State { count: 0 };  
            while let Some(cmd) \= rx.recv().await {  
                match cmd {  
                    Command::Increment \=\> state.count \+= 1,  
                    Command::Get(reply) \=\> { let \_ \= reply.send(state.count); }  
                }  
            }  
        });

        Arc::new(Self { tx })  
    }

    pub fn increment(&self) {  
        // Non-blocking send  
        let \_ \= self.tx.try\_send(Command::Increment);  
    }

    // Async method exposed to Foreign code  
    pub async fn get\_count(&self) \-\> i32 {  
        let (tx, rx) \= oneshot::channel();  
        self.tx.send(Command::Get(tx)).await.unwrap();  
        rx.await.unwrap()  
    }  
}

This pattern isolates state mutation to a single thread (the actor), eliminating the need for complex locking strategies in the business logic.21

## ---

**7\. Real-World Patterns: State Management**

### **7.1 The ViewModel Pattern**

Instead of passing raw domain entities to the UI, Rust should expose ViewModel objects that are pre-formatted for display. This keeps formatting logic consistent across iOS and Android.

Rust

\#\[derive(uniffi::Object)\]  
pub struct DashboardViewModel {  
    pub title: String,  
    pub is\_loading: bool,  
    items: Vec\<String\>,  
}

\#\[uniffi::export\]  
impl DashboardViewModel {  
    pub fn get\_display\_title(&self) \-\> String {  
        format\!("Dashboard: {}", self.title).to\_uppercase()  
    }  
}

### **7.2 Event Sourcing for 120Hz**

Polling is often more predictable than callbacks for high-frequency loops. Instead of Rust calling on\_frame 120 times a second, the UI loop asks "What happened?" each frame.

Rust

\#\[derive(uniffi::Enum)\]  
pub enum UiEvent {  
    EntityMoved { id: u32, x: f32, y: f32 },  
    SoundPlayed { name: String },  
}

\#\[uniffi::export\]  
pub fn poll\_events() \-\> Vec\<UiEvent\> {  
    // Return all events accumulated since the last frame.  
    // This batches FFI calls, reducing overhead significantly.  
    EVENT\_QUEUE.lock().unwrap().drain(..).collect()  
}

This effectively batches updates, reducing the number of FFI crossings from $N \\times 120$ to $1 \\times 120$ per second.

## ---

**8\. Build Pipeline and Automation**

Generating the bindings is only half the battle; integrating them into the build systems is critical.

### **8.1 Android Integration**

Android builds require the cargo-ndk tool to handle JNI library naming and linking arguments.

**Build Script (build-android.sh):**

Bash

\#\!/bin/bash  
\# 1\. Build the Rust dynamic libraries (.so)  
\# We target standard Android architectures  
cargo ndk \-t arm64-v8a \-t armeabi-v7a \-t x86\_64 \\  
    \-o./android-app/app/src/main/jniLibs build \--release

\# 2\. Generate Kotlin Bindings  
\# We must point to one of the generated libraries to extract the interface  
cargo run \--bin uniffi-bindgen generate \\  
    \--library./target/aarch64-linux-android/release/libopta\_core.so \\  
    \--language kotlin \\  
    \--out-dir./android-app/app/src/main/java/com/opta/core

### **8.2 iOS Integration**

iOS requires creating an XCFramework that bundles static libraries for devices (arm64) and simulators (arm64/x86\_64).

**Build Script (build-ios.sh):**

Bash

\#\!/bin/bash  
\# 1\. Build Static Libraries  
cargo build \--release \--target aarch64-apple-ios  
cargo build \--release \--target aarch64-apple-ios-sim

\# 2\. Generate Swift Bindings  
\# The CLI generates a.swift file and a C header (.h) module map  
cargo run \--bin uniffi-bindgen generate \\  
    \--library./target/aarch64-apple-ios/release/libopta\_core.a \\  
    \--language swift \\  
    \--out-dir./bindings/swift

\# 3\. Create XCFramework  
\# We bundle the static libs and the generated headers into a framework  
xcodebuild \-create-xcframework \\  
    \-library./target/aarch64-apple-ios/release/libopta\_core.a \\  
    \-headers./bindings/swift \\  
    \-library./target/aarch64-apple-ios-sim/release/libopta\_core.a \\  
    \-headers./bindings/swift \\  
    \-output./ios-app/OptaCore.xcframework

**Note:** The generated module.modulemap in the bindings directory is crucial for allowing Swift to import the C headers generated by UniFFI.22

### **8.3 Configuring uniffi.toml**

To fine-tune the generated code, place a uniffi.toml file in the crate root. This is essential for controlling namespace collisions or adjusting generation settings.

Ini, TOML

\[bindings.kotlin\]  
package\_name \= "com.opta.core"

\[bindings.swift\]  
\# Omit argument labels to make Swift code feel more Rust-like (optional)  
omit\_argument\_labels \= true 

## **Conclusion**

The architecture defined for "Opta" leverages Mozilla UniFFI 0.25+ to create a safe, maintainable cross-platform core. By adhering to the **Procedural Macro** workflow, the project ensures strict synchronization between Rust implementations and foreign interfaces. While UniFFI's default marshaling handles standard application logic effectively, the stringent 120Hz requirement mandates the adoption of the **Zero-Copy Shared Memory** pattern (Strategy 4.2) for the rendering loop. This hybrid approach—safety for logic, raw pointers for performance—combined with the **Actor Pattern** for state management, provides a robust foundation for a high-performance, native-feel application driven entirely by Rust.

#### **Works cited**

1. The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/](https://mozilla.github.io/uniffi-rs/)  
2. generate UDL from proc macros \#2345 \- mozilla/uniffi-rs \- GitHub, accessed January 20, 2026, [https://github.com/mozilla/uniffi-rs/issues/2345](https://github.com/mozilla/uniffi-rs/issues/2345)  
3. Generating Javascript bindings with UniFFI \- Firefox Source Docs, accessed January 20, 2026, [https://firefox-source-docs.mozilla.org/rust-components/developing-rust-components/uniffi.html](https://firefox-source-docs.mozilla.org/rust-components/developing-rust-components/uniffi.html)  
4. Lifting, Lowering and Serialization \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/0.28/internals/lifting\_and\_lowering.html](https://mozilla.github.io/uniffi-rs/0.28/internals/lifting_and_lowering.html)  
5. Procedural Macros: Attributes and Derives \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/proc\_macro/index.html](https://mozilla.github.io/uniffi-rs/proc_macro/index.html)  
6. Configuration \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/swift/configuration.html](https://mozilla.github.io/uniffi-rs/latest/swift/configuration.html)  
7. Configuration \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/kotlin/configuration.html](https://mozilla.github.io/uniffi-rs/latest/kotlin/configuration.html)  
8. Shared core and types \- Crux: Cross-platform app development in Rust \- GitHub Pages, accessed January 20, 2026, [https://redbadger.github.io/crux/getting\_started/core.html](https://redbadger.github.io/crux/getting_started/core.html)  
9. Foreign-language bindings \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/tutorial/foreign\_language\_bindings.html](https://mozilla.github.io/uniffi-rs/latest/tutorial/foreign_language_bindings.html)  
10. Lifting, Lowering and Serialization \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/internals/lifting\_and\_lowering.html](https://mozilla.github.io/uniffi-rs/latest/internals/lifting_and_lowering.html)  
11. Lifting, Lowering and Serialization \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/0.27/internals/lifting\_and\_lowering.html](https://mozilla.github.io/uniffi-rs/0.27/internals/lifting_and_lowering.html)  
12. Design Principles \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/internals/design\_principles.html](https://mozilla.github.io/uniffi-rs/latest/internals/design_principles.html)  
13. JNI library for Kotlin/Java/KMP · Issue \#2672 · mozilla/uniffi-rs \- GitHub, accessed January 20, 2026, [https://github.com/mozilla/uniffi-rs/issues/2672](https://github.com/mozilla/uniffi-rs/issues/2672)  
14. How uniffi-bindgen-gecko-js handles lifting and lowering \- Firefox Source Docs, accessed January 20, 2026, [https://firefox-source-docs.mozilla.org/rust-components/uniffi-bindgen-gecko-js-dev-guide/lifting-and-lowering.html](https://firefox-source-docs.mozilla.org/rust-components/uniffi-bindgen-gecko-js-dev-guide/lifting-and-lowering.html)  
15. UnsafePointer | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/swift/unsafepointer](https://developer.apple.com/documentation/swift/unsafepointer)  
16. How could I do basic memory layout control for bridging Swift to Rust?, accessed January 20, 2026, [https://forums.swift.org/t/how-could-i-do-basic-memory-layout-control-for-bridging-swift-to-rust/83129](https://forums.swift.org/t/how-could-i-do-basic-memory-layout-control-for-bridging-swift-to-rust/83129)  
17. Need help with Mozilla UniFFI \+ Rust for Android/IOS \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1pzkupq/need\_help\_with\_mozilla\_uniffi\_rust\_for\_androidios/](https://www.reddit.com/r/rust/comments/1pzkupq/need_help_with_mozilla_uniffi_rust_for_androidios/)  
18. Pointer \- jna 5.18.1 javadoc, accessed January 20, 2026, [https://javadoc.io/doc/net.java.dev.jna/jna/latest/com/sun/jna/Pointer.html?is-external=true](https://javadoc.io/doc/net.java.dev.jna/jna/latest/com/sun/jna/Pointer.html?is-external=true)  
19. FlatBuffers Docs, accessed January 20, 2026, [https://flatbuffers.dev/](https://flatbuffers.dev/)  
20. Managing Object References \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/internals/object\_references.html](https://mozilla.github.io/uniffi-rs/latest/internals/object_references.html)  
21. Synchronize data in several threads with very different update rates \- Rust Users Forum, accessed January 20, 2026, [https://users.rust-lang.org/t/synchronize-data-in-several-threads-with-very-different-update-rates/121993](https://users.rust-lang.org/t/synchronize-data-in-several-threads-with-very-different-update-rates/121993)  
22. Building an iOS App with Rust Using UniFFI \- DEV Community, accessed January 20, 2026, [https://dev.to/almaju/building-an-ios-app-with-rust-using-uniffi-200a](https://dev.to/almaju/building-an-ios-app-with-rust-using-uniffi-200a)  
23. uniffi-bindgen-swift \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/next/swift/uniffi-bindgen-swift.html](https://mozilla.github.io/uniffi-rs/next/swift/uniffi-bindgen-swift.html)