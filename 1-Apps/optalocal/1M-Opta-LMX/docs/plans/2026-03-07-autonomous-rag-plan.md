---
title: Autonomous RAG Implementation Plan
created: 2026-03-07
updated: 2026-03-07
type: implementation-plan
status: active
---

# Autonomous RAG System — Implementation Plan

> "Opta's Memory" — zero-configuration, always-on knowledge retrieval aligned to the new Opta Workspace filesystem.

---

## 1. Existing State (Investigation Summary)

### What Is Already Built

All pipeline components exist and are production-quality:

| Component | File | Status |
|-----------|------|--------|
| Vector store (FAISS + RRF) | `rag/store.py` | Complete |
| BM25 keyword index | `rag/bm25.py` | Complete |
| Text/code/markdown chunkers | `rag/chunker.py` | Complete |
| File processors | `rag/processors.py` | Complete (with gap — see below) |
| Reranker engine | `rag/reranker.py` | Complete, wired |
| MLX embedding engine | `inference/embedding_engine.py` | Complete |
| RAG API (`/v1/rag/*`) | `api/rag.py` | Complete |
| RAG config | `config.py::RAGConfig` | Complete |

The reranker IS already wired into `/v1/rag/query` and `/v1/rag/context` via `body.rerank=True`.
Context assembly across multiple collections is fully implemented.

### Critical Gaps (What's Missing)

1. **No file watcher** — nothing triggers ingest when files change
2. **Frontmatter stripped, not preserved** — `processors.py::process_markdown()` discards YAML frontmatter instead of indexing it as metadata; breaks `ai-read-when` tag filtering
3. **No source tracking** — `Document.metadata` doesn't store file path or hash; can't delete old chunks on file update
4. **No admin watch management API** — no endpoints to register/unregister watched folders
5. **No startup re-index** — stale data after LMX restart
6. **No recency boost** — recently modified files don't rank higher
7. **No default workspace auto-registration** — users must manually register every folder

---

## 2. Target Architecture

```
Opta Workspace filesystem
    ~/Documents/Opta Workspace/
    ~/.opta/
          |
    [watchdog observer]          ← NEW: rag/watcher.py
          | FSEvents / inotify
    WatchRegistry                ← NEW: rag/watch_registry.py
    ~/.opta-lmx/watch-registry.json
          |
    process_file() → chunk → embed
          |
    VectorStore.delete_by_source() + .add()   ← NEW method on store
          |
    FAISS + BM25 + RRF + Reranker
          |
    /v1/rag/query   /v1/rag/context
          |
    CLI / Code Desktop / LMX Dashboard
```

### Collection Naming Convention

| Scope | Collection Name | What Goes In |
|-------|----------------|--------------|
| User identity | `global` | About Me/, My Setup/ from workspace root |
| Project docs | `project-<slug>` | GOAL.md, CLAUDE.md, Plans/, updates/ per project |
| Project code | `code-<slug>` | Source files within a project |
| Hidden config | `opta-config` | ~/.opta/ hooks, learning, memory |

---

## 3. Implementation Phases

### Phase 1: Foundation Fixes (processors.py + store.py)

**File: `rag/processors.py`**
- Parse YAML frontmatter fields (`type`, `project`, `tags`, `summary`, `ai-read-when`, `last-updated`) into `ProcessedDocument.metadata` before stripping from text
- Add `file_path`, `file_modified_at`, `file_hash` (sha256 first 8 chars) to metadata for all processors
- `process_code()`: add `language`, `file_path` to metadata

**File: `rag/store.py`**
- Add `delete_by_source(source: str) -> int` — deletes all documents where `metadata['source'] == source`, returns count
- Add `recency_boost(results, decay_days, weight)` — static method applying `score *= (1 + weight * exp(-age_days / decay_days))`
- `search()` accepts optional `recency_boost_config: dict | None` to apply after RRF

### Phase 2: File Watcher

**New file: `rag/watch_registry.py`**
```python
@dataclass
class WatchEntry:
    path: str
    collection: str
    recursive: bool = True
    patterns: list[str] = field(default_factory=lambda: ["*.md", "*.txt", "*.py", "*.ts", "*.rs"])
    exclude_patterns: list[str] = field(default_factory=lambda: ["node_modules", ".git", "__pycache__", ".next", "dist"])

class WatchRegistry:
    # Persists to ~/.opta-lmx/watch-registry.json
    def add(entry: WatchEntry) -> None
    def remove(path: str) -> bool
    def get_all() -> list[WatchEntry]
    def get(path: str) -> WatchEntry | None
```

**New file: `rag/watcher.py`**
```python
class WorkspaceWatcher:
    # Uses watchdog Observer + FSEventsObserver (macOS)
    # Debounced file events (1 second delay, dedup by path)
    async def start() -> None          # Load registry, watch all folders
    async def stop() -> None           # Graceful shutdown
    async def register(entry) -> None  # Add folder + start watching it
    async def unregister(path) -> None # Stop watching + optionally purge index
    async def reindex_folder(path) -> ReindexResult  # Full re-index

    # Internal
    async def _handle_change(path: str, event_type: str) -> None
    async def _ingest_file(path: str, collection: str) -> None
    async def _delete_file(path: str) -> None
```

File event handling:
- `created` / `modified`: `delete_by_source(path)` → `process_file()` → chunk → embed → `store.add()`
- `deleted`: `delete_by_source(path)` → `store.save()`
- `moved`: `delete_by_source(old_path)` → ingest at `new_path`
- Binary / too-large files (> 10MB): skip with warning log

### Phase 3: Admin Watch API

Add to `api/rag.py` under new admin auth group:

```
POST   /admin/rag/watch              Register folder for watching
DELETE /admin/rag/watch/{encoded_path}  Unregister folder
GET    /admin/rag/watch              List all watched folders + status
POST   /admin/rag/index              Trigger full re-index of folder
GET    /admin/rag/status             Watcher health + global index stats
```

### Phase 4: Recency Boost

Add to `RAGConfig`:
```yaml
recency_boost_enabled: false        # Enable recency scoring
recency_boost_decay_days: 30.0      # Half-life in days
recency_boost_weight: 0.15          # Max boost multiplier (score * 1.15)
```

Applied post-RRF in `store.search()` when `metadata.file_modified_at` is present:
```
boosted_score = score * (1 + weight * exp(-age_days / (decay_days / ln(2))))
```

### Phase 5: Startup Auto-Indexing

In `main.py` startup:
1. Load `WatchRegistry`
2. For each registered folder: compare stored file hashes vs disk
3. Re-ingest changed/new files, delete orphans
4. Start watchdog observer for ongoing watching

This is async and non-blocking — LMX serves requests while indexing in background.

### Phase 6: Default Workspace Auto-Registration

On first start (no watch-registry.json exists), auto-register:
```
~/Documents/Opta Workspace/    → collection: global
~/.opta/                       → collection: opta-config
```

Both with `recursive=True`, standard patterns.

---

## 4. Key Technical Decisions

### Watchdog vs watchfiles
Use `watchdog` — already a common Python dependency, supports FSEventsObserver on macOS (native kernel notifications, not polling), works on Linux/Windows too. Add to `pyproject.toml` optional `[rag]` extras group.

### Debounce Strategy
1-second debounce per file path. Editor saves often trigger multiple events in rapid succession. A `dict[str, asyncio.TimerHandle]` keyed by path, cancelled+replaced on each event.

### Thread Safety
watchdog runs in its own thread. Use `asyncio.run_coroutine_threadsafe(coro, loop)` to schedule file ingestion back on the FastAPI event loop. Store access remains single-threaded.

### File Size Guard
Skip files > 10MB. Skip binary files (non-UTF-8). Log warning but don't crash.

### Incremental Updates
`delete_by_source(path)` before every ingest. Slightly wasteful for unchanged sections but correct. Full re-ingest on any file change is acceptable given typical document sizes in Opta Workspace.

### Collection Auto-Mapping
`WatchEntry` stores explicit `collection`. The admin API accepts it at registration time. The default workspace registration uses the naming convention above.

---

## 5. Files to Create / Modify

| Action | File | What Changes |
|--------|------|-------------|
| MODIFY | `rag/processors.py` | Preserve frontmatter as metadata; add file_path/hash |
| MODIFY | `rag/store.py` | Add `delete_by_source()`, recency boost support |
| MODIFY | `config.py` | Add `recency_boost_*` fields to `RAGConfig` |
| CREATE | `rag/watcher.py` | File watcher daemon |
| CREATE | `rag/watch_registry.py` | Persistent watch folder registry |
| MODIFY | `api/rag.py` | Add admin watch management endpoints |
| MODIFY | `main.py` | Wire watcher lifecycle (startup/shutdown) |
| MODIFY | `pyproject.toml` | Add `watchdog>=3.0.0` to rag extras |

---

## 6. Future Work (Out of Scope for This Implementation)

- **Query expansion** — expand queries via fast LLM model before embedding search
- **Access pattern learning** — boost frequently-queried documents using ledger.jsonl
- **Graph index** — JSON knowledge graph mapping decisions→files, updates→features
- **CLI commands** (`opta index`, `opta search`) in 1D-Opta-CLI-TS
- **Code Desktop integration** — RAG status panel in settings
- **Cross-device indexing** — index files on Mono512 from MacBook trigger

---

## 7. Test Plan

- `tests/test_rag_watcher.py` — unit tests using tmp_path + mock observer
- `tests/test_rag_processors.py` — frontmatter extraction correctness
- `tests/test_rag_store.py` — `delete_by_source()`, recency boost
- `tests/test_admin_rag_watch.py` — API endpoint tests

---

*Plan written: 2026-03-07 | Owner: Matthew Byrden | Status: Active*
