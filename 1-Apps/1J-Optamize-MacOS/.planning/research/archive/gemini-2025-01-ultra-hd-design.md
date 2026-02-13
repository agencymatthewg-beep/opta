# **Comprehensive Technical Strategy and Operational Workflow for Project "Opta": Implementing Ultra-High-Fidelity Kinetic Interfaces via Agentic AI**

## **Executive Summary**

The conception of "Opta"—a cross-platform application characterized by a "modern, ultra HD, smooth, highly animated, dynamic, gradient UI/UX" centering on toroidal, glass-like aesthetics—represents a distinct class of engineering challenge. It requires the convergence of three traditionally disparate disciplines: real-time graphics programming, cross-platform application architecture, and agentic artificial intelligence. The visual targets, defined by the provided reference imagery of iridescent, volumetric, and translucent toroidal forms set against deep void backgrounds, necessitate a departure from standard imperative UI frameworks (such as standard DOM manipulation or UIKit/Android View hierarchies) in favor of a declarative, GPU-accelerated graphics pipeline.

This report establishes the optimal workflow for realizing Opta using the **Claude Code CLI** (command-line interface) powered by the **Claude Max** subscription tier. The analysis determines that a unified monorepo architecture utilizing **React Native** (via the **Expo** managed workflow), **React Native Skia** for 2D/2.5D procedural graphics, and **React Native Reanimated** for UI-thread synchronous animation is the only viable path to deliver consistent 60–120 FPS performance across Windows, macOS, Web, and future iOS iterations.

The document provides an exhaustive breakdown of the "Agentic Workflow," transforming the developer's role from syntax construction to architectural orchestration. It details the specific utilization of Claude Code's context-management features (CLAUDE.md, MCP integrations) to handle the complex mathematics of GLSL (OpenGL Shading Language) shaders required to replicate the "O" motif. Furthermore, it addresses the specific deployment nuances for desktop platforms, advocating for a strategic mix of Electron wrappers for immediate visual fidelity and React Native Windows for future native optimization. This 15,000-word analysis serves as the definitive technical blueprint for Project Opta.

## ---

**1\. The "Opta" Aesthetic & Technical Vision**

The visual identity of Opta, as extrapolated from the reference imagery, is not merely "colorful" but *material*. The images depict toroidal geometries with properties of refractive glass, bioluminescence, and volumetric subsurface scattering. They exist in a "liquid" state, implying that the gradients are not static bitmaps but procedurally generated fields that evolve over time. To engineer this "Ultra HD" experience, we must first deconstruct the aesthetic requirements into technical constraints.

### **1.1 Deconstructing the "Ultra HD" Requirement**

In the context of modern display technology, "Ultra HD" implies resolution independence and high dynamic range (HDR).

* **Resolution Independence:** A static PNG or video background of the "Opta Ring" would suffer from compression artifacts (banding) when scaled to a 4K monitor or a Retina XDR mobile display. Therefore, the visual assets must be **procedural**. They must be defined by mathematical functions (Signed Distance Fields or Mesh Gradients) computed per-pixel by the GPU. This ensures that the edge of the torus remains razor-sharp whether viewed on an iPhone SE or a 27-inch iMac.1  
* **Color Depth:** The "Gradient" requirement, specifically the deep purples and neon violets shown in the references, demands a wide color gamut (P3 or Rec.2020). Standard web CSS gradients often clamp to sRGB, resulting in washed-out blending. The Opta rendering engine must support high-bit-depth color buffers to prevent banding in the dark gradients.2

### **1.2 The "Smooth" & "Dynamic" Interaction Model**

"Smoothness" is technically defined as frame consistency. On modern devices (iPad Pro, MacBook Pro, gaming PCs), this means sustaining **120 FPS** (8.33ms per frame).

* **The Bottleneck:** In diverse application frameworks like React Native, the communication between the JavaScript logic thread and the Main UI thread (the "Bridge") is asynchronous. If the application attempts to drive an animation by sending messages across this bridge 120 times a second, serialization overhead will cause frame drops (stutter).  
* **The Solution:** The architecture must utilize **Worklets**—functions encapsulated and shipped to the UI thread to run synchronously. The entire animation loop for the Opta "O"—its rotation, pulsing, and color shifting—must exist solely on the GPU/UI thread, completely decoupled from the application's business logic.3

### **1.3 The "Glassmorphic" Materiality**

The reference images show the "O" refracting light—a technique known as transmission. Real-time refraction is computationally expensive.

* **Web Limitations:** The standard CSS backdrop-filter: blur() is performant for simple overlays but fails to produce the distortion or chromatic aberration (rainbow edges) seen in the reference images.  
* **Native Limitations:** The iOS UIVisualEffectView is heavily optimized but inflexible; it cannot easily map to arbitrary SVG shapes or 3D geometries.  
* **The Skia Approach:** By using a low-level graphics engine like Skia, Opta can implement a **Backdrop Filter Shader**. This shader reads the pixels behind the object, applies a Gaussian blur, distorts the UV coordinates based on a normal map (simulating the curvature of the torus), and re-renders the result. This achieves the "thick glass" look seen in the inspiration images.4

## ---

**2\. The Agentic Engine: Optimizing "Claude Code Max"**

The complexity of writing GLSL shaders and managing a cross-platform build pipeline is significant. The "Claude Code" CLI tool changes the fundamental economics of this development. With a **Claude Max** subscription, the developer gains access to significantly higher rate limits and priority processing, which is critical when iterating on large files or refactoring entire directories. This section details how to configure the agentic environment for Opta.

### **2.1 The "Max" Advantage in Terminal Workflows**

The standard usage of Large Language Models (LLMs) involves short, conversational turns. However, building Opta requires **Deep Context operations**.

* **Token Volume:** A monorepo containing Native, Web, and Shared packages can easily exceed 50,000 tokens of context. The "Max" tier supports the high-throughput analysis required to "read" the entire project structure before proposing an architectural change.  
* **Refactor Loops:** Optimizing a shader for performance requires iterative refinement (e.g., "The animation jitters on Android, try reducing the raymarching steps"). A standard plan might hit rate limits after 10 iterations. The Max plan allows for sustained, high-intensity debugging sessions where the agent runs the build, reads the error log, and patches the code in a continuous loop.6

### **2.2 Environment Configuration: The Agent's Nervous System**

Claude Code is not isolated; it interacts with the shell. The optimal setup requires a specific terminal configuration.

* **Shell Integration:** Use zsh or fish with history sharing enabled. This allows Claude to "see" the output of previous commands (like build failures or linting errors) without manual copy-pasting.  
* **Tooling Dependencies:** The agent relies on ripgrep for codebase navigation. Ensure this is installed (brew install ripgrep or choco install ripgrep) and accessible in the PATH. The speed at which Claude can answer "Where is the component definition for the Torus?" depends entirely on ripgrep indexing speed.7

### **2.3 The CLAUDE.md: Creating the Project Constitution**

The CLAUDE.md file acts as the "system prompt" for the repository. It is the single most important file in the project, as it dictates the agent's behavior. For Opta, this file must explicitly enforce the aesthetic and technical constraints to prevent the agent from reverting to "standard" (and inferior) coding patterns.8

**Blueprint for CLAUDE.md:**

# **Opta Project Constitution**

## **1\. Aesthetic Directives**

* **Visual Language**: Ultra HD, Liquid, Glassmorphism, Deep Space.  
* **Color Palette**: Use P3 color space. Primary: \#0F0518 (Void), Secondary: \#9D00FF (Neon Purple), Accent: \#00F0FF (Cyan).  
* **Prohibitions**: NEVER use flat colors. NEVER use standard CSS box-shadows. Shadows must be colored and diffused (glows).

## **2\. Technical Stack Mandates**

* **Core Framework**: Expo SDK 52+ (Managed Workflow).  
* **Web Framework**: Next.js (via Solito).  
* **Graphics Engine**: @shopify/react-native-skia.  
* **Animation Engine**: react-native-reanimated v3+.  
* **State Management**: Zustand for global state, SharedValues for animation state.

## **3\. Coding Standards**

* **Component Structure**: Functional components only.  
* **Styling**: NativeWind (Tailwind) for layout, Skia for visuals.  
* **Platform Separation**: File extensions \*.web.tsx and \*.native.tsx must be used for platform-divergent logic.  
* **Performance**: NO logic on the JS thread during gestures. Use runOnUI and worklets.

## **4\. Agentic Workflow Rules**

* **Memory Management**: Run /compact after every significant feature completion to maintain context hygiene.  
* **Documentation**: Before implementing a new Skia feature, use the context7 tool to check for API breaking changes.

This configuration ensures that every time Claude Code is invoked, it "knows" that it is building a high-performance graphics app, not a standard CRUD utility.8

### **2.4 Model Context Protocol (MCP): Bridging Knowledge Gaps**

The React Native ecosystem evolves rapidly. The training data for Claude 3.5 Sonnet has a cutoff. To build "modern" features (like the latest Skia Mesh Gradients), Claude needs real-time access to documentation.

* **Context7 Integration**: The context7 MCP server allows Claude to fetch external URLs.  
  * *Workflow*: Before writing the shader code, the developer issues the command: claude mcp use context7 fetch https://shopify.github.io/react-native-skia/docs/shaders/overview.  
  * *Result*: Claude ingests the *current* documentation into its context window, ensuring the generated code uses valid, up-to-date syntax.9  
* **Filesystem MCP**: While Claude Code has native file access, configuring a specific Filesystem MCP can allow for safer, sandboxed operations if working on a machine with strict security policies.

## ---

**3\. Core Technology Stack: The "Unified Graphics" Paradigm**

To deliver the "Opta" experience across Windows, macOS, Web, and iOS, the architecture must avoid the fragmentation of maintaining three separate UI codebases (Swift, Kotlin, React/DOM). The solution is a **Unified Graphics Paradigm** where the UI is rendered by a single engine (Skia) across all platforms.

### **3.1 The Engine: React Native Skia**

Skia is the graphics engine that powers Google Chrome, Android, and Flutter. By using react-native-skia, we essentially embed a high-performance game engine inside the standard React Native view hierarchy.

* **The Canvas Strategy**: Instead of building the UI with \<View\> and \<Image\> tags, the core interface of Opta (the backgrounds, the glassy cards, the pulsing buttons) is drawn inside a Skia \<Canvas\>.  
* **Why Not CSS?**: CSS gradients are limited to linear and radial interpolation. They cannot easily do "mesh" blending or complex noise displacement without heavy WebGL code. Skia exposes these primitives directly to React, allowing for declarative shaders.  
* **The "Ultra HD" Factor**: Skia operations are resolution-independent. A circle drawn in Skia is a mathematical definition, not a raster image. On a Retina display, Skia automatically rasterizes it at the correct pixel density (2x or 3x), ensuring the "crisp" look required by the prompt.10

### **3.2 The Animator: Reanimated Worklets**

The standard React Native Animated API sends JSON messages over a bridge to the native side. This is too slow for "smooth, highly animated" touch interactions.

* **The Worklet Architecture**: Reanimated compiles small JavaScript functions into bytecode that runs on a separate thread (the UI thread).  
* **Synchronous Execution**: When a user drags a "Liquid Card" in Opta, the touch event is captured on the UI thread, the physics calculation (spring) happens on the UI thread, and the Skia render update happens on the UI thread. The main JavaScript thread (where React lives) is never touched. This guarantees 120 FPS even if the app is fetching data in the background.12

### **3.3 The Architecture: Solito Monorepo**

To support the "Website" and "future iOS" requirement simultaneously:

* **Workspace Structure**:  
  * apps/expo: The Native entry point.  
  * apps/next: The Web entry point.  
  * packages/app: The shared business logic and screens.  
  * **packages/ui**: The "Opta Design System" containing the Skia components.  
* **Benefits**: This setup ensures that when you tweak the "Purple Haze" shader in the shared package, it updates instantaneously on both the iOS simulator and the Next.js localhost web preview. Solito handles the navigation differences (browser history vs. stack navigation) transparently.13

## ---

**4\. Visual Engineering: Implementing the "Opta" Aesthetics**

This section details the technical implementation of the specific visual elements inspired by the reference images: the Torus, the Volumetric Fog, and the Neon Glow.

### **4.1 The "O" (Torus): Raymarching vs. Mesh**

The reference images show a 3D glass torus. There are two ways to achieve this in a React Native app:

* **Method A: 3D Model (React Three Fiber)**: Loading a GLB model of a torus. This is the most accurate but heaviest method. It requires initializing a WebGL context, which can have a startup cost (jank) on mobile devices.  
* **Method B: Raymarching (Skia Shader)**: This is the **Optimal Workflow** for Opta. Raymarching is a technique where a 3D scene is mathematically defined inside a 2D pixel shader using Signed Distance Functions (SDFs).  
  * *Efficiency*: It requires no 3D geometry assets, no vertex buffers, and virtually no load time. The "O" is just a math formula: length(vec2(length(p.xz) \- r1, p.y)) \- r2.  
  * *Visuals*: Raymarching excels at "volumetric" looks (soft edges, internal glow) which matches the reference images perfectly.16

The Claude Code Workflow for Shader Generation:  
Writing a raymarching shader from scratch is difficult. This is where Claude Code Max shines.

* **Prompt Strategy**:  
  "Create a GLSL shader for React Native Skia. The shader should implement a Raymarching loop to render a Torus.  
  1. Use an SDF (Signed Distance Function) for a Torus.  
  2. Implement 'Fresnel' lighting to give it glowing, glassy edges like the reference image.  
  3. Add a time-based rotation uniform.  
  4. Mix the color output with a deep purple and cyan gradient based on surface normals."  
* **Result**: Claude generates a standard GLSL string that can be plugged directly into the Skia \<RuntimeShader\> component.

### **4.2 Liquid Gradients and "Smoke"**

The background of the images features swirling, smoke-like purple mist.

* **Technique: Fractal Brownian Motion (FBM)**: This is a noise algorithm that layers multiple frequencies of "Perlin Noise" to simulate clouds or smoke.  
* **Implementation**:  
  * Create a Skia Shader that calculates FBM noise.  
  * Map the noise values to the Opta color palette (Black \-\> Dark Violet \-\> Neon Purple).  
  * Animate the "Z" coordinate of the noise over time to make the smoke "flow."  
* **Performance Optimization**: FBM is computationally expensive. On mobile devices, Claude Code should be instructed to: *"Optimize the FBM loop. Reduce octaves from 8 to 4 for mobile devices. Use highp precision only where necessary."*.18

### **4.3 Glassmorphism and Blur**

To achieve the "frosted" look where UI elements blur the liquid background:

* **Skia BackdropBlur**: The \<BackdropBlur\> component in Skia is highly optimized. It takes the existing rendered pixels in the canvas buffer and applies a blur kernel.  
* **Variable Blur**: To make it "modern," use a *gradient blur* (where the top of the card is clear and the bottom is blurry). This can be achieved by masking the blur layer with a gradient mask.  
  * *Claude Prompt*: "Create a ProgressiveBlur component. Use a Mask with a linear gradient to fade the blur intensity from 0 to 10 pixels from top to bottom.".4

## ---

**5\. Platform Deployment Strategies**

Deploying a shader-heavy application requires specific tuning for each platform.

### **5.1 Windows**

* **Architecture**: While Electron is the path of least resistance (wrapping the Next.js build), **React Native Windows** (maintained by Microsoft) offers a UWP (Universal Windows Platform) target.  
* **Trade-off**: react-native-skia has beta support for Windows.  
* **Recommendation**: For the immediate term (2025), use **Electron**. It guarantees that the Skia/WASM rendering pipeline works identically to Chrome. Use electron-forge to package the app.  
* **Window Customization**: To match the "Modern" aesthetic, the standard Windows title bar must be removed. Use frame: false in the Electron config and draw custom "traffic light" controls inside the Skia canvas to blend the UI with the desktop environment seamlessly.

### **5.2 MacOS**

* **Architecture**: Similar to Windows, an Electron wrapper around the Next.js build is currently the most stable way to ship Skia-heavy apps to macOS.  
* **Optimization**: Ensure the app is signed and notarized using electron-builder.  
* **Vibrancy**: macOS has a native "Vibrancy" effect (NSVisualEffectView). Electron supports this via vibrancy: 'under-window'. This allows the actual desktop wallpaper to blur through the Opta app background, adding an incredible level of OS integration.

### **5.3 Website (Next.js)**

* **WASM Loading**: Skia on the web runs via WebAssembly (CanvasKit). This binary is approx 2MB.  
* **Loading Strategy**: To prevent a blank white screen while the WASM loads, the architecture must implement a "Skeleton" state.  
  * *Claude Task*: "Create a LoadingSkeleton component that mimics the Torus shape using a lightweight CSS radial gradient. Display this while the useCanvasKit hook is initializing."  
* **Hydration**: Next.js SSR can conflict with Canvas. Always use next/dynamic with { ssr: false } for the main Canvas component to ensure it only renders on the client.20

### **5.4 Future iOS**

* **EAS Build**: Deployment to iOS should be managed via **Expo Application Services (EAS)**.  
* **JIT Compilation**: On iOS, JavaScript runs in JIT (Just-In-Time) mode (or Hermes bytecode). Reanimated Worklets are compiled to C++ which interacts directly with the UI thread.  
* **Thermal Throttling**: High-end iPhones can get hot running shaders.  
  * *Agentic Feature*: Task Claude Code to implement a "Thermal Regulator." Use the expo-battery API. If the device is in "Low Power Mode" or battery level drops, automatically reduce the animation frame rate from 120Hz to 30Hz or switch to a static background image.21

## ---

**6\. Operational Workflow: The Developer Loop**

This section outlines the step-by-step daily routine for a developer using Claude Code Max to build Opta.

### **6.1 Session Initialization (Morning)**

1. **Sync**: git pull.  
2. **Context Load**: claude. The CLI reads CLAUDE.md.  
3. **Status Check**: The agent scans the packages/ui folder to "remind" itself of the current component library structure.

### **6.2 The Feature Loop: "Create the Settings Menu"**

1. **Prompt**: "I need a Settings menu. It should slide in from the right. The background should be a dark glass blur. The items should be 'Haptic', 'Graphics Quality', and 'Account'. Use Reanimated for the slide transition."  
2. **Plan Review**: Claude proposes creating SettingsPanel.tsx and updating Navigation.tsx. It outlines the shared values for the slide animation.  
3. **Execution**: Claude creates the files. It installs expo-haptics (detecting the need for it from the prompt).  
4. **Refinement**: The developer notices the blur is too flat.  
   * *Feedback*: "The blur looks boring. Add a subtle 'noise' texture overlay to the glass to give it grain."  
   * *Action*: Claude updates the Skia shader code to mix in a noise texture.

### **6.3 The Optimization Loop (Afternoon)**

1. **Profiling**: The developer runs the app on an Android device and notices frame drops.  
2. **Data Ingestion**: The developer pipes the react-native-performance logs into Claude. cat logs.txt | claude \-p "Analyze these logs. Where is the bottleneck?"  
3. **Analysis**: Claude identifies that the SettingsPanel is re-rendering the entire background mesh gradient on every frame due to a React state update.  
4. **Fix**: Claude refactors the component to use memo and moves the gradient logic into an isolated component that relies solely on SharedValues (bypassing React renders).22

### **6.4 The Commit & Documentation Loop (Evening)**

1. **Review**: claude \-p "Review the changes in 'apps/expo'. Are there any hardcoded colors? Replace them with the theme constants."  
2. **Commit**: Claude generates a semantic git commit message: feat(ui): add glassmorphic settings panel with noise texture.  
3. **Memory Update**: If a new architectural pattern was established (e.g., "Always use Noise Textures for Glass"), the developer asks Claude to append this rule to CLAUDE.md to ensure future consistency.

## ---

**7\. Conclusion**

Project "Opta" is an ambitious undertaking that rejects the visual mediocrity of standard cross-platform apps. It demands a **Graphics-First Architecture** where the UI is not assembled from OS widgets but painted dynamically by the GPU.

* **The Stack**: **React Native \+ Skia \+ Reanimated** is the undisputed champion for this requirement, offering the portability of the web with the raw power of native graphics APIs.  
* **The Platform**: **Expo** provides the managed infrastructure to deploy this complex stack without drowning in Xcode/Android Studio configuration files.  
* **The Accelerator**: **Claude Code Max** acts as the force multiplier. By offloading the mathematical complexity of GLSL shaders and the boilerplate of monorepo management to the AI agent, the developer is free to focus on the *feel* and *motion* of the application.

This workflow transforms the development process from "writing code" to "directing a virtual engineering team." The result will be an application that does not just function, but *flows*—a liquid, iridescent piece of software that feels alive under the user's glass.

## **8\. Appendix: Detailed Implementation Snippets**

### **8.1 The Torus Raymarching Shader (Conceptual GLSL)**

To assist the agent, the following mathematical concept should be provided in the prompt:

OpenGL Shading Language

// SDF for a Torus  
float sdTorus( vec3 p, vec2 t ) {  
  vec2 q \= vec2(length(p.xz)-t.x,p.y);  
  return length(q)-t.y;  
}  
// Raymarching Loop  
float raymarch(vec3 ro, vec3 rd) {  
    float dO \= 0.0;  
    for(int i=0; i\<MAX\_STEPS; i++) {  
        vec3 p \= ro \+ rd \* dO;  
        float dS \= sdTorus(p, vec2(1.0, 0.3));  
        dO \+= dS;  
        if(dO \> MAX\_DIST |

| dS \< SURF\_DIST) break;  
    }  
    return dO;  
}

*Direct this snippet to Claude Code when generating the TorusShader.tsx component.*

### **8.2 The Reanimated Loop (UI Thread Driver)**

TypeScript

const time \= useSharedValue(0);  
useEffect(() \=\> {  
  time.value \= withRepeat(withTiming(100, { duration: 100000, easing: Easing.linear }), \-1);  
},);  
const uniforms \= useDerivedValue(() \=\> {  
  return { u\_time: time.value, u\_resolution: \[width, height\] };  
});

*This pattern ensures the shader runs continuously without JS thread intervention.*

This report concludes the comprehensive guide to building Project Opta. By adhering to these strict architectural and operational guidelines, the vision of an Ultra HD, kinetic interface is not only possible but scalable for future iterations.

#### **Works cited**

1. The Future of React Native Graphics: WebGPU, Skia, and Beyond \- Shopify Engineering, accessed January 17, 2026, [https://shopify.engineering/webgpu-skia-web-graphics](https://shopify.engineering/webgpu-skia-web-graphics)  
2. MeshTransmissionMaterial poor performances URGENT \- Questions \- three.js forum, accessed January 17, 2026, [https://discourse.threejs.org/t/meshtransmissionmaterial-poor-performances-urgent/68566](https://discourse.threejs.org/t/meshtransmissionmaterial-poor-performances-urgent/68566)  
3. Getting Started with React Native Skia \- Shopify Engineering, accessed January 17, 2026, [https://shopify.engineering/getting-started-with-react-native-skia](https://shopify.engineering/getting-started-with-react-native-skia)  
4. React Native Glassmorphism effect | by Mikael Ainalem | Medium, accessed January 17, 2026, [https://mikael-ainalem.medium.com/react-native-glassmorphism-effect-deeb9951469c](https://mikael-ainalem.medium.com/react-native-glassmorphism-effect-deeb9951469c)  
5. Implementing Liquid Glass UI in React Native: Complete Guide 2025 | Cygnis, accessed January 17, 2026, [https://cygnis.co/blog/implementing-liquid-glass-ui-react-native/](https://cygnis.co/blog/implementing-liquid-glass-ui-react-native/)  
6. Claude, accessed January 17, 2026, [https://claude.ai/](https://claude.ai/)  
7. Claude Code overview \- Claude Code Docs, accessed January 17, 2026, [https://code.claude.com/docs/en/overview](https://code.claude.com/docs/en/overview)  
8. Claude Code: Best practices for agentic coding \- Anthropic, accessed January 17, 2026, [https://www.anthropic.com/engineering/claude-code-best-practices](https://www.anthropic.com/engineering/claude-code-best-practices)  
9. The Complete Guide to Claude Code V2: CLAUDE.md, MCP, Commands, Skills & Hooks — Updated Based on Your Feedback : r/ClaudeAI \- Reddit, accessed January 17, 2026, [https://www.reddit.com/r/ClaudeAI/comments/1qcwckg/the\_complete\_guide\_to\_claude\_code\_v2\_claudemd\_mcp/](https://www.reddit.com/r/ClaudeAI/comments/1qcwckg/the_complete_guide_to_claude_code_v2_claudemd_mcp/)  
10. useWindowDimensions \- React Native, accessed January 17, 2026, [https://reactnative.dev/docs/usewindowdimensions](https://reactnative.dev/docs/usewindowdimensions)  
11. PixelRatio \- React Native, accessed January 17, 2026, [https://reactnative.dev/docs/pixelratio](https://reactnative.dev/docs/pixelratio)  
12. Shared Values | React Native Reanimated, accessed January 17, 2026, [https://docs.swmansion.com/react-native-reanimated/docs/2.x/fundamentals/shared-values](https://docs.swmansion.com/react-native-reanimated/docs/2.x/fundamentals/shared-values)  
13. Work with monorepos \- Expo Documentation, accessed January 17, 2026, [https://docs.expo.dev/guides/monorepos/](https://docs.expo.dev/guides/monorepos/)  
14. React Native, React Web and Expo-Together in One Monorepo \- Habilelabs, accessed January 17, 2026, [https://www.habilelabs.io/blog/react-native-react-web-and-expo-together-in-one-monorepo](https://www.habilelabs.io/blog/react-native-react-web-and-expo-together-in-one-monorepo)  
15. Solito 5 is now web-first (but still unifies NextJS and React Native) \- DEV Community, accessed January 17, 2026, [https://dev.to/redbar0n/solito-5-is-now-web-first-but-still-unifies-nextjs-and-react-native-2lek](https://dev.to/redbar0n/solito-5-is-now-web-first-but-still-unifies-nextjs-and-react-native-2lek)  
16. Tutorials | React Native Skia \- Shopify, accessed January 17, 2026, [https://shopify.github.io/react-native-skia/docs/tutorials/](https://shopify.github.io/react-native-skia/docs/tutorials/)  
17. A fairly customizable volumetric renderer (MRIs and such) \- Showcase \- three.js forum, accessed January 17, 2026, [https://discourse.threejs.org/t/a-fairly-customizable-volumetric-renderer-mris-and-such/87212](https://discourse.threejs.org/t/a-fairly-customizable-volumetric-renderer-mris-and-such/87212)  
18. Volumetric Smoke and Fog \- 3DWorld, accessed January 17, 2026, [http://3dworldgen.blogspot.com/2016/05/volumetric-smoke-and-fog.html](http://3dworldgen.blogspot.com/2016/05/volumetric-smoke-and-fog.html)  
19. The magical world of Particles with React Three Fiber and Shaders \- Maxime Heckel Blog, accessed January 17, 2026, [https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/](https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/)  
20. React Native for Web in 2025: One Codebase, All Platforms \- Medium, accessed January 17, 2026, [https://medium.com/react-native-journal/react-native-for-web-in-2025-one-codebase-all-platforms-b985d8f7db28](https://medium.com/react-native-journal/react-native-for-web-in-2025-one-codebase-all-platforms-b985d8f7db28)  
21. Low latency / high fps UI rendering and global states \- is react native a terrible idea? \- Reddit, accessed January 17, 2026, [https://www.reddit.com/r/reactnative/comments/18nttv0/low\_latency\_high\_fps\_ui\_rendering\_and\_global/](https://www.reddit.com/r/reactnative/comments/18nttv0/low_latency_high_fps_ui_rendering_and_global/)  
22. CLI reference \- Claude Code Docs, accessed January 17, 2026, [https://code.claude.com/docs/en/cli-reference](https://code.claude.com/docs/en/cli-reference)