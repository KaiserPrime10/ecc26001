import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from extract import verify_quotes_and_options

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ParseRequest(BaseModel):
    transcript: str
    language: str = "en"

@app.post("/api/parse")
def parse_voice(req: ParseRequest):
    data = verify_quotes_and_options(req.transcript, req.language)
    return {"success": True, "data": data}

# Automatically find and serve the frontend folder from the backend directory
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")