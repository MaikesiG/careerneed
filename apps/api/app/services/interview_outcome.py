import hashlib
import json
from typing import Any

from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crypto import decrypt_secret
from app.models import AISuggestion, Application, Interview, InterviewQuestion, UsageLog, User, utcnow
from app.schemas import (
    AnalysisScope,
    GroundedObservation,
    InterviewOutcomeAnalysisOutput,
    InterviewOutcomeResolveRequest,
    RecommendedAction,
)
from app.services.skill_extractor import (
    PROVIDER_CONFIGS,
    _get_active_provider,
    _get_byok_credential,
    get_extraction_mode,
)

PROMPT_VERSION = "interview-outcome-v1"
OUTPUT_SCHEMA_VERSION = "1.0"
SUGGESTION_TYPE = "interview_outcome_analysis"
MAX_QUESTIONS = 30
MAX_QUESTION_LENGTH = 1000
MAX_NOTE_LENGTH = 2000
SAFE_LIMITATION = (
    "This analysis is based on user-recorded information and does not determine "
    "employer decision-making."
)


def build_minimized_context(
    db: Session,
    application: Application,
    interview: Interview,
) -> dict[str, Any]:
    """Build bounded context for the current owned interview only."""
    questions = list(
        db.scalars(
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == interview.id)
            .order_by(InterviewQuestion.created_at.asc())
            .limit(MAX_QUESTIONS)
        )
    )
    job = application.job
    return {
        "scope": "current_interview_only",
        "interview": {
            "interview_type": (interview.interview_type or "")[:50],
            "status": (interview.status or "")[:50],
            "result": (interview.result or "")[:50],
            "notes": (interview.notes or "")[:MAX_NOTE_LENGTH].strip(),
            "preparation_notes": (interview.preparation_notes or "")[:MAX_NOTE_LENGTH].strip(),
        },
        "application": {
            "company_name": (job.company_name or "")[:255].strip() if job else "",
            "job_title": (job.title or "")[:255].strip() if job else "",
        },
        "questions": [
            {
                "question": question.question[:MAX_QUESTION_LENGTH].strip(),
                "category": question.category[:50],
                "difficulty": question.difficulty[:20],
                "answer_notes": (question.answer_notes or "")[:MAX_NOTE_LENGTH].strip(),
                "reflection": (question.reflection or "")[:MAX_NOTE_LENGTH].strip(),
                "asked_at": question.asked_at.isoformat() if question.asked_at else None,
            }
            for question in questions
        ],
    }


def compute_context_hash(context: dict[str, Any]) -> str:
    canonical = json.dumps(context, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _generate_deterministic_fallback(context: dict[str, Any]) -> InterviewOutcomeAnalysisOutput:
    interview = context["interview"]
    questions = context["questions"]
    observations: list[GroundedObservation] = []
    if interview["notes"]:
        observations.append(
            GroundedObservation(
                observation="Interview notes are available for review.",
                source_reference="interview_notes",
                evidence_summary=interview["notes"][:500],
                confidence=1.0,
            )
        )
    if interview["result"] and interview["result"] != "pending":
        observations.append(
            GroundedObservation(
                observation=f"The recorded interview result is {interview['result']}.",
                source_reference="interview_result",
                evidence_summary="This is the result explicitly recorded for the interview.",
                confidence=1.0,
            )
        )

    sparse = not observations and not any(
        q["answer_notes"] or q["reflection"] for q in questions
    )
    uncertainty = [
        "There is insufficient recorded evidence to infer strengths, growth areas, or causality."
    ] if sparse else [
        "Observations reflect only the information recorded by the user for this interview."
    ]
    data_limitations = ["Only the current interview was considered."]
    if len(questions) == MAX_QUESTIONS:
        data_limitations.append(f"Question context was limited to {MAX_QUESTIONS} records.")
    if sparse:
        data_limitations.append("No substantive interview notes, answer notes, or reflections were available.")

    actions = [] if sparse else [
        RecommendedAction(
            action="Review the recorded notes and turn specific evidence into a practice plan.",
            time_horizon="before_next_interview",
            rationale="A focused review can convert recorded observations into concrete preparation.",
            related_topics=[],
        )
    ]
    return InterviewOutcomeAnalysisOutput(
        grounded_observations=observations,
        possible_strengths=[],
        possible_growth_areas=[],
        recurring_topics=[],
        recommended_actions=actions,
        suggested_follow_up_points=[],
        uncertainty_notes=uncertainty,
        limitations=[SAFE_LIMITATION, "Recurring-topic scope is limited to this interview only."],
        analysis_scope=AnalysisScope(
            interviews_considered=1,
            questions_considered=len(questions),
            notes_available=bool(interview["notes"] or interview["preparation_notes"]),
            result_recorded=bool(interview["result"] and interview["result"] != "pending"),
            data_limitations=data_limitations,
        ),
    )


def _call_llm_for_outcome(
    api_key: str,
    base_url: str | None,
    model: str,
    context: dict[str, Any],
) -> tuple[InterviewOutcomeAnalysisOutput, int]:
    client = OpenAI(api_key=api_key, base_url=base_url, timeout=30.0)
    response = client.chat.completions.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Analyze only the supplied user-recorded interview evidence. Separate observations "
                    "from tentative interpretations, never invent employer intent or causal claims, and "
                    "use calibrated language such as 'possible' and 'may'. Recurring topics must explicitly "
                    "say their scope is this interview only. Do not predict hiring decisions. The limitations "
                    f"must include exactly this safety meaning: {SAFE_LIMITATION}"
                ),
            },
            {"role": "user", "content": json.dumps(context, ensure_ascii=False, separators=(",", ":"))},
        ],
        response_format=InterviewOutcomeAnalysisOutput,
    )
    parsed = response.choices[0].message.parsed
    tokens_used = response.usage.total_tokens if response.usage else 0
    if parsed is None:
        return _generate_deterministic_fallback(context), tokens_used
    return parsed, tokens_used


def generate_interview_outcome(
    db: Session,
    current_user: User,
    interview: Interview,
    application: Application,
) -> tuple[AISuggestion, bool]:
    context = build_minimized_context(db, application, interview)
    context_hash = compute_context_hash(context)
    output: InterviewOutcomeAnalysisOutput | None = None
    provider_label = "fallback"
    model_version = "deterministic-v1"
    usage: UsageLog | None = None
    mode, _ = get_extraction_mode(db, current_user.id)
    if mode != "basic":
        if mode == "byok":
            credential = _get_byok_credential(db, current_user.id)
            if credential:
                config = PROVIDER_CONFIGS.get(credential.provider, PROVIDER_CONFIGS["openai"])
                api_key = decrypt_secret(credential.encrypted_api_key)
                base_url = config["base_url"]
                model = config["model"]
                candidate_provider = f"byok_{credential.provider}"
            else:
                api_key, base_url, model, candidate_provider = None, None, "", ""
        else:
            provider = _get_active_provider()
            api_key, base_url, model = provider["api_key"], provider["base_url"], provider["model"]
            candidate_provider = f"platform_{provider['name']}"
        if api_key:
            try:
                output, tokens_used = _call_llm_for_outcome(api_key, base_url, model, context)
                provider_label, model_version = candidate_provider, model
                usage = UsageLog(
                    user_id=current_user.id,
                    provider=provider_label,
                    action="interview_outcome_analysis_generate",
                    tokens_used=tokens_used,
                )
            except Exception:
                output = None

    if output is None:
        output = _generate_deterministic_fallback(context)
        provider_label, model_version, usage = "fallback", "deterministic-v1", None

    confidence_values = [
        item.confidence
        for item in [*output.grounded_observations, *output.possible_strengths, *output.possible_growth_areas]
        if item.confidence is not None
    ]
    suggestion = AISuggestion(
        user_id=current_user.id,
        interview_id=interview.id,
        entity_type="interview",
        entity_id=interview.id,
        suggestion_type=SUGGESTION_TYPE,
        proposed_value=output.model_dump(mode="json"),
        confidence=round(sum(confidence_values) / len(confidence_values), 2) if confidence_values else None,
        rationale=(output.grounded_observations[0].observation[:500] if output.grounded_observations else None),
        model_provider=provider_label,
        model_version=model_version,
        prompt_version=PROMPT_VERSION,
        output_schema_version=OUTPUT_SCHEMA_VERSION,
        input_snapshot_hash=context_hash,
        status="pending",
    )
    db.add(suggestion)
    if usage is not None:
        db.add(usage)
    db.commit()
    db.refresh(suggestion)
    return suggestion, True


def resolve_interview_outcome_suggestion(
    db: Session,
    suggestion: AISuggestion,
    payload: InterviewOutcomeResolveRequest,
) -> AISuggestion:
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Only pending suggestions can be resolved (current: {suggestion.status})",
        )
    if payload.status == "accepted":
        resolved = payload.resolved_value or InterviewOutcomeAnalysisOutput.model_validate(
            suggestion.proposed_value
        )
        suggestion.resolved_value = resolved.model_dump(mode="json")
    elif payload.status == "edited":
        if payload.resolved_value is None:
            raise HTTPException(status_code=422, detail="resolved_value is required when status is 'edited'")
        suggestion.resolved_value = payload.resolved_value.model_dump(mode="json")
    suggestion.status = payload.status
    suggestion.resolved_at = utcnow()
    suggestion.updated_at = utcnow()
    db.commit()
    db.refresh(suggestion)
    return suggestion
