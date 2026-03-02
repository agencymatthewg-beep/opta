import os

def extract_and_refactor():
    input_file = "1M-Opta-LMX/src/opta_lmx/api/inference.py"
    with open(input_file, "r") as f:
        lines = f.readlines()

    stream_blocks = []
    validation_blocks = []
    inference_out = []

    stream_names = [
        "@dataclass\nclass _StreamEndMarker",
        "class _StreamEndMarker",
        "async def _counting_stream",
        "async def _chat_completions_sse_stream_n",
        "async def _legacy_completions_sse_stream",
        "async def _responses_sse_stream"
    ]
    val_names = [
        "def _chat_stream_include_logprobs_placeholder",
        "def _parse_responses_max_tokens",
        "def _normalize_responses_content_parts",
        "def _parse_responses_input_messages"
    ]

    current_target = inference_out
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check start of block
        if line.startswith("async def ") or line.startswith("def ") or line.startswith("class ") or line.startswith("@dataclass"):
            # Which block does it belong to?
            is_stream = any(line.startswith(n) for n in stream_names)
            if line.startswith("@dataclass") and i+1 < len(lines) and "class _StreamEndMarker" in lines[i+1]:
                is_stream = True
                
            is_val = any(line.startswith(n) for n in val_names)
            
            if is_stream:
                current_target = stream_blocks
            elif is_val:
                current_target = validation_blocks
            else:
                current_target = inference_out
                
        current_target.append(line)
        i += 1

    # Write stream_handlers.py
    stream_imports = """\"\"\"Streaming handlers for inference endpoints.\"\"\"

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from opta_lmx.api.deps import Engine
from opta_lmx.inference.schema import ChatCompletionRequest, ChatMessage
from opta_lmx.inference.streaming import format_sse_stream, format_sse_tool_stream
from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing
from opta_lmx.monitoring.metrics import MetricsCollector, RequestMetric

logger = logging.getLogger(__name__)

"""
    with open("1M-Opta-LMX/src/opta_lmx/api/stream_handlers.py", "w") as f:
        f.write(stream_imports + "".join(stream_blocks))

    # Write validation.py
    val_imports = """\"\"\"Validation and payload parsing helpers.\"\"\"

from __future__ import annotations

from opta_lmx.inference.schema import ChatCompletionRequest, ChatMessage

"""
    with open("1M-Opta-LMX/src/opta_lmx/api/validation.py", "w") as f:
        f.write(val_imports + "".join(validation_blocks))

    # Update inference.py
    # Add the imports for the moved functions right after the original schema imports
    new_inference_text = "".join(inference_out)
    
    import_hook = "from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing"
    new_imports = """from opta_lmx.api.stream_handlers import (
    _StreamEndMarker,
    _counting_stream,
    _chat_completions_sse_stream_n,
    _legacy_completions_sse_stream,
    _responses_sse_stream,
)
from opta_lmx.api.validation import (
    _chat_stream_include_logprobs_placeholder,
    _parse_responses_max_tokens,
    _normalize_responses_content_parts,
    _parse_responses_input_messages,
)
"""
    new_inference_text = new_inference_text.replace(import_hook, import_hook + "\n" + new_imports)
    
    with open("1M-Opta-LMX/src/opta_lmx/api/inference.py", "w") as f:
        f.write(new_inference_text)

if __name__ == "__main__":
    extract_and_refactor()
