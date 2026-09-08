import os
import re
import traceback
import uuid

from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crypto import decrypt_secret
from app.models import LLMCredential, UsageLog

FREE_TIER_LIMIT = 5

SKILLS_SECTION_HEADERS = ("TECHNICAL SKILLS", "SKILLS", "CORE COMPETENCIES")
NEXT_SECTION_PATTERN = re.compile(r"^[A-Z][A-Z\s&/]{3,40}$")

PROVIDER_CONFIGS = {
    "openai": {
        "base_url": None,
        "model": "gpt-4o-mini",
        "env_key": "PLATFORM_OPENAI_API_KEY",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "openai/gpt-oss-20b",
        "env_key": "GROQ_API_KEY",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "env_key": "OPENROUTER_API_KEY",
    },
}


class ExtractedSkills(BaseModel):
    skills: list[str]


def _regex_extract(raw_text: str) -> str | None:
    lines = raw_text.splitlines()
    start_idx = None
    for idx, line in enumerate(lines):
        if line.strip().upper() in SKILLS_SECTION_HEADERS:
            start_idx = idx + 1
            break
    if start_idx is None:
        return None

    section_lines: list[str] = []
    for line in lines[start_idx:]:
        stripped = line.strip()
        if stripped and NEXT_SECTION_PATTERN.match(stripped) and ":" not in stripped:
            break
        if stripped:
            section_lines.append(stripped)

    if not section_lines:
        return None

    joined = " ".join(section_lines)
    candidates = re.split(r"[,:•\u2022]", joined)
    skills = [c.strip() for c in candidates if c.strip() and len(c.strip()) < 60]
    return ", ".join(dict.fromkeys(skills)) if skills else None


def _get_byok_credential(db: Session, user_id: uuid.UUID) -> LLMCredential | None:
    return db.scalar(
        select(LLMCredential).where(
            LLMCredential.user_id == user_id, LLMCredential.provider == "openai"
        )
    )


def _platform_calls_used(db: Session, user_id: uuid.UUID) -> int:
    # Match any "platform_*" label (platform_openai, platform_groq, platform_openrouter, ...)
    # so the free-tier count stays correct regardless of which underlying LLM_PROVIDER is active.
    count = db.scalar(
        select(func.count()).where(
            UsageLog.user_id == user_id,
            UsageLog.provider.like("platform_%"),
        )
    )
    return count or 0


def get_extraction_mode(db: Session, user_id: uuid.UUID) -> tuple[str, int | None]:
    if _get_byok_credential(db, user_id) is not None:
        return "byok", None
    used = _platform_calls_used(db, user_id)
    remaining = max(FREE_TIER_LIMIT - used, 0)
    if remaining > 0:
        return "platform", remaining
    return "basic", 0


def _get_active_provider() -> dict:
    provider_name = os.environ.get("LLM_PROVIDER", "openai")
    config = PROVIDER_CONFIGS.get(provider_name, PROVIDER_CONFIGS["openai"])
    api_key = os.environ.get(config["env_key"])
    return {**config, "api_key": api_key, "name": provider_name}


def _call_llm(
    api_key: str, base_url: str | None, model: str, raw_text: str
) -> tuple[list[str], int]:
    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Extract a clean, deduplicated list of technical and professional "
                    "skills from this resume text. Return only concrete skills "
                    "(languages, tools, frameworks, methodologies), not category labels."
                ),
            },
            {"role": "user", "content": raw_text[:12000]},
        ],
        response_format=ExtractedSkills,
    )
    parsed = response.choices[0].message.parsed
    tokens_used = response.usage.total_tokens if response.usage else 0
    return (parsed.skills if parsed else [], tokens_used)


def extract_skills(db: Session, user_id: uuid.UUID, raw_text: str) -> str | None:
    mode, _ = get_extraction_mode(db, user_id)

    if mode == "basic":
        return _regex_extract(raw_text)

    if mode == "byok":
        credential = _get_byok_credential(db, user_id)
        api_key = decrypt_secret(credential.encrypted_api_key)
        base_url = None
        model = PROVIDER_CONFIGS["openai"]["model"]
        provider_label = "byok_openai"
    else:
        provider = _get_active_provider()
        if not provider["api_key"]:
            return _regex_extract(raw_text)
        api_key = provider["api_key"]
        base_url = provider["base_url"]
        model = provider["model"]
        provider_label = f"platform_{provider['name']}"

    try:
        skills, tokens_used = _call_llm(api_key, base_url, model, raw_text)
    except Exception:
        traceback.print_exc()
        return _regex_extract(raw_text)

    db.add(
        UsageLog(
            user_id=user_id,
            provider=provider_label,
            action="resume_skill_extraction",
            tokens_used=tokens_used,
        )
    )
    db.commit()

    return ", ".join(skills) if skills else None
