import hashlib
import json
import re
from typing import Any

from fastapi import HTTPException
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crypto import decrypt_secret
from app.models import (
    AISuggestion,
    Application,
    Interview,
    InterviewQuestion,
    UsageLog,
    User,
    utcnow,
)
from app.schemas import (
    BehavioralStory,
    GapWarning,
    InterviewPrepOutput,
    InterviewPrepResolveRequest,
    LikelyQuestion,
    PrepPriority,
    ReadinessAssessment,
    ReadinessBreakdown,
    TechnicalTopic,
)
from app.services.skill_extractor import (
    PROVIDER_CONFIGS,
    _get_active_provider,
    _get_byok_credential,
    get_extraction_mode,
)

PROMPT_VERSION = "interview-prep-v1"
OUTPUT_SCHEMA_VERSION = "1.0"
SUGGESTION_TYPE = "interview_prep"
MAX_PREPARATION_NOTES_LENGTH = 2_000
MAX_APPLICATION_NOTES_LENGTH = 1_000
MAX_JOB_DESCRIPTION_LENGTH = 3_000
MAX_RESUME_SKILLS = 50
MAX_RESUME_SKILL_LENGTH = 100
MAX_PRIOR_QUESTIONS = 20
MAX_PRIOR_QUESTION_LENGTH = 500
MAX_PRIOR_ANSWER_LENGTH = 500
MAX_PRIOR_REFLECTION_LENGTH = 500


def _serialize_scheduled_at(interview: Interview) -> dict[str, Any] | None:
    """Serialize legacy interview time without inventing a UTC offset."""
    scheduled_at = interview.scheduled_at
    if scheduled_at is None:
        return None

    timezone_context = (interview.timezone or "").strip()[:100] or None
    is_aware = scheduled_at.tzinfo is not None and scheduled_at.utcoffset() is not None
    if is_aware:
        return {
            "value": scheduled_at.isoformat(),
            "timezone_context": timezone_context,
            "timezone_awareness": "aware",
            "limitation": None,
        }

    if timezone_context:
        limitation = (
            "The scheduled time is stored without a UTC offset. "
            f"The recorded timezone context is {timezone_context}; no conversion was assumed."
        )
    else:
        limitation = (
            "The scheduled time is stored without a UTC offset and no timezone context "
            "is recorded; confirm the local interview time."
        )
    return {
        "value": scheduled_at.isoformat(),
        "timezone_context": timezone_context,
        "timezone_awareness": "naive",
        "limitation": limitation,
    }


def _bounded_resume_skills(raw_skills: str | None) -> list[str]:
    """Return a deterministic, bounded list from the legacy skills text field."""
    if not raw_skills:
        return []

    skills: list[str] = []
    seen: set[str] = set()
    for value in re.split(r"[,;\n|\u2022]", raw_skills):
        skill = value.strip()[:MAX_RESUME_SKILL_LENGTH]
        normalized = skill.casefold()
        if not skill or normalized in seen:
            continue
        seen.add(normalized)
        skills.append(skill)
        if len(skills) == MAX_RESUME_SKILLS:
            break
    return skills


def build_minimized_context(
    db: Session,
    application: Application,
    interview: Interview,
) -> dict[str, Any]:
    """Build minimal server-side context from available owned data."""
    # Prior completed interviews and their questions under the same application
    prior_interviews = db.scalars(
        select(Interview)
        .where(
            Interview.application_id == application.id,
            Interview.id != interview.id,
            Interview.status == "completed",
        )
        .order_by(Interview.round.asc())
    ).all()

    prior_questions_data: list[dict[str, Any]] = []
    if prior_interviews:
        prior_interview_ids = [pi.id for pi in prior_interviews]
        questions = db.scalars(
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id.in_(prior_interview_ids))
            .order_by(
                InterviewQuestion.asked_at.asc().nullslast(),
                InterviewQuestion.created_at.asc(),
            )
        ).all()
        for q in questions[:MAX_PRIOR_QUESTIONS]:
            prior_questions_data.append(
                {
                    "question": q.question[:MAX_PRIOR_QUESTION_LENGTH].strip(),
                    "category": q.category,
                    "difficulty": q.difficulty,
                    "reflection": (q.reflection or "")[
                        :MAX_PRIOR_REFLECTION_LENGTH
                    ].strip(),
                    "answer_notes": (q.answer_notes or "")[
                        :MAX_PRIOR_ANSWER_LENGTH
                    ].strip(),
                }
            )

    job_description = ""
    if application.job and application.job.description:
        job_description = application.job.description[:MAX_JOB_DESCRIPTION_LENGTH].strip()

    resume_label = ""
    resume_skills: list[str] = []
    if application.resume:
        resume_label = (application.resume.label or "").strip()[:100]
        resume_skills = _bounded_resume_skills(application.resume.skills)

    return {
        "interview": {
            "title": (interview.title or "").strip(),
            "interview_type": (interview.interview_type or "").strip(),
            "duration_minutes": interview.duration_minutes or 60,
            "scheduled_at": _serialize_scheduled_at(interview),
            # A bounded role title can calibrate interview depth. Third-party names
            # and email addresses are intentionally excluded from provider context.
            "interviewer_title": (interview.interviewer_title or "").strip()[:200],
            "preparation_notes": (interview.preparation_notes or "")[
                :MAX_PREPARATION_NOTES_LENGTH
            ].strip(),
        },
        "application": {
            "company_name": (application.job.company_name or "").strip() if application.job else "",
            "job_title": (application.job.title or "").strip() if application.job else "",
            "notes": (application.notes or "")[:MAX_APPLICATION_NOTES_LENGTH].strip(),
            "job_description": job_description,
            "resume_label": resume_label,
            "resume_skills": resume_skills,
        },
        "prior_questions": prior_questions_data,
    }


def compute_context_hash(context: dict[str, Any]) -> str:
    """Deterministically hash the canonical normalized context without volatile fields."""
    canonical = {
        "interview": {
            "title": context["interview"]["title"],
            "interview_type": context["interview"]["interview_type"],
            "duration_minutes": context["interview"]["duration_minutes"],
            "scheduled_at": context["interview"]["scheduled_at"],
            "interviewer_title": context["interview"]["interviewer_title"],
            "preparation_notes": context["interview"]["preparation_notes"],
        },
        "application": {
            "company_name": context["application"]["company_name"],
            "job_title": context["application"]["job_title"],
            "notes": context["application"]["notes"],
            "job_description": context["application"]["job_description"],
            "resume_label": context["application"]["resume_label"],
            "resume_skills": context["application"]["resume_skills"],
        },
        "prior_questions": [
            {
                "question": q["question"],
                "category": q["category"],
                "difficulty": q["difficulty"],
                "reflection": q["reflection"],
                "answer_notes": q["answer_notes"],
            }
            for q in context.get("prior_questions", [])
        ],
    }
    canonical_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def _generate_deterministic_fallback(context: dict[str, Any]) -> InterviewPrepOutput:
    """Deterministic fallback producing a fully compliant InterviewPrepOutput."""
    app_info = context.get("application", {})
    int_info = context.get("interview", {})

    company = app_info.get("company_name") or "the company"
    role = app_info.get("job_title") or "the role"
    interview_type = int_info.get("interview_type") or "technical"

    priorities = [
        PrepPriority(
            title=f"Review core requirements for {role} at {company}",
            reason=f"Aligning your background directly with key {role} expectations improves conversational clarity.",
            recommended_action="Map 3-4 of your primary achievements directly against the stated responsibilities.",
            priority="high",
        ),
        PrepPriority(
            title=f"Prepare STAR stories tailored for {interview_type} evaluation",
            reason=f"{interview_type.replace('_', ' ').capitalize()} interviews require concise, structured evidence of impact.",
            recommended_action="Rehearse examples highlighting problem diagnosis, ownership, and measurable results.",
            priority="high" if interview_type in ("behavioral", "hiring_manager") else "medium",
        ),
        PrepPriority(
            title=f"Formulate questions to ask the interviewer at {company}",
            reason="Shows strategic curiosity about team dynamics, tech stack trade-offs, and immediate roadmaps.",
            recommended_action="Select 3-5 specific questions focused on engineering practices and team goals.",
            priority="medium",
        ),
    ]

    topics = [
        TechnicalTopic(
            topic="System Architecture & Scalability",
            reason="Common focal area for senior engineering and technical assessments.",
            recommended_actions=[
                "Review high-level architectural patterns and component decoupling.",
                "Be ready to articulate trade-offs between latency, throughput, and consistency.",
            ],
        ),
        TechnicalTopic(
            topic="Core Problem Solving & Implementation",
            reason="Evaluates structured reasoning and edge-case awareness.",
            recommended_actions=[
                "Practice breaking down complex requirements into testable steps.",
                "Review time and space complexity trade-offs.",
            ],
        ),
    ]

    stories = [
        BehavioralStory(
            story_or_evidence="Complex technical initiative delivered under shifting constraints",
            relevance="Demonstrates ownership, resourcefulness, and technical leadership.",
            suggested_angle="Focus on initial ambiguity, trade-offs made, and concrete business or team impact.",
        ),
        BehavioralStory(
            story_or_evidence="Resolving an architectural or engineering disagreement within the team",
            relevance="Demonstrates communication maturity, collaboration, and data-driven pragmatism.",
            suggested_angle="Highlight active listening, evaluation of alternatives, and arriving at consensus.",
        ),
    ]

    likely_q: list[LikelyQuestion] = []
    if interview_type in ("coding", "technical"):
        likely_q.append(
            LikelyQuestion(
                question="Can you walk through your approach to solving an optimization or data structure challenge?",
                category="coding",
                reason="Evaluates methodical problem breakdown and edge case consideration.",
                recommended_angle="State assumptions, propose a brute force approach, then optimize with clear time/space bounds.",
            )
        )
        likely_q.append(
            LikelyQuestion(
                question="What was the most challenging bug or technical roadblock in your recent work and how did you resolve it?",
                category="technical",
                reason="Tests depth of troubleshooting and root-cause analysis.",
                recommended_angle="Explain diagnosis methodology, tools used, and steps taken to prevent recurrence.",
            )
        )
    elif interview_type == "system_design":
        likely_q.append(
            LikelyQuestion(
                question="How would you design a distributed cache with high availability and partition tolerance?",
                category="system_design",
                reason="Evaluates scalability patterns and consistency trade-offs.",
                recommended_angle="Scope functional and non-functional requirements before detailing data flow and storage choices.",
            )
        )
    else:
        likely_q.append(
            LikelyQuestion(
                question="Tell me about a time you had to adapt quickly to unexpected project requirement changes.",
                category="behavioral",
                reason="Measures adaptability, communication, and resilience under change.",
                recommended_angle="Structure response with STAR: situation, task, action taken, and measurable resolution.",
            )
        )

    likely_q.append(
        LikelyQuestion(
            question=f"Why are you interested in joining {company} as a {role} at this stage?",
            category="culture",
            reason="Assesses alignment with team mission and career progression goals.",
            recommended_angle="Connect company mission or engineering problems with your personal career trajectory.",
        )
    )

    questions_to_ask = [
        f"What are the biggest technical challenges the {role} team is tackling over the next two quarters?",
        "How does the engineering organization balance technical debt remediation with feature delivery?",
        "What does outstanding performance look like in this role during the first 90 days?",
    ]

    gaps: list[GapWarning] = []
    if not app_info.get("job_description"):
        gaps.append(
            GapWarning(
                area="Job Description Depth",
                reason="Limited job description context was stored on the application.",
                suggested_action="Review the original job posting or ask the recruiter for the team's specific focus areas.",
                confidence=0.7,
            )
        )
    if not int_info.get("interviewer_title"):
        gaps.append(
            GapWarning(
                area="Interviewer Role Context",
                reason="The interviewer's specific role or title is not yet recorded.",
                suggested_action="Confirm the interviewer's role with your recruiter to better calibrate technical depth.",
                confidence=0.8,
            )
        )

    limitations = [
        "Generated using deterministic baseline as AI assistance is in basic mode or platform quota is depleted.",
        "Preparation guidance reflects general role heuristics and should be tailored to specific recruiter advice.",
    ]
    scheduled_at = int_info.get("scheduled_at")
    if scheduled_at and scheduled_at.get("limitation"):
        limitations.append(scheduled_at["limitation"])

    readiness = ReadinessAssessment(
        score=None,
        summary=(
            f"Based on the available preparation context for {role} at {company}, "
            "review core role requirements and practice structured STAR responses. "
            "Quantitative readiness scoring is omitted in deterministic baseline mode."
        ),
        breakdown=ReadinessBreakdown(
            technical_depth=None,
            role_context=None,
            behavioral_examples=None,
            logistics_and_preparation=70 if int_info.get("scheduled_at") else None,
        ),
        limitations=[
            "Score unavailable: generated in deterministic fallback mode with limited context.",
            "Readiness reflects preparation context, not a Job Match Score or guarantee of interview success.",
            *(
                [scheduled_at["limitation"]]
                if scheduled_at and scheduled_at.get("limitation")
                else []
            ),
        ],
    )

    return InterviewPrepOutput(
        summary=(
            f"Structured preparation plan for {role} interview at {company}. "
            f"Focus on {interview_type.replace('_', ' ')} competencies, core role alignment, and articulate communication."
        ),
        preparation_priorities=priorities,
        technical_topics=topics,
        behavioral_stories=stories,
        likely_questions=likely_q,
        questions_to_ask=questions_to_ask,
        gap_warnings=gaps,
        limitations_or_uncertainties=limitations,
        readiness=readiness,
    )


def _call_llm_for_prep(
    api_key: str,
    base_url: str | None,
    model: str,
    context: dict[str, Any],
) -> tuple[InterviewPrepOutput, int]:
    """Invoke LLM using structured outputs with explicit timeout."""
    client = OpenAI(api_key=api_key, base_url=base_url, timeout=30.0)
    system_prompt = (
        "You are an expert technical interview coach and career advisor. "
        "Given the provided interview details, company, role, job description excerpt, "
        "candidate resume skills, and prior questions from earlier rounds, generate a "
        "comprehensive, actionable interview preparation plan and readiness assessment.\n"
        "Follow these strict readiness assessment rules:\n"
        "1. Readiness means preparation for this specific interview stage/time, NOT an overall Job Match Score.\n"
        "2. Readiness must never be presented as a guarantee of passing or interview success.\n"
        "3. Use objective, constructive language such as 'Based on the available preparation context' "
        "and 'Consider reviewing'. Do not make claims like 'You will pass' or 'You are not qualified'.\n"
        "4. If context on a dimension is insufficient, set that dimension score to null and state the limitation.\n"
        "5. All non-null scores must be integers between 0 and 100. Confidence values must be 0.0 to 1.0."
    )
    user_content = json.dumps(context, ensure_ascii=False, separators=(",", ":"))

    response = client.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        response_format=InterviewPrepOutput,
    )
    parsed = response.choices[0].message.parsed
    tokens_used = response.usage.total_tokens if response.usage else 0
    if parsed is None:
        return _generate_deterministic_fallback(context), tokens_used
    return parsed, tokens_used


def generate_interview_prep(
    db: Session,
    current_user: User,
    interview: Interview,
    application: Application,
) -> tuple[AISuggestion, bool]:
    """Generate interview preparation plan with BYOK -> platform -> fallback hierarchy."""
    context = build_minimized_context(db, application, interview)
    context_hash = compute_context_hash(context)

    # Each explicit generation creates an independent draft, even when context is unchanged.
    mode, _ = get_extraction_mode(db, current_user.id)
    prep_output: InterviewPrepOutput | None = None
    provider_label = "fallback"
    model_version = "deterministic-v1"

    if mode != "basic":
        if mode == "byok":
            credential = _get_byok_credential(db, current_user.id)
            if credential:
                api_key = decrypt_secret(credential.encrypted_api_key)
                config = PROVIDER_CONFIGS.get(credential.provider, PROVIDER_CONFIGS["openai"])
                base_url = config["base_url"]
                model = config["model"]
                candidate_provider = f"byok_{credential.provider}"
            else:
                api_key = None
                base_url = None
                model = ""
                candidate_provider = ""
        else:
            provider = _get_active_provider()
            api_key = provider["api_key"]
            base_url = provider["base_url"]
            model = provider["model"]
            candidate_provider = f"platform_{provider['name']}"

        if api_key:
            try:
                prep_output, tokens_used = _call_llm_for_prep(
                    api_key=api_key,
                    base_url=base_url,
                    model=model,
                    context=context,
                )
                provider_label = candidate_provider
                model_version = model

                # Log quota usage only on successful LLM invocation
                db.add(
                    UsageLog(
                        user_id=current_user.id,
                        provider=provider_label,
                        action="interview_prep_generate",
                        tokens_used=tokens_used,
                    )
                )
                db.commit()
            except Exception:
                prep_output = None

    # Fallback to deterministic generation if LLM was skipped or failed
    if prep_output is None:
        prep_output = _generate_deterministic_fallback(context)
        provider_label = "fallback"
        model_version = "deterministic-v1"

    confidence = None
    if prep_output.readiness.score is not None:
        confidence = round(prep_output.readiness.score / 100.0, 2)

    rationale = prep_output.summary[:500] if prep_output.summary else None

    suggestion = AISuggestion(
        user_id=current_user.id,
        interview_id=interview.id,
        entity_type="interview",
        entity_id=interview.id,
        suggestion_type=SUGGESTION_TYPE,
        proposed_value=prep_output.model_dump(mode="json"),
        confidence=confidence,
        rationale=rationale,
        model_provider=provider_label,
        model_version=model_version,
        prompt_version=PROMPT_VERSION,
        output_schema_version=OUTPUT_SCHEMA_VERSION,
        input_snapshot_hash=context_hash,
        status="pending",
    )

    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return suggestion, True


def resolve_interview_prep_suggestion(
    db: Session,
    suggestion: AISuggestion,
    payload: InterviewPrepResolveRequest,
) -> AISuggestion:
    """Resolve a pending interview preparation suggestion with human-in-the-loop control."""
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Only pending suggestions can be resolved (current: {suggestion.status})",
        )

    resolved_dict: dict[str, Any] | None = None
    if payload.status == "accepted":
        suggestion.status = "accepted"
        if payload.resolved_value is not None:
            resolved_dict = payload.resolved_value.model_dump(mode="json")
        else:
            resolved_dict = InterviewPrepOutput.model_validate(
                suggestion.proposed_value
            ).model_dump(mode="json")
        suggestion.resolved_value = resolved_dict
        suggestion.resolved_at = utcnow()
    elif payload.status == "edited":
        if payload.resolved_value is None:
            raise HTTPException(
                status_code=422,
                detail="resolved_value is required when status is 'edited'",
            )
        suggestion.status = "edited"
        resolved_dict = payload.resolved_value.model_dump(mode="json")
        suggestion.resolved_value = resolved_dict
        suggestion.resolved_at = utcnow()
    elif payload.status == "rejected":
        suggestion.status = "rejected"
        suggestion.resolved_at = utcnow()

    suggestion.updated_at = utcnow()
    db.commit()
    db.refresh(suggestion)
    return suggestion
