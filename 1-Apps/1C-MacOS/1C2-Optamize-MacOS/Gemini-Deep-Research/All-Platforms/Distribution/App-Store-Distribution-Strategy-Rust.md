# **Comprehensive Research Report: Distribution Strategy for Rust-Integrated macOS and iOS Applications**

## **Executive Summary**

The modern Apple application ecosystem presents a dichotomy for developers leveraging systems-level languages like Rust: while the performance and safety benefits of Rust—particularly when coupled with the wgpu rendering engine—are substantial, the distribution pathway through the App Store is increasingly governed by restrictive sandboxing, rigorous privacy transparency requirements, and strict architectural compliance. This report provides an exhaustive analysis of the distribution lifecycle for a hybrid application that utilizes Rust (via UniFFI) for core logic, wgpu for graphical rendering, and requires access to hardware telemetry and system process management.

The analysis indicates that the primary deployment risks lie at the intersection of the App Sandbox—a mandatory security containment mechanism for App Store distribution—and the application's inherent need to access low-level hardware sensors and manage external system processes. Apple’s Review Guidelines are explicitly designed to prevent applications from interfering with the operating system or accessing data without transparency, creating a hostile environment for traditional system utilities.

This document serves as a strategic roadmap, detailing the necessary technical configurations for the Rust-Swift bridge to ensure stability, the specific entitlement strategies required to navigate the sandbox, and the privacy declaration frameworks needed for hardware data. Furthermore, it establishes a decision matrix for developers, contrasting the limitations of the App Store against the capabilities of notarized direct distribution, specifically for applications that may exceed the permissible boundaries of the Mac App Store’s restrictive environment.

## ---

**1\. Architectural Compliance and The Rust-Swift Bridge**

The foundational viability of any hybrid application distributed on Apple platforms depends on the integrity and compliance of the bridge between the high-performance Rust core and the native Swift user interface layer. While UniFFI (Unified Foreign Function Interface) significantly automates the generation of language bindings, the runtime behavior of this bridge—specifically regarding concurrency models, memory safety, and binary structure—is a critical factor in passing the App Store’s technical review and ensuring stability in the wild.

### **1.1 The UniFFI Interface and Concurrency Models**

Apple’s platforms have aggressively transitioned toward the Swift 6 concurrency model, which emphasizes actor isolation, strict Sendable conformance, and structured async/await patterns to prevent data races. This model acts as the gatekeeper for UI responsiveness and system stability. Rust’s asynchronous runtimes, primarily Tokio or async-std, do not map one-to-one with Swift’s Grand Central Dispatch (GCD) or the new Swift Concurrency runtime, creating a complex integration challenge that must be managed to avoid "App Completeness" rejections under Guideline 2.1.1

#### **1.1.1 The Foreign Executor Pattern**

When exposing asynchronous Rust functions to Swift, the application must manage the ForeignExecutor. UniFFI generates a protocol that allows Rust futures to be polled by the Swift runtime, effectively bridging the two asynchronous worlds. A specific failure point observed in hybrid applications is the "main thread freeze," where long-running Rust tasks—such as telemetry gathering loops or complex wgpu state initializations—block the main UI thread because the executor is not correctly offloaded or yielded.3

The mechanism of the ForeignExecutor involves passing a handle from Swift to Rust, which Rust uses to schedule tasks back onto a Swift-managed thread pool. If this implementation is naive—for example, if the Rust future blocks the thread waiting for a lock—the Swift Actor meant to update the UI will stall. On iOS, the system watchdog (Wait Fence) monitors the main thread; if it remains blocked for a specific interval (typically around 20 seconds during launch, but much shorter during interaction), the system terminates the process with the exception code 0x8badf00d ("ate bad food").

To ensure compliance with Guideline 2.1 (Performance/App Completeness), the architecture must implement a dedicated background serial queue or a detached Task hierarchy for the Rust runtime. This prevents the "spinning beachball" on macOS or the watchdog termination on iOS.

**Table 1: Concurrency Mapping Strategy**

