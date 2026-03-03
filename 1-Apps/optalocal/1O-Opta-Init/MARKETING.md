# Opta Init — Marketing & Capabilities

**Tagline:** Your local AI stack, managed in one native control surface.

## 🎯 The Purpose
Opta Init (the Opta Initializer) is the single front door to the Opta ecosystem. It acts as your local stack initializer, package updater, and background daemon supervisor. Instead of downloading random binaries from GitHub, you run one bootstrap command, and Opta Init orchestrates the installation and lifecycle of your entire native AI stack.

## ✨ Core Marketing Points (What makes it impressive?)
*   **One Command, Full Stack:** Running `curl -fsSL https://init.optalocal.com/init | bash` is all it takes to initialize your Mac with the app manager, auto-discover your hardware, and spin up the background services.
*   **Manifest-Driven Updates:** Say goodbye to broken dependencies. Opta Init uses cryptographically signed release manifests to safely roll out updates across the CLI, UI, and inference engine simultaneously.
*   **Daemon Supervisor Drawer:** Features a sleek, physics-driven "Glass Drawer" UI that slides out over your desktop to let you monitor, kill, or restart background inference processes (like an NPM server or an LLM download) out-of-band from any code editor.
*   **Apple Silicon Native:** Built as a blazingly fast Rust/Tauri desktop application specifically optimized for M1/M2/M3/M4 hardware.

## 🛠 Features & Capabilities
*   **Central App Manager:** The only user-visible download target needed to install or launch Opta Code, Opta CLI, and Opta LMX.
*   **Daemon Operations Console:** Real-time visibility into the health of your local inference daemon, with 1-click restart and recovery hooks.
*   **Stable & Beta Channels:** Safely opt-in to bleeding-edge features or stay on the stable track, controlled from one trusted plane.
*   **Zero-Server Static Architecture:** The init website is served globally via edge CDNs with zero backend logic, guaranteeing instant, secure availability.