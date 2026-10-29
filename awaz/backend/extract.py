import json
import os
import re
from typing import Dict, Any, Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

SYSTEM_PROMPT = """
You are a precise form-filling assistant for the Awaz widget. 
Your task is to extract form field values from a spoken user transcript in English, Hindi, or Assamese.

SCHEMA FIELD RULES:
{schema_summary}

STRICT EXTRACTION LAWS:
1. Extract ONLY field values that were explicitly spoken in the TRANSCRIPT.
2. Every field you extract MUST include an exact "quote" containing the verbatim words from the transcript that back up the value.
3. DO NOT GUESS or fabricate data. If a field is not spoken, DO NOT include it in the response.
4. Value Formatting Rules:
   - Convert spoken numbers (e.g. "पच्चीस हज़ार" or "twenty five thousand") into plain digits (e.g., 25000).
   - Convert spoken dates to YYYY-MM-DD.
   - Phone numbers must be 10 digits without spaces.
5. If the user corrects a previously filled value, output the NEW corrected value.

CURRENT FORM VALUES:
{current_values}

USER TRANSCRIPT:
"{transcript}"

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this structure:
{{
  "extracted": {{
    "field_id": {{
      "value": "extracted_value_or_number",
      "quote": "exact words spoken in transcript"
    }}
  }}
}}
"""

def verify_quotes_and_options(extracted_data: Dict[str, Any], transcript: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Anti-Hallucination check: 
    1. Verifies that 'quote' is present verbatim in transcript (case-insensitive & whitespace normalized).
    2. Ensures select/dropdown values match allowed schema options.
    """
    clean_transcript = " ".join(transcript.lower().split())
    fields_schema = {f["id"]: f for f in schema.get("fields", [])}
    verified_results = {}

    for field_id, item in extracted_data.get("extracted", {}).items():
        if field_id not in fields_schema:
            continue
            
        val = str(item.get("value", ""))
        quote = str(item.get("quote", "")).strip()

        # 1. Quote check
        clean_quote = " ".join(quote.lower().split())
        if clean_quote and clean_quote not in clean_transcript:
            print(f"[REJECTED HALLUCINATION] Field '{field_id}': quote '{quote}' not found in transcript.")
            continue

        # 2. Dropdown options check
        field_meta = fields_schema[field_id]
        if field_meta.get("type") == "select":
            options = field_meta.get("options", [])
            if val not in options:
                # Fuzzy match option case if needed
                matched = next((opt for opt in options if opt.lower() == val.lower()), None)
                if matched:
                    val = matched
                else:
                    print(f"[REJECTED OPTION] Field '{field_id}': value '{val}' not in allowed options.")
                    continue

        verified_results[field_id] = {
            "value": val,
            "quote": quote,
            "source": "voice"
        }

    return verified_results