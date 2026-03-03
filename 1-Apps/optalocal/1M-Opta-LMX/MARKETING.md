# Opta LMX — Marketing & Capabilities

**Tagline:** Your private AI inference engine, built natively for Apple Silicon.

## 🎯 The Purpose
Opta-LMX is a headless, high-performance API daemon that replaces GUI-heavy tools like LM Studio. Built specifically for M-series Macs using Apple's MLX framework, it serves local LLMs via an OpenAI-compatible API while allowing autonomous bots to manage the entire model lifecycle programmatically.

## ✨ Core Marketing Points (What makes it impressive?)
*   **MLX-Native Speed:** By utilizing Apple's MLX framework directly in Python, Opta-LMX achieves 15-30% faster inference than traditional GGUF/llama.cpp wrappers by leveraging true zero-copy unified memory.
*   **Bot-Autonomous:** Designed without a GUI so that Opta CLI or OpenClaw bots can autonomously query the HuggingFace Hub, download a new model, load it into VRAM, and start generating—all without a human clicking a button.
*   **Smart Routing:** When 6 different bots hit the server simultaneously, LMX queues the requests and intelligently routes them to the best-loaded model, preventing crashes and Out-Of-Memory (OOM) errors.
*   **Zero-Config Drop-in:** Exposes a flawless `/v1/chat/completions` endpoint on port 1234, meaning existing apps configured for LM Studio will work instantly with LMX while gaining a massive speed boost.

## 🛠 Features & Capabilities
*   **Headless Launchd Service:** Starts silently on boot and runs 24/7 in the background.
*   **Admin API:** Full programmatic control to list, load, unload, and download models dynamically.
*   **GGUF Fallback:** If an MLX version of a model isn't available, it automatically falls back to a GGUF backend seamlessly.
*   **Memory Monitoring:** Actively protects your Mac from locking up by evaluating available Unified Memory before authorizing a new model load.