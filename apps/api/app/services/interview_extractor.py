import os
import re
import traceback
import uuid
from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crypto import decrypt_secret
from app.models import Application, Interview, LLMCredential, UsageLog
from app.schemas import InterviewExtraction
from app.services.skill_extractor import (
    FREE_TIER_LIMIT,
    PROVIDER_CONFIGS,
    _get_active_provider,
    _get_byok_credential,
    _platform_calls_used,
)

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

MEETING_URL_PATTERN = re.compile(
    r"(https?://(?:[\w-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|chime\.aws)[^\s<>\"'\)]+)",
    re.IGNORECASE,
)

GENERIC_URL_PATTERN = re.compile(
    r"(https?://[^\s<>\"'\)]+)",
    re.IGNORECASE,
)

DURATION_PATTERN = re.compile(
    r"(\d+)\s*(?:min|minute|minutes|mins)\b",
    re.IGNORECASE,
)

HOUR_DURATION_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:hr|hour|hours)\b",
    re.IGNORECASE,
)

TIMEZONE_PATTERN = re.compile(
    r"\b(EST|EDT|PST|PDT|CST|CDT|MST|MDT|UTC|GMT)\b",
    re.IGNORECASE,
)

INTERVIEWER_MEET_PATTERN = re.compile(
    r"(?:meet(?:ing)?\s+with|speaking\s+with|interviewer[s]?:\s*|interviewer\s+is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)+)",
    re.IGNORECASE,
)

INTERVIEWER_TITLE_PATTERN = re.compile(
    r"\b((?:Senior|Lead|Principal|Staff|Head\s+of)?\s*(?:Software\s+Engineer|Frontend\s+Engineer|Backend\s+Engineer|Full\s+Stack\s+Engineer|Engineer|Engineering\s+Manager|Product\s+Manager|Technical\s+Recruiter|Recruiter|Hiring\s+Manager|Director))\b",
    re.IGNORECASE,
)

EMAIL_PATTERN = re.compile(
    r"\b([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b"
)


def _regex_extract_interview(raw_text: str) -> InterviewExtraction:
    """Deterministic regex-based fallback extraction."""
    extracted = InterviewExtraction()

    # Meeting URL
    meeting_match = MEETING_URL_PATTERN.search(raw_text)
    if meeting_match:
        extracted.meeting_url = meeting_match.group(1).rstrip(".,;")
    else:
        # Check generic url if it looks like a meeting or video
        for url in GENERIC_URL_PATTERN.findall(raw_text):
            cleaned = url.rstrip(".,;")
            if any(k in cleaned.lower() for k in ("zoom", "meet", "teams", "interview", "call")):
                extracted.meeting_url = cleaned
                break

    # Duration
    dur_match = DURATION_PATTERN.search(raw_text)
    if dur_match:
        extracted.duration_minutes = int(dur_match.group(1))
    else:
        hr_match = HOUR_DURATION_PATTERN.search(raw_text)
        if hr_match:
            extracted.duration_minutes = int(float(hr_match.group(1)) * 60)
        else:
            extracted.duration_minutes = 60

    # Timezone
    tz_match = TIMEZONE_PATTERN.search(raw_text)
    if tz_match:
        extracted.timezone = tz_match.group(1).upper()

    # Interview type & title
    lower_text = raw_text.lower()
    if any(k in lower_text for k in ("recruiter screen", "phone screen", "initial screen", "recruiter call")):
        extracted.interview_type = "recruiter"
        extracted.title = "Recruiter Screen"
    elif "system design" in lower_text:
        extracted.interview_type = "system_design"
        extracted.title = "System Design Interview"
    elif any(k in lower_text for k in ("coding", "algorithm", "live coding", "leetcode", "hackerrank")):
        extracted.interview_type = "coding"
        extracted.title = "Coding Interview"
    elif any(k in lower_text for k in ("behavioral", "culture fit", "values interview")):
        extracted.interview_type = "behavioral"
        extracted.title = "Behavioral Interview"
    elif any(k in lower_text for k in ("hiring manager", "hm chat", "hm interview")):
        extracted.interview_type = "hiring_manager"
        extracted.title = "Hiring Manager Interview"
    elif any(k in lower_text for k in ("onsite", "panel interview", "virtual onsite")):
        extracted.interview_type = "panel"
        extracted.title = "Panel Interview"
    elif "technical" in lower_text:
        extracted.interview_type = "technical"
        extracted.title = "Technical Interview"
    else:
        extracted.interview_type = "technical"
        extracted.title = "Interview"

    # Interviewer Name
    name_match = INTERVIEWER_MEET_PATTERN.search(raw_text)
    if name_match:
        extracted.interviewer_name = name_match.group(1).strip()

    # Interviewer Title
    title_match = INTERVIEWER_TITLE_PATTERN.search(raw_text)
    if title_match:
        extracted.interviewer_title = title_match.group(1).strip()

    # Interviewer Email
    emails = EMAIL_PATTERN.findall(raw_text)
    for em in emails:
        # Ignore obvious corporate / notification emails
        if not any(ignore in em.lower() for ignore in ("noreply", "no-reply", "calendar-notification", "notifications")):
            extracted.interviewer_email = em
            break

    # Date and Time extraction
    now = datetime.now()
    parsed_date = None
    parsed_time = None

    # Try ISO date first: YYYY-MM-DD
    iso_match = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", raw_text)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        try:
            parsed_date = (y, m, d)
        except ValueError:
            pass

    # Try Month Day Year or Day Month Year
    if not parsed_date:
        month_day_match = re.search(
            r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b",
            raw_text,
            re.IGNORECASE,
        )
        if month_day_match:
            month_str = month_day_match.group(1).lower()
            m = MONTHS.get(month_str, 1)
            d = int(month_day_match.group(2))
            y = int(month_day_match.group(3)) if month_day_match.group(3) else now.year
            parsed_date = (y, m, d)

    # Time: HH:MM AM/PM or HH AM/PM
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)\b", raw_text)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        ampm = time_match.group(3).lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        parsed_time = (hour, minute)

    if parsed_date and parsed_time:
        try:
            extracted.scheduled_at = datetime(
                parsed_date[0], parsed_date[1], parsed_date[2],
                parsed_time[0], parsed_time[1]
            )
        except Exception:
            pass
    elif parsed_date:
        try:
            extracted.scheduled_at = datetime(
                parsed_date[0], parsed_date[1], parsed_date[2], 10, 0
            )
        except Exception:
            pass

    return extracted


def _call_llm_for_interview(
    api_key: str, base_url: str | None, model: str, raw_text: str
) -> tuple[InterviewExtraction, int]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert recruitment coordinator assistant. "
                    "Extract structured interview schedule details from the provided email, message, or invite text. "
                    "Fields to extract: round (integer round number if mentioned, default 1), "
                    "title (e.g. 'Technical Interview', 'Recruiter Screen', 'System Design'), "
                    "interview_type (one of 'recruiter', 'technical', 'coding', 'system_design', 'behavioral', 'hiring_manager', 'panel', 'final', 'other'), "
                    "scheduled_at (ISO datetime YYYY-MM-DDTHH:MM:SS if date/time is mentioned, else null), "
                    "duration_minutes (integer duration in minutes, default 60), "
                    "timezone (e.g. 'EST', 'PST', 'UTC'), "
                    "interviewer_name (full name of interviewer if mentioned), "
                    "interviewer_title (title/role of interviewer if mentioned), "
                    "interviewer_email (email of interviewer if mentioned), "
                    "meeting_url (Zoom, Google Meet, Microsoft Teams or other video conference link), "
                    "location (physical address or phone number if in-person/phone), "
                    "notes (any preparation tips or instructions mentioned in the text), "
                    "company (company name if mentioned), "
                    "role (job title/role if mentioned)."
                ),
            },
            {"role": "user", "content": raw_text[:8000]},
        ],
        response_format=InterviewExtraction,
    )
    parsed = response.choices[0].message.parsed
    tokens_used = response.usage.total_tokens if response.usage else 0
    return (parsed if parsed else InterviewExtraction(), tokens_used)


def extract_interview(
    db: Session,
    user_id: uuid.UUID,
    raw_text: str,
    application_id: uuid.UUID | None = None,
) -> InterviewExtraction:
    """Extract interview details from text via LLM with deterministic regex fallback."""
    from app.services.skill_extractor import get_extraction_mode

    mode, _ = get_extraction_mode(db, user_id)
    extracted: InterviewExtraction | None = None

    if mode != "basic":
        if mode == "byok":
            credential = _get_byok_credential(db, user_id)
            if credential:
                api_key = decrypt_secret(credential.encrypted_api_key)
                config = PROVIDER_CONFIGS.get(credential.provider, PROVIDER_CONFIGS["openai"])
                base_url = config["base_url"]
                model = config["model"]
                provider_label = f"byok_{credential.provider}"
            else:
                api_key = None
        else:
            provider = _get_active_provider()
            api_key = provider["api_key"]
            base_url = provider["base_url"]
            model = provider["model"]
            provider_label = f"platform_{provider['name']}"

        if api_key:
            try:
                extracted, tokens_used = _call_llm_for_interview(api_key, base_url, model, raw_text)
                db.add(
                    UsageLog(
                        user_id=user_id,
                        provider=provider_label,
                        action="interview_fast_capture",
                        tokens_used=tokens_used,
                    )
                )
                db.commit()
            except Exception:
                traceback.print_exc()
                extracted = None

    # Fallback to regex if LLM was skipped or failed
    regex_extracted = _regex_extract_interview(raw_text)

    if extracted is None:
        extracted = regex_extracted
    else:
        # Complement missing fields with regex detections if LLM left them null
        if not extracted.meeting_url and regex_extracted.meeting_url:
            extracted.meeting_url = regex_extracted.meeting_url
        if not extracted.scheduled_at and regex_extracted.scheduled_at:
            extracted.scheduled_at = regex_extracted.scheduled_at
        if not extracted.duration_minutes and regex_extracted.duration_minutes:
            extracted.duration_minutes = regex_extracted.duration_minutes
        if not extracted.timezone and regex_extracted.timezone:
            extracted.timezone = regex_extracted.timezone
        if not extracted.interviewer_name and regex_extracted.interviewer_name:
            extracted.interviewer_name = regex_extracted.interviewer_name
        if not extracted.interviewer_title and regex_extracted.interviewer_title:
            extracted.interviewer_title = regex_extracted.interviewer_title
        if not extracted.interviewer_email and regex_extracted.interviewer_email:
            extracted.interviewer_email = regex_extracted.interviewer_email

    # If application_id is provided or matches, enrich company/role and round
    target_app: Application | None = None
    if application_id:
        target_app = db.scalar(
            select(Application).where(
                Application.id == application_id,
                Application.user_id == user_id,
            )
        )
    elif extracted.company:
        # Attempt to match active application by company name
        target_app = db.scalar(
            select(Application)
            .join(Application.job)
            .where(
                Application.user_id == user_id,
                func.lower(Application.job.property.mapper.class_.company_name)
                == extracted.company.lower().strip(),
            )
        )

    if target_app and target_app.job:
        extracted.company = target_app.job.company_name
        extracted.role = target_app.job.title
        # Calculate next round number
        count = db.scalar(
            select(func.count(Interview.id)).where(
                Interview.application_id == target_app.id
            )
        ) or 0
        extracted.round = count + 1

    return extracted
