"""Embedding engine — lazy-loads MLX embedding models for /v1/embeddings."""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class EmbeddingEngine:
    """Manages embedding model lifecycle and inference via mlx-embeddings.

    Independent from the main InferenceEngine — separate model, separate
    lifecycle. Lazy-loads on first request or can be pre-loaded via config.
    """

    def __init__(self) -> None:
        self._model: Any = None
        self._tokenizer: Any = None
        self._model_id: str | None = None
        self._loaded_at: float | None = None

    @property
    def is_loaded(self) -> bool:
        """Check if an embedding model is currently loaded."""
        return self._model is not None

    @property
    def model_id(self) -> str | None:
        """Return the currently loaded model ID."""
        return self._model_id

    async def load_model(self, model_id: str) -> None:
        """Load an embedding model from HuggingFace via mlx-embeddings.

        Args:
            model_id: HuggingFace model ID (e.g. 'mlx-community/bge-large-en-v1.5-4bit').
        """
        if self._model_id == model_id and self._model is not None:
            logger.info("embedding_model_already_loaded", extra={"model_id": model_id})
            return

        # Unload previous model if any
        if self._model is not None:
            await self.unload()

        start = time.monotonic()
        try:
            from mlx_embeddings.utils import load

            self._model, self._tokenizer = load(model_id)
            self._model_id = model_id
            self._loaded_at = time.time()

            elapsed = time.monotonic() - start
            logger.info("embedding_model_loaded", extra={
                "model_id": model_id, "duration_sec": round(elapsed, 2),
            })
        except Exception as e:
            logger.error("embedding_model_load_failed", extra={
                "model_id": model_id, "error": str(e),
            })
            raise RuntimeError(f"Failed to load embedding model {model_id}: {e}") from e

    async def unload(self) -> None:
        """Unload the current embedding model."""
        if self._model is not None:
            model_id = self._model_id
            del self._model
            del self._tokenizer
            self._model = None
            self._tokenizer = None
            self._model_id = None
            self._loaded_at = None
            logger.info("embedding_model_unloaded", extra={"model_id": model_id})

    async def embed(
        self,
        texts: list[str],
        model_id: str | None = None,
    ) -> list[list[float]]:
        """Generate embeddings for a list of texts.

        Args:
            texts: Input texts to embed.
            model_id: Optional model to lazy-load if not already loaded.

        Returns:
            List of embedding vectors (one per input text).
        """
        if model_id and (not self.is_loaded or self._model_id != model_id):
            await self.load_model(model_id)

        if not self.is_loaded:
            raise RuntimeError("No embedding model loaded. Set models.embedding_model in config.")

        try:
            from mlx_embeddings.utils import generate

            result = generate(self._model, self._tokenizer, texts)
            # mlx-embeddings >=0.0.5 returns BaseModelOutput; extract embeddings
            if hasattr(result, "text_embeds") and result.text_embeds is not None:
                return result.text_embeds.tolist()  # type: ignore[no-any-return]
            if hasattr(result, "pooler_output") and result.pooler_output is not None:
                return result.pooler_output.tolist()  # type: ignore[no-any-return]
            # Fallback: assume result is already an array (older versions)
            return result.tolist()  # type: ignore[no-any-return]
        except Exception as e:
            logger.error("embedding_failed", extra={"error": str(e), "num_texts": len(texts)})
            raise RuntimeError(f"Embedding generation failed: {e}") from e

    def get_info(self) -> dict[str, Any]:
        """Return info about the loaded embedding model."""
        return {
            "model_id": self._model_id,
            "loaded": self.is_loaded,
            "loaded_at": self._loaded_at,
        }
