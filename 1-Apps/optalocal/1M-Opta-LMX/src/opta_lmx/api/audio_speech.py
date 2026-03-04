from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/audio", tags=["audio"])

class SpeechRequest(BaseModel):
    model: str = Field(default="mlx-audio/kokoro-82m", description="The ID of the model to use.")
    input: str = Field(..., max_length=4096, description="The text to generate audio for.")
    voice: str = Field(default="af_heart", description="The voice to use for audio generation.")
    response_format: Literal["mp3", "opus", "aac", "flac", "wav", "pcm"] = Field(default="wav")
    speed: float = Field(default=1.0, ge=0.25, le=4.0)

@router.post(
    "/speech",
    description="Generates audio from the input text.",
)
async def create_speech(request: SpeechRequest) -> StreamingResponse:
    """
    Generate audio using MLX-Audio (Kokoro TTS).
    Matches the OpenAI /v1/audio/speech endpoint signature.
    """
    try:
        # In a real deployed LMX environment, this would cleanly reuse a loaded model
        # from the Opta Model Manager, but for this direct implementation we'll use
        # the mlx_audio module (or subprocess if its API surface changes).
        
        logger.info(f"Starting speech generation with model {request.model}, voice {request.voice}")
        
        import tempfile
        import os
        import subprocess
        import uuid
        
        # Write input to a temp file
        temp_txt_path = os.path.join(tempfile.gettempdir(), f"tts_input_{uuid.uuid4().hex}.txt")
        temp_wav_path = os.path.join(tempfile.gettempdir(), f"tts_output_{uuid.uuid4().hex}.wav")
        
        with open(temp_txt_path, "w", encoding="utf-8") as f:
            f.write(request.input)
            
        # We invoke via subprocess to ensure clean memory release if mlx_audio doesn't provide
        # an async-safe singleton generation function out of the box.
        # This matches the local safety patterns for isolated MLX executions.
        cmd = [
            "python", "-m", "mlx_audio.tts",
            "--model", request.model,
            "--voice", request.voice,
            "--text-file", temp_txt_path,
            "--output", temp_wav_path,
            "--speed", str(request.speed)
        ]
        
        logger.debug(f"Executing TTS: {' '.join(cmd)}")
        
        import asyncio
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"TTS generation failed: {stderr.decode()}")
            raise RuntimeError(f"MLX-Audio failed: {stderr.decode()}")
            
        # Generator to stream the file and then clean up temp files
        def iterfile():
            try:
                with open(temp_wav_path, "rb") as audio:
                    yield from audio
            finally:
                for path in [temp_txt_path, temp_wav_path]:
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                        except OSError:
                            pass
                            
        media_types = {
            "wav": "audio/wav",
            "mp3": "audio/mpeg", 
            "opus": "audio/ogg",
            "flac": "audio/flac",
            "aac": "audio/aac",
            "pcm": "audio/pcm"
        }
        
        return StreamingResponse(
            iterfile(),
            media_type=media_types.get(request.response_format, "audio/wav")
        )

    except Exception as e:
        logger.error("Speech generation failed: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech generation failed: {str(e)}"
        ) from e
