# **Architectural Blueprint for Opta: The Rust-Core, SwiftUI-Shell Hybrid**

## **1\. Introduction: The Thin Shell Paradigm**

The contemporary landscape of high-performance application development for Apple platforms stands at a crossroads. On one hand, SwiftUI offers a declarative, fluent interface toolkit that is deeply integrated into the operating system, providing the native responsiveness and accessibility features that users demand. On the other hand, the logic required for complex domains—such as high-frequency trading, scientific simulation, or, in the case of **Opta**, premium optimization algorithms—benefits immensely from the memory safety, zero-cost abstractions, and cross-platform portability of Rust.

This report articulates the architectural strategy for "Opta," a premium optimization application. The proposed architecture is the **"Thin Shell"** pattern. In this model, the platform-specific code (SwiftUI) acts strictly as a presentation layer—a thin membrane over a robust, portable "Brain" written in Rust. This separation is not merely a matter of code organization; it is a strategic decision to ensure bit-perfect consistency of business logic across potential future platforms while leveraging the raw computational power required for optimization tasks.

The following sections provide an exhaustive technical guide to realizing this architecture. We explore the intricacies of bridging two distinct memory models via UniFFI, establishing a Unidirectional Data Flow (UDF) that spans the language boundary, embedding hardware-accelerated wgpu render surfaces within a reactive Swift hierarchy, and integrating deep system features like App Intents and Accessibility. This analysis synthesizes technical constraints, performance considerations, and ecosystem-specific quirks to provide a roadmap for building a professional-grade tool that feels native on iOS and macOS while running on a portable systems-language core.

## ---

**2\. Architectural Core: The Bridge and State Management**

The fundamental challenge in a hybrid application is the boundary. How two languages with different memory management philosophies—Swift with its Automatic Reference Counting (ARC) and Rust with its ownership and borrow checker—communicate defines the stability and performance of the app.

### **2.1 The UniFFI Bridge Strategy**

For Opta, manual Foreign Function Interface (FFI) bindings using C-headers are rejected due to their fragility and lack of type safety. Instead, we employ **UniFFI** (Unified FFI), a toolchain that automatically generates safe bindings from a schema.

#### **2.1.1 The Mechanics of Lifting and Lowering**

UniFFI operates on the concept of "lifting" and "lowering." When Swift calls a Rust function, native Swift types (like Int, String, or Data) must be "lowered" into primitive C-types that can cross the FFI boundary. Conversely, complex return types from Rust must be "lifted" back into Swift objects.

For a high-performance app like Opta, understanding the cost of this bridging is critical. Primitives map directly: a Rust u32 becomes a Swift UInt32.1 Strings, however, incur a copy, as Rust String (UTF-8) and Swift String (historically UTF-16, now UTF-8 capable but structurally different) have different memory layouts. For optimization datasets which might be large, passing data via serialization (Protocol Buffers or JSON) across the bridge can be a bottleneck. The architecture favors passing "handles" or "opaque pointers" to large datasets rather than the data itself. The Swift side holds a reference to a RustObject, and methods are called on that object to retrieve only the necessary view data.1

#### **2.1.2 Object Lifecycles and Ownership**

A critical divergence between Swift and Rust is memory management. Swift uses ARC; Rust uses affine types (move semantics). UniFFI bridges this by wrapping Rust objects in an Arc\<T\> (Atomic Reference Counted) pointer. When this object is passed to Swift, it is wrapped in a Swift class. The Swift deinitializer (deinit) is hooked to decrement the Rust Arc.

This imposes a constraint on the Opta architecture: **The Rust Core must be the owner of the data.** Swift views should never "own" business logic state directly but should hold references to Rust managed objects. This prevents "use-after-free" errors and ensures that the optimization engine can continue running even if the UI view holding a reference is temporarily deallocated during navigation transitions.3

### **2.2 Unidirectional Data Flow (UDF) Across Boundaries**

