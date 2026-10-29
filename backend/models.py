from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FieldSchema(BaseModel):
    id: str
    type: str
    required: bool = False
    label: Dict[str, str] = Field(default_factory=dict)
    options: Optional[List[str]] = None
    rules: Dict[str, Any] = Field(default_factory=dict)


class FormSchema(BaseModel):
    formId: str
    title: Dict[str, str] = Field(default_factory=dict)
    fields: List[FieldSchema]


class ExtractValue(BaseModel):
    value: Any
    quote: Optional[str] = None
    source: Optional[str] = None


class ExtractRequest(BaseModel):
    transcript: str = ""
    schema: Dict[str, Any] = Field(default_factory=dict)
    values: Dict[str, Any] = Field(default_factory=dict)
    issues: List[Dict[str, str]] = Field(default_factory=list)


class SubmitRequest(BaseModel):
    schema: Dict[str, Any] = Field(default_factory=dict)
    values: Dict[str, Any] = Field(default_factory=dict)