| Feature | Rust Implementation | Swift Bridge Requirement | Compliance Risk |
| :---- | :---- | :---- | :---- |
| **Async Tasks** | async fn / Tokio Task | async/await (Swift 5.5+) | **High:** Blocking MainActor triggers watchdog kills and immediate rejection. |
| **Data Streams** | Stream\<Item=T\> | AsyncStream\<T\> | **Medium:** Memory leaks in stream bridging if continuation is not yielded. |
| **Callbacks** | Box\<dyn Trait\> | Swift Protocol Implementation | **Low:** Ensure reference counting is cyclic-safe to avoid leaks. |
| **Error Handling** | Result\<T, E\> | throws / do-catch | **Low:** Must handle Rust panics via catch\_unwind to prevent SIGABRT. |

#### **1.1.2 Memory Safety and FFI Boundaries**

App Review places high scrutiny on application stability. A Rust panic across the FFI boundary is technically undefined behavior in the context of the bridge and typically results in an immediate, unrecoverable crash.5 Unlike Swift-native crashes, which produce readable stack traces in Xcode and App Store Connect, Rust FFI crashes often appear as opaque hexadecimal memory addresses in the libobjc.A.dylib or libsystem\_kernel.dylib frames, complicating the debugging process during the review phase.

To pass the technical review, the Rust library must catch stack unwindings before they cross the FFI boundary. Using std::panic::catch\_unwind at the interface layer is mandatory. Furthermore, strings and data buffers passed between Rust (String, Vec\<u8\>) and Swift (String, Data) involve allocation and deallocation across separate heaps. The free\_rust\_string pattern—where Swift defers the freeing of memory back to Rust logic—must be implemented flawlessly. A "double-free" or a memory leak here will eventually trigger the system's memory pressure termination, particularly on memory-constrained iOS devices, leading to rejection for instability.5

### **1.2 wgpu and Metal Integration**

The architectural decision to use wgpu for rendering necessitates a robust translation layer to Apple’s Metal API. With the introduction of Metal 4 and Apple Silicon, strict requirements for shader compilation and binary structure have emerged, directly impacting wgpu implementations.6

#### **1.2.1 Shader Compilation and Validation**

On iOS and macOS, wgpu defaults to the Metal backend. A significant risk during App Store submission is the use of runtime shader compilation. Apple's guidelines and best practices prefer—and in some high-performance contexts effectively require—offline or optimized shader compilation to minimize launch time latency. wgpu typically translates WGSL (WebGPU Shading Language) to MSL (Metal Shading Language) at runtime.

If the application relies on Just-In-Time (JIT) compilation of complex shaders on launch, it may fail on older devices where compilation time exceeds system limits. To mitigate rejection risks under Guideline 2.5.1 (Software Requirements), the application should validate that the generated MSL complies with the target device’s GPU family capabilities. The wgpu instance must be explicitly configured to check for wgpu::Backends::METAL. If the app crashes on launch due to shader validation failures—common on older A-series chips that lack specific feature sets supported by M-series chips—it will be rejected for "Hardware Compatibility".7

#### **1.2.2 Binary Size Implications and App Thinning**

Rust binaries are statically linked, meaning the standard library and all dependencies (crates) are compiled directly into the executable. wgpu, being a comprehensive graphics abstraction, pulls in substantial dependencies. An unoptimized Rust binary can easily exceed 100MB.

**App Thinning** is Apple's technology to ensure users only download the code relevant to their device. However, for a Rust binary, the "Universal Binary" (containing both arm64 and x86\_64 code for macOS) can be extremely large. If the app exceeds the cellular download limit (currently 200MB) without justification, it restricts the user base. More critically, if the binary contains unnecessary architectures (like x86\_64 slices for an iOS-only app), it will fail validation.8

**Optimization Strategy:**

1. **Strip Symbols:** The release profile in Cargo.toml must include strip \= "symbols". This removes debug symbols from the binary distributed to the user, often reducing size by 30-40%.  
2. **LTO (Link Time Optimization):** Enable lto \= true to allow the linker to eliminate dead code across crate boundaries. This is crucial for wgpu, as it removes backends (like Vulkan or DX12) that are irrelevant for macOS/iOS builds.9  
3. **Universal Binary Creation:** As of Xcode 16, Bitcode is deprecated. The developer must manually create universal binaries for macOS using the lipo tool. The workflow involves compiling the Rust code twice—once for x86\_64-apple-darwin and once for aarch64-apple-darwin—and then stitching them together: lipo \-create \-output UniversalBinary target/x86\_64/release/binary target/aarch64/release/binary.10

