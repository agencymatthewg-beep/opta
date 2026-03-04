import re
from pathlib import Path

# Files to modify
BASE_DIR = Path("src/opta_lmx")
INFERENCE_FILE = BASE_DIR / "api/inference.py"
SCHEMA_FILE = BASE_DIR / "inference/schema.py"
VALIDATION_FILE = BASE_DIR / "api/validation.py"
IMPL_FILE = BASE_DIR / "api/inference_impl.py"
STREAM_FILE = BASE_DIR / "api/stream_handlers.py"

def extract_between(content, start_marker, end_marker=None):
    if not end_marker:
        return content.split(start_marker)[1]
    return content.split(start_marker)[1].split(end_marker)[0]

def main():
    content = INFERENCE_FILE.read_text()
    
    # 1. Extract LegacyCompletionRequest
    legacy_req_code = "class LegacyCompletionRequest(BaseModel):\n" + extract_between(content, "class LegacyCompletionRequest(BaseModel):\n", "num_ctx: int | None = Field(None, ge=512, le=131072)\n") + "    num_ctx: int | None = Field(None, ge=512, le=131072)\n"
    
    schema_content = SCHEMA_FILE.read_text()
    if "class LegacyCompletionRequest" not in schema_content:
        SCHEMA_FILE.write_text(schema_content + "\n" + legacy_req_code + "\n")
        
    # 2. Extract _resolve_serving_lane_and_priority
    serving_lane_code = "_SERVING_LANE_TO_PRIORITY: dict[str, str] = {\n" + extract_between(content, "_SERVING_LANE_TO_PRIORITY: dict[str, str] = {\n", "return serving_lane, priority\n") + "    return serving_lane, priority\n"
    
    val_content = VALIDATION_FILE.read_text()
    if "_SERVING_LANE_TO_PRIORITY" not in val_content:
        VALIDATION_FILE.write_text(val_content + "\n" + serving_lane_code + "\n")

    print("Success")

if __name__ == "__main__":
    main()
