# Opta Local DX Refinement & QoL Improvements (2025 SOTA)

Based on research into state-of-the-art AI coding agents like Aider, Claude Code, and OpenCode, here are the most impactful "Quality of Life" (QoL) and Developer Experience (DX) features we should integrate into the Opta ecosystem to polish it to perfection.

## 1. Context & Awareness (The "Knowing" Agent)
Currently, Opta requires the user or the agent to manually explore directories. SOTA agents automate this.
- **Repository Map (Aider Style):** Build a lightweight, compressed map of the entire repository (using `ctags` or Tree-sitter) that is implicitly injected into the system prompt. This allows the agent to see the structure of the project without spending tokens on `list_dir` or `read_file` loops.
- **Semantic Search (LSP Integration):** Instead of just ripgrep, integrate Language Server Protocol (LSP) capabilities so the agent can "Jump to Definition" or "Find References" across files naturally.

## 2. Workflow Integration (Seamless Automation)
- **Auto-Commits with Semantic Intent:** After an agent completes a task (especially in `opta do` mode), it should automatically stage the changes and generate a high-quality, standardized git commit message (e.g., `feat(auth): implement Supabase SSO sync`).
- **File Auto-Discovery:** When a user asks "fix the bug where the login button doesn't work", the agent should autonomously use the Repo Map to find `Login.tsx` rather than asking "what file is that in?".

## 3. Terminal DX & Interactions (The TUI Polish)
- **Shell Tab Completion:** Integrate shell completions for bash/zsh/fish so users can type `opta do --model cl<TAB>` and have it autocomplete to `claude-3-7-sonnet-latest`.
- **System Notifications (Audio/Desktop):** When a long-running autonomous task (e.g., a 10-minute CEO refactor) completes, the daemon should trigger a native OS notification (`node-notifier` or `osascript` on macOS) so the user doesn't have to watch the terminal.
- **Vibe Coding / Natural Language Shell:** Allow the user to pipe command failures directly into Opta. For example, `npm run build | opta fix` to automatically diagnose and repair build errors.

## 4. UI/UX Tweaks for Opta Code (The Universal App)
- **Project Specific "Memory" Files:** Support `.opta.yml` or `.aider.conf.yml` equivalent files in the root of user projects so teams can define "Always use Vitest, never Jest" or "Follow this specific architectural pattern" without typing it every time.
- **Model Fallback Transparency:** If a local LMX model fails and Opta falls back to Claude 3.7 via the cloud, the TUI should visually indicate this "Cloud Fallback" state so the user is aware of where their data is going.

## Immediate Action Items
1. Implement **System Notifications** for long-running autonomous tasks (quick win, high impact).
2. Add **Auto-Commits with Intent** to the `opta do` completion flow.
3. Investigate a lightweight **Repository Map** generator for the context window.