## ---

**2\. The App Sandbox and System Introspection**

For a system utility application designed to access hardware telemetry and manage system processes, the App Sandbox represents the single most significant barrier to App Store approval. The Sandbox is a mandatory access control technology enforced at the kernel level for all Mac App Store apps and all iOS apps, designed to contain damage to the system if an app is compromised.11

### **2.1 Hardware Telemetry Constraints**

The user query specifies a requirement for "hardware telemetry." In the context of macOS and iOS, this generally implies reading values such as CPU temperature, fan speeds, voltage, and power consumption.

#### **2.1.1 IOKit and the Sandbox**

Historically, accessing thermal sensors and hardware statistics on macOS requires communicating with the Apple System Management Controller (SMC) via the IOKit framework. However, low-level IOKit access is strictly prohibited within the App Sandbox.13 The sandbox profile blocks the iokit-open Mach service routine for most user client classes.

The Rejection Trap:  
If the application attempts to open a user client connection to AppleSMC or similar kernel extensions to read "die temperature," the operation will fail at runtime with kIOReturnNotPermitted. If the developer attempts to circumvent this by adding the com.apple.security.temporary-exception.iokit-user-client-class entitlement without explicit prior agreement from Apple, the binary will be rejected. Apple Review rarely, if ever, grants this exception for general system utility apps, reserving it for specialized hardware drivers.14  
Approved Alternatives (MetricKit):  
Apple explicitly pushes developers toward MetricKit and high-level thermal state APIs as the privacy-safe alternative.

* **ProcessInfo API:** ProcessInfo.processInfo.thermalState provides abstract states: .nominal, .fair, .serious, and .critical. This is permitted.  
* **MetricKit Payloads:** MetricKit allows the app to subscribe to diagnostic payloads that include battery drain data, performance metrics, and hang diagnostics.16  
* **Limitation:** These APIs do *not* provide raw integer values (e.g., "65°C"). If the application's core value proposition is "precise temperature monitoring," it is fundamentally incompatible with the Mac App Store’s sandbox rules and must be distributed via alternative means.18

### **2.2 System Process Management**

The query mentions "managing system processes." This typically implies functionalities such as listing running tasks, inspecting their resource usage (CPU/RAM), or terminating them ("killing" processes).

#### **2.2.1 Process Enumeration**

Listing processes via sysctl or proc\_pidinfo is generally permitted within the sandbox, but the information returned is heavily sanitized. The app may be able to see its own processes and some system processes, but sensitive attributes (such as open file descriptors or environment variables) of other user applications will be masked or hidden entirely to prevent data exfiltration.

#### **2.2.2 Process Termination (The "Kill" Command)**

A sandboxed application **cannot** terminate other applications. The sandbox kernel profile denies the signal permission required to kill a process ID (PID) that does not belong to the application's own container or app group.11

* **Entitlement Attempts:** There is no specific entitlement that grants "kill arbitrary process" rights to a sandboxed app. The com.apple.security.temporary-exception.apple-events entitlement allows sending Apple Events to other apps (e.g., telling Finder to quit), but this is not a generic "kill" command and is often rejected if used broadly.  
* **Workarounds:** Historic workarounds involved launching a helper tool, but even helper tools must be sandboxed if distributed via the App Store.  
* **Guideline 2.5.1 Violation:** Apple views an app that kills other processes as interfering with the operating system and user experience, a direct violation of Guideline 2.5.1.20

Strategic Pivot:  
If the application functions as a "Task Manager," it must be distributed outside the App Store (Notarized App) or strictly limited to monitoring on the App Store. Apps like "System Monitor" on the App Store exist but are strictly limited to displaying data, effectively acting as "read-only" dashboards.11

## ---

**3\. Privacy Nutrition Labels and Data Safety**

Apple’s "Privacy Nutrition Labels" are a mandatory disclosure on the App Store product page. For an application collecting hardware telemetry, the categorization of data is subtle but critical. Misclassifying data can lead to rejection during the metadata review or user distrust.22

### **3.1 Categorizing Hardware Telemetry**

Hardware data (temperature, battery health, memory usage) does not have a direct top-level category in Apple's privacy taxonomy. It must be mapped to the closest definitions based on intent and linkage.

* **Diagnostics:** This is the most appropriate category for "hardware telemetry." It includes crash data, performance data, and "other diagnostic data." If the app collects thermal logs to analyze system performance, it falls here.24  
* **Usage Data:** If the telemetry includes data on how the user interacts with their device (e.g., screen time, app launches, or resource usage triggered by user actions), it falls under Usage Data.

### **3.2 "Data Linked to You" vs. "Data Not Linked"**

The pivotal distinction in the privacy label is whether the telemetry is associated with a user identity or a persistent device identifier.

* **The Risk of IDFA/IDFV:** If the Rust telemetry module generates a unique UUID (like a client\_id) and sends it alongside the temperature data to a server for historical graphing, this data is now classified as **"Data Linked to You"** under the categories of "Identifiers" and "Diagnostics".24 This label can be intimidating to users, as it implies tracking.  
* **Best Practice Strategy:** To minimize user friction and improve the privacy scorecard:  
  1. **Local Only:** Process and display data entirely on the device. Data never leaves the device. Label: "Data Not Collected".25  
  2. **Anonymous:** If data must be uploaded, strip all persistent identifiers. Use ephemeral session IDs that rotate. Label: "Data Not Linked to You."

### **3.3 Battery Health and HealthKit**

If "hardware telemetry" includes detailed battery health (cycle count, wear level), it is generally considered "Device Diagnostics." However, if the app attempts to infer user health (e.g., activity levels based on battery drain patterns) or accesses HealthKit to correlate this, it edges into "Health & Fitness."

**Warning:** Apps cannot simply read Battery Health via public API in the same way the System Settings app does. The public API UIDevice.current.batteryLevel is allowed. Private APIs to read cycle counts or battery chemistry will trigger Guideline 2.5.1 rejection immediately.

## ---

**4\. App Store Review Guidelines: Rejection Avoidance Strategies**

Navigating the App Review Board requires anticipating how they interpret the "Functionality" and "Safety" of system utilities. The integration of Rust requires specific attention to how the binary is analyzed.

### **4.1 Guideline 2.5.1 \- Private APIs and System Interference**

This is the most common rejection code for Rust-based system tools. Rust crates often link against C-libraries that might call private or deprecated system symbols.

* **Pre-submission Check:** Developers must run nm \-u on the final binary to list undefined symbols. This list should be grepped against the list of known public frameworks. If symbols like IOConnectCallMethod (IOKit) or undocumented \_AppleInternal symbols appear and are not covered by an entitlement exception, the app is at high risk.13  
* **System Interference:** The app must not alter standard system behaviors (e.g., changing fan curves, overclocking, disabling SIP). The review team will reject apps that potentially damage hardware or confuse the user by overriding system settings.7

### **4.2 Guideline 2.1 \- App Completeness & Crashes**

Rust panics result in immediate process termination (abort). Apple tests on a variety of devices, including iPads, iPhones, and Macs with different silicon.

* **Scenario:** The user has a generic Rust panic handler that prints to stderr. On a reviewer's device, a specific sensor is missing, causing a panic.  
* **Requirement:** The app must gracefully handle errors. Instead of crashing, the UI should display a "Telemetry Unavailable" state. A crash on launch (e.g., due to wgpu failing to initialize Metal on the Simulator) is an instant rejection.26

### **4.3 Guideline 5.1 \- Data Collection and Transparency**

If the app collects telemetry, it must include a mechanism to ask for permission if the data is protected.

* **The "Purpose String":** Even if not using a specific restricted API, if the app accesses "Sensitive Info" or local network devices to gather telemetry, the Info.plist must contain usage description strings (e.g., NSLocalNetworkUsageDescription).  
* **Hardware Identifier Ban:** Using hardware-based immutable identifiers (like MAC addresses or Serial Numbers) to track users is strictly banned. Rust crates that fetch "System UUID" via IOKit must be vetted to ensure they are not used for tracking or licensing enforcement, which violates Guideline 5.1.2.

## ---

**5\. Distribution Logistics: Pricing, Updates, and TestFlight**

