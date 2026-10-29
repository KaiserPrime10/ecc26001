from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Awaz Form Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractRequest(BaseModel):
    form_id: str
    transcript: str
    current_values: dict[str, Any] = Field(default_factory=dict)
    language: str


class ExtractedField(BaseModel):
    value: Any
    quote: str


class ExtractResponse(BaseModel):
    form_id: str
    values: dict[str, ExtractedField]


def _extract_demo_values(transcript: str) -> dict[str, ExtractedField]:
    """Extract only simple literal examples for the initial API scaffold."""
    extracted: dict[str, ExtractedField] = {}

    name_match = re.search(
        r"\b(?:my name is|name is)\s+([A-Za-z][A-Za-z .'-]{0,80}?)(?=\s*(?:,|\.|;|$|\band\b))",
        transcript,
        flags=re.IGNORECASE,
    )
    if name_match:
        extracted["name"] = ExtractedField(
            value=name_match.group(1).strip(),
            quote=name_match.group(0).strip(),
        )

    phone_match = re.search(r"(?<!\d)[6-9]\d{9}(?!\d)", transcript)
    if phone_match:
        extracted["phone"] = ExtractedField(
            value=phone_match.group(0),
            quote=phone_match.group(0),
        )

    date_match = re.search(
        r"(?<!\d)(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})(?!\d)",
        transcript,
    )
    if date_match:
        date_text = date_match.group(1)
        date_formats = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y")
        for date_format in date_formats:
            try:
                iso_date = datetime.strptime(date_text, date_format).date().isoformat()
                extracted["dob"] = ExtractedField(value=iso_date, quote=date_text)
                break
            except ValueError:
                continue

    income_match = re.search(
        r"(?:income|rupees?|₹)\D{0,16}(\d{1,8}(?:,\d{3})*)",
        transcript,
        flags=re.IGNORECASE,
    )
    if income_match:
        amount = income_match.group(1).replace(",", "")
        extracted["income"] = ExtractedField(
            value=int(amount),
            quote=income_match.group(0).strip(),
        )

    districts = ("Kamrup Metropolitan", "Barpeta", "Jorhat")
    lower_transcript = transcript.casefold()
    for district in districts:
        start = lower_transcript.find(district.casefold())
        if start >= 0:
            quote = transcript[start : start + len(district)]
            extracted["district"] = ExtractedField(value=district, quote=quote)
            break

    return extracted


@app.post("/extract", response_model=ExtractResponse)
async def extract(request: ExtractRequest) -> ExtractResponse:
    if request.form_id != "scholarship":
        return ExtractResponse(form_id=request.form_id, values={})

    values = _extract_demo_values(request.transcript)
    verified_values = {
        field_id: extraction
        for field_id, extraction in values.items()
        if extraction.quote and extraction.quote in request.transcript
    }

    return ExtractResponse(
        form_id=request.form_id,
        values=verified_values,
    )
