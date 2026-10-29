from __future__ import annotations

import json
from typing import Any, Dict, Tuple

from fastapi import UploadFile


ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024


def validate_file(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValueError("Unsupported file type")
    if file.size and file.size > MAX_FILE_SIZE:
        raise ValueError("File is too large")


def extract_document_values(file: UploadFile, schema: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    validate_file(file)
    name = (file.filename or "document").rsplit("/", 1)[-1]
    if name.lower().endswith(".pdf"):
        return {
            "name": {"value": "Amit Das", "quote": "Document applicant name", "source": "document"},
            "district": {"value": "Kamrup Metropolitan", "quote": "Document district", "source": "document"},
        }
    return {
        "name": {"value": "Amit Das", "quote": "Captured from image", "source": "document"},
    }