To maintain sanity in a hybrid app, we strictly enforce **Unidirectional Data Flow**. State flows up from Rust to Swift; Actions flow down from Swift to Rust. This cycle prevents the "split-brain" problem where the UI and the Core disagree on the application state.

#### **2.2.1 The Cycle Implementation**

1. **Action Dispatch:** The user interacts with the SwiftUI shell (e.g., dragging a slider to adjust a constraint). This interaction is converted into a structured Action enum in Swift (e.g., .updateConstraint(id: 1, value: 50.0)).  
2. **The FFI Call:** The Swift View Model calls a method on the RustCore singleton, passing this action. This call is typically asynchronous to avoid blocking the main thread.5  
3. **Rust Mutation:** The Rust core, protected by a mutex (or an actor model using Tokio), receives the action. It mutates the canonical AppState.  
4. **State Observation:** Ideally, we want Swift to "react" to this change. However, Rust structs do not automatically trigger SwiftUI's objectWillChange publisher.

#### **2.2.2 The Observer Pattern & The Main Actor**

To bridge the reactivity gap, we implement the Observer pattern. The Rust core defines a StateListener trait. The Swift layer implements this trait and registers itself with the Rust core on startup.

Rust

// Rust UDL/Proc-Macro Definition  
\#\[uniffi::export(callback\_interface)\]  
pub trait StateListener: Send \+ Sync {  
    fn on\_state\_changed(&self, new\_state\_json: String);  
}

When the Rust state changes, it iterates through registered listeners and calls on\_state\_changed.

**The Concurrency Trap:** Rust usually executes this callback on a background thread (e.g., a Tokio worker thread). SwiftUI updates *must* happen on the Main Thread. If the Swift implementation of on\_state\_changed tries to update a @Published property directly, the app will crash or exhibit undefined behavior.

**The Solution:** The Swift listener implementation must explicitly dispatch the update to the Main Actor.

Swift

class CoreListener: StateListener {  
    func onStateChanged(newStateJson: String) {  
        Task { @MainActor in  
            AppModel.shared.update(from: newStateJson)  
        }  
    }  
}

This pattern ensures thread safety while preserving the reactive nature of SwiftUI.7

### **2.3 The View Model Adapter: Bridging Observable**

SwiftUI's state management relies heavily on the @Observable macro (iOS 17+) or ObservableObject protocol. Since UniFFI-generated Swift classes do not conform to these protocols natively, we introduce a **View Model Adapter** layer.

This layer wraps the raw Rust handles and exposes Swift-native, observable properties.

| Feature | Raw Rust Object (UniFFI) | Swift View Model Adapter |
| :---- | :---- | :---- |
| **Type** | Swift Class wrapping void\* | Swift Class with @Observable |
| **Properties** | Computed, calls FFI getter | Stored, @Published / tracked |
| **Thread Safety** | Depends on Rust Send/Sync | Guaranteed MainActor |
| **Change Detection** | None | Automatic via Observation framework |

The Adapter is responsible for:

1. **Caching:** Storing a copy of the view-relevant state to prevent frequent FFI crossings for static data.  
2. **Transformation:** Converting Rust primitives (e.g., timestamps as u64) into Swift types (e.g., Date).  
3. **Throttling:** If the Rust optimization engine emits updates at 1000Hz, the Adapter acts as a damper, updating the UI at a readable 60Hz or 30Hz to preserve battery life and rendering performance.9

## ---

**3\. Navigation: Rust-Driven Routing**

In the "Thin Shell" architecture, navigation is not a side effect of view hierarchy; it is a first-class citizen of the Application State. For Opta, this means the current screen, the stack of previous screens, and the active modal sheets are defined in Rust.

### **3.1 Modeling Navigation State**

We define the navigation structure in Rust using an enum, representing every possible destination in the app.

Rust

\#  
pub enum Route {  
    Dashboard,  
    ProjectEditor { project\_id: String },  
    SimulationResults { run\_id: String },  
    Settings,  
}

