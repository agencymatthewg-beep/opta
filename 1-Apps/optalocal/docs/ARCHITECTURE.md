---
title: Architecture
type: workspace-docs
status: active
last_updated: 2026-03-04
---

# OptaLocal Architecture

## Topology Overview

OptaLocal has two layers:

1. **Runtime/control plane**

- `1D-Opta-CLI-TS` (CLI + daemon contract authority)
- `1M-Opta-LMX` (inference runtime)
- `1P-Opta-Code-Universal` (desktop/web daemon client)
- `1O-Opta-Init` (distribution + lifecycle manager)
- `1L-Opta-LMX-Dashboard` (LMX operational dashboard)

1. **Web surfaces**

- `1T` Home, `1U` Help, `1V` Learn, `1R` Accounts, `1S` Status, `1X` Admin

## Core Runtime Data Flows

### Flow A: Coding session

1. User runs `opta chat` or uses Opta Code.
2. Client talks to daemon (`1D`) over `/v3/*` HTTP + websocket events.
3. Daemon resolves LMX endpoint and forwards inference operations to `1M`.
4. `1M` serves model output via OpenAI-compatible APIs.

### Flow B: LMX operations

1. Operators use LMX Dashboard (`1L`) and/or CLI model commands.
2. Both call LMX APIs (`/v1/*`, `/admin/*`, discovery endpoints).

### Flow C: Distribution

1. Users land on `init.optalocal.com` (`1O` web).
2. Opta Init Manager handles lifecycle of local stack components.

### Flow D: Voice Dictation

1. User taps the mic button in `1P-Opta-Code-Universal` (`Composer.tsx`).
2. Browser MediaStream API captures audio; `useAudioRecorder` hook encodes to base64 WebM.
3. Payload dispatched to daemon (`1D`) via `POST /v3/operations/audio.transcribe`.
4. Daemon routes to LMX (`POST /v1/audio/transcriptions` via `mlx-whisper`) or OpenAI Whisper-1 depending on configured provider.
5. Transcribed text is appended to the composer input automatically.

## Contract Boundaries

- `1D` is contract authority for daemon protocol and operations.
- `1P` consumes daemon APIs; it does not reimplement orchestration.
- `1M` owns inference/runtime semantics and discovery contract.
- `1L` is a dashboard client of `1M`, not a runtime itself.

## Discovery and Connectivity

LMX discovery contract is exposed by `1M`:

- `/.well-known/opta-lmx`
- `/v1/discovery`

Clients use these with health/model probes for resilient connection behavior.

## Source Files for Deep Detail

- Workspace map: `README.md`
- Runtime coupling audit: `docs/audit/2026-03-system-map.md`
- Product taxonomy: `docs/PRODUCT-MODEL.md`

## Cross-App Coordination

The `todo-optalocal/` directory is the cross-agent coordination hub. When an agent working in one app identifies ripple-effect updates needed in other apps, it drops a structured markdown document here (named `{TargetApp}-{reason}-{timestamp}.md`) rather than context-switching into unfamiliar codebases. Agents native to the target app pick up and implement the work with full local context. See `todo-optalocal/README.md` for the full protocol.
