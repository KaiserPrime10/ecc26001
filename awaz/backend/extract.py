import re

def verify_quotes_and_options(transcript: str, language: str = "en") -> dict:
    """
    Fine-tuned precision parser for Name and Age extraction.
    """
    extracted = {}
    text_lower = transcript.lower().strip()

    extracted["raw_transcript"] = transcript
    extracted["language"] = language

    # -------------------------------------------------------------------------
    # 1. AGE PARSER
    # -------------------------------------------------------------------------
    age_keywords = [
        "age", "years old", "year old", "iam", "i am", 
        "साल", "वर्ष", "उम्र", "आयु", 
        "বছৰ", "বয়স"
    ]
    
    if any(kw in text_lower for kw in age_keywords) or (re.search(r'\b\d{1,2}\b', text_lower) and len(text_lower.split()) <= 4):
        age_match = re.search(r'\b(\d{1,2})\b', transcript)
        if age_match:
            extracted["age"] = age_match.group(1)
            return extracted


    # -------------------------------------------------------------------------
    # 2. NAME PARSER
    # -------------------------------------------------------------------------
    name_cleaned = transcript
    phrases_to_remove = [
        r"my name is", r"mera naam hai", r"mera naam", r"myself", r"i am called", r"i am",
        r"मेरा नाम है", r"मेरा नाम", r"मेरा नाम ऐ", r"मै हूँ", r"mai hu", r"mera nam",
        r"moi", r"মোৰ নাম", r"mein", r"main", r"mai", r"मैं", r"हूँ", r"hu", r"is", r"naam",
        r"name is", r"this is"
    ]
    
    for pattern in phrases_to_remove:
        name_cleaned = re.sub(pattern, "", name_cleaned, flags=re.IGNORECASE)
        
    name_cleaned = re.sub(r'[,\.\u0964\-!?]', ' ', name_cleaned)
    name_cleaned = " ".join(name_cleaned.split()).strip()

    if len(name_cleaned) > 1 and not name_cleaned.isdigit():
        extracted["full_name"] = name_cleaned.title()

    return extracted