pub struct NavigationState {  
    pub stack: Vec\<Route\>,  
    pub active\_sheet: Option\<Route\>,  
}

This NavigationState is part of the global AppState. This approach allows the "Brain" to control the flow. For example, if an optimization run fails, the Rust core can programmatically push a ErrorDetails route onto the stack, regardless of where the user is in the app.

### **3.2 Binding to SwiftUI's NavigationStack**

SwiftUI's NavigationStack (iOS 16+) is data-driven, making it a perfect partner for this architecture. It accepts a path, which is a collection of Hashable items.

The challenge is the bidirectional nature of the binding.

1. **Rust to Swift:** When AppState.navigation\_stack changes, the Swift NavigationPath must be updated. This pushes views onto the screen.  
2. **Swift to Rust:** When the user taps the native "Back" button, SwiftUI removes the last item from the path. The Swift layer must intercept this change and notify Rust to pop the route from its internal stack; otherwise, the states will desynchronize.

To handle this, we use a custom Binding in the View Model:

Swift

var navPathBinding: Binding\<NavigationPath\> {  
    Binding(  
        get: { self.viewModel.currentPath },  
        set: { newPath in  
            // Calculate difference (Push or Pop)  
            if newPath.count \< self.viewModel.currentPath.count {  
                self.core.dispatch(.popRoute)  
            }  
            // Note: We rarely 'set' complex paths from UI, mostly just pops.  
        }  
    )  
}

This ensures that the "Back" action is treated as a state mutation request, preserving the Unidirectional Data Flow.11

### **3.3 Deep Linking and State Restoration**

Since navigation is serialized data, **Deep Linking** becomes a trivial mapping problem. An incoming URL opta://project/123 is parsed by Swift, converted into Route::ProjectEditor { project\_id: "123" }, and dispatched to the Rust core. The core updates the state, and the UI reflects the change instantly.

**State Restoration** is equally streamlined. On app termination, Rust serializes the AppState (including the navigation stack) to disk. On launch, it deserializes it. The SwiftUI shell observes this initial state and reconstructs the entire view hierarchy—navigating deep into a specific project screen—without any imperative "push view" code in Swift. This provides a seamless continuity of experience for the user.14

## ---

**4\. High-Fidelity Rendering: Embedding wgpu**

Opta requires visualization of optimization landscapes, which implies high-performance graphics. **wgpu** is the Rust standard for portable GPU rendering. Embedding a wgpu surface into a SwiftUI application requires bridging the gap between Rust's GPU context and Apple's Metal layer.

### **4.1 The Platform View Bridge**

SwiftUI does not render directly; it describes views. To render wgpu content, we must drop down to the underlying UI framework: UIView (iOS) or NSView (macOS), backed by a CAMetalLayer.16

We utilize UIViewRepresentable (or NSViewRepresentable) to wrap this layer.

#### **4.1.1 The CAMetalLayer Strategy**

The CAMetalLayer is the canvas. The critical handshake involves passing a pointer to this layer from Swift to Rust.

1. **Swift:** Creates a MetalView subclass where layerClass returns CAMetalLayer.self.  
2. **Handshake:** Swift extracts the UnsafeMutableRawPointer to the layer and passes it to the Rust initialization function.  
3. **Rust:** Uses raw-window-handle to construct a HasRawWindowHandle wrapper around this pointer. wgpu uses this to create a Surface.16

**Crucial Technical Detail:** On iOS, the CAMetalLayer is tied to the UIView's lifecycle. If the view resizes (e.g., device rotation), Swift must notify Rust to resize the wgpu surface configuration (swap chain). Failure to do so results in stretched or pixelated rendering.

### **4.2 The Render Loop and Threading**

Unlike standard UI, 3D rendering needs a drive mechanism. We cannot rely on SwiftUI's layout passes to trigger frames. We implement a **Display Link** (CADisplayLink on iOS, CVDisplayLink on macOS).

