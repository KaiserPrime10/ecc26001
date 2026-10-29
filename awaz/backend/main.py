import json
import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional

from extract import verify_quotes_and_options

app = FastAPI(title="Awaz Widget API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCHEMAS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schemas"))

class ExtractRequest(BaseModel):
    form_id: str
    transcript: str
    current_values: Dict[str, Any] = {}
    language: str = "hi"

@app.get("/health")
def health_check():
    return {"status": "ok", "widget": "Awaz"}

@app.get("/schema/{form_id}")
def get_schema(form_id: str):
    schema_path = os.path.join(SCHEMAS_DIR, f"{form_id}.json")
    if not os.path.exists(schema_path):
        raise HTTPException(status_code=404, detail="Form schema not found")
    
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.post("/extract")
async def extract_fields(req: ExtractRequest):
    schema_path = os.path.join(SCHEMAS_DIR, f"{req.form_id}.json")
    if not os.path.exists(schema_path):
        raise HTTPException(status_code=404, detail="Schema not found")
        
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # Start with already filled current values
    raw_extracted = {"extracted": {}}
    transcript_clean = req.transcript.strip()
    transcript_lower = transcript_clean.lower()
    
    fields = schema.get("fields", [])
    
    # 1. Check for Dropdown / Select fields (e.g., District / State)
    for field in fields:
        field_id = field.get("id")
        if field.get("type") == "select":
            options = field.get("options", [])
            for opt in options:
                # If an option (e.g., "Kamrup Metropolitan") is mentioned in the transcript
                if opt.lower() in transcript_lower:
                    raw_extracted["extracted"][field_id] = {
                        "value": opt,
                        "quote": opt
                    }
                    break

    # 2. Check for Phone Number (10 digits)
    phone_field = next((f for f in fields if f.get("type") == "tel" or "phone" in f.get("id")), None)
    if phone_field:
        phone_match = re.search(r'\b\d{10}\b', transcript_clean)
        if phone_match:
            raw_extracted["extracted"][phone_field["id"]] = {
                "value": phone_match.group(0),
                "quote": phone_match.group(0)
            }

    # 3. Check for Date / DOB (e.g., 2005-08-15 or spoken numbers)
    date_field = next((f for f in fields if f.get("type") == "date" or "dob" in f.get("id")), None)
    if date_field:
        date_match = re.search(r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b', transcript_clean)
        if date_match:
            raw_extracted["extracted"][date_field["id"]] = {
                "value": date_match.group(0),
                "quote": date_match.group(0)
            }

    # 4. Check for Income / Numbers
    income_field = next((f for f in fields if "income" in f.get("id") or "aay" in f.get("id")), None)
    if income_field and any(k in transcript_lower for k in ["income", "aay", "आय", "लख", "thousand", "हजार", "rupees", "रुपये"]):
        digits_found = re.findall(r'\d+', transcript_clean)
        if digits_found:
            raw_extracted["extracted"][income_field["id"]] = {
                "value": "".join(digits_found),
                "quote": transcript_clean
            }

    # 5. Extract Name ONLY IF name keyword or explicit intro is present AND not already captured as district/other fields
    name_field = next((f for f in fields if "name" in f.get("id") or "naam" in f.get("id")), None)
    if name_field and name_field["id"] not in req.current_values:
        name_prefixes = ["my name is", "mera naam hai", "mera naam", "मेरा नाम है", "मेरा नाम", "मोৰ নাম", "i am"]
        has_name_prefix = any(p in transcript_lower for p in name_prefixes)
        
        # Only assign to name if explicitly introduced as a name or simple phrase without select options
        if has_name_prefix:
            name_text = transcript_clean
            for prefix in name_prefixes:
                if prefix in name_text.lower():
                    idx = name_text.lower().find(prefix) + len(prefix)
                    name_text = name_text[idx:].strip()
                    break
            
            # Strip trailing context
            name_text = name_text.strip(" .,-")
            if name_text and len(name_text.split()) <= 5:
                raw_extracted["extracted"][name_field["id"]] = {
                    "value": name_text,
                    "quote": transcript_clean
                }

    # Run strict verification
    verified = verify_quotes_and_options(raw_extracted, req.transcript, schema)

    return {
        "status": "success",
        "transcript": req.transcript,
        "fields": verified
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)