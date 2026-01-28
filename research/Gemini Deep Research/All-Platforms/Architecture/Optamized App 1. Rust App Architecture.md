# **Architectural Optimization Report for Opta: Migrating to a Rust-Native Paradigm**

## **1\. Introduction: The Philosophy of "Opta" and the Pursuit of Optimality**

In the contemporary landscape of mobile application development, the term "optimal" transcends mere functionality. For the "Opta" application, as described in the architectural mandate, optimality implies a convergence of maximizing throughput, minimizing latency, ensuring absolute visual fidelity, and adhering to strict resource constraints such as battery life and binary footprint. The stated objective—to optimize the existing architecture by migrating to a completely Rust-based stack while ensuring premium, modern, High-Definition (HD) visuals and 3D rendering—requires a rigorous deconstruction of current hybrid methodologies and a strategic adoption of emerging native-compilation paradigms.

Current industry analysis suggests that while hybrid frameworks utilizing WebViews have democratized cross-platform development, they fundamentally fail to meet the definition of "optimal" for high-performance graphics and fluid, 120Hz interactions.1 The "Opta" vision necessitates an architecture that operates closer to the metal, leveraging the zero-cost abstractions of Rust to manage memory and concurrency without the overhead of a JavaScript bridge or the unpredictability of a garbage collector.

This report provides an exhaustive analysis of the architectural landscape, evaluating the transition from the inferred current state (likely utilizing standard hybrid patterns) to a fully optimized, Rust-centric native architecture. It explores the depths of the graphics pipeline using wgpu and Metal/Vulkan, the intricacies of foreign function interfaces (FFI) for native interoperability, and the critical production considerations of binary size, thermal dynamics, and accessibility compliance. The analysis is synthesized to guide the Opta application toward a "Premium" status, defined not just by how it looks, but by the engineering precision of its underlying execution.

## ---

**2\. Architectural Paradigms: Deconstructing the Rust-Mobile Landscape**

To achieve the "Opta" standard, one must first evaluate where the application logic and rendering responsibilities lie. The architectural landscape for Rust on mobile is presently bifurcated into three distinct approaches: the WebView-based Hybrid, the Headless Core (Shared Logic), and the Pure Rust Rendering model. Each presents a different calculus of optimality regarding performance, developer experience, and visual capability.

### **2.1 The WebView-Hybrid Model: Tauri v2 and Its Limitations**

Tauri v2 represents a significant evolution in hybrid app development, allowing developers to write backends in Rust while utilizing standard web technologies (HTML/CSS/JS) for the frontend.1 This model has gained traction for its ability to reduce bundle sizes significantly compared to predecessors like Electron—dropping from over 100MB to approximately 10MB 4—and for its shared codebase efficiency.

However, when analyzed through the lens of the "Opta" requirement for HD visuals and 3D rendering, the WebView model reveals structural inefficiencies. The reliance on the system WebView (WKWebView on iOS, WebView2 on Windows) means the rendering pipeline is ultimately controlled by the browser engine, not the application developer. This abstraction layer introduces potential "UI jank," particularly when synchronization issues arise between the Rust backend and the JavaScript frontend.1 The "bridge" communication overhead, even when optimized, creates a latency barrier that fights against the requirement for "optimal" responsiveness.

Furthermore, integrating true native 3D (via Metal or Vulkan) into a WebView context is architecturally fraught. It often requires complex workarounds, such as overlaying a transparent WebView on top of a native rendering surface. This "sandwich" approach complicates gesture handling, z-ordering, and compositing, frequently leading to performance degradation during complex transitions—a direct violation of the user's requirement for "modern transitions".2 The consensus in high-performance computing circles is that for an app prioritizing "premium" visuals and 3D transitions, the WebView acts as a middleware layer that bottlenecks the GPU pipeline.2

### **2.2 The Pure Rust Rendering Model: Makepad and Direct GPU Control**

At the opposite end of the spectrum lies the "Pure Rust" rendering paradigm, exemplified by frameworks like Makepad. This approach aligns most aggressively with the user's desire to "move to completely Rust," as it bypasses native UI toolkits entirely to draw pixels directly to a window surface using the GPU.

Makepad utilizes a highly optimized styling language (MPSL) and relies on shaders for almost all drawing operations, from basic rectangles to complex text rendering.6 This architecture allows for unprecedented control over visual aesthetics, enabling the "premium" look with custom shadows, blurs, and 3D transitions that are mathematically consistent across all platforms. The architecture supports live design, where shader changes are reflected in real-time, facilitating rapid iteration on visual fidelity.8