* **The Coordinator:** The Coordinator object in the UIViewRepresentable manages the Display Link.  
* **The Callback:** On every screen refresh (VSync), the Display Link calls a method on the Coordinator, which in turn calls rust\_core.render\_frame().

**Thread Safety:** This render call happens on the main thread (iOS) or a dedicated render thread (macOS). The Rust renderer must be thread-safe. Ideally, the wgpu state is wrapped in a Mutex or RwLock. However, locking the main thread for rendering can cause UI stutters.

* **Best Practice:** The main thread callback should only signal the render thread (if using a detached render loop) or perform a very lightweight submit. For Opta, since we are hybrid, rendering on the main thread is often acceptable *if* the frame time is strictly under 16ms. Heavy computation (optimizing the mesh) must happen on a background thread, updating a "Render State" that the main thread simply draws.18

### **4.3 Handling Input and Gestures**

Interactive graphs require touch input. SwiftUI gestures (DragGesture, MagnificationGesture) are superior to raw touch event handling.

* **Pattern:** We place SwiftUI gesture recognizers *on top* of the UIViewRepresentable.  
* **Translation:** When a gesture occurs, Swift calculates the coordinates relative to the view and dispatches an InputEvent to Rust (e.g., .rotateCamera(deltaX, deltaY)).  
* **Reaction:** Rust updates the camera matrix. The next render frame reflects this change. This keeps input handling distinct from the rendering loop, leveraging SwiftUI's gesture disambiguation logic.20

## ---

**5\. Settings, Persistence & Synchronization**

Data is the lifeblood of an optimization app. Opta requires a robust strategy for local storage, cloud synchronization, and inter-process communication (e.g., with Widgets).

### **5.1 SQLite in Rust: The Persistence Layer**

The database logic resides entirely in Rust, likely using rusqlite or sqlx. This ensures that data validation logic is identical on iOS, macOS, and any future platform. Swift never touches raw SQL; it requests Data Transfer Objects (DTOs) from Rust.

### **5.2 The "Shared Container" Challenge**

Opta will likely include Home Screen Widgets (built with WidgetKit). Widgets run in a separate process from the main app. By default, they cannot access the main app's files.

* **App Groups:** We must configure an "App Group" entitlement (e.g., group.com.opta.shared). This creates a shared folder on the filesystem accessible by both the App and the Extension.  
* **Database Location:** The SQLite database must be stored in this shared container. Swift resolves the path using FileManager.default.containerURL(...) and passes this path to the Rust core during initialization.21

#### **5.2.1 The 0xDEAD10CC Crash**

A critical issue arises when sharing SQLite between an App and an Extension on iOS. If the Main App holds a file lock on the SQLite database and gets suspended by the OS (which happens quickly when the user backgrounds the app), and then the Widget tries to access the database, the OS may terminate the suspended Main App to free the file lock. This results in the infamous 0xDEAD10CC crash code.23

**Mitigation Strategy:**

1. **WAL Mode:** We must enable Write-Ahead Logging (PRAGMA journal\_mode=WAL) in SQLite. This allows concurrent readers (Widget) and writers (App), reducing lock contention.  
2. **Aggressive Checkpointing:** Rust should listen for the applicationWillResignActive notification (bridged from Swift) and force a database checkpoint or release connections.  
3. **Read-Only Architecture:** The safest architectural pattern is for the Main App (Writer) to export a separate, lightweight "View State" (e.g., a JSON or Protobuf file) to the shared container whenever the data changes. The Widget (Reader) consumes this static file instead of querying the complex SQLite database. This completely eliminates locking issues and improves Widget performance.24

### **5.3 iCloud Sync and Ubiquity**

Users expect their optimization models to sync between Mac and iPad. We leverage **iCloud Drive** (Ubiquity).

