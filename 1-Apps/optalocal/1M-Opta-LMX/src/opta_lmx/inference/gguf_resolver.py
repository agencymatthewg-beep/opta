"""Best-effort resolver for local GGUF equivalents of MLX model IDs."""

from __future__ import annotations

import re
from pathlib import Path


def _name_tokens(model_id: str) -> list[str]:
    model_name = model_id.rsplit("/", 1)[-1]
    parts = [part.lower() for part in re.split(r"[^a-zA-Z0-9]+", model_name) if part]
    return [token for token in parts if token not in {"mlx", "community", "model"}]


def resolve_local_gguf_equivalents(
    model_id: str,
    *,
    search_roots: list[Path] | None = None,
    max_results: int = 20,
) -> list[str]:
    """Resolve local GGUF files that likely correspond to a model identifier."""
    lowered = model_id.lower()
    if lowered.endswith(".gguf"):
        path = Path(model_id).expanduser()
        return [str(path)] if path.exists() else []

    roots = search_roots or [
        Path.home() / ".opta-lmx" / "models",
        Path.home() / ".cache" / "huggingface" / "hub",
    ]
    tokens = _name_tokens(model_id)
    if not tokens:
        return []

    candidates: list[Path] = []
    for root in roots:
        root_path = Path(root).expanduser()
        if not root_path.exists():
            continue
        for gguf_path in root_path.rglob("*.gguf"):
            name = gguf_path.stem.lower()
            # Require at least one strong token match and prefer exact prefix matches.
            if any(token in name for token in tokens):
                candidates.append(gguf_path)

    candidates = sorted(set(candidates), key=lambda path: (len(path.name), str(path)))
    return [str(path) for path in candidates[:max_results]]
