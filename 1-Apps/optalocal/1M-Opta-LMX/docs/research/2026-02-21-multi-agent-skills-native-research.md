# Research: Simultaneous Multi-Agent + Skills-Native Architecture

**Date:** 2026-02-21  
**Status:** Complete  
**Scope:** Research-backed implementation guidance for fully concurrent multi-agent orchestration and skills-native execution in Opta-LMX.

---

## Goal

Define an implementation approach that is:

1. Concurrent by design (parallel agent work, bounded resource usage).
2. Skills-native (first-class skill discovery, loading, execution, and governance).
3. Compatible with current Opta-LMX architecture and deployment model.
4. Competitive with modern multi-agent frameworks while keeping LMX-specific control.

---

## Current Opta-LMX Baseline (Code Reality)

Opta-LMX already provides strong primitives we can build on:

- Bounded inference concurrency with adaptive limits and priority bypass (`high` requests can bypass queue):
  - `src/opta_lmx/inference/engine.py:147`
  - `src/opta_lmx/inference/engine.py:172`
  - `src/opta_lmx/inference/engine.py:694`
  - `src/opta_lmx/inference/engine.py:935`
- Model stack diversity (MLX + GGUF + embedding + reranking + helper nodes):
  - `src/opta_lmx/main.py:148`
  - `src/opta_lmx/main.py:199`
  - `src/opta_lmx/main.py:208`
  - `src/opta_lmx/config.py:175`
  - `src/opta_lmx/config.py:208`
- Preset/routing foundation for specialization:
  - `src/opta_lmx/presets/manager.py:35`
  - `src/opta_lmx/config.py:152`

Gap: there is no native agent runtime with orchestration graph semantics or first-class skill registry/executor.

---

## External Research Findings (Primary Sources)

## 1) MCP gives a standards path for skills as tools/resources/prompts

- MCP lifecycle requires explicit initialization, capability negotiation, and version negotiation.
- MCP primitives map directly to skills-native needs:
  - Tools (`tools/list`, `tools/call`)
  - Prompts (`prompts/list`, `prompts/get`)
  - Resources (`resources/list`, `resources/read`, subscriptions)
- MCP roots provide bounded filesystem access model and root-change notifications.
- MCP tool security guidance requires human-in-the-loop controls for sensitive tool use.

Why this matters for LMX:

- We can make skills discoverable and interoperable with MCP-like interfaces without locking into one framework.
- We can enforce root boundaries and capability negotiation as explicit runtime contracts.

## 2) Multi-agent pattern tradeoffs are context- and latency-dependent

LangChain multi-agent docs show clear tradeoffs:

- Router/Subagent patterns are strongest for parallel multi-domain tasks.
- Handoffs are stateful and useful for sequential conversational flows but weak for large parallel fan-out.
- Skills pattern is efficient for progressive disclosure but can increase token load if too much skill context accumulates.

Why this matters for LMX:

- We should support multiple orchestration patterns in one runtime instead of one universal pattern.
- Parallel router/subagent execution should be the default for concurrent worker teams.

## 3) Actor/event-driven model is a good fit for scalable agent orchestration

AutoGen Core emphasizes actor-model agents, asynchronous messaging, and distributed runtime design.

Why this matters for LMX:

- LMX should treat each agent worker as an addressable actor with typed messages and explicit supervision.
- This aligns with existing async architecture and helper-node model.

## 4) Python concurrency primitives support robust in-process orchestration

- `asyncio.TaskGroup` provides fail-fast cancellation semantics for structured concurrency.
- `asyncio.Queue(maxsize=...)` provides built-in backpressure and workload distribution.

Why this matters for LMX:

- We can implement safe fan-out/fan-in and cancellation behavior in-process first, then scale out later.

## 5) Distributed heavy work should use queue workers, not FastAPI background tasks

- FastAPI explicitly recommends heavier distributed/background work using queue tools like Celery.
- Celery provides multi-worker, multi-broker horizontal scaling.

Why this matters for LMX:

- Keep fast orchestration control-plane in LMX API process.
- Move heavy/long-running skill jobs to worker data-plane for multi-server execution.

## 6) Observability should use standard trace propagation

- W3C Trace Context standardizes `traceparent`/`tracestate` propagation across distributed services.

Why this matters for LMX:

- Agent/tool/skill calls need end-to-end correlation IDs across internal and remote execution.

## 7) Skill contracts should be strict and schema-validated

- Pydantic strict mode reduces coercion surprises.
- Pydantic JSON schema generation supports Draft 2020-12 / OpenAPI 3.1 compatibility.

Why this matters for LMX:

- Skill manifests and tool I/O should be validated strictly and exportable for documentation/tooling.

---

## Research-Backed Design Decisions

1. Implement a hybrid orchestration runtime with Router + Subagents + Handoffs + Skills modes.
2. Represent skills as versioned manifests with strict schema validation and permission metadata.
3. Expose skills through MCP-aligned primitives (tool/prompt/resource) and change notifications.
4. Use structured concurrency (`TaskGroup`) and bounded queues for in-process orchestration.
5. Add optional distributed worker plane (Celery + Redis/RabbitMQ) for heavy skill execution.
6. Propagate W3C trace context across all agent and skill boundaries.
7. Keep human approval gates for sensitive/destructive skills.

---

## Source Links

- MCP architecture overview: https://modelcontextprotocol.io/docs/learn/architecture
- MCP lifecycle: https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
- MCP tools: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP prompts: https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
- MCP resources: https://modelcontextprotocol.io/specification/2025-06-18/server/resources
- MCP roots: https://modelcontextprotocol.io/specification/2025-06-18/client/roots
- Python `asyncio` tasks: https://docs.python.org/3/library/asyncio-task.html
- Python `asyncio` queues: https://docs.python.org/3/library/asyncio-queue.html
- FastAPI background tasks caveat: https://fastapi.tiangolo.com/tutorial/background-tasks/
- Celery introduction: https://docs.celeryq.dev/en/stable/getting-started/introduction.html
- LangChain multi-agent overview: https://docs.langchain.com/oss/python/langchain/multi-agent/index
- LangChain handoffs: https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs
- LangChain router: https://docs.langchain.com/oss/python/langchain/multi-agent/router
- LangChain skills: https://docs.langchain.com/oss/python/langchain/multi-agent/skills
- AutoGen core: https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/index.html
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- Pydantic strict mode: https://docs.pydantic.dev/latest/concepts/strict_mode/
- Pydantic JSON schema: https://docs.pydantic.dev/latest/concepts/json_schema/