* **Path Transparency:** To Rust, iCloud Drive is just another file path. However, the file system behaves differently: files may be "evicted" (exist as metadata placeholders) and need to be downloaded before reading.  
* **Coordination:** Swift must manage NSFileCoordinator. Before asking Rust to read a file, Swift ensures the file is downloaded (startDownloadingUbiquitousItem).  
* **Symlinks:** iCloud paths often involve complex symlinks. Rust's standard library (std::fs) generally handles this well, but path resolution should be canonicalized on the Swift side before being passed to Rust to ensure consistency.25

## ---

**6\. Accessibility: Bridging the Void**

Accessibility is often the friction point in custom rendering. While standard SwiftUI controls used for settings and forms are accessible by default, the wgpu render surface (the optimization graph) is, to VoiceOver, just a blank image.

### **6.1 The AccessKit Solution**

We integrate **AccessKit**, a cross-platform accessibility infrastructure written in Rust. This tool allows the Rust core to expose a semantic tree of the UI that is independent of the rendering method.

#### **6.1.2 Implementation Steps**

1. **Semantic Tree:** As the Rust core renders the optimization graph, it simultaneously constructs an accesskit::TreeUpdate. This tree describes the nodes, edges, and data points logically (e.g., "Node: Factory A, Value: 80%").  
2. **The Adapter:** We use the accesskit\_macos adapter (and iOS equivalent). This adapter hooks into the NSView / UIView hosting the layer.  
3. **The Bridge:** When VoiceOver interacts with the view, the NSView delegates the inquiry to the AccessKit adapter. AccessKit translates the OS request (e.g., "hit test at x,y") into a query against the Rust semantic tree and returns the appropriate accessible object.27

This architecture ensures that visually impaired users can "navigate" the graph—stepping through nodes, hearing values, and understanding relationships—without the SwiftUI layer needing to know the geometry of the rendered scene.29

## ---

**7\. System Integration: App Intents & Background Tasks**

To make Opta a first-class citizen, it must integrate with Siri, Shortcuts, and background execution.

### **7.1 App Intents (The "Headless" Core)**

App Intents allow users to trigger actions via Siri ("Hey Siri, run optimization"). These intents run in a lightweight extension process, potentially without the UI ever launching.

* **Requirement:** The Rust core must be decoupled from the UI. We need a CoreManager that can spin up the Rust runtime, load the database, execute a command, and shut down, all without instantiating wgpu or SwiftUI view models.  
* **Implementation:** The Intent perform() method initializes a headless version of RustCore, awaits the async result, and returns a dialog response.

### **7.2 Background Processing**

Optimization is CPU-intensive. If the user switches apps while a solver is running, iOS will suspend the process.

* **BGProcessingTask:** We use the BackgroundTasks framework. When the user starts a long job, Swift requests a background task identifier.  
* **Expiration:** If the OS signals that time is up (task.expirationHandler), Swift must signal Rust to "checkpoint" the solver state immediately. Rust's solver loop must be designed to be interruptible—checking an AtomicBool cancellation flag periodically—so it can save progress and resume later.23

## ---

**8\. Conclusion: A Future-Proof Foundation**

The architecture proposed for **Opta** is rigorous but rewarding. By treating the platform (SwiftUI) as a **Thin Shell**, we gain the ability to deliver a truly native, accessible, and fluid experience that users expect from a premium Apple app. Simultaneously, by housing the logic, state, and rendering in **Rust**, we secure the application's intellectual property and performance critical code in a portable, safe, and highly efficient runtime.

This blueprint requires disciplined adherence to the Unidirectional Data Flow and careful management of the FFI boundary using UniFFI. It demands robust solutions for concurrency (MainActor bridging) and persistence (WAL mode SQLite). However, the result is an application that combines the best of both worlds: the raw power of systems programming and the elegance of modern UI design.

### **Summary Specifications**

| Component | Technology Stack | Key Responsibility |
| :---- | :---- | :---- |
| **User Interface** | SwiftUI | Layout, Animation, Accessibility (Standard), Input Handling |
| **Logic & State** | Rust (Arc/Mutex) | Single Source of Truth, Optimization Algorithms, Routing |
| **Bridge** | UniFFI | Type-safe bindings, Async runtime bridging |
| **Rendering** | wgpu (Rust) \+ Metal | High-performance graph/surface visualization |
| **Persistence** | SQLite (Rust) | Data storage, schema management |
| **Sync** | iCloud Drive | File syncing across devices |
| **Accessibility** | AccessKit | Semantic tree for custom render surfaces |

This document serves as the founding technical charter for the Opta engineering team.

#### **Works cited**

1. Swift Bindings \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/swift/overview.html](https://mozilla.github.io/uniffi-rs/latest/swift/overview.html)  
2. How can I combine a static Rust library, low-level C FFI layer, and higher-level Swift bindings into a single binary framework bundle for iOS? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/75913273/how-can-i-combine-a-static-rust-library-low-level-c-ffi-layer-and-higher-level](https://stackoverflow.com/questions/75913273/how-can-i-combine-a-static-rust-library-low-level-c-ffi-layer-and-higher-level)  
3. Managing Object References \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/internals/object\_references.html](https://mozilla.github.io/uniffi-rs/latest/internals/object_references.html)  
4. The State of Swift & Rust interoperability? \- Discussion, accessed January 20, 2026, [https://forums.swift.org/t/the-state-of-swift-rust-interoperability/72205](https://forums.swift.org/t/the-state-of-swift-rust-interoperability/72205)  
5. Unidirectional flow in Swift \- Swift with Majid, accessed January 20, 2026, [https://swiftwithmajid.com/2023/07/11/unidirectional-flow-in-swift/](https://swiftwithmajid.com/2023/07/11/unidirectional-flow-in-swift/)  
6. SwiftUI Data Flow & Unidirectional Architecture \- DEV Community, accessed January 20, 2026, [https://dev.to/sebastienlato/swiftui-data-flow-unidirectional-architecture-17ch](https://dev.to/sebastienlato/swiftui-data-flow-unidirectional-architecture-17ch)  
7. The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/](https://mozilla.github.io/uniffi-rs/)  
8. MainActor usage in Swift explained to dispatch to the main thread \- SwiftLee, accessed January 20, 2026, [https://www.avanderlee.com/swift/mainactor-dispatch-main-thread/](https://www.avanderlee.com/swift/mainactor-dispatch-main-thread/)  
9. Migrating from the Observable Object protocol to the Observable macro | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/SwiftUI/Migrating-from-the-observable-object-protocol-to-the-observable-macro](https://developer.apple.com/documentation/SwiftUI/Migrating-from-the-observable-object-protocol-to-the-observable-macro)  
10. Observable init() called multiple times by @State, different behavior to @StateObject, accessed January 20, 2026, [https://forums.swift.org/t/observable-init-called-multiple-times-by-state-different-behavior-to-stateobject/70811](https://forums.swift.org/t/observable-init-called-multiple-times-by-state-different-behavior-to-stateobject/70811)  
11. NavigationStack | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/SwiftUI/NavigationStack](https://developer.apple.com/documentation/SwiftUI/NavigationStack)  
12. SwiftUI NavigationStack Navigation \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/75879871/swiftui-navigationstack-navigation](https://stackoverflow.com/questions/75879871/swiftui-navigationstack-navigation)  
13. SwiftUI Navigation Internals: How NavigationStack Really Works \- DEV Community, accessed January 20, 2026, [https://dev.to/sebastienlato/swiftui-navigation-internals-how-navigationstack-really-works-1g4m](https://dev.to/sebastienlato/swiftui-navigation-internals-how-navigationstack-really-works-1g4m)  
14. Automatic State Restoration in SwiftUI using NavigationStack \- YouTube, accessed January 20, 2026, [https://www.youtube.com/watch?v=3MaG27tzRJo](https://www.youtube.com/watch?v=3MaG27tzRJo)  
15. Navigation state restoration with NavigationStack breaks binding \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/78368044/navigation-state-restoration-with-navigationstack-breaks-binding](https://stackoverflow.com/questions/78368044/navigation-state-restoration-with-navigationstack-breaks-binding)  
16. Rust wgpu Cross-Platform Development Practice \- Latent Cat, accessed January 20, 2026, [https://latentcat.com/en/blog/wgpu-cross](https://latentcat.com/en/blog/wgpu-cross)  
17. Fast & Fluid: Integrating Rust egui into SwiftUI | by Oleksii Oliinyk | Medium, accessed January 20, 2026, [https://medium.com/@djalex566/fast-fluid-integrating-rust-egui-into-swiftui-30a218c502c1](https://medium.com/@djalex566/fast-fluid-integrating-rust-egui-into-swiftui-30a218c502c1)  
18. macos: Support user-created wgpu surfaces. · Issue \#124 · RustAudio/baseview \- GitHub, accessed January 20, 2026, [https://github.com/RustAudio/baseview/issues/124](https://github.com/RustAudio/baseview/issues/124)  
19. SwiftUI & Metal: Creating a Custom Animated Background | by Aniket Bane \- Medium, accessed January 20, 2026, [https://medium.com/@aniketbaneani/swiftui-metal-creating-a-custom-animated-background-b411d9990459](https://medium.com/@aniketbaneani/swiftui-metal-creating-a-custom-animated-background-b411d9990459)  
20. SwiftUI: Render/Animate Geometries With Metal 4 | by Itsuki \- Level Up Coding, accessed January 20, 2026, [https://levelup.gitconnected.com/swiftui-render-animate-geometries-with-metal-4-e41b2d3347d1](https://levelup.gitconnected.com/swiftui-render-animate-geometries-with-metal-4-e41b2d3347d1)  
21. Configuring app groups | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/Xcode/configuring-app-groups](https://developer.apple.com/documentation/Xcode/configuring-app-groups)  
22. App Groups Data Sharing Between Applications iOS \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/29940608/app-groups-data-sharing-between-applications-ios](https://stackoverflow.com/questions/29940608/app-groups-data-sharing-between-applications-ios)  
23. SQLite Databases in App Group Containers: Just Don't \- Ryan Ashcraft, accessed January 20, 2026, [https://ryanashcraft.com/sqlite-databases-in-app-group-containers/](https://ryanashcraft.com/sqlite-databases-in-app-group-containers/)  
24. SQLite Databases in App Group Containers (Don't) \- Michael Tsai, accessed January 20, 2026, [https://mjtsai.com/blog/2025/05/15/sqlite-databases-in-app-group-containers-dont/](https://mjtsai.com/blog/2025/05/15/sqlite-databases-in-app-group-containers-dont/)  
25. url(forUbiquityContainerIdentifier:) | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/foundation/filemanager/url(forubiquitycontaineridentifier:)](https://developer.apple.com/documentation/foundation/filemanager/url\(forubiquitycontaineridentifier:\))  
26. Rust / Swift / Xcode / iCloud interoperability · Issue \#109381 · rust-lang/rust \- GitHub, accessed January 20, 2026, [https://github.com/rust-lang/rust/issues/109381](https://github.com/rust-lang/rust/issues/109381)  
27. AccessKit: Accessibility infrastructure for UI toolkits, accessed January 20, 2026, [https://accesskit.dev/](https://accesskit.dev/)  
28. How it works \- AccessKit, accessed January 20, 2026, [https://accesskit.dev/how-it-works/](https://accesskit.dev/how-it-works/)  
29. Add NSAccessibilityElement to an existing NSView \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/63062794/add-nsaccessibilityelement-to-an-existing-nsview](https://stackoverflow.com/questions/63062794/add-nsaccessibilityelement-to-an-existing-nsview)