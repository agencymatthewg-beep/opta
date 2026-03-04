"""Implementation delegates for inference API routing."""

from __future__ import annotations

import json
import secrets
import time
from collections.abc import AsyncIterator
from typing import Any, cast

from fastapi.responses import JSONResponse, StreamingResponse
from starlette.requests import Request

from opta_lmx.api.deps import Metrics, Presets, Router
from opta_lmx.api.stream_handlers import (
    _chat_completions_sse_stream_n,
    _responses_sse_stream,
    format_sse_stream,
    format_sse_tool_stream,
    wrap_stream_with_tool_parsing,
)
from opta_lmx.api.validation import (
    _parse_responses_input_messages,
    _parse_responses_max_tokens,
    _resolve_serving_lane_and_priority,
)
from opta_lmx.inference.engine import Engine
from opta_lmx.inference.schema import (
    ChatCompletionRequest,
    ChatMessage,
    LegacyCompletionRequest,
    ModelObject,
    ModelsListResponse,
)
from opta_lmx.monitoring.metrics import RequestMetric
from opta_lmx.presets.manager import PRESET_PREFIX

