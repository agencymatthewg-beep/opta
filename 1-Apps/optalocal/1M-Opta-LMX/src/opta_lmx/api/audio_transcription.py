from __future__ import annotations

import logging
from typing import Annotated

import mlx_whisper
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/audio", tags=["audio"])

class TranscriptionResponse(BaseModel):
    text: str

@router.post(
    "/transcriptions",
    response_model=TranscriptionResponse,
    description="Transcribes audio into the input language.",
)
async def create_transcription(
    file: Annotated[UploadFile, File(description="The audio file to transcribe (e.g., .wav, .mp3, .m4a)")],
    model: Annotated[str, Form(description="ID of the model to use.")] = "mlx-community/whisper-base",
    language: Annotated[str | None, Form(description="The language of the input audio.")] = None,
    prompt: Annotated[str | None, Form(description="An optional text to guide the model's style or continue a previous audio segment. The prompt should match the audio language.")] = None,
    response_format: Annotated[str | None, Form(description="The format of the transcript output, in one of these options: json, text, srt, verbose_json, or vtt.")] = "json",
    temperature: Annotated[float | None, Form(description="The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use log probability to automatically increase the temperature until certain thresholds are hit.")] = 0.0,
) -> TranscriptionResponse | str:
    """
    Transcribe an audio file using MLX-Whisper.
    Matches the OpenAI /v1/audio/transcriptions endpoint signature.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No filename provided")

    # Read the file to bytes
    audio_bytes = await file.read()
    
    # Save the bytes to a temporary file because mlx_whisper processes paths or pre-loaded arrays
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_audio:
        temp_audio.write(audio_bytes)
        temp_audio_path = temp_audio.name
        
    try:
        logger.info("Starting transcription for file %s using model %s", file.filename, model)
        kwargs = {}
        if language:
            kwargs["language"] = language
            
        # mlx_whisper has its own model caching in ~/.cache/huggingface/hub
        result = mlx_whisper.transcribe(
            temp_audio_path,
            path_or_hf_repo=model,
            **kwargs
        )
        
        text = result.get("text", "").strip()
        logger.info("Transcription complete. Output length: %d characters", len(text))
        
        if response_format == "text":
            return text
            
        return TranscriptionResponse(text=text)

    except Exception as e:
        logger.error("Transcription failed: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        ) from e
    finally:
        if os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
            except OSError:
                pass