### **5.1 Pricing and Business Model (StoreKit 2\)**

For Rust apps, business logic (e.g., entitlement checking, subscription status) should ideally reside in the Swift layer using **StoreKit 2**, which leverages Swift's modern async/await concurrency.27

* **The Rust Problem:** If the core logic is in Rust, the developer needs Rust to know if the user is "Pro."  
* **Implementation:** Do not attempt to validate receipts purely in Rust using legacy OpenSSL methods. Apple's receipt validation format is changing, and verifyReceipt endpoints are deprecated. Instead, perform validation in Swift using StoreKit 2, then pass a "Pro" boolean or token to the Rust layer via UniFFI.28

### **5.2 App Updates**

* **The "Force Update" Myth:** Apple does not provide a native "force update" mechanism. Developers must implement a remote config fetch (in Rust or Swift) to check the latest version against an API and block the UI if the version is deprecated.  
* **Sparkle Framework:** Sparkle is the industry standard for updates *outside* the App Store. It strictly cannot be used *inside* the App Store. The App Store infrastructure manages all updates automatically. Including Sparkle code (even if unused or dead-stripped) in an App Store submission can lead to rejection because it contains code capable of downloading and executing external code, a violation of Guideline 2.5.2.29

### **5.3 TestFlight and Crash Symbolication**

When distributing via TestFlight, crashes will be reported by testers.

* **Symbolication Gap:** Xcode will not automatically symbolicate the Rust portion of the stack trace because the dSYM generation for Rust libraries is distinct from the Swift build process.  
* **Action:** The build script must ensure that the Rust static library debug symbols are preserved and merged into the final app dSYM. When a crash occurs in libapp\_core.a, the developer must manually upload the dSYM to App Store Connect or use a third-party tool (like Sentry) that supports custom symbolication uploads for Rust/iOS.30

## ---

**6\. Pre-Submission Checklist & Decision Matrix**

### **6.1 The "Go/No-Go" Decision Matrix**

Before submitting, the developer must strictly classify the app's capability against App Store limits to avoid wasting review cycles.

**Table 2: Feature Viability Matrix**

| Feature | App Store Status | Workaround/Strategy |
| :---- | :---- | :---- |
| **Render 3D (wgpu)** | **Allowed** | Use Metal backend; pre-compile shaders if possible; strip symbols. |
| **Read Battery Level** | **Allowed** | Use UIDevice public API. |
| **Read CPU Temp** | **Rejected** | Requires restricted IOKit. Drop feature or move to Notarized distribution. |
| **Kill Processes** | **Rejected** | Sandbox violation. Pivot to "Process Monitor" (read-only) or move to Notarized. |
| **Auto-Update** | **Managed by Store** | Remove Sparkle framework code entirely. |
| **Subscription** | **Allowed** | Use StoreKit 2 (Swift) \-\> Bridge status to Rust. |

### **6.2 Pre-Submission Checklist**

1. **Architecture Check:** Verify the binary contains arm64 and x86\_64 (if macOS) slices using lipo \-info. Ensure Bitcode is stripped if using Xcode 16+.10  
2. **Symbol Check:** Run nm or otool to ensure no private API symbols are linked.  
3. **Sandbox Verification:**  
   * Enable App Sandbox capability in Xcode.  
   * Run the app from the Finder (simulating a user launch).  
   * Check Activity Monitor \> Columns \> Sandbox. It must say "Yes".11  
   * Test all hardware features. If they fail silently, the app will be rejected for "bugs."  
4. **Privacy Manifest:** Generate the PrivacyInfo.xcprivacy file. Declare any data collected, even if by third-party Rust crates.23  
5. **Entitlements:** Ensure com.apple.security.app-sandbox is true. Remove any temporary exceptions unless you have a written justification prepared for the Review notes.33  
6. **IPv6 Support:** Ensure the Rust networking stack (e.g., reqwest/hyper) supports IPv6-only networks, a requirement for App Store approval.

## ---

**7\. Strategic Recommendation and The "Notarized" Alternative**

The synthesis of the research suggests that a **pure App Store distribution** for a "System Process Manager" and "Hardware Telemetry" app is highly likely to fail or result in a severely crippled application due to Sandbox restrictions.

Primary Recommendation (App Store Path):  
If the app's core value is visualizing system state via wgpu, the developer must reframe the app as a "System Dashboard."

* **Remove:** All "kill process" functionality.  
* **Replace:** Direct IOKit sensors with MetricKit thermal states.  
* **Architecture:** Use Swift-first concurrency to ensure the UniFFI bridge does not block the main thread.

Secondary Recommendation (Notarized Path):  
If "Process Management" and "Kill" features are non-negotiable for the business model, the application must bypass the Mac App Store entirely and utilize Notarized Distribution (Direct Download). This path allows the use of the Hardened Runtime without the App Sandbox.

* **Capabilities:** Enables IOKit access (via entitlements) and Process Management (via SMAppService or helper tools).34  
* **Safety:** Still vetted by Apple for malware (Notarization) but not for functionality or sandbox containment.35  
* **Updates:** Requires integrating Sparkle for update management.29

By strictly aligning the feature set with the distribution channel's technical limitations, the developer can successfully navigate the review process and leverage Rust's capabilities within the Apple ecosystem.

#### **Works cited**

1. The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/](https://mozilla.github.io/uniffi-rs/)  
2. Building an iOS App with Rust Using UniFFI \- DEV Community, accessed January 20, 2026, [https://dev.to/almaju/building-an-ios-app-with-rust-using-uniffi-200a](https://dev.to/almaju/building-an-ios-app-with-rust-using-uniffi-200a)  
3. Async/Future support \- The UniFFI user guide, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/0.28/futures.html](https://mozilla.github.io/uniffi-rs/0.28/futures.html)  
4. UniFFI Async FFI details, accessed January 20, 2026, [https://mozilla.github.io/uniffi-rs/latest/internals/async-ffi.html](https://mozilla.github.io/uniffi-rs/latest/internals/async-ffi.html)  
5. Bridging Rust and iOS: Seamless Native Integration with Swift and Objective-C \- Medium, accessed January 20, 2026, [https://medium.com/@antonio.dias.bastiao/bridging-rust-and-ios-seamless-native-integration-with-swift-and-objective-c-7e1462c5c586](https://medium.com/@antonio.dias.bastiao/bridging-rust-and-ios-seamless-native-integration-with-swift-and-objective-c-7e1462c5c586)  
6. Using the Metal 4 compilation API | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/Metal/using-the-metal-4-compilation-api](https://developer.apple.com/documentation/Metal/using-the-metal-4-compilation-api)  
7. App Review Guidelines \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/app-store/review/guidelines/](https://developer.apple.com/app-store/review/guidelines/)  
8. Optimizing bitdrift's Rust mobile SDK for binary size \- Blog, accessed January 20, 2026, [https://blog.bitdrift.io/post/optimizing-rust-mobile-sdk-binary-size](https://blog.bitdrift.io/post/optimizing-rust-mobile-sdk-binary-size)  
9. Reduce the binary size · Issue \#1464 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu-rs/issues/696](https://github.com/gfx-rs/wgpu-rs/issues/696)  
10. Building a universal macOS binary | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary)  
11. Configuring the macOS App Sandbox | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox](https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox)  
12. Accessing files from the macOS App Sandbox | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox)  
13. IOKit not permitted in Sandbox? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/23244349/iokit-not-permitted-in-sandbox](https://stackoverflow.com/questions/23244349/iokit-not-permitted-in-sandbox)  
14. BR: error in entitlements for macOS \- MacOSX and iOS \- JUCE Forum, accessed January 20, 2026, [https://forum.juce.com/t/br-error-in-entitlements-for-macos/58002](https://forum.juce.com/t/br-error-in-entitlements-for-macos/58002)  
15. App Sandbox Temporary Exception Entitlements \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/AppSandboxTemporaryExceptionEntitlements.html](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/AppSandboxTemporaryExceptionEntitlements.html)  
16. MetricKit | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/MetricKit](https://developer.apple.com/documentation/MetricKit)  
17. hangDiagnostics | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/metrickit/mxdiagnosticpayload/hangdiagnostics?changes=\_6](https://developer.apple.com/documentation/metrickit/mxdiagnosticpayload/hangdiagnostics?changes=_6)  
18. It does not correspond to sandbox of macOS · Issue \#343 · oshi/oshi \- GitHub, accessed January 20, 2026, [https://github.com/oshi/oshi/issues/343](https://github.com/oshi/oshi/issues/343)  
19. objective c \- Sandbox \- killall Operation not permitted \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/10808258/sandbox-killall-operation-not-permitted](https://stackoverflow.com/questions/10808258/sandbox-killall-operation-not-permitted)  
20. Updated App Review Guidelines now available \- Latest News \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/news/?id=ey6d8onl](https://developer.apple.com/news/?id=ey6d8onl)  
21. System Monitor \- App Store, accessed January 20, 2026, [https://apps.apple.com/us/app/system-monitor/id423368786?mt=12](https://apps.apple.com/us/app/system-monitor/id423368786?mt=12)  
22. Privacy \- Control \- Apple, accessed January 20, 2026, [https://www.apple.com/privacy/control/](https://www.apple.com/privacy/control/)  
23. What are Apple's Privacy Nutrition Labels? \- Adjust, accessed January 20, 2026, [https://www.adjust.com/glossary/privacy-nutrition-labels/](https://www.adjust.com/glossary/privacy-nutrition-labels/)  
24. How to Fill Out Apple's App Store Privacy Label (Complete Guide) \- Respectlytics, accessed January 20, 2026, [https://respectlytics.com/blog/app-store-privacy-label-guide/](https://respectlytics.com/blog/app-store-privacy-label-guide/)  
25. Privacy \- Labels \- Apple, accessed January 20, 2026, [https://www.apple.com/privacy/labels/](https://www.apple.com/privacy/labels/)  
26. Top 10 App Store Rejection Reasons and How to Fix them \- UXCam, accessed January 20, 2026, [https://uxcam.com/blog/app-store-rejection-reasons/](https://uxcam.com/blog/app-store-rejection-reasons/)  
27. iOS In-App Subscription Tutorial with StoreKit 2 and Swift \- RevenueCat, accessed January 20, 2026, [https://www.revenuecat.com/blog/engineering/ios-in-app-subscription-tutorial-with-storekit-2-and-swift/](https://www.revenuecat.com/blog/engineering/ios-in-app-subscription-tutorial-with-storekit-2-and-swift/)  
28. Validating receipts with the App Store | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store](https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store)  
29. Handle software updates in the mac app using Sparkle framework \- Medium, accessed January 20, 2026, [https://medium.com/@arulmurugan\_s/handle-software-updates-in-the-mac-app-using-sparkle-framework-646fdb2ed067](https://medium.com/@arulmurugan_s/handle-software-updates-in-the-mac-app-using-sparkle-framework-646fdb2ed067)  
30. ios \- How to symbolicate crash log Xcode? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/25855389/how-to-symbolicate-crash-log-xcode](https://stackoverflow.com/questions/25855389/how-to-symbolicate-crash-log-xcode)  
31. IOS Testflight Crash logs · dotnet maui · Discussion \#22535 \- GitHub, accessed January 20, 2026, [https://github.com/dotnet/maui/discussions/22535](https://github.com/dotnet/maui/discussions/22535)  
32. Fixing Bitcode Issues in Xcode 16: How to Resolve Invalid Executable Errors When Uploading iOS Builds \- Medium, accessed January 20, 2026, [https://medium.com/@abdulahad2024/fixing-bitcode-issues-in-xcode-16-how-to-resolve-invalid-executable-errors-when-uploading-ios-da07a5a39c7c](https://medium.com/@abdulahad2024/fixing-bitcode-issues-in-xcode-16-how-to-resolve-invalid-executable-errors-when-uploading-ios-da07a5a39c7c)  
33. About Entitlements \- Apple Developer, accessed January 20, 2026, [https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/AboutEntitlements.html](https://developer.apple.com/library/archive/documentation/Miscellaneous/Reference/EntitlementKeyReference/Chapters/AboutEntitlements.html)  
34. SMAppService | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/servicemanagement/smappservice](https://developer.apple.com/documentation/servicemanagement/smappservice)  
35. Notarizing macOS software before distribution | Apple Developer Documentation, accessed January 20, 2026, [https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)