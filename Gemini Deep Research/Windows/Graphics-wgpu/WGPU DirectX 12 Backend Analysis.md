# **Comprehensive Technical Analysis of wgpu DirectX 12 Backend Architecture for High-Performance Desktop Applications**

## **1\. Introduction and Architectural Paradigm**

The landscape of real-time graphics rendering on the Windows desktop ecosystem has undergone a fundamental transformation with the advent of explicit APIs. While Direct3D 12 (D3D12) offers granular control over hardware resources, its inherent complexity—requiring manual memory residency management, synchronization barriers, and descriptor heap allocation—presents a significant barrier to entry and a source of critical stability errors. The wgpu project addresses this by implementing the WebGPU standard as a native, cross-platform Rust library, providing safety and portability without sacrificing the performance characteristics of modern hardware.1

The architecture of wgpu is strictly stratified. The user-facing API, exposed through wgpu-core, enforces valid usage rules and resource tracking. This layer sits atop wgpu-hal (Hardware Abstraction Layer), an unsafe, low-level interface that performs the direct translation of commands into the backend-specific API—in this case, Direct3D 12\.3 On Windows, the D3D12 backend is the primary execution path for high-performance applications, offering deeper integration with the Desktop Window Manager (DWM) and superior driver stability compared to Vulkan in windowed environments.5

This report provides an exhaustive technical analysis of the wgpu D3D12 backend. It dissects the initialization sequence, the mechanics of the DXGI Flip Model swap chain, the intricacies of memory residency via gpu-allocator, and the implementation of advanced display features like High Dynamic Range (HDR) and Variable Refresh Rate (VRR). Furthermore, it evaluates the tooling landscape for profiling and the specific driver behaviors that necessitate the backend’s complex workaround logic.

## **2\. D3D12 Device Initialization and Adapter Enumeration**

The initialization phase of a wgpu application on Windows is a critical sequence that determines the performance profile and stability of the renderer. This process involves interacting with the DirectX Graphics Infrastructure (DXGI) to enumerate physical adapters and creating a logical D3D12 device that satisfies specific feature level requirements.

### **2.1 DXGI Factory and Adapter Selection Logic**

The entry point for the D3D12 backend is the creation of a DXGI Factory. wgpu attempts to utilize the latest available interface, typically IDXGIFactory6 or IDXGIFactory4, to leverage modern enumeration methods. The selection of the physical adapter is governed by the RequestAdapterOptions structure, specifically the PowerPreference field.7

The enumeration strategy within wgpu-hal utilizes IDXGIFactory6::EnumAdapterByGpuPreference when available. This method allows the application to request a sort order based on DXGI\_GPU\_PREFERENCE\_HIGH\_PERFORMANCE or DXGI\_GPU\_PREFERENCE\_MINIMUM\_POWER.9

* **High Performance Preference:** When PowerPreference::HighPerformance is requested, wgpu instructs DXGI to prioritize discrete GPUs (dGPU). On a standard desktop with an NVIDIA RTX 4090 and an Intel iGPU, the factory will return the RTX card first.  
* **Low Power Preference:** Conversely, PowerPreference::LowPower targets the integrated GPU (iGPU) to conserve battery life, useful for non-graphics-intensive workloads like UI rendering.

#### **2.1.1 Hybrid Graphics Complexities**

A significant challenge arises in hybrid graphics environments, such as laptops with NVIDIA Optimus or AMD Switchable Graphics. In these configurations, the iGPU typically owns the display scan-out hardware, while the dGPU acts as a coprocessor. Empirical analysis suggests that wgpu's reliance on EnumAdapterByGpuPreference is not infallible. Windows 10 and 11 aggressively manage power profiles, and if the operating system designates the application as "Power Saving" in the system settings, DXGI may return the iGPU even when HighPerformance is requested.5

To mitigate this, robust applications utilizing wgpu often manually iterate through the list returned by Instance::enumerate\_adapters. By inspecting the AdapterInfo::device\_type field, developers can explicitly distinguish between DiscreteGpu and IntegratedGpu, overriding the default selection logic if necessary.11 This manual filter is crucial because the "High Performance" label in Windows is a hint, not a strict command, and the OS prioritizes thermal and power constraints over API requests.

### **2.2 Feature Level Negotiation: 11\_0 to 12\_2**

The Direct3D 12 API organizes hardware capabilities into "Feature Levels." wgpu enforces a strict minimum requirement of Feature Level 11\_0 (D3D\_FEATURE\_LEVEL\_11\_0). This baseline ensures support for essential features like Compute Shaders, Tiled Resources, and basic Resource Binding.12

The backend employs a descending search strategy to determine the highest supported feature level of the selected adapter. It queries the driver for support starting from the modern standard and falling back to the minimum:

1. **D3D\_FEATURE\_LEVEL\_12\_2:** The "Ultimate" tier, requiring support for DirectX Raytracing (DXR) Tier 1.1, Mesh Shaders, and Variable Rate Shading (VRS). wgpu detects this for future-proofing and enabling experimental features like ray tracing.14  
2. **D3D\_FEATURE\_LEVEL\_12\_1:** Introduced with NVIDIA Maxwell (Gen 2\) and Skylake, enabling Conservative Rasterization and Rasterizer Ordered Views (ROVs).  
3. **D3D\_FEATURE\_LEVEL\_12\_0:** The standard baseline for "modern" DX12, supported by Maxwell Gen 1 and GCN architectures.  
4. **D3D\_FEATURE\_LEVEL\_11\_1:** A transitional level.  
5. **D3D\_FEATURE\_LEVEL\_11\_0:** The absolute floor. Adapters failing to meet this (e.g., pre-Fermi NVIDIA, pre-GCN AMD) will fail RequestAdapter, necessitating a fallback to the DX11 or OpenGL backends.13

#### **2.2.1 Critical Implementation Flaw in Feature Detection**

A notable instability was identified in previous versions of wgpu-hal regarding the feature level query. The implementation passed an array of feature levels including D3D\_FEATURE\_LEVEL\_12\_2 to ID3D12Device::CheckFeatureSupport. On systems with older Windows SDKs or drivers that did not recognize the 12\_2 enumeration value, this function call would invoke undefined behavior, leading to application crashes.14 The resolution involved sanitizing the input to CheckFeatureSupport based on the host system's capabilities, illustrating the fragility of interfacing with evolving Windows APIs.

### **2.3 Device Creation and Queue Architecture**

Once the adapter and feature level are validated, wgpu creates the ID3D12Device. Unlike Vulkan, which exposes granular queue families, D3D12 typically provides three primary command queue types: D3D12\_COMMAND\_LIST\_TYPE\_DIRECT (Graphics \+ Compute \+ Copy), COMPUTE, and COPY.

wgpu abstracts these into a unified Queue object. Internally, the D3D12 backend primarily utilizes the DIRECT queue for the main submission path to ensure synchronization simplicity. While D3D12 supports async compute and copy queues for parallelism, wgpu's current architecture often serializes operations onto the direct queue to strictly satisfy the WebGPU ordering guarantees without incurring the complexity of multi-queue cross-synchronization barriers, although internal optimizations for transfer operations on copy queues are implemented where safe.3

## **3\. Swap Chain Architecture and Presentation Models**

The bridge between the rendered frame and the display hardware is the Swap Chain. In the D3D12 backend, this is managed via the DXGI 1.4+ API, necessitating a departure from legacy paradigms towards the modern "Flip Model."

### **3.1 The Flip Model: DXGI\_SWAP\_EFFECT\_FLIP\_DISCARD**

wgpu exclusively utilizes the Flip Model for its swap chains on D3D12. The specific swap effect utilized is DXGI\_SWAP\_EFFECT\_FLIP\_DISCARD.16 This choice is non-negotiable for D3D12, which deprecated the older BitBlt (Bit-Block Transfer) models (DXGI\_SWAP\_EFFECT\_DISCARD and SEQUENTIAL) used in DX11.

The Flip Model operates by sharing the back buffer surface directly with the Desktop Window Manager (DWM). When IDXGISwapChain::Present is called, the OS simply swaps the pointer of the visible surface with the back buffer.

* **Zero-Copy Efficiency:** This mechanism eliminates the memory copy operation required by the BitBlt model, significantly reducing memory bandwidth consumption and presentation latency.18  
* **Multiplane Overlays (MPO):** Using the Flip Model allows the DWM to promote the application's swap chain to a dedicated hardware scan-out plane (MPO). When this occurs, the composition pass is bypassed entirely, allowing the application to scan out directly to the display. This achieves the latency and performance characteristics of "Exclusive Fullscreen" while running in a windowed borderless mode.19

### **3.2 Borderless Windowed vs. Exclusive Fullscreen**

A distinct characteristic of wgpu on Windows is its handling of fullscreen modes. The API does not expose a traditional "Exclusive Fullscreen" mode that changes the display resolution and takes sole control of the output. Instead, it relies on the "Immediate Independent Flip" optimization.

When a wgpu window is resized to cover the entire screen (Borderless Windowed) and uses the Flip Model, the DWM disengages its compositor for that window. The application effectively enters "pseudo-exclusive" mode.

* **Advantages:** This approach allows for instant Alt-Tab switching, overlay support (Game Bar, volume indicators), and eliminates the "mode switch" flicker associated with legacy exclusive fullscreen.20  
* **Latency:** Tests confirm that modern D3D12 Flip Model in borderless mode achieves identical latency to legacy exclusive mode, rendering the latter obsolete for most use cases.21

### **3.3 Latency Control via Waitable Objects**

To ensure high responsiveness, wgpu implements latency control using "Waitable Swap Chains."

* **The Latency Problem:** By default, DXGI may queue up to 3 frames to ensure smooth playback. For interactive applications, this introduces a perceptible input lag (up to \~50ms at 60Hz).  
* **The Solution:** wgpu creates the swap chain with the DXGI\_SWAP\_CHAIN\_FLAG\_FRAME\_LATENCY\_WAITABLE\_OBJECT flag. This exposes a synchronization handle via IDXGISwapChain2::GetFrameLatencyWaitableObject.22  
* **Implementation:** Within the Surface::get\_current\_texture call, wgpu waits on this object. This blocks the CPU thread until the GPU has processed enough frames to drop below the maximum latency threshold (configurable via SurfaceConfiguration::desired\_maximum\_frame\_latency). Setting this to 1 ensures that the CPU never races ahead of the GPU, minimizing the "frame in flight" queue and reducing input lag to the hardware minimum.22

## **4\. Tearing Control and Variable Refresh Rate (VRR)**

Supporting high-refresh-rate displays and Variable Refresh Rate (VRR) technologies like NVIDIA G-Sync and AMD FreeSync requires precise configuration of the DXGI swap chain flags.

### **4.1 Present Modes and Synchronization**

The wgpu PresentMode enum maps directly to DXGI present parameters. The behavior is distinct for each mode:

| wgpu PresentMode | DXGI Equivalent Configuration | Behavior Description |
| :---- | :---- | :---- |
| **Fifo** | SyncInterval \= 1 | **V-Sync On.** Presentation is synchronized with the Vertical Blanking Interval (VBlank). The frame rate is capped at the monitor's refresh rate (e.g., 60Hz). Guarantees no tearing.24 |
| **Immediate** | SyncInterval \= 0 \+ ALLOW\_TEARING | **V-Sync Off.** The driver presents the frame immediately, even if the scan-out is in the middle of the screen. This results in visual tearing but offers the lowest possible latency. |
| **Mailbox** | SyncInterval \= 0 (Waitable) | **Fast Sync / Enhanced Sync.** The application renders as fast as possible. The swap chain discards older frames and only presents the most recent complete frame at the next VBlank. Low latency, no tearing. |

### **4.2 The ALLOW\_TEARING Flag Requirement**

To support PresentMode::Immediate (uncapped framerate) and proper VRR functionality, wgpu must navigate strict DXGI requirements.

1. **Creation:** The swap chain must be initialized with DXGI\_SWAP\_CHAIN\_FLAG\_ALLOW\_TEARING.  
2. **Presentation:** Every Present call must include the DXGI\_PRESENT\_ALLOW\_TEARING flag.  
3. **Constraint:** The tearing flag is *only* valid when SyncInterval is 0\. Using it with V-Sync enabled results in a DXGI\_ERROR\_INVALID\_CALL.20

#### **4.2.1 VRR Implementation Details**

For G-Sync/FreeSync to activate, the application typically needs to be in a fullscreen state (or the driver must support "Windowed G-Sync"). By using DXGI\_SWAP\_CHAIN\_FLAG\_ALLOW\_TEARING in a borderless window, wgpu enables the driver to modulate the display's refresh rate to match the render rate. If the application runs at 45 FPS, the monitor refreshes at 45Hz. If the framerate exceeds the monitor's max, the behavior depends on the V-Sync setting (tearing if Immediate, capped if Fifo).

### **4.3 Common Pitfalls and "Greyed Out" VRR**

Users have reported issues where VRR options appear disabled or non-functional on Intel Arc and specific AMD configurations.26 This is often linked to the "Fullscreen Optimizations" feature in Windows or overlay interference. If the DWM fails to promote the window to an MPO plane (e.g., because a transparent window is on top), the composition path forces V-Sync, breaking VRR. wgpu developers must ensure the surface is opaque and covers the full client area to maximize VRR compatibility.16

## **5\. High Dynamic Range (HDR) Rendering Implementation**

The transition from Standard Dynamic Range (SDR) to High Dynamic Range (HDR) represents a significant increase in visual fidelity, requiring wgpu to handle higher bit-depths and wider color gamuts.

### **5.1 Format Support: scRGB vs. HDR10**

Windows supports two primary pixel formats for HDR content, and wgpu must choose between them based on the SurfaceConfiguration.

#### **5.1.1 scRGB (DXGI\_FORMAT\_R16G16B16A16\_FLOAT)**

This is the canonical composition color space (CCCS) for the Windows DWM.

* **Characteristics:** It uses 16-bit floating-point values per channel. The color space is Linear sRGB primaries.  
* **Values:** SDR white is encoded as 1.0. HDR highlights are encoded as values \> 1.0 (e.g., 12.5 for 1000 nits, assuming 80 nits reference white).  
* **Pros:** It allows for values outside the range and negative values, covering the entire visible spectrum (Scötopic). It is linear, simplifying blending operations.28  
* **Cons:** High bandwidth consumption (64 bits per pixel).

#### **5.1.2 HDR10 (DXGI\_FORMAT\_R10G10B10A2\_UNORM)**

* **Characteristics:** It uses 10 bits for Red, Green, and Blue, and 2 bits for Alpha.  
* **Color Space:** Typically uses Rec.2020 primaries with the ST.2084 (Perceptual Quantizer \- PQ) transfer function.  
* **Pros:** Efficient bandwidth usage (32 bits per pixel), identical to standard RGBA8. Preferred for full-screen games.  
* **Cons:** Requires precise color space metadata handling. The non-linear PQ encoding makes blending operations mathematically incorrect if not decoded to linear first.28

### **5.2 wgpu Implementation Status and Metadata Issues**

As of current versions, wgpu's support for native HDR surfaces is functional but requires manual configuration. The Adapter::get\_capabilities method will report TextureFormat::Rgba16Float or Rgb10a2Unorm if the driver allows it.29

However, a critical gap exists in the handling of HDR Metadata (ST.2086). To correctly display HDR10 content, the application must send metadata (MaxCLL, MaxFALL, Mastering Display Primaries) to the display. wgpu does not yet expose a high-level API for IDXGISwapChain4::SetHDRMetaData.

* **Consequence:** Without this metadata, the display uses a fallback tone-mapping curve, which may clip highlights or wash out colors.  
* **Workaround:** Developers targeting professional HDR output often need to use unsafe blocks to retrieve the raw IDXGISwapChain handle from wgpu-hal and call SetColorSpace1 and SetHDRMetaData directly via the windows crate.28

## **6\. GPU Memory Management and Residency**

In Direct3D 12, the driver no longer manages memory automatically. The application is responsible for allocating heaps, sub-allocating resources, and ensuring they are "Resident" in video memory (VRAM) when needed. wgpu abstracts this complexity using the gpu-allocator crate.

### **6.1 The gpu-allocator Strategy**

The D3D12 backend utilizes gpu-allocator (a Rust port of the AMD D3D12MemoryAllocator) to implement the "Classify, Budget, and Stream" strategy.31

* **Heap Allocation:** Instead of creating a committed resource for every texture (which creates a distinct heap and has high overhead), wgpu allocates large ID3D12Heap blocks (e.g., 256MB).  
* **Placed Resources:** It then uses CreatePlacedResource to sub-allocate individual buffers and textures within these heaps. This minimizes the OS kernel overhead associated with memory management.  
* **Tiers:** The allocator automatically detects the hardware Tier. On Tier 1 hardware (older architectures), it must segregate buffers, render targets, and textures into different heaps. On Tier 2, it allows mixed resource types.32

### **6.2 Residency Management: MakeResident and Evict**

WDDM 2.0 (Windows Display Driver Model) introduced the concept of explicit residency.

* **The Budget:** wgpu queries IDXGIAdapter3::QueryVideoMemoryInfo to determine the "Local Budget" (available VRAM) and "Non-Local Budget" (shared system RAM).  
* **Eviction:** If the application exceeds its budget, the OS may page out resources to disk or system RAM, causing catastrophic performance degradation (stuttering).  
* **MakeResident:** Before executing a command list, wgpu must ensure that all heaps referenced by that list are resident. It calls ID3D12Device::MakeResident.33  
* **Synchronization Cost:** MakeResident is a synchronous kernel call. If the memory was paged out, this call blocks the CPU thread until the data is paged back in. This latency is a primary source of stutter in unoptimized D3D12 applications.34

### **6.3 Upload and Readback Heaps**

Data transfer in wgpu relies on specific heap types:

* **D3D12\_HEAP\_TYPE\_UPLOAD:** This memory is CPU-writable and GPU-readable (via PCIe). wgpu uses "Staging Belts"—linear allocators in upload heaps—to handle Queue::write\_buffer commands.  
* **D3D12\_HEAP\_TYPE\_READBACK:** CPU-readable and GPU-writable. Used for capturing screenshots or reading back compute results.  
* **ReBAR (Resizeable BAR):** Emerging support for D3D12\_HEAP\_TYPE\_GPU\_UPLOAD allows the CPU to write directly to VRAM, bypassing the slow system RAM upload heap path. This feature is critical for the performance of unified memory architectures and modern dGPUs.35

## **7\. Performance Profiling and Tooling**

Profiling wgpu applications on Windows requires navigating native tools, as the high-level API abstractions can obscure the underlying hardware behavior.

### **7.1 PIX for Windows**

PIX is the definitive profiling tool for D3D12.

* **GPU Capture:** This mode records every API call (e.g., DrawInstanced, ExecuteCommandLists) for a single frame. It allows developers to inspect the pipeline state, root signatures, and resource bindings generated by wgpu-hal.36  
* **Timing Captures:** To analyze performance, PIX Timing Captures visualize the execution of the GPU and CPU timelines.  
* **Instrumentation:** wgpu supports the wgpu::Label trait. On the D3D12 backend, these labels are translated into PIX Events using PIXBeginEvent and PIXEndEvent (requires WinPixEventRuntime.dll). This creates a hierarchical view in the PIX timeline (e.g., "Shadow Pass" \-\> "Draw Entity"), making it possible to correlate API calls with logical render passes.37

### **7.2 Windows Performance Analyzer (WPA)**

For diagnosing CPU-side bottlenecks, WPA is essential.

* **Jitter Analysis:** WPA can track the precise timing of the Present call and the "DWM Frame Presentation" event. This reveals if the application is missing V-Sync windows due to CPU logic or if the GPU is taking too long to complete the frame.31  
* **Queue Packets:** WPA traces the submission of packets to the GPU hardware queue, helping to identify if wgpu is batching command lists effectively or submitting them too frequently (incurring kernel call overhead).

### **7.3 GPU-Z and Hardware Sensors**

Tools like GPU-Z provide real-time monitoring of:

* **Video Engine Load:** Indicates if hardware video decoding is active (relevant if wgpu is processing video frames).  
* **Bus Interface Load:** High load here indicates excessive data transfer between CPU and GPU, suggesting that wgpu might be thrashing resources between UPLOAD and DEFAULT heaps or failing to keep resources resident.36

## **8\. Driver Quirks and Vendor-Specific Behavior**

The "unsafe" nature of wgpu-hal means it must implement workarounds for driver bugs that violate the D3D12 specification.

### **8.1 NVIDIA**

* **Strict Barriers:** NVIDIA drivers strictly enforce resource state transitions. A missing transition from D3D12\_RESOURCE\_STATE\_COPY\_DEST to D3D12\_RESOURCE\_STATE\_PIXEL\_SHADER\_RESOURCE will trigger Debug Layer errors and potential instability. wgpu's barrier tracker is rigorous to satisfy this.  
* **Profile Overrides:** The NVIDIA Control Panel can force settings (like AA or Power Management) that override wgpu's intent, leading to mismatching adapter selection.5

### **8.2 Intel**

* **TDR (Timeout Detection and Recovery):** Integrated Intel GPUs (e.g., UHD 620/630) are prone to hanging if a compute shader runs too long. wgpu attempts to partition workloads, but DXGI\_ERROR\_DEVICE\_REMOVED is a common failure mode on these chips.  
* **Memory Leaks:** Older Intel drivers exhibited leaks in the D3D12 root signature management, necessitating driver updates for stable long-term operation.39

### **8.3 AMD**

* **Bindless Descriptors:** AMD drivers have historically had issues with "Bindless" resource arrays (SM 6.0 features) utilized by wgpu's descriptor indexing implementation. This manifests as crashes in the shader compiler or during pipeline creation.41  
* **Presentation Stutter:** Issues with the Flip Model synchronization on specific RDNA architectures have been observed, where enabling ALLOW\_TEARING in windowed mode causes micro-stuttering unless the specific Radeon software setting for "Enhanced Sync" is toggled.10

## **9\. Fallback Strategies: DX11 and Vulkan**

When D3D12 is unavailable or unstable, wgpu relies on fallback backends.

### **9.1 Direct3D 11**

The DX11 backend is the primary fallback for Windows 7/8.1 or older hardware (Fermi/Pre-GCN).

* **Feature Parity:** It supports most WebGPU features but lacks Ray Tracing and Mesh Shaders.  
* **Stability:** It is extremely mature and less prone to the "Device Removed" errors caused by improper barrier management in DX12.  
* **Flip Model:** Crucially, wgpu on DX11 *also* supports the Flip Model (DXGI\_SWAP\_EFFECT\_FLIP\_DISCARD) on Windows 10/11, ensuring that the fallback path does not suffer from increased latency compared to DX12.18

### **9.2 Vulkan on Windows**

* **Parity:** Vulkan offers feature parity with DX12.  
* **WSI Issues:** Vulkan's integration with the Windows desktop (WSI) is sometimes less robust than DXGI. Resizing windows can trigger validation errors or swap chain recreation lags that are smoother in DX12.  
* **Selection:** Users can force this backend via the environment variable WGPU\_BACKEND=vulkan for testing or if the DX12 driver is broken for a specific device.5

## **10\. Conclusion**

The wgpu Direct3D 12 backend represents a complex convergence of modern graphics engineering and legacy system integration. By effectively leveraging the **DXGI Flip Model**, **Waitable Swap Chains**, and the **gpu-allocator** residency manager, it delivers a high-performance foundation capable of rivaling native C++ engines. However, the intricacies of **HDR metadata**, **VRR synchronization flags**, and **Hybrid Graphics selection** require developers to possess a deep understanding of the underlying API constraints.

Success with wgpu on Windows depends not just on writing safe Rust code, but on understanding the unsafe reality of the driver stack beneath it. The detailed profiling workflows via PIX and the strategic handling of driver-specific quirks are essential skills for delivering a robust, production-grade desktop application.

#### **Works cited**

1. wgpu \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/wgpu/](https://docs.rs/wgpu/)  
2. gfx-rs/wgpu: A cross-platform, safe, pure-Rust graphics API. \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu](https://github.com/gfx-rs/wgpu)  
3. Adapter in wgpu \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/wgpu/latest/wgpu/struct.Adapter.html](https://docs.rs/wgpu/latest/wgpu/struct.Adapter.html)  
4. wgpu-hal 27.0.4 \- Docs.rs, accessed January 20, 2026, [https://docs.rs/crate/wgpu-hal/latest/source/src/lib.rs](https://docs.rs/crate/wgpu-hal/latest/source/src/lib.rs)  
5. Backend selection is not always Vulkan \> Metal \> DX12 · Issue \#1416 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/1416](https://github.com/gfx-rs/wgpu/issues/1416)  
6. Make DX12 the Default API on Windows · Issue \#2719 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/2719](https://github.com/gfx-rs/wgpu/issues/2719)  
7. The wgpu backends — wgpu-py 0.15.2 documentation, accessed January 20, 2026, [https://wgpu-py.readthedocs.io/en/v0.15.2/backends.html](https://wgpu-py.readthedocs.io/en/v0.15.2/backends.html)  
8. Instance in wgpu \- Rust, accessed January 20, 2026, [https://idanarye.github.io/bevy-tnua/wgpu/struct.Instance.html](https://idanarye.github.io/bevy-tnua/wgpu/struct.Instance.html)  
9. Instance in wgpu \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/wgpu/latest/wgpu/struct.Instance.html](https://docs.rs/wgpu/latest/wgpu/struct.Instance.html)  
10. WGPU is using integrated graphics when I told it to use high performance. \#8793 \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/8793](https://github.com/gfx-rs/wgpu/issues/8793)  
11. Intel Integrated GPU Erroniously Reported as a Discrete GPU on DX12 Backend · Issue \#683 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/683](https://github.com/gfx-rs/wgpu/issues/683)  
12. Hardware Feature Levels \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/direct3d12/hardware-feature-levels](https://learn.microsoft.com/en-us/windows/win32/direct3d12/hardware-feature-levels)  
13. Failed to find adapter on Dx12 · Issue \#2437 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/2437](https://github.com/gfx-rs/wgpu/issues/2437)  
14. DX12 fails to populate \`MaxSupportedFeatureLevel\` on specific (older?) environments · Issue \#8803 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/8803](https://github.com/gfx-rs/wgpu/issues/8803)  
15. d3d12 package \- github.com/gogpu/wgpu/hal/dx12/d3d12 \- Go Packages, accessed January 20, 2026, [https://pkg.go.dev/github.com/gogpu/wgpu/hal/dx12/d3d12](https://pkg.go.dev/github.com/gogpu/wgpu/hal/dx12/d3d12)  
16. For best performance, use DXGI flip model \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/for-best-performance--use-dxgi-flip-model](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/for-best-performance--use-dxgi-flip-model)  
17. DXGI\_SWAP\_EFFECT enumeration (dxgi.h) \- Win32 \- Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/api/dxgi/ne-dxgi-dxgi\_swap\_effect](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/ne-dxgi-dxgi_swap_effect)  
18. The Care and Feeding of Modern Swap Chains (part 1), accessed January 20, 2026, [https://walbourn.github.io/care-and-feeding-of-modern-swapchains/](https://walbourn.github.io/care-and-feeding-of-modern-swapchains/)  
19. Migrating Your Apps to DirectX\* 12 – Part 4, accessed January 20, 2026, [https://www.intel.cn/content/dam/develop/external/us/en/documents/tutorial-migrating-your-aps-to-directx-12-part-4-599498.pdf](https://www.intel.cn/content/dam/develop/external/us/en/documents/tutorial-migrating-your-aps-to-directx-12-part-4-599498.pdf)  
20. Advanced API Performance: Swap Chains | NVIDIA Technical Blog, accessed January 20, 2026, [https://developer.nvidia.com/blog/advanced-api-performance-swap-chains/](https://developer.nvidia.com/blog/advanced-api-performance-swap-chains/)  
21. Fullscreen (exclusive) crashes when used with DXGI flip mode surfaces · Issue \#3124 · rust-windowing/winit \- GitHub, accessed January 20, 2026, [https://github.com/rust-windowing/winit/issues/3124](https://github.com/rust-windowing/winit/issues/3124)  
22. Sample Application for Direct3D 12 Flip Model Swap Chains \- Intel, accessed January 20, 2026, [https://www.intel.com/content/www/us/en/developer/articles/code-sample/sample-application-for-direct3d-12-flip-model-swap-chains.html](https://www.intel.com/content/www/us/en/developer/articles/code-sample/sample-application-for-direct3d-12-flip-model-swap-chains.html)  
23. SurfaceConfiguration in wgpu \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/wgpu/latest/wgpu/type.SurfaceConfiguration.html](https://docs.rs/wgpu/latest/wgpu/type.SurfaceConfiguration.html)  
24. PresentMode in slint::wgpu\_26::wgpu \- Rust, accessed January 20, 2026, [https://docs.slint.dev/latest/docs/rust/slint/wgpu\_26/wgpu/enum.PresentMode](https://docs.slint.dev/latest/docs/rust/slint/wgpu_26/wgpu/enum.PresentMode)  
25. Variable refresh rate displays \- Win32 apps \- Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/variable-refresh-rate-displays](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/variable-refresh-rate-displays)  
26. variable refresh rate greyed out : r/IntelArc \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/IntelArc/comments/1jr64na/variable\_refresh\_rate\_greyed\_out/](https://www.reddit.com/r/IntelArc/comments/1jr64na/variable_refresh_rate_greyed_out/)  
27. DX12 Forces my fps to be capped to my monitors refresh rate no matter what, while Vulkan allows uncapped. Anyone else? : r/pathofexile \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/pathofexile/comments/v0ba3c/dx12\_forces\_my\_fps\_to\_be\_capped\_to\_my\_monitors/](https://www.reddit.com/r/pathofexile/comments/v0ba3c/dx12_forces_my_fps_to_be_capped_to_my_monitors/)  
28. Use DirectX with Advanced Color on high/standard dynamic range displays \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/direct3darticles/high-dynamic-range](https://learn.microsoft.com/en-us/windows/win32/direct3darticles/high-dynamic-range)  
29. Rendering to texture no longer works with RGBA texture format, but used to work in v.0.12 · Issue \#2878 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/2878](https://github.com/gfx-rs/wgpu/issues/2878)  
30. Well-defined HDR surface support · Issue \#2920 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/2920](https://github.com/gfx-rs/wgpu/issues/2920)  
31. Memory Management in Direct3D 12 \- Win32 apps \- Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/direct3d12/memory-management](https://learn.microsoft.com/en-us/windows/win32/direct3d12/memory-management)  
32. D3D12 Memory Allocator \- AMD GPUOpen, accessed January 20, 2026, [https://gpuopen.com/d3d12-memory-allocator/](https://gpuopen.com/d3d12-memory-allocator/)  
33. Practical DirectX 12 \- AMD GPUOpen, accessed January 20, 2026, [https://gpuopen.com/download/Practical\_DX12\_Programming\_Model\_and\_Hardware\_Capabilities.pdf](https://gpuopen.com/download/Practical_DX12_Programming_Model_and_Hardware_Capabilities.pdf)  
34. Coming to DirectX 12: More control over memory allocation \- Microsoft Dev Blogs, accessed January 20, 2026, [https://devblogs.microsoft.com/directx/coming-to-directx-12-more-control-over-memory-allocation/](https://devblogs.microsoft.com/directx/coming-to-directx-12-more-control-over-memory-allocation/)  
35. D3D12 Memory Allocator: Optimal resource allocation \- GPUOpen Libraries & SDKs, accessed January 20, 2026, [https://gpuopen-librariesandsdks.github.io/D3D12MemoryAllocator/html/optimal\_allocation.html](https://gpuopen-librariesandsdks.github.io/D3D12MemoryAllocator/html/optimal_allocation.html)  
36. GPU Captures \- PIX on Windows \- Microsoft Dev Blogs, accessed January 20, 2026, [https://devblogs.microsoft.com/pix/gpu-captures/](https://devblogs.microsoft.com/pix/gpu-captures/)  
37. Analyze frames with GPU captures \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/direct3dtools/pix/articles/gpu-captures/pix-gpu-captures](https://learn.microsoft.com/en-us/windows/win32/direct3dtools/pix/articles/gpu-captures/pix-gpu-captures)  
38. WinPixEventRuntime \- PIX on Windows \- Microsoft Dev Blogs, accessed January 20, 2026, [https://devblogs.microsoft.com/pix/winpixeventruntime/](https://devblogs.microsoft.com/pix/winpixeventruntime/)  
39. DEVICE\_REMOVAL\_PROCESS, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/4007](https://github.com/gfx-rs/wgpu/issues/4007)  
40. DeviceLost with D3D12 on Intel HD 4000 · Issue \#849 · gfx-rs/wgpu \- GitHub, accessed January 20, 2026, [https://github.com/gfx-rs/wgpu/issues/849](https://github.com/gfx-rs/wgpu/issues/849)  
41. AMD driver crash on DX12 bindless API usage · Issue \#140 · DiligentGraphics/DiligentSamples \- GitHub, accessed January 20, 2026, [https://github.com/DiligentGraphics/DiligentSamples/issues/140](https://github.com/DiligentGraphics/DiligentSamples/issues/140)