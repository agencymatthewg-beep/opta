# **The Sovereign Interface: Engineering High-Performance, Privacy-First AI Applications on Windows**

## **1\. The Convergence of Hardware, Economics, and Architecture**

The personal computing landscape is currently undergoing a structural transformation comparable in magnitude to the shift from command-line interfaces to graphical user interfaces, or the migration from local software to the cloud. This new epoch, defined by the "AI PC," is characterized by the migration of artificial intelligence inference from centralized data centers back to the network edge. For software architects and developers targeting the Microsoft Windows ecosystem, this shift presents a distinct set of economic opportunities and technical imperatives. Success in this emerging market is no longer defined merely by feature sets, but by the architectural decisions that govern latency, privacy, and system integration.

The market data paints a picture of aggressive expansion. The global market for AI applications, valued at approximately USD 2.94 billion in 2024, is projected to ascend to USD 26.36 billion by 2030\. This trajectory represents a Compound Annual Growth Rate (CAGR) of 38.7% over the latter half of the decade.1 While North America currently anchors the market, accounting for nearly 30% of the share in recent years, the Asia-Pacific region is poised to capture the plurality of revenue—roughly 45%—by 2030, driven by the rapid commoditization of AI-capable hardware in manufacturing and consumer electronics hubs.2

However, the aggregate market size belies the specific dynamics driving the Windows ecosystem. The primary catalyst for the "AI PC" is the impending End-of-Support (EOS) for Windows 10, scheduled for October 2025\. This deadline is triggering a massive enterprise hardware refresh cycle. Corporations, legally and operationally bound to maintain supported operating systems, are replacing aging fleets with modern devices. Unlike previous cycles, where upgrades focused on marginal CPU speed improvements, this cycle introduces a new standard: the Copilot+ PC. These devices are mandated to carry Neural Processing Units (NPUs) capable of at least 40 Trillion Operations Per Second (TOPS), fundamentally altering the compute baseline for Windows applications.2

Global revenues for AI PCs surged from near-zero in early 2024 to an estimated $7 billion by the end of that year. As the enterprise refresh accelerates in 2025, this segment is projected to more than triple to $25 billion.2 The implications for application development are profound. The install base is bifurcating into two distinct tiers: a legacy tier reliant on CPU or discrete GPU inference, and a modern, NPU-native tier capable of sustained, low-power background AI processing.

### **1.1 The Privacy Imperative and the "Anti-Cloud" Thesis**

While the hardware market expands, the software market is grappling with a "Privacy Gap." First-generation generative AI tools, exemplified by Microsoft Copilot and ChatGPT, are cloud-native architectures. They require user data to traverse the public internet to be processed on Azure or OpenAI servers. While acceptable for casual consumer use, this architecture faces stiff resistance in high-compliance sectors such as law, finance, healthcare, and defense.

Legal professionals cannot ethically upload unredacted contracts to a third-party server. Financial analysts cannot expose proprietary datasets to models that might implicitly learn from them. This friction has created a substantial market opening for "Local-First" AI applications—software that guarantees data sovereignty by performing all inference on the local machine.4

Research indicates a clear divergence in adoption based on these concerns. While adoption in the Global North has reached nearly 25% of the working-age population, there is a persistent demand for tools that operate offline and independent of major cloud providers.5 A successful Windows AI application in 2025, therefore, competes not on the size of its model (where the cloud will always win), but on the privacy of its execution. By leveraging the local NPU and GPU, a native application can offer Retrieval-Augmented Generation (RAG) capabilities where the document index, the embedding model, and the generation model never leave the user's physical device.6

### **1.2 The Strategic Case for Rust**

In this context, the choice of programming language becomes a strategic differentiator. The historical dichotomy in Windows development—C++ for performance, C\#/.NET for productivity—is being disrupted by Rust.

Rust offers a unique value proposition for the "AI PC" era:

1. **Memory Safety without Garbage Collection:** AI applications deal with massive tensors and complex graph structures. C++ offers the control to manage this but introduces risks of memory leaks and buffer overflows. C\# manages memory automatically but introduces "stop-the-world" garbage collection pauses that ruin the fluidity of real-time inference interfaces. Rust provides the manual memory control of C++ with compile-time safety guarantees, ensuring robust performance without the pauses.7  
2. **Fearless Concurrency:** The modern AI app is a symphony of asynchronous tasks—UI rendering, model loading, token generation, and vector retrieval running in parallel. Rust’s ownership model (Send and Sync traits) prevents data races at compile time, allowing developers to build highly multi-threaded inference pipelines that utilize every core of the CPU and NPU without crashing.6  
3. **The "Thin Shell" Architecture:** The incumbent cross-platform framework, Electron, is increasingly viewed as bloated, often consuming 500MB+ of RAM for simple background tasks. A native Rust application can run as a "thin shell" consuming under 50MB, making it viable as an "always-on" system utility that respects the user's battery life and system resources.9

## ---

**2\. The Hardware Substrate: Navigating the Heterogeneous Compute Landscape**

To build a successful AI application on Windows, one must fundamentally misunderstand the PC. It is no longer a homogeneous architecture. It is a heterogeneous distributed system contained within a chassis, comprising a Central Processing Unit (CPU), a Graphics Processing Unit (GPU), and now, a Neural Processing Unit (NPU).

### **2.1 The NPU: A New Tier of Compute**

The Neural Processing Unit represents the most significant architectural addition to the PC since the GPU. Unlike GPUs, which are designed for massive parallel throughput (burst speed) at high power consumption, NPUs are architected for *efficiency* and *sustained* inference.

A typical use case illustrates the difference: A GPU might generate an image in 2 seconds utilizing 100 Watts. An NPU might generate the same image in 4 seconds but utilize only 10 Watts. For a laptop running on battery, the NPU enables "always-on" AI features—such as real-time context monitoring or background summarization—that would otherwise be battery-prohibitive.3

However, the NPU landscape is fragmented.

* **Intel Core Ultra (Meteor Lake/Arrow Lake):** Features the "Intel AI Boost" NPU. Support is currently accessible via the DirectML layer, but drivers are often in "Developer Preview" status, requiring specific OS builds (e.g., Windows 11 24H2).12  
* **Qualcomm Snapdragon X Elite:** The flagship of the "Windows on Arm" resurgence. Its Hexagon NPU is powerful (45 TOPS) but requires the Qualcomm Neural Network (QNN) framework or specialized DirectML drivers to function correctly.14  
* **AMD Ryzen AI:** Similar to Intel, leveraging distinct architectures that require unified abstraction layers.

### **2.2 DirectML: The Universal Abstraction**

For a Rust developer, targeting each NPU vendor individually (using OpenVINO for Intel, QNN for Qualcomm, ROCm for AMD) is a maintenance nightmare. The strategic solution is **DirectML** (Direct Machine Learning).

DirectML is a low-level API provided by Microsoft that abstracts the underlying hardware capabilities through the DirectX 12 pipeline. It allows a single inference codebase to execute on any DirectX 12-compatible GPU or NPU.16

* **Mechanism:** DirectML acts as an "Execution Provider" (EP) for the ONNX Runtime. When the application requests an inference session, DirectML translates the ONNX graph operators into GPU shaders or NPU instructions appropriate for the detected hardware.  
* **Rust Integration:** The integration is handled via the ort crate (ONNX Runtime bindings). By enabling the directml feature in Cargo.toml and configuring the session options to use DirectMLExecutionProvider, the Rust application delegates the hardware complexity to the OS.16

**Table 1: Hardware Acceleration Strategies for Windows AI Apps**

| Hardware Target | Execution Provider (EP) | Use Case | Rust Implementation (ort) |
| :---- | :---- | :---- | :---- |
| **NVIDIA GPU** | CUDA / TensorRT | High-performance, plugged-in desktops. Gaming laptops. | ort::strategies::CUDA |
| **Any GPU/NPU** | **DirectML** | **The Default.** Broadest compatibility (Intel, AMD, Qualcomm). | ort::strategies::DirectML |
| **Intel CPU/GPU** | OpenVINO | Optimization for specific Intel fleets (Corporate standard). | ort::strategies::OpenVINO |
| **Snapdragon NPU** | QNN | Specific optimization for Surface Pro X / Copilot+ ARM devices. | ort::strategies::QNN |
| **Generic CPU** | CPU | Fallback for legacy hardware. Quantized models only. | Default fallback. |

17

### **2.3 The Small Language Model (SLM) Revolution**

The viability of local inference relies on the "Small Language Model." Models like Microsoft's **Phi-3** (3.8 billion parameters) or quantized versions of **Llama 3** (8 billion parameters) have changed the calculus of what is possible on the edge.20

These models, particularly when quantized to 4-bit integers (Int4), require approximately 2-4 GB of VRAM/RAM. This fits comfortably within the memory envelope of standard enterprise laptops (16GB RAM), leaving ample room for the operating system and other applications. Benchmarks indicate that Phi-3-mini running on DirectML can achieve token generation speeds sufficient for real-time chat, vastly outperforming CPU-only execution.3

## ---

**3\. The Rust Ecosystem on Windows: Architecture and Interoperability**

Developing for Windows in Rust requires navigating the ecosystem of crates that bridge the gap between Rust's safety guarantees and the raw Windows API.

### **3.1 The windows-rs Projection**

The cornerstone of modern Windows development in Rust is the windows crate (often referred to as windows-rs). Unlike traditional FFI wrappers that require manual binding definitions, windows-rs uses a "language projection" approach. It reads the Windows Metadata (WinMD) files provided by Microsoft and automatically generates Rust code for any API capability.22

This architecture provides several distinct advantages:

* **Completeness:** Developers have access to the entire API surface, from the legacy User32 windowing functions (CreateWindowExW) to the modern Windows.AI.MachineLearning namespaces.23  
* **Safety Encapsulation:** The crate automatically handles the lifecycle of COM (Component Object Model) objects. In C++, a developer must meticulously call AddRef and Release on interfaces, leading to frequent memory leaks. In Rust, windows-rs wraps these interfaces in smart pointers (structs implementing Drop) that automatically release the COM reference when the variable goes out of scope.8  
* **Error Propagation:** Windows APIs typically return HRESULT codes. windows-rs transforms these into Rust Result types, allowing for idiomatic error handling using the ? operator, rather than verbose if (FAILED(hr)) checks.22

### **3.2 Bridging the Unsafe Gap**

Despite these conveniences, the core of Windows programming—especially the Win32 API—remains fundamentally unsafe. Operations such as creating windows, hooking message loops, and handling raw pointers require unsafe blocks.

A critical example is the Global Keyboard Hook (SetWindowsHookEx), essential for "Spotlight-style" launchers that activate via hotkey. Implementing this in Rust requires passing a function pointer to the Windows kernel. If the Rust code panics across this FFI boundary, it leads to undefined behavior. Therefore, successful Rust apps on Windows often consist of a "safe" outer shell wrapping a carefully audited "unsafe" core that interacts with the OS.24

### **3.3 The UI Framework Decision: Native vs. Hybrid**

One of the most consequential decisions for a Windows AI app is the choice of UI framework. There are two primary viable paths, each with distinct trade-offs regarding performance and development velocity.

#### **Path A: The Pragmatic Hybrid (Tauri / WebView2)**

This architecture is the current gold standard for most commercial applications. It uses Rust for the backend (inference, file system, system hooks) and renders the UI using Microsoft Edge WebView2 (HTML/CSS/JS).

* **Mechanism:** The webview2 or tauri crates host a browser control within a native window.  
* **Advantage:** Rapid development of complex UIs (chat bubbles, markdown rendering, code syntax highlighting) using mature web technologies.  
* **Efficiency:** Unlike Electron, which bundles a full Chromium binary (\~150MB), WebView2 uses the shared runtime already present on Windows. This results in an application bundle size of \<10MB and significantly lower RAM usage.10  
* **Rust Integration:** The backend communicates with the frontend via IPC. Heavy compute tasks (like running the LLM) happen in Rust threads, ensuring the UI never freezes.27

#### **Path B: The Pure Native (Win32 / DirectComposition)**

For ultra-lightweight utilities (e.g., a background clipboard analyzer), a pure native approach is viable.

* **Mechanism:** Creating windows directly via CreateWindowExW and drawing using Direct2D or a Rust-native GUI crate like slint or iced.  
* **Advantage:** Unbeatable performance. An app can idle at \<10MB RAM.  
* **Disadvantage:** Implementing modern UI features like accessibility, complex text layout, and high-DPI scaling from scratch is prohibitively expensive for most teams.28

**Note on WinUI 3:** While WinUI 3 is Microsoft's premier native UI framework, its support in Rust is currently experimental. The bindings are unstable, and hosting XAML content ("XAML Islands") in a Rust application is fraught with undocumented complexity. It is generally not recommended for production applications in 2025\.30

## ---

**4\. The Inference Engine: Architecting with ONNX and ort**

The engine room of the AI application is the ONNX Runtime, accessed via the ort crate. This section details the specific implementation strategies required for success.

### **4.1 The ort Architecture**

The ort crate is a Rust wrapper around the Microsoft ONNX Runtime. It is designed to be "inference-first," prioritizing low latency and ease of deployment.

* **Setup:** The crate allows for two linking strategies: dynamic (linking to a system-installed onnxruntime.dll) or static (compiling the runtime into the binary). For commercial distribution, the "download" strategy (which fetches the correct binaries during the build process) or bundling the DLLs is preferred to ensure version compatibility.17  
* **Session Management:** The core object is the Session. Creating a session is expensive (loading the model, allocating memory). Therefore, a successful app initializes the session once (usually wrapped in an Arc\<Session\> or OnceCell) and reuses it for subsequent inference requests across threads.33

### **4.2 Handling DirectML and NPU Configuration**

Configuring the session for DirectML requires specific attention to the SessionOptions.

* **Device Selection:** DirectML allows selecting a specific "adapter" (GPU/NPU). By default, it selects the high-performance GPU. To target the NPU specifically (e.g., on a Copilot+ PC), the developer may need to enumerate adapters using DXGI (DirectX Graphics Infrastructure) and pass the specific adapter ID to the DirectML execution provider options.34  
* **Memory Patterns:** DirectML does not support certain memory pattern optimizations available in the CPU provider. These must be disabled in SessionOptions to avoid runtime errors.34

### **4.3 Quantization and Model Management**

To run LLMs like Llama 3 or Phi-3 locally, the application must manage model quantization.

* **Quantization:** This process reduces the precision of model weights from 32-bit floating point (FP32) to 4-bit integers (Int4). This reduces the model size by roughly 8x with minimal loss in accuracy.  
* **Rust Implementation:** ort supports loading quantized models directly. The application should include a logic layer that checks available system RAM and VRAM.  
  * *Scenario A (16GB+ RAM, Discrete GPU):* Load INT4 or INT8 model to GPU VRAM.  
  * *Scenario B (8GB RAM, Integrated Graphics):* Load highly quantized INT4 model, potentially offloading layers to the CPU if VRAM is insufficient.35

Code Logic Strategy:  
The app should not ship with the model bundled (bloating the download). Instead, it should ship with a "Model Loader" capability. Upon first launch, it analyzes the hardware (sysinfo crate) and downloads the appropriate ONNX model variant (e.g., phi3-mini-4k-instruct-int4-directml.onnx) from a managed repository or Hugging Face.37

## ---

**5\. User Experience Paradigms: The "Zero UI" Revolution**

The trend in AI UX is distinct: "Zero UI" or "Invisible Interfaces." Users do not want to switch context to a separate window to use AI; they want AI to appear *over* their work, assist, and vanish.38

### **5.1 The Command Bar (Spotlight) Pattern**

The dominant form factor is the "Command Bar"—a floating input field invoked by a global hotkey (e.g., Alt+Space), similar to macOS Spotlight or Raycast.

* **Implementation:** This requires creating a purely native Win32 window (or a transparent WebView2 window) that is:  
  1. **Frameless:** WS\_POPUP style, no title bar.  
  2. **Centered:** Manually calculated coordinates based on the current monitor's resolution.  
  3. **Topmost:** WS\_EX\_TOPMOST extended style to ensure it floats above all other applications.39

### **5.2 Global Hotkeys and Input Interception**

To function as an instant utility, the app must listen for inputs globally.

* **Hotkeys:** The global-hotkey crate abstracts the RegisterHotKey Win32 API. This allows the app to wake up from the system tray even when it doesn't have focus.41  
* **Hooks:** For "Copilot-like" capability—where the AI suggests completions as the user types in Word or Notepad—the app must use SetWindowsHookEx with WH\_KEYBOARD\_LL. This hook intercepts all keyboard events.  
  * *Performance Criticality:* The hook callback runs in the critical input path. If the Rust code blocks here (e.g., by running inference directly in the hook), the user's entire system will lag. The pattern is to clone the input event, send it to a background thread via a channel, and return immediately from the hook.25

### **5.3 Visual Integration: Mica and Acrylic**

To feel like a native part of Windows 11, the app must utilize the system's material effects.

* **Mica:** An opaque material that tints the window background with the user's desktop wallpaper color. It signifies a long-lived, primary window.  
  * *Rust Code:* Call DwmSetWindowAttribute with the attribute DWMWA\_SYSTEMBACKDROP\_TYPE set to DWMSBT\_MAINWINDOW.43  
* **Acrylic:** A translucent, blurred material. It signifies a transient, floating surface (like a context menu or command bar).  
  * *Rust Code:* Set DWMWA\_SYSTEMBACKDROP\_TYPE to DWMSBT\_TRANSIENTWINDOW or DWMSBT\_TABBEDWINDOW (Mica Alt).43  
* **Dark Mode:** The app must respect the system theme. This involves listening to UISettings events (ColorValuesChanged) and updating the window frame via DwmSetWindowAttribute with DWMWA\_USE\_IMMERSIVE\_DARK\_MODE.44

## ---

**6\. Data Sovereignty: The Local RAG Architecture**

The ultimate differentiator for a native Windows AI app is privacy. By implementing Retrieval-Augmented Generation (RAG) locally, the app can offer "Contextual Intelligence" without "Data Exfiltration."

### **6.1 The Local Vector Store**

Cloud apps use databases like Pinecone. A local app must use an embedded equivalent.

* **LanceDB:** A modern, high-performance vector database that runs in-process. It has native Rust bindings and stores data in a columnar format on the local disk, making it extremely fast for retrieval.6  
* **Ingestion Pipeline:**  
  1. **File Watcher:** Use the notify crate to watch target directories (Documents, Code Repos).  
  2. **Extraction:** Use Rust libraries (like pdf-extract or ignore for code) to pull text.  
  3. **Chunking:** Split text into manageable tokens.  
  4. **Embedding:** Pass chunks to a small embedding model (e.g., all-MiniLM-L6-v2) running in ort on the CPU/NPU.  
  5. **Indexing:** Store vectors in LanceDB in the user's %APPDATA% directory.6

### **6.2 The Inference Loop**

When a user queries the app:

1. **Embed Query:** The query is embedded using the same local model.  
2. **Vector Search:** LanceDB finds the nearest k neighbors (relevant document chunks).  
3. **Prompt Construction:** A prompt is built: "Answer the question based on this context: \[Chunks\]... Question: \[Query\]".  
4. **Generation:** The prompt is sent to the local SLM (Phi-3) via ort.45

This entire loop happens without a single byte leaving the machine, satisfying the strictest enterprise privacy requirements.

## ---

**7\. Strategic Outlook and Conclusion**

The convergence of the Windows 10 End-of-Support refresh cycle, the proliferation of NPU-equipped Copilot+ PCs, and the maturity of the Rust ecosystem has created a singular moment for application developers. The market is demanding AI tools that are not just powerful, but private, responsive, and integrated.

**Success Factors Summarized:**

1. **Architecture:** Adopt a "Local-First" topology. Use Rust for the high-performance backend (inference, hooks) and WebView2 for the flexible frontend.  
2. **Hardware:** Embrace DirectML to unify the fragmented GPU/NPU landscape. Implement dynamic model loading to adapt to the user's hardware.  
3. **Experience:** Move beyond the window. Build "Zero UI" agents that live in the background, activated by hotkeys, and visually integrated with Mica/Acrylic.  
4. **Privacy:** Market the "Air-Gapped" capability. Local RAG is the killer feature for the enterprise.

For the Rust developer, the tools are ready. The windows crate provides the access, ort provides the intelligence, and the NPU provides the power. The next generation of defining Windows software will not be web apps wrapped in containers; they will be native, sovereign intelligent agents built on this stack.

## ---

**8\. Appendix: Technical Implementation Reference**

### **8.1 Critical Win32 APIs for AI Apps**

| API / Constant | Function | Rust Usage Note |
| :---- | :---- | :---- |
| SetWindowsHookEx | Global Input Hook | Requires unsafe. Must unhook on exit. |
| RegisterHotKey | Global Shortcuts | Use global-hotkey crate for safety. |
| DwmSetWindowAttribute | Window Effects | Use for Mica (38) and Dark Mode (20). |
| WM\_DPICHANGED | Hi-DPI Scaling | Essential handler in WndProc. |
| WM\_NCHITTEST | Snap Layouts | Return HTMAXBUTTON to enable Snap menu. |

### **8.2 Rust Crate Recommendation Stack**

| Domain | Crate | Rationale |
| :---- | :---- | :---- |
| **OS Bindings** | windows | Official Microsoft projection. |
| **Inference** | ort | Best ONNX Runtime wrapper. |
| **UI** | tauri / wry | WebView2 wrapper. Lighter than Electron. |
| **Vector DB** | lancedb | Embedded, fast, Rust-native. |
| **System Info** | sysinfo | Detect NPU/GPU capabilities. |
| **Async** | tokio | Standard async runtime for pipeline. |

#### **Works cited**

1. AI Apps Market Size, Share & Trends | Industry Report, 2030 \- Grand View Research, accessed January 20, 2026, [https://www.grandviewresearch.com/industry-analysis/ai-apps-market-report](https://www.grandviewresearch.com/industry-analysis/ai-apps-market-report)  
2. AI PC Market Surges as Windows 10 Deadline Triggers Global Enterprise Refresh, accessed January 20, 2026, [https://futurumgroup.com/press-release/ai-pc-market-surges-as-windows-10-deadline-triggers-global-enterprise-refresh/](https://futurumgroup.com/press-release/ai-pc-market-surges-as-windows-10-deadline-triggers-global-enterprise-refresh/)  
3. Local-first: AI leaves the cloud and runs on your PC thanks to NPUs \- Fenxi, accessed January 20, 2026, [https://fenxi.fr/en/blog/ia-local-first-npu-slm-2/](https://fenxi.fr/en/blog/ia-local-first-npu-slm-2/)  
4. Copilot vs ChatGPT: Which AI Tool Better Protects a Lawyer's Privacy? \- Spellbook, accessed January 20, 2026, [https://www.spellbook.legal/learn/copilot-vs-chatgpt-privacy](https://www.spellbook.legal/learn/copilot-vs-chatgpt-privacy)  
5. Global AI Adoption in 2025 – AI Economy Institute \- Microsoft, accessed January 20, 2026, [https://www.microsoft.com/en-us/corporate-responsibility/topics/ai-economy-institute/reports/global-ai-adoption-2025/](https://www.microsoft.com/en-us/corporate-responsibility/topics/ai-economy-institute/reports/global-ai-adoption-2025/)  
6. High-performance local RAG server in Rust that integrates with Claude Desktop via MCP. Search PDF documents privately using Ollama embeddings \- no external API calls. \- GitHub, accessed January 20, 2026, [https://github.com/ksaritek/rust-local-rag](https://github.com/ksaritek/rust-local-rag)  
7. Windows-rs & FFI ergonomic issues \- help \- The Rust Programming Language Forum, accessed January 20, 2026, [https://users.rust-lang.org/t/windows-rs-ffi-ergonomic-issues/103404](https://users.rust-lang.org/t/windows-rs-ffi-ergonomic-issues/103404)  
8. Getting Started with Rust \- Kenny Kerr, accessed January 20, 2026, [https://kennykerr.ca/rust-getting-started/](https://kennykerr.ca/rust-getting-started/)  
9. Tauri vs. Electron Benchmark: \~58% Less Memory, \~96% Smaller Bundle – Our Findings and Why We Chose Tauri : r/programming \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/programming/comments/1jwjw7b/tauri\_vs\_electron\_benchmark\_58\_less\_memory\_96/](https://www.reddit.com/r/programming/comments/1jwjw7b/tauri_vs_electron_benchmark_58_less_memory_96/)  
10. Tauri vs. Electron for Tray Apps \- Better Programming, accessed January 20, 2026, [https://betterprogramming.pub/tauri-vs-electron-for-tray-apps-ed15974f35ce](https://betterprogramming.pub/tauri-vs-electron-for-tray-apps-ed15974f35ce)  
11. Phi Silica, small but mighty on-device SLM | Windows Experience Blog, accessed January 20, 2026, [https://blogs.windows.com/windowsexperience/2024/12/06/phi-silica-small-but-mighty-on-device-slm/](https://blogs.windows.com/windowsexperience/2024/12/06/phi-silica-small-but-mighty-on-device-slm/)  
12. Introducing Neural Processor Unit (NPU) support in DirectML (developer preview), accessed January 20, 2026, [https://blogs.windows.com/windowsdeveloper/2024/02/01/introducing-neural-processor-unit-npu-support-in-directml-developer-preview/](https://blogs.windows.com/windowsdeveloper/2024/02/01/introducing-neural-processor-unit-npu-support-in-directml-developer-preview/)  
13. Re:NPU \- Intel Community, accessed January 20, 2026, [https://community.intel.com/t5/Mobile-and-Desktop-Processors/NPU/m-p/1723365](https://community.intel.com/t5/Mobile-and-Desktop-Processors/NPU/m-p/1723365)  
14. Running Small Language Models using NPU with Copilot+ PCs | pkbullock.com, accessed January 20, 2026, [https://pkbullock.com/blog/2025/running-slm-models-using-npu-with-copilot-pc](https://pkbullock.com/blog/2025/running-slm-models-using-npu-with-copilot-pc)  
15. Supported execution providers in Windows ML | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/supported-execution-providers](https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/supported-execution-providers)  
16. Get started with DirectML | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/ai/directml/dml-get-started](https://learn.microsoft.com/en-us/windows/ai/directml/dml-get-started)  
17. ort \- ONNX Runtime Rust bindings \- Crates.io, accessed January 20, 2026, [https://crates.io/crates/ort/1.14.0](https://crates.io/crates/ort/1.14.0)  
18. ONNX Runtime Execution Providers, accessed January 20, 2026, [https://onnxruntime.ai/docs/execution-providers/](https://onnxruntime.ai/docs/execution-providers/)  
19. ort \- Rust bindings for ONNX Runtime \- Crates.io, accessed January 20, 2026, [https://crates.io/crates/ort/1.16.1](https://crates.io/crates/ort/1.16.1)  
20. microsoft/Phi-3-medium-128k-instruct-onnx-directml \- Hugging Face, accessed January 20, 2026, [https://huggingface.co/microsoft/Phi-3-medium-128k-instruct-onnx-directml](https://huggingface.co/microsoft/Phi-3-medium-128k-instruct-onnx-directml)  
21. ONNX Runtime supports Phi-3 mini models across platforms and devices, accessed January 20, 2026, [https://onnxruntime.ai/blogs/accelerating-phi-3](https://onnxruntime.ai/blogs/accelerating-phi-3)  
22. Rust for Windows, and the windows crate | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/dev-environment/rust/rust-for-windows](https://learn.microsoft.com/en-us/windows/dev-environment/rust/rust-for-windows)  
23. microsoft/windows-rs: Rust for Windows \- GitHub, accessed January 20, 2026, [https://github.com/microsoft/windows-rs](https://github.com/microsoft/windows-rs)  
24. How to use SetWindowsHookEx in Rust? \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/51033906/how-to-use-setwindowshookex-in-rust](https://stackoverflow.com/questions/51033906/how-to-use-setwindowshookex-in-rust)  
25. Hook with Winapi \- help \- The Rust Programming Language Forum, accessed January 20, 2026, [https://users.rust-lang.org/t/hook-with-winapi/29936](https://users.rust-lang.org/t/hook-with-winapi/29936)  
26. Tauri vs. Electron: performance, bundle size, and the real trade-offs \- Hopp, accessed January 20, 2026, [https://www.gethopp.app/blog/tauri-vs-electron](https://www.gethopp.app/blog/tauri-vs-electron)  
27. webview2 \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/webview2](https://docs.rs/webview2)  
28. Win32 \- Triangle From Scratch \- GitHub Pages, accessed January 20, 2026, [https://rust-tutorials.github.io/triangle-from-scratch/opening\_a\_window/win32.html](https://rust-tutorials.github.io/triangle-from-scratch/opening_a_window/win32.html)  
29. Pure Rust, No/Minimal Crate Graphics Window \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/1msuuzz/pure\_rust\_nominimal\_crate\_graphics\_window/](https://www.reddit.com/r/rust/comments/1msuuzz/pure_rust_nominimal_crate_graphics_window/)  
30. WinUI 3 with Rust for Windows \- Reddit, accessed January 20, 2026, [https://www.reddit.com/r/rust/comments/13myj7q/winui\_3\_with\_rust\_for\_windows/](https://www.reddit.com/r/rust/comments/13myj7q/winui_3_with_rust_for_windows/)  
31. Proposal: WinUI 3 rust support · Issue \#2488 · microsoft/microsoft-ui-xaml \- GitHub, accessed January 20, 2026, [https://github.com/microsoft/microsoft-ui-xaml/issues/2488](https://github.com/microsoft/microsoft-ui-xaml/issues/2488)  
32. pykeio/ort: Fast ML inference & training for ONNX models in Rust \- GitHub, accessed January 20, 2026, [https://github.com/pykeio/ort](https://github.com/pykeio/ort)  
33. Rust Win32 window, peek message disabling main loop exit \- Stack Overflow, accessed January 20, 2026, [https://stackoverflow.com/questions/75723500/rust-win32-window-peek-message-disabling-main-loop-exit](https://stackoverflow.com/questions/75723500/rust-win32-window-peek-message-disabling-main-loop-exit)  
34. Windows \- DirectML | onnxruntime, accessed January 20, 2026, [https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html](https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html)  
35. Quantize ONNX models | onnxruntime, accessed January 20, 2026, [https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)  
36. Building an End-to-End Chat Bot with ONNX Runtime and Rust | Necati Demir, accessed January 20, 2026, [https://n.demir.io/articles/building-an-end-to-end-chat-bot-with-onnx-runtime-and-rust/](https://n.demir.io/articles/building-an-end-to-end-chat-bot-with-onnx-runtime-and-rust/)  
37. How to run phi3 on NPU via OnnxRuntime+DirectML · Issue \#679 \- GitHub, accessed January 20, 2026, [https://github.com/microsoft/DirectML/issues/679](https://github.com/microsoft/DirectML/issues/679)  
38. Future of Zero UI: How Voice, AI & Sensors Are Replacing Screens \- Algoworks, accessed January 20, 2026, [https://www.algoworks.com/blog/zero-ui-designing-screenless-interfaces-in-2025/](https://www.algoworks.com/blog/zero-ui-designing-screenless-interfaces-in-2025/)  
39. Creating a Spotlight like NSWindow \- YouTube, accessed January 20, 2026, [https://www.youtube.com/watch?v=geJw6q6raXE](https://www.youtube.com/watch?v=geJw6q6raXE)  
40. Rust Game \- Part 2 \- Win32 Window | Jendrik Illner \- 3D Programmer, accessed January 20, 2026, [https://www.jendrikillner.com/post/rust-game-part-2/](https://www.jendrikillner.com/post/rust-game-part-2/)  
41. global\_hotkey \- Rust \- Docs.rs, accessed January 20, 2026, [https://docs.rs/global-hotkey](https://docs.rs/global-hotkey)  
42. SetWindowsHookExA function (winuser.h) \- Win32 apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexa](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexa)  
43. DWM\_SYSTEMBACKDROP\_TY, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm\_systembackdrop\_type](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type)  
44. Support Dark and Light themes in Win32 apps \- Windows apps | Microsoft Learn, accessed January 20, 2026, [https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-windows-themes](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-windows-themes)  
45. Rust Local RAG: The Ultimate Privacy-First AI Tool for Your Local Documents \- Skywork.ai, accessed January 20, 2026, [https://skywork.ai/skypage/en/rust-local-rag-privacy-ai-tool/1978362871884935168](https://skywork.ai/skypage/en/rust-local-rag-privacy-ai-tool/1978362871884935168)  
46. Local RAG with Rust and MCP: Private Document Search for Claude Desktop \- Medium, accessed January 20, 2026, [https://medium.com/@ksaritek/local-rag-with-rust-and-mcp-private-document-search-for-claude-desktop-6fccb37c024e](https://medium.com/@ksaritek/local-rag-with-rust-and-mcp-private-document-search-for-claude-desktop-6fccb37c024e)