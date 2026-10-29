from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os

# Safe import supporting both package and direct execution
try:
    from .extract import verify_quotes_and_options
except ImportError:
    from extract import verify_quotes_and_options

app = FastAPI(title="Awaz Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/schema")
def get_schema():
    schema_path = os.path.join(os.path.dirname(__file__), "../schemas/scholarship.json")
    if not os.path.exists(schema_path):
        raise HTTPException(status_code=404, detail="Schema not found")
    with open(schema_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

@app.post("/api/parse")
async def parse_audio_transcript(payload: dict):
    transcript = payload.get("transcript", "")
    language = payload.get("language", "en")
    extracted_data = verify_quotes_and_options(transcript, language)
    return {"success": True, "data": extracted_data}