# Opta CLI — Marketing & Capabilities

**Tagline:** Local-first agentic AI coding assistant — your dedicated Apple Silicon host, your control.

## 🎯 The Purpose
Opta CLI is a Node.js-based command-line interface that brings Claude Code-level autonomy to your own private hardware. It acts as the intelligent driver connecting your terminal to Opta-LMX, allowing AI to read files, edit code, and run bash commands autonomously—without ever needing to send your codebase to a cloud API.

## ✨ Core Marketing Points (What makes it impressive?)
*   **True Local Autonomy:** It is not just a chat wrapper. It is a full tool-using agent that executes actual bash commands, modifies the filesystem, and runs tests completely locally.
*   **60+ Minute Uninterrupted Workloads:** Designed for deep, long-running execution. Unlike cloud services that timeout or fail after 5 minutes, Opta CLI can be set to work for over an hour autonomously, hunting down bugs, refactoring entire systems, and running test suites until the job is done.
*   **CEO Mode (L5 Autonomy):** Engage "CEO Mode" to completely remove the safety rails. You give the objective, and the agent takes over your terminal with absolute permission to read, write, commit, and execute without ever prompting you for approval.
*   **Sub-Agent Swarms:** Instead of forcing one model to do everything, it spawns specialized background sub-agents (e.g., a "research" agent to scour documentation) and coordinates their findings.
*   **The ATPO Supervisor:** Features an autonomous background supervisor that actively monitors the main agent's logs, detects infinite loops or hallucinations, and silently intervenes to course-correct the agent in real-time.
*   **No API Keys Required:** Native integration with Opta-LMX means you can run 72B parameter models natively on your Apple Silicon entirely for free.
*   **Browser & MCP Ready:** Built-in headless Playwright automation allows the agent to visually inspect web pages, while seamless MCP integration connects it instantly to your local ecosystem tools.

## 🛠 Features & Capabilities
*   **Agentic Execution:** Chat (`opta chat`) or Task-based (`opta do "fix this bug"`) operations.
*   **Git Checkpoints:** Automatically snapshots your code before the AI makes dangerous edits, allowing instant rollbacks.
*   **Per-Turn Overrides:** Instantly switch models or elevate autonomy to "Level 4 (Dangerous Mode)" for a single prompt without breaking global configs.
*   **Cloud Fallback:** If your local dedicated Apple Silicon host goes offline, it gracefully falls back to Anthropic/OpenAI APIs.
*   **Extensive Tooling:** Includes `read_file`, `write_file`, `edit_file`, `run_command`, `web_search`, and `ask_user`.