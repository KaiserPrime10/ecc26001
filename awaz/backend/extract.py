def verify_quotes_and_options(transcript: str, language: str = "en") -> dict:
    """
    Intelligent fallback parser mapping raw speech transcripts to schema fields.
    """
    extracted = {}
    text_lower = transcript.lower()

    extracted["raw_transcript"] = transcript
    extracted["language"] = language
    
    # Heuristic mapping for category selection
    if "general" in text_lower or "सामान्य" in text_lower:
        extracted["category"] = "general"
    elif "obc" in text_lower or "ओबीसी" in text_lower:
        extracted["category"] = "obc"
    elif "sc" in text_lower:
        extracted["category"] = "sc"
    elif "st" in text_lower:
        extracted["category"] = "st"

    extracted["full_name"] = transcript if len(transcript) > 2 else ""
    return extracted