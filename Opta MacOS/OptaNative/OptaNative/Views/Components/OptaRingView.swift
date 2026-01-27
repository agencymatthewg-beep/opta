# Task: Revitalize Opta Ring Design (MacOS Native)

**Objective**: Completely redesign the `OptaRingView` in the Opta MacOS Native app to match the high-fidelity "Luminal Glassmorphism" aesthetic defined in the "Gemini Deep Research" documents. This involves moving from basic shapes to a **Metal Shader-based Raymarched Torus** with physically based rendering (Fresnel, refraction, neon glow).

## Phase 1: Planning & Setup [Completed]
- [x] Analyze "Gemini Deep Research" documents for design specs. <!-- id: 0 -->
- [x] Inspect User's "OptaNative" codebase structure. <!-- id: 1 -->
- [x] Create detailed `implementation_plan.md` for SwiftUI + Metal integration. <!-- id: 2 -->
- [x] Define Metal Shader specifications (SDF Torus, P3 Colors). <!-- id: 3 -->

## Phase 2: Metal Shader Implementation [Completed]
- [x] Create `RingShader.metal` in `OptaNative/Shaders`. <!-- id: 4 -->
- [x] Implement `sdfTorus` function in Metal. <!-- id: 5 -->
- [x] Implement Raymarching loop (Camera, Ray direction). <!-- id: 6 -->
- [x] Implement Material Lighting (Schlick Fresnel, Beer's Law Absorption). <!-- id: 7 -->
- [x] Implement "Neon" Glow and Chromatic Aberration. <!-- id: 8 -->

## Phase 3: SwiftUI Integration [Completed]
- [x] Create `MetalRingView.swift` to host the shader. <!-- id: 9 -->
- [x] Wire up `TimelineView` or `CADisplayLink` for smooth time-based animation (uniforms). <!-- id: 10 -->
- [x] Pass app state (Energy Level, Active State) as uniforms to the shader. <!-- id: 11 -->
- [x] Integrate `MetalRingView` into the main `OptaRingView` as the primary renderer (with fallback). <!-- id: 12 -->

## Phase 4: Polish & Verification [Current]
- [ ] Tune Shader constants (Glow intensity, Glass IOR) to match the reference image. <!-- id: 13 -->
- [ ] Verify performance (Frame rate, GPU usage). <!-- id: 14 -->
- [ ] Create `walkthrough.md` with screenshots of the new ring. <!-- id: 15 -->
