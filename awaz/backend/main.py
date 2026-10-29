import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional

from extract import verify_quotes_and_options

app = FastAPI(title="Awaz Widget API", version="1.0.0")

# Enable CORS for local widget testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory schema cache for demo
SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "..", "schemas")

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
    # 1. Load form schema
    schema_path = os.path.join(SCHEMAS_DIR, f"{req.form_id}.json")
    if not os.path.exists(schema_path):
        raise HTTPException(status_code=404, detail="Schema not found")
        
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # DEMO MODE / FALLBACK EXTRACTION LOGIC
    # (Extracts basic patterns locally if no LLM key is supplied)
    raw_extracted = {"extracted": {}}
    transcript_lower = req.transcript.lower()

    # Pattern extraction for demonstration/offline fallback
    if "naam" in transcript_lower or "name" in transcript_lower or "मेरा नाम" in req.transcript:
        # Simple extraction heuristic for fallback
        words = req.transcript.split()
        raw_extracted["extracted"]["name"] = {
            "value": words[-1] if len(words) > 0 else "User",
            "quote": req.transcript
        }

    # Run strict anti-hallucination verification
    verified = verify_quotes_and_options(raw_extracted, req.transcript, schema)

    return {
        "status": "success",
        "transcript": req.transcript,
        "fields": verified
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)