import os

def do_refactor():
    with open("1M-Opta-LMX/src/opta_lmx/api/inference.py", "r") as f:
        lines = f.readlines()

    stream_part1 = lines[58:330]
    validation_part = lines[331:433]
    stream_part2 = lines[721:818]
    
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
        f.write(stream_imports + "".join(stream_part1) + "".join(stream_part2))

    val_imports = """\"\"\"Validation and payload parsing helpers.\"\"\"

from __future__ import annotations

from opta_lmx.inference.schema import ChatCompletionRequest, ChatMessage

"""
    with open("1M-Opta-LMX/src/opta_lmx/api/validation.py", "w") as f:
        f.write(val_imports + "".join(validation_part))

    new_imports = """
from opta_lmx.api.stream_handlers import (
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
    
    # We need to insert `new_imports` somewhere in the top block, e.g., after `from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing`
    # Let's just put it at the very end of lines[0:58]
    top_block = "".join(lines[0:58])
    top_block = top_block.replace(
        "from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing\n",
        "from opta_lmx.inference.tool_parser import wrap_stream_with_tool_parsing\n" + new_imports
    )

    new_inference = top_block + "".join(lines[330:331]) + "".join(lines[433:721]) + "".join(lines[818:])
    
    with open("1M-Opta-LMX/src/opta_lmx/api/inference.py", "w") as f:
        f.write(new_inference)

if __name__ == "__main__":
    do_refactor()
