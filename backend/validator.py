from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List


def normalize_digits(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    mapping = {
        "०": "0",
        "१": "1",
        "२": "2",
        "३": "3",
        "४": "4",
        "५": "5",
        "६": "6",
        "७": "7",
        "८": "8",
        "९": "9",
    }
    for src, dst in mapping.items():
        text = text.replace(src, dst)
    return text


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _parse_date(value: Any) -> date | None:
    text = normalize_digits(str(value)).strip()
    if not text:
        return None

    for candidate in (text, text.replace('/', '-').replace('.', '-')):
        try:
            return date.fromisoformat(candidate)
        except ValueError:
            pass

    patterns = [
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
    ]
    for fmt in patterns:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def validate_field(field: Dict[str, Any], value: Any) -> List[str]:
    issues: List[str] = []
    rules = field.get("rules", {}) or {}

    if field.get("required") and _is_empty(value):
        return ["required"]

    if _is_empty(value):
        return issues

    field_type = field.get("type")

    if field_type == "phone":
        digits = re.sub(r"\D", "", normalize_digits(value))
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            issues.append("invalid_format")

    if field_type == "date":
        parsed = _parse_date(value)
        if parsed is None:
            issues.append("invalid_date")
        else:
            age = (date.today() - parsed).days // 365
            if "minAge" in rules and age < int(rules["minAge"]):
                issues.append("min_age")
            if "maxAge" in rules and age > int(rules["maxAge"]):
                issues.append("max_age")

    if field_type == "number":
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            issues.append("invalid_number")
        else:
            if "min" in rules and numeric < float(rules["min"]):
                issues.append("min")
            if "max" in rules and numeric > float(rules["max"]):
                issues.append("max")

    if field_type == "select":
        options = field.get("options") or []
        if value not in options:
            issues.append("invalid_option")

    pattern = rules.get("pattern")
    if pattern and not re.fullmatch(pattern, str(value)):
        issues.append("invalid_format")

    return issues


def validate_form(schema: Dict[str, Any], values: Dict[str, Any]) -> Dict[str, List[str]]:
    issues: Dict[str, List[str]] = {}
    for field in schema.get("fields", []):
        field_id = field.get("id")
        value = values.get(field_id)
        field_issues = validate_field(field, value)
        if field_issues:
            issues[field_id] = field_issues
    return issues
