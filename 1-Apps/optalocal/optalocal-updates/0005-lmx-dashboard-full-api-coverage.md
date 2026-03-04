# LMX Dashboard — Full API Coverage (Audio, RAG, Skills/MCP, Agents, Logs)

**Date:** 2026-03-04T19:10:55+11:00
**Target:** LMX Dashboard
**Update Type:** Feature
**Commit:** 0b7b6355

## Summary

The LMX Dashboard data layer now has 100% coverage of the Opta LMX backend API surface. Six previously unimplemented feature areas — Audio (TTS/STT), RAG/Embeddings, Skills/MCP Registry, Agent Orchestration, and Journal Logs — have been fully wired up as typed TypeScript hooks and mutations. The dashboard can now read from, query, and mutate all 25+ backend endpoints through reactive SWR hooks.

## Detailed Changes

- **`lib/types.ts`:** Added 228 lines of new types covering `SpeechRequest`, `TranscriptionResponse`, `RagIngestRequest/Response`, `RagQueryRequest/Response`, `RagCollectionsResponse`, `EmbeddingResponse`, `Skill`, `SkillListResponse`, `SkillExecuteRequest/Response`, `MCPTool`, `MCPToolsResponse`, `MCPToolCallRequest/Response`, `AgentRun`, `AgentStep`, `AgentRunCreateRequest`, `AgentRunListResponse`, `AgentRunStatus`, `LogFileEntry`.
- **`lib/api.ts`:** Added `lmxAdminFetcher` (alias), `lmxTextFetcher` (plain-text for log files), `lmxFormPost<T>()` (multipart for audio transcription upload).
- **`lib/mutations.ts`:** 10 new mutations — `textToSpeech`, `transcribeAudio`, `ingestDocuments`, `queryRag`, `deleteRagCollection`, `generateEmbedding`, `executeSkill`, `callMcpTool`, `createAgentRun`, `cancelAgentRun`.
- **`hooks/use-audio.ts`:** Audio operation state type definitions.
- **`hooks/use-rag.ts`:** `useRagCollections()` — polls `/v1/rag/collections` every 30s.
- **`hooks/use-skills.ts`:** `useSkills()`, `useSkill(name)`, `useMcpTools()` — 30s polling.
- **`hooks/use-agents.ts`:** `useAgentRuns(status?)`, `useAgentRun(id)` — adaptive 3s/15s polling via `useRef` to avoid stale closure bugs.
- **`hooks/use-logs.ts`:** `useSessionLogs()`, `useUpdateLogs()`, `useSessionLog(file)`, `useUpdateLog(file)`.
- **Menu centering bug fix:** Corrected Holographic HUD prototype layout from `position:absolute; translateX(-50%)` to `width:100%; justify-content:center` for reliable centering.

## Rollout Impact

Seamless / No action required. The new hooks and mutations are additive — no existing hook or mutation was modified. All changes TypeScript-checked (0 errors) and production-built successfully (1288ms). Pages consuming these new hooks will need to be separately wired in future UI work.
