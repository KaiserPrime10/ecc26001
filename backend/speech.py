from __future__ import annotations

from typing import Any, Dict


class BHASHINIClient:
    """Placeholder integration for BHASHINI TTS / ASR services."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key

    def text_to_speech(self, text: str, language: str) -> Dict[str, Any]:
        return {"language": language, "text": text, "status": "stubbed"}

    def transcribe(self, audio_bytes: bytes, language: str) -> Dict[str, Any]:
        return {"language": language, "text": "", "status": "stubbed"}
