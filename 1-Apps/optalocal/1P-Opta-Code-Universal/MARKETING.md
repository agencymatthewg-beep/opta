# Opta Code — Marketing & Capabilities

**Tagline:** The universal desktop IDE powered by your local daemon.

## 🎯 The Purpose
Opta Code is the flagship visual client for the Opta ecosystem. Built with Tauri and React, it consumes the headless `opta daemon` to provide a beautiful, native desktop window into your local AI interactions. It proves that you don't have to sacrifice a premium GUI just to retain local hardware control.

## ✨ Core Marketing Points (What makes it impressive?)
*   **Daemon-Powered UI:** Unlike other IDE wrappers that bundle their own massive logic layers, Opta Code is a lightweight visualizer of the `v3` daemon protocol. If the app crashes, the daemon keeps working on your task.
*   **Live Runtime Telemetry:** Features a "Neon Node" dashboard that visualizes exactly what the AI is thinking. You can watch sub-agents spawn, track ATPO supervisor interventions, and see live VRAM/Token speeds updated in milliseconds.
*   **Infinite Context Virtualization:** Employs advanced DOM virtualization (`react-virtuoso`) and markdown debouncing to handle massive 128k+ token streams locally without dropping a single frame of UI performance.
*   **Composer Flexibility:** An intelligent inline "pill" design lets you rapidly swap between `Chat`, `Do`, `Plan`, and `Research` modes, or override the LLM provider on a turn-by-turn basis.

## 🛠 Features & Capabilities
*   **Rich Markdown & Code Rendering:** Beautifully styled, syntax-highlighted responses that stream flawlessly.
*   **Permission Quality Gates:** Intercepts "Dangerous" CLI tools before they execute, presenting a clean UI prompt for the user to Allow or Deny the action.
*   **Workspace Sync:** Reads the same `.opta/memory.md` and configuration files as the CLI, ensuring your context is identical whether you use the terminal or the visual app.
*   **Native Platform Feel:** Built on Tauri v2 for an incredibly fast, lightweight installation compared to bloated Electron wrappers.