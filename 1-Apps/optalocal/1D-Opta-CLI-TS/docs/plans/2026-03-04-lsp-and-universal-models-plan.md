# Opta CLI — LSP Optimization & Universal Provider Plan

**Date:** 2026-03-04
**Target:** `1D-Opta-CLI-TS`

## Part 1: Achieving Optimal LSP Integration

Opta CLI currently possesses a "V1" Language Server Protocol implementation (`src/lsp/manager.ts`). It successfully proxies JSON-RPC requests over `stdio` to globally installed language servers and exposes 7 tool schemas to the LLM (`lsp_hover`, `lsp_diagnostics`, etc.).

To achieve parity with industry-leading LSP integrations (like OpenCode) and eliminate code hallucinations, we must upgrade the LSP layer from "reactive" to "proactive".

### Required Implementations:

1. **Automated Server Provisioning (`lsp/installer.ts`)**
   - **Current State:** The CLI crashes or degrades gracefully if `typescript-language-server` or `rust-analyzer` is not in the user's `$PATH`.
   - **Required:** Implement an auto-installer. When Opta detects a `tsconfig.json` or `Cargo.toml`, it should automatically download the correct LSP binary into `~/.opta/lsp-bin/` if it does not exist, entirely abstracting the setup from the user.

2. **OS-Level Workspace Synchronization (`lsp/watcher.ts`)**
   - **Current State:** The LSP shadow-workspace is only updated when the LLM explicitly calls `edit_file` or `write_file`. If the user edits a file in VSCode simultaneously, the LLM's LSP state becomes stale.
   - **Required:** Bind `chokidar` (or native file watching) to the daemon. Stream `textDocument/didChange` JSON-RPC payloads to the LSP server in real-time as the user types.

3. **Proactive Diagnostics Injection**
   - **Current State:** The LLM must waste tokens deciding to call `lsp_diagnostics` to check if its code compiled correctly.
   - **Required:** The daemon must listen for incoming `textDocument/publishDiagnostics` events. If the LLM finishes a task and the LSP server immediately throws a severe syntax error, the daemon should automatically append a hidden "System Warning: Your previous edit caused the following LSP errors..." message before the LLM considers the task complete.

---

## Part 2: Universal Model Architecture (Minimax, Kimi, LiteLLM)

OpenCode's primary marketing advantage is its support for "75+ models." It achieves this via the OpenAI-compatible API standard, allowing users to point the CLI to LiteLLM proxies or directly to providers that mimic OpenAI's spec (like DeepSeek, Minimax, and Moonshot/Kimi).

Opta CLI can neutralize this advantage trivially.

### Implementation Path:

1. **The Custom Provider Schema**
   Update the Zod schema in `src/core/config.ts` to support dynamic providers:
   ```typescript
   customProviders: z.array(z.object({
     id: z.string(),
     protocol: z.enum(['openai-compatible', 'anthropic-compatible']),
     baseURL: z.string().url(),
     apiKeyEnvVar: z.string()
   })).optional()
   ```

2. **Adapter Abstraction (`src/api/custom-openai.ts`)**
   Duplicate the existing `openai.ts` adapter but allow the `baseURL` to be injected from the configuration rather than defaulting to `api.openai.com`.

3. **High-Value Targets Unlocked Immediately:**
   By implementing this single abstraction, Opta natively supports:
   - **Kimi (Moonshot):** `https://api.moonshot.cn/v1`
   - **Minimax:** `https://api.minimax.chat/v1`
   - **DeepSeek:** `https://api.deepseek.com/v1`
   - **LiteLLM Proxies:** `http://localhost:4000/v1` (Unlocking the full 75+ model library)
   - **Local LM Studio / vLLM:** `http://localhost:1234/v1`

**Conclusion:** Implementing the universal provider interface is highly recommended. It is a low-effort, high-reward feature that completely matches OpenCode's model flexibility while maintaining Opta's superior Daemon/LMX execution architecture.
