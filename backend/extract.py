from __future__ import annotations

import json
import re
from typing import Any, Dict, List


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _find_quote(text: str, pattern: re.Pattern[str]) -> str:
    match = pattern.search(text)
    if match:
        return match.group(0)
    return ""


def extract_field_values(transcript: str, schema: Dict[str, Any], values: Dict[str, Any], issues: List[Dict[str, str]]) -> Dict[str, Dict[str, Any]]:
    text = transcript or ""
    normalized = text.lower()
    result: Dict[str, Dict[str, Any]] = {}
    for field in schema.get("fields", []):
        fid = field["id"]
        if fid == "name":
            patterns = [
                r"(?:my name is|name is|i am|this is)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s.-]+)",
                r"(?:मेर\s*का\s*नाम|नाम\s*है|मेरा\s*नाम)\s+([\w\s.-]+)",
                r"(?:মোৰ\s*নাম|নাম\s*হ\'\w+|মোৰ\s*নাম)\s+([\w\s.-]+)",
            ]
            for pattern in patterns:
                match = re.search(pattern, text, flags=re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    if value:
                        result[fid] = {"value": value, "quote": match.group(0), "source": "voice"}
                    break
        elif fid == "phone":
            digits = re.findall(r"(?:\+?91\s*)?([6-9]\d{9})", text)
            if digits:
                value = digits[0]
                result[fid] = {"value": value, "quote": value, "source": "voice"}
        elif fid == "dob":
            date_match = re.search(r"\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\b", text)
            if date_match:
                extracted = date_match.group(1)
                result[fid] = {"value": extracted, "quote": extracted, "source": "voice"}
        elif fid == "income":
            amounts = re.findall(r"\b(?:rupees?|₹)?\s*(\d{3,7})\b", text, flags=re.IGNORECASE)
            if amounts:
                value = amounts[0]
                result[fid] = {"value": value, "quote": value, "source": "voice"}
        elif fid == "district":
            options = [opt.lower() for opt in field.get("options", [])]
            matched = next((opt for opt in options if opt.lower() in normalized), None)
            if matched:
                result[fid] = {"value": matched, "quote": matched, "source": "voice"}

    return result


def classify_demo_response() -> Dict[str, Dict[str, Any]]:
    return {
        "name": {"value": "Amit Das", "quote": "My name is Amit Das", "source": "demo"},
        "phone": {"value": "9876543210", "quote": "9876543210", "source": "demo"},
        "dob": {"value": "2006-03-03", "quote": "3 March 2006", "source": "demo"},
        "income": {"value": "25000", "quote": "25000", "source": "demo"},
        "district": {"value": "Kamrup Metropolitan", "quote": "Kamrup Metropolitan", "source": "demo"},
    }


def parse_json_response(raw: str) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
            cleaned = cleaned.removesuffix("```").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {}