However, the "optimal" nature of this approach is compromised by the "Uncanny Valley" of UI. Replicating the exact physics of native scrolling, the precise sub-pixel anti-aliasing of system fonts, and the complex behavior of native input methods is a monumental task. While Makepad offers speed and customizability, it shifts the burden of implementing basic OS behaviors (like text selection handles or accessibility trees) onto the framework developer.9 For "Opta," this presents a risk: while the visuals may be HD and custom, the *feel* of the application might deviate from user expectations of a native iOS or Android experience, potentially violating the "premium" requirement which often entails seamless OS integration.

### **2.3 The Headless Core Model: Crux and the Humble Object Pattern**

The "Headless Core" architecture, championed by frameworks like Crux, represents a strategic compromise that often yields the highest "optimality" for production-grade applications. This model aligns with the "Humble Object" pattern or Hexagonal Architecture, where Rust manages 100% of the business logic, state management, and network interaction, while the UI is built entirely in the platform's native language (SwiftUI for iOS, Kotlin/Jetpack Compose for Android).10

In this paradigm, the Rust core is compiled into a static library (iOS) or shared library (Android). The user interface is a "thin shell" that strictly renders the state provided by the Rust core and forwards user events back to it.12 This architecture guarantees that standard UI transitions utilize Apple’s CoreAnimation or Android’s RenderThread, which are highly optimized for power efficiency and smoothness.13 It ensures perfect 120Hz scrolling and instant system integration for features like haptics and accessibility, without "fighting the OS" as seen in hybrid models.1

For the Opta app, this architecture offers a robust foundation. It ensures that the standard navigation elements (tab bars, settings menus) feel entirely native. However, purely relying on SwiftUI or Kotlin for the *entire* app would fail the "move to completely Rust" objective and potentially complicate the implementation of shared, complex 3D rendering logic. Therefore, a modification of this architecture is required.

### **2.4 Synthesis: The Hybrid Native-Core Recommendation**

To satisfy the specific constraints of the Opta vision—maximizing Rust usage, ensuring HD 3D visuals, and maintaining native "premium" feel—this analysis recommends a **Hybrid Native-Core Architecture**. This architecture involves:

1. **Rust Core (Crux/UniFFI):** Managing all state, business logic, and data processing.  
2. **Native Shell (SwiftUI/Kotlin):** Handling application lifecycle, navigation, and accessibility.  
3. **Rust Render Surface (wgpu):** A specialized region (or full screen, depending on the view) where Rust draws directly to a Metal/Vulkan surface for the "HD Visuals" and "3D" content.

This "embedded" approach allows Opta to leverage the raw power of Rust for heavy visual lifting while retaining the safety net of the native OS frameworks for basic interaction. It aligns with the emerging trend in high-performance mobile apps (e.g., the Zed editor or Rive runtime) where the heavy lifting is done in Rust, but the final integration allows for native interoperability.15

## ---

**3\. The Graphics Pipeline: Achieving HD and 3D Visuals**

The requirement for "HD Visuals" and "3D rendering where necessary" necessitates a deep dive into the graphics pipeline. The standard abstraction for Rust in this domain is wgpu.

### **3.1 The wgpu Abstraction: Native Performance via WebGPU Standards**

wgpu is a safe, portable, pure-Rust graphics API based on the WebGPU standard. It is critical to understand that wgpu is not an emulator; it dispatches native commands. On iOS, wgpu translates calls to **Metal**; on Android, it targets **Vulkan** or **GLES**.17

#### **3.1.1 Metal and Vulkan Translation**

The optimization achieved by wgpu comes from its efficient mapping to modern low-level APIs.

* **Metal (iOS):** Metal is designed for low-overhead access to the GPU on Apple Silicon. wgpu leverages Metal’s command buffers and compute shaders efficiently.19 By using wgpu, Opta gains access to modern GPU features like push constants (via emulation or extension) and efficient uniform binding.21 The overhead of this translation has been benchmarked as minimal for non-AAA gaming workloads, making it "optimal" for application development.22  
* **Vulkan (Android):** Android’s graphics ecosystem is fragmented. wgpu handles the complexity of instance creation, physical device selection, and memory barriers, which are notorious sources of bugs in raw Vulkan development. This abstraction allows the Opta team to write a single renderer that works across the myriad of Android devices without managing device-specific quirks manually.23

#### **3.1.2 High-Definition (HD) Rendering Strategies**

"Premium" aesthetics on mobile are defined by pixel density. "Retina" and high-DPI displays require rendering strategies that are resolution-independent.

* **Surface Configuration:** To achieve "HD," the wgpu surface must be configured to match the device's physical pixel capabilities, not logical points. This involves querying the window.scale\_factor() and adjusting the SurfaceConfiguration width and height accordingly.24  
* **Multisampling (MSAA):** To ensure "HD" smoothness on vector edges, the pipeline should enable Multi-Sample Anti-Aliasing (MSAA) within the wgpu render pass descriptor. This significantly reduces jagged edges (aliasing) on 3D geometry, contributing to the "premium" feel.

### **3.2 3D Rendering Integration: Bevy vs. Custom Pipelines**

For the "3D rendering where necessary" requirement, the architecture must choose between integrating a full game engine (Bevy) or building a custom renderer.

#### **3.2.1 Option A: Bevy Engine Integration**

Bevy is a data-driven, ECS-based game engine built on wgpu. It supports PBR (Physically Based Rendering), glTF loading, and skeletal animation out of the box.25

* **Pros:** Immediate access to advanced 3D features (shadows, lighting, render graphs). It simplifies the implementation of complex scenes.  
* **Cons:** Bevy is heavy. Embedding a full Bevy app into a SwiftUI view requires careful state synchronization and can increase binary size significantly.15 Furthermore, Bevy's UI system (bevy\_ui) is currently considered inadequate for complex application UIs 26, meaning it should be strictly restricted to the 3D viewports.

#### **3.2.2 Option B: Custom wgpu Render Pass**

For Opta, if the 3D requirements are specific (e.g., distinct product visualizations, 3D data graphs) rather than a pervasive game world, a custom wgpu render pipeline is the more "optimal" choice regarding binary size and control.

* **Pros:** Drastically lower binary size; exact control over the render loop; easier integration with standard 2D UI layers via texture composition.  
* **Cons:** Requires writing raw vertex/fragment shaders and managing camera matrices manually.16

**Recommendation:** The analysis suggests **Option B (Custom wgpu)** is the optimal path for an *app* (as opposed to a *game*). It allows the precise integration of specific 3D elements without the overhead of a full game engine's physics and audio systems, aligning better with the goal of optimization.

### **3.3 Advanced Shaders and Aesthetics**

To achieve "Premium Aesthetics," the rendering pipeline must move beyond standard rendering equations.

* **Signed Distance Fields (SDFs):** For UI elements rendered in Rust, SDFs offer infinite resolution. This technique, heavily utilized by Makepad 27, allows for rendering soft shadows, rounded corners, and glows that remain perfectly crisp at any zoom level. Implementing an SDF shader library within the wgpu pipeline will give Opta a unique, futuristic visual language.  
* **Compute Shaders:** For "Modern" transitions, compute shaders can be used to calculate particle effects or mesh deformations on the GPU, leaving the CPU free for business logic. This is particularly effective on Apple Silicon’s unified memory architecture, where compute and graphics share high-bandwidth memory.19

## ---

**4\. High-Performance Animation: The 120Hz Standard**

"Premium" and "Modern" in 2026 are synonymous with fluid motion. Static screens feel dated; interface elements must react with physics-based inertia. To ensure "Modern" transitions, the architecture must support high refresh rates (120Hz/ProMotion) and vector-based animations.

### **4.1 Frame Pacing and the Render Loop**

Modern mobile devices operate at variable refresh rates (VRR), typically ramping up to 120Hz during interaction and dropping to 10Hz or lower when static to save battery.

* **The Challenge:** A standard game loop often defaults to a fixed time step (e.g., 60Hz). To support 120Hz, the Rust render loop must be decoupled from fixed logic ticks.  
* **Native Drivers:** The architecture must utilize CADisplayLink (iOS) or Choreographer (Android) to drive the render loop. In a Rust-hosted view, this is typically bridged. The native host (Swift/Kotlin) should receive the VSync signal and call the tick method of the Rust core. This ensures the Rust rendering is perfectly synchronized with the display's refresh cycle, eliminating tearing and micro-stutter.13  
* **Interpolation:** To handle the discrepancy between a fixed logic update (e.g., physics calculating at 60Hz) and a high-frequency display (120Hz), the rendering logic must implement state interpolation. The renderer calculates the visual state based on the alpha value between two logic frames, ensuring visual smoothness even if the logic thread is momentarily heavily loaded.28

### **4.2 Vector Animation Integration: Rive and Lottie**

For "HD Visuals," raster images (PNG/JPG) are suboptimal due to scaling artifacts and large file sizes. Vector animations are essential for a "modern" feel.

* **Rive:** Rive offers a Rust runtime (rive-rs) which is highly performant and allows for state-machine-driven animations. Unlike video, Rive animations can react to input—a character might follow the user's touch, or a button might morph based on hover state.29 Rive files are significantly smaller than equivalent video or sprite sheets, optimizing the app size—a key component of "optimality".29  
* **Lottie:** For legacy animations or simpler vector assets, dotLottie-rs provides a Rust-based player using ThorVG for rendering. This ensures consistent rendering across platforms, addressing the fragmentation issues seen with native Lottie libraries where Android and iOS implementations often render effects differently.31

**Integration Strategy:** The Opta architecture should expose these players as textures within the wgpu pipeline. This allows animations to exist within the 3D scene (e.g., a Rive animation on a 3D monitor screen) or as 2D overlays without context switching.

## ---

**5\. Native Interoperability: The UniFFI Bridge**

To "adapt the code for native support optimization," the bridge between the Rust core and the mobile OS must be as thin and efficient as possible. The era of manual JNI (Java Native Interface) writing is over; modern tooling provides safer, faster alternatives.

### **5.1 The UniFFI Advantage**

The most robust solution for modern Rust mobile development is **UniFFI** (developed by Mozilla). It automatically generates bindings for Swift and Kotlin from a Rust Interface Definition Language (UDL) or direct macros.34

* **Mechanism:** UniFFI handles the complex memory management of passing strings, structs, and objects across the FFI boundary. It reduces the boilerplate of JNI on Android, which is notoriously verbose and error-prone.36  
* **Performance:** While JNI calls have overhead (nanoseconds to microseconds), UniFFI minimizes this by optimizing data transfer. For high-frequency data—such as 3D object coordinates updating 120 times a second—Opta should use **shared memory buffers** (byte arrays) or **FlatBuffers** passed through the FFI rather than serializing complex JSON objects, which incurs CPU serialization costs.37

### **5.2 Embedding Strategies for "Opta" Views**

The crucial implementation detail for Opta is embedding the Rust renderer into the native hierarchy seamlessly.

#### **5.2.1 iOS Integration (SwiftUI)**

On iOS, the integration leverages the UIViewRepresentable protocol to wrap a MTKView (MetalKit View) or a CAKeyframeLayer.

* **The Hook:** The Swift code initializes a CAMetalLayer. It passes the UnsafeMutableRawPointer of this layer to the Rust core via UniFFI.  
* **Rust Side:** The Rust wgpu instance uses instance.create\_surface\_unsafe(wgpu::SurfaceTargetUnsafe::CoreAnimationLayer(layer\_ptr)) to attach to this layer.16  
* **Benefit:** This allows the Rust view to sit inside a standard SwiftUI VStack or ZStack. You can overlay standard SwiftUI text or buttons on top of the Rust 3D view, combining the best of high-performance rendering with native UI ease-of-use.16

#### **5.2.2 Android Integration (Kotlin)**

On Android, the integration utilizes the SurfaceView or TextureView.

* **The Hook:** In the surfaceCreated callback of the SurfaceHolder, the Android app obtains the native Surface object.  
* **Rust Side:** This surface is passed via JNI to Rust, where wgpu attaches to the raw window handle (ANativeWindow).15  
* **Benefit:** This enables the app to use Android's standard XML or Jetpack Compose layouts for the shell, while the "premium" content renders in the high-performance Rust surface.

### **5.3 Sensor Fusion and Haptics**

A "Premium" app must feel responsive.

* **Haptics:** Do not use a Rust crate that tries to abstract haptics generically. Instead, define a HapticFeedback enum in Rust (e.g., Light, Medium, Heavy, Success). When a relevant event occurs in the Rust logic (e.g., a 3D object snaps to grid), return this enum to the Swift/Kotlin shell. The shell then triggers the native UIImpactFeedbackGenerator (iOS) or VibrationEffect (Android).39 This ensures the haptics feel indistinguishable from the OS.  
* **Sensors:** Capture Accelerometer and Gyroscope data in the native layer (CoreMotion on iOS, SensorManager on Android) and pipe the raw Float32 arrays into the Rust core during the update loop. This ensures the 3D transitions react instantly to device movement, creating a tangible sense of depth.40

## ---

**6\. Performance Optimization: Battery, Thermal, and Binary Size**

Optimality is a function of resource usage. A "premium" app cannot drain the user's battery or consume hundreds of megabytes of storage.

### **6.1 Battery Consumption and Thermal Throttling**

High-fidelity 3D rendering is computationally expensive and generates heat. If the device heats up, the OS will throttle the CPU/GPU, reducing frame rates and dimming the screen—disastrous for the "Opta" experience.

* **Adaptive Rendering:** The architecture must implement "Adaptive Refresh Rate" (ARR) awareness. If the user is not interacting with the 3D model, the render loop should degrade to 0Hz (stop rendering) or a low idle rate (e.g., 10Hz), rather than constantly spinning at 120Hz. Native views handle this automatically; the Rust render loop must be explicitly programmed to sleep when idle.41  
* **Bandwidth Optimization:** On mobile GPUs, memory bandwidth is the primary consumer of power. Opta must minimize texture fetches and utilize compressed texture formats (ASTC) to keep data within the GPU cache.42

### **6.2 Binary Size Optimization**

Rust binaries can be large due to monomorphization (the compiler generating unique code for every generic usage). A large binary slows down download/update times and app startup.

* **Compiler Settings:** The build profile must be configured with opt-level \= "z" (optimize for size) and lto \= true (Link Time Optimization). LTO allows the linker to remove dead code across crate boundaries, which is essential when using large libraries like wgpu.43  
* **Symbol Visibility:** On Android and iOS, dynamic libraries export all symbols by default. Using a linker script to retain only the necessary JNI/FFI entry points can reduce the binary size of the shared library by up to 90%, stripping away internal symbol names that are irrelevant to the runtime.45  
* **Modularization:** Avoid monolithic dependencies. If using Bevy, disable unused features (2D, Audio, UI) via default-features \= false in Cargo.toml if only the 3D renderer is required.46

## ---

**7\. Production Readiness: Aesthetics, Accessibility, and Compliance**

To represent "optimal in every way," the app must be usable by all users and compliant with Apple App Store and Google Play guidelines.

### **7.1 Accessibility (A11y): The Critical Risk**

This is the most significant risk factor for "Pure Rust" UIs like Makepad or wgpu rendered content. A custom GPU renderer creates a "black box" of pixels that screen readers (VoiceOver/TalkBack) cannot read. This can lead to App Store rejection 47 and alienates users with disabilities.48

* **The Solution:** The "Native Shell" architecture is the mitigation. By using SwiftUI/Kotlin for standard UI elements (buttons, lists, navigation), accessibility is handled automatically by the OS.  
* **Bridging the Gap:** For the custom Rust render canvas, the app must expose a description to the accessibility API. On iOS, the UIViewRepresentable wrapping the Rust view can implement UIAccessibilityElement protocols, providing a label (e.g., "3D Visualization of Network Graph") and handling accessibility gestures that are translated into Rust commands.49

### **7.2 Visual Consistency and Compliance**

* **Font Rendering:** Rust renderers often struggle to match the sub-pixel font anti-aliasing of the host OS, leading to text that looks "slightly off." Using native text labels overlaid on top of the Rust view ensures the text looks crisp and respects system font size settings (Dynamic Type).50  
* **App Store Guidelines:** Apple rejects apps that appear "non-native" or behave inconsistently.47 Using standard navigation controllers (UINavigationController) ensures the app respects safe areas, gesture navigation (swipe to go back), and status bar handling, significantly reducing the risk of rejection compared to a fully custom rendered UI.52

## ---

**8\. Implementation Roadmap**

To transition the Opta application to this optimized state, a phased implementation roadmap is recommended:

| Phase | Milestone | Objective | Key Technologies |
| :---- | :---- | :---- | :---- |
| **1** | **Core Foundation** | Establish the Rust logic core and FFI bindings. | UniFFI, Crux, Rust cargo |
| **2** | **Render Surface** | Create the standalone wgpu renderer and embedding logic. | wgpu, Metal, Vulkan, UIViewRepresentable |
| **3** | **Visual Polish** | Implement custom shaders, SDFs, and Rive animations. | WGSL, Rive-rs, Compute Shaders |
| **4** | **Native Integration** | Connect sensors, haptics, and standard UI shell. | Swift/Kotlin, CoreMotion, Haptics |
| **5** | **Optimization** | Profile battery, reduce binary size, audit accessibility. | lto, strip, Xcode Instruments, VoiceOver |

### **Phase 1: Core Migration & FFI Setup**

Define the data model and business logic in a pure Rust crate. Implement **UniFFI** to generate Swift and Kotlin bindings. Create a "thin shell" iOS and Android app that initializes the Rust core and validates data passing.

### **Phase 2: The Render Surface**

Develop the visual core using **wgpu**. Focus on a standalone render pass that accepts state from the Rust Core. Implement the embedding logic: UIViewRepresentable (iOS) and SurfaceView (Android) hooking into the wgpu surface. Validate the render loop timing using CADisplayLink.

### **Phase 3: Visual Polish & 3D Integration**

Integrate **Rive-rs** for vector UI animations. Implement the **custom shader** pipeline for the "HD Visuals," utilizing SDFs for UI elements. Optimize assets (texture compression) and shader complexity for mobile GPUs.

### **Phase 4: Production Hardening**

Apply strip, LTO, and codegen-unit optimizations to the build pipeline. Profile the app using Xcode Instruments (Energy Impact) to ensure thermal stability. Implement the accessibility bridge to ensure the Rust content is discoverable by screen readers.

## **9\. Conclusion**

The pursuit of the "Opta" standard—an optimal, premium, and visually stunning application—requires a departure from the convenience of web-based hybrids toward the precision of native engineering. While a "100% Rust" approach using frameworks like Makepad offers theoretical purity, the **Hybrid Native-Core Architecture** represents the pragmatic optimal.

By leveraging Rust for the high-performance logic and the custom wgpu rendering surface, while retaining a thin Native Shell for navigation and accessibility, Opta captures the best of both worlds. This architecture delivers the requested "Premium, Modern, and HD Visuals" via direct Metal/Vulkan control, ensures "Native Support Optimization" through proper platform integration, and guarantees the stability and compliance required for a flagship application. This is the optimal path for 2026\.

#### **Works cited**

1. Architecture Dilemma: Tauri Mobile vs. React Native for a companion app for a Rust-heavy Local-First App \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1pyexyr/architecture\_dilemma\_tauri\_mobile\_vs\_react\_native/](https://www.reddit.com/r/rust/comments/1pyexyr/architecture_dilemma_tauri_mobile_vs_react_native/)  
2. Framework Wars: Tauri vs Electron vs Flutter vs React Native \- Moon Technolabs, accessed January 20, 2026, [https://www.moontechnolabs.com/blog/tauri-vs-electron-vs-flutter-vs-react-native/](https://www.moontechnolabs.com/blog/tauri-vs-electron-vs-flutter-vs-react-native/)  
3. Tauri 2.0 Stable Release, accessed January 20, 2026, [https://v2.tauri.app/blog/tauri-20/](https://v2.tauri.app/blog/tauri-20/)  
4. Built a desktop app with Tauri 2.0 \- impressions after 6 months : r/rust \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1nvvoee/built\_a\_desktop\_app\_with\_tauri\_20\_impressions/](https://www.reddit.com/r/rust/comments/1nvvoee/built_a_desktop_app_with_tauri_20_impressions/)  
5. Architecture Dilemma: Tauri Mobile vs. React Native for a companion app for a Rust-heavy Local-First App \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/tauri/comments/1pyeu7g/architecture\_dilemma\_tauri\_mobile\_vs\_react\_native/](https://www.reddit.com/r/tauri/comments/1pyeu7g/architecture_dilemma_tauri_mobile_vs_react_native/)  
6. 8 \- Styling With Shaders \- Makepad Docs \- Obsidian Publish, accessed January 20, 2026, [https://publish.obsidian.md/makepad-docs/Tutorials/Image+Viewer/8+-+Styling+With+Shaders/8+-+Styling+With+Shaders](https://publish.obsidian.md/makepad-docs/Tutorials/Image+Viewer/8+-+Styling+With+Shaders/8+-+Styling+With+Shaders)  
7. Makepad Architecture Benefits \- HackMD, accessed January 20, 2026, [https://hackmd.io/@guofoo/rJpSeJzXR](https://hackmd.io/@guofoo/rJpSeJzXR)  
8. Makepad 1.0: Rust UI Framework \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1kllldg/makepad\_10\_rust\_ui\_framework/](https://www.reddit.com/r/rust/comments/1kllldg/makepad_10_rust_ui_framework/)  
9. On Accessibility · Issue \#196 \- GitHub, accessed January 20, 2026, [https://github.com/makepad/makepad/issues/196](https://github.com/makepad/makepad/issues/196)  
10. redbadger/crux: Cross-platform app development in Rust \- GitHub, accessed January 20, 2026, [https://github.com/redbadger/crux](https://github.com/redbadger/crux)  
11. Introducing CRUX \- All Articles | Our Thinking | Red Badger Insights, accessed January 20, 2026, [https://content.red-badger.com/resources/introducing-crux](https://content.red-badger.com/resources/introducing-crux)  
12. crux\_core \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/crux\_core/latest/crux\_core/](https://docs.rs/crux_core/latest/crux_core/)  
13. Optimize frame rate with adaptive refresh rate | Views \- Android Developers, accessed January 20, 2026, [https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate](https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate)  
14. Using SwiftUI with View Model written in Kotlin Multiplatform Mobile | by Lammert Westerhoff, accessed January 20, 2026, [https://lwesterhoff.medium.com/using-swiftui-with-view-model-written-in-kotlin-multiplatform-mobile-67cf7b6da551](https://lwesterhoff.medium.com/using-swiftui-with-view-model-written-in-kotlin-multiplatform-mobile-67cf7b6da551)  
15. jinleili/bevy-in-app: Integrate the Bevy engine into existing iOS / Android apps. \- GitHub, accessed January 20, 2026, [https://github.com/jinleili/bevy-in-app](https://github.com/jinleili/bevy-in-app)  
16. Fast & Fluid: Integrating Rust egui into SwiftUI | by Oleksii Oliinyk | Medium, accessed January 20, 2026, [https://medium.com/@djalex566/fast-fluid-integrating-rust-egui-into-swiftui-30a218c502c1](https://medium.com/@djalex566/fast-fluid-integrating-rust-egui-into-swiftui-30a218c502c1)  
17. WGPU and Dawn (WebGpu) \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/74434480/wgpu-and-dawn-webgpu](https://stackoverflow.com/questions/74434480/wgpu-and-dawn-webgpu)  
18. gfx-rs/wgpu: A cross-platform, safe, pure-Rust graphics API. \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu](https://github.com/gfx-rs/wgpu)  
19. General Computing on the GPU: An Example Using Metal \- WWT, accessed January 20, 2026, [https://www.wwt.com/article/general-computing-on-the-gpu-an-example-using-metal](https://www.wwt.com/article/general-computing-on-the-gpu-an-example-using-metal)  
20. Metal Overview \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/metal/](https://developer.apple.com/metal/)  
21. "reportedly Apple just got absolutely everything they asked for and WebGPU really looks a lot like Metal. But Metal was always reportedly the nicest of the three modern graphics APIs to use, so that's… good?" : r/programming \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/programming/comments/136vugh/reportedly\_apple\_just\_got\_absolutely\_everything/](https://www.reddit.com/r/programming/comments/136vugh/reportedly_apple_just_got_absolutely_everything/)  
22. WGPU vs Vulkan? : r/rust\_gamedev \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust\_gamedev/comments/p2ihhz/wgpu\_vs\_vulkan/](https://www.reddit.com/r/rust_gamedev/comments/p2ihhz/wgpu_vs_vulkan/)  
23. Point of WebGPU on native \- kvark's dev blog, accessed January 20, 2026, [http://kvark.github.io/web/gpu/native/2020/05/03/point-of-webgpu-native.html](http://kvark.github.io/web/gpu/native/2020/05/03/point-of-webgpu-native.html)  
24. The Surface | Learn Wgpu, accessed January 20, 2026, [https://sotrh.github.io/learn-wgpu/beginner/tutorial2-surface/](https://sotrh.github.io/learn-wgpu/beginner/tutorial2-surface/)  
25. Bevy Engine, accessed January 20, 2026, [https://bevy.org/](https://bevy.org/)  
26. Current state of Bevy for professional game development 2025 edition \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/bevy/comments/1n0o8m5/current\_state\_of\_bevy\_for\_professional\_game/](https://www.reddit.com/r/bevy/comments/1n0o8m5/current_state_of_bevy_for_professional_game/)  
27. makepad-skills/skills/makepad-shaders/SKILL.md at main · ZhangHanDong/makepad-skills, accessed January 20, 2026, [https://github.com/ZhangHanDong/makepad-skills/blob/main/skills/makepad-shaders/SKILL.md](https://github.com/ZhangHanDong/makepad-skills/blob/main/skills/makepad-shaders/SKILL.md)  
28. How to achieve smooth frame rate independent animations \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/79148373/how-to-achieve-smooth-frame-rate-independent-animations](https://stackoverflow.com/questions/79148373/how-to-achieve-smooth-frame-rate-independent-animations)  
29. Rive Runtimes, accessed January 20, 2026, [https://rive.app/runtimes](https://rive.app/runtimes)  
30. rive-app/rive-rs \- GitHub, accessed January 20, 2026, [https://github.com/rive-app/rive-rs](https://github.com/rive-app/rive-rs)  
31. dotLottie-rs — Rust gfx library // Lib.rs, accessed January 20, 2026, [https://lib.rs/crates/dotlottie-rs](https://lib.rs/crates/dotlottie-rs)  
32. The Future of dotLottie Players \- LottieFiles, accessed January 20, 2026, [https://lottiefiles.com/blog/working-with-lottie-animations/future-of-dotlottie-player](https://lottiefiles.com/blog/working-with-lottie-animations/future-of-dotlottie-player)  
33. Show HN: DotLottie Player – A New Universal Lottie Player Built with Rust | Hacker News, accessed January 20, 2026, [https://news.ycombinator.com/item?id=39930493](https://news.ycombinator.com/item?id=39930493)  
34. Seeking information regarding calling Rust from Java \- help, accessed January 20, 2026, [https://users.rust-lang.org/t/seeking-information-regarding-calling-rust-from-java/120386](https://users.rust-lang.org/t/seeking-information-regarding-calling-rust-from-java/120386)  
35. Lessons from Mixing Rust and Java: Fast, Safe, and Practical | Hacker News, accessed January 20, 2026, [https://news.ycombinator.com/item?id=43991221](https://news.ycombinator.com/item?id=43991221)  
36. Mix in Rust with Java (or Kotlin\!) \- Blog \- Tweede golf, accessed January 20, 2026, [https://tweedegolf.nl/en/blog/147/mix-in-rust-with-java-or-kotlin](https://tweedegolf.nl/en/blog/147/mix-in-rust-with-java-or-kotlin)  
37. Overhead of Calling Rust FFI from Java JNR/JNI \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/b0leg9/overhead\_of\_calling\_rust\_ffi\_from\_java\_jnrjni/](https://www.reddit.com/r/rust/comments/b0leg9/overhead_of_calling_rust_ffi_from_java_jnrjni/)  
38. Rust wgpu Cross-Platform Development Practice \- Latent Cat, accessed January 20, 2026, [https://latentcat.com/en/blog/wgpu-cross](https://latentcat.com/en/blog/wgpu-cross)  
39. Haptics | Tauri, accessed January 20, 2026, [https://v2.tauri.app/plugin/haptics/](https://v2.tauri.app/plugin/haptics/)  
40. Deep Mobile Integration: Enhancing Bevy's Interoperability with iOS and Android \#10900, accessed January 20, 2026, [https://github.com/bevyengine/bevy/discussions/10900](https://github.com/bevyengine/bevy/discussions/10900)  
41. Leveraging Rust and the GPU to render user interfaces at 120 FPS | Brian Lovin, accessed January 20, 2026, [https://brianlovin.com/hn/35078464](https://brianlovin.com/hn/35078464)  
42. On Games' Power Consumption and phones \- Yosoygames, accessed January 20, 2026, [https://www.yosoygames.com.ar/wp/2018/06/on-games-power-consumption-and-phones/](https://www.yosoygames.com.ar/wp/2018/06/on-games-power-consumption-and-phones/)  
43. johnthagen/min-sized-rust: How to minimize Rust binary size \- GitHub, accessed January 20, 2026, [https://github.com/johnthagen/min-sized-rust](https://github.com/johnthagen/min-sized-rust)  
44. How to optimize the size of the executable binary file for native and WASM toolchains?, accessed January 20, 2026, [https://stackoverflow.com/questions/68327937/how-to-optimize-the-size-of-the-executable-binary-file-for-native-and-wasm-toolc](https://stackoverflow.com/questions/68327937/how-to-optimize-the-size-of-the-executable-binary-file-for-native-and-wasm-toolc)  
45. Optimizing bitdrift's Rust mobile SDK for binary size \- Blog, accessed January 20, 2026, [https://blog.bitdrift.io/post/optimizing-rust-mobile-sdk-binary-size](https://blog.bitdrift.io/post/optimizing-rust-mobile-sdk-binary-size)  
46. Open-Sourced My Rust/Vulkan Renderer for the Bevy Game Engine \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1nflsmg/opensourced\_my\_rustvulkan\_renderer\_for\_the\_bevy/](https://www.reddit.com/r/rust/comments/1nflsmg/opensourced_my_rustvulkan_renderer_for_the_bevy/)  
47. Top 10 App Store Rejection Reasons and How to Fix them \- UXCam, accessed January 20, 2026, [https://uxcam.com/blog/app-store-rejection-reasons/](https://uxcam.com/blog/app-store-rejection-reasons/)  
48. How Screen Readers and Magnifiers Support Digital Accessibility Compliance \- Vispero, accessed January 20, 2026, [https://vispero.com/resources/how-screen-readers-and-magnifiers-support-accessibility-compliance/](https://vispero.com/resources/how-screen-readers-and-magnifiers-support-accessibility-compliance/)  
49. VoiceOver evaluation criteria \- App Store Connect \- Help \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/help/app-store-connect/manage-app-accessibility/voiceover-evaluation-criteria/](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/voiceover-evaluation-criteria/)  
50. Integration with the SwiftUI framework | Kotlin Multiplatform Documentation, accessed January 20, 2026, [https://kotlinlang.org/docs/multiplatform/compose-swiftui-integration.html](https://kotlinlang.org/docs/multiplatform/compose-swiftui-integration.html)  
51. 14 Common Apple App Store Rejections and How To Avoid Them \- OneMobile, accessed January 20, 2026, [https://onemobile.ai/common-app-store-rejections-and-how-to-avoid-them/](https://onemobile.ai/common-app-store-rejections-and-how-to-avoid-them/)  
52. Apple App rejection due to non native buttons and features \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/13381912/apple-app-rejection-due-to-non-native-buttons-and-features](https://stackoverflow.com/questions/13381912/apple-app-rejection-due-to-non-native-buttons-and-features)