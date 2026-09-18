import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    AISuggestion,
    Application,
    ApplicationContact,
    Contact,
    Interview,
    InterviewParticipant,
    InterviewQuestion,
    Job,
    User,
    utcnow,
)
from app.schemas import (
    AISuggestionOut,
    AISuggestionStatus,
    FastCaptureRequest,
    InterviewCreate,
    InterviewExtraction,
    InterviewOut,
    InterviewOutcomeAnalysisOutput,
    InterviewOutcomeResolveRequest,
    InterviewParticipantOut,
    InterviewPrepOutput,
    InterviewPrepResolveRequest,
    InterviewQuestionCreate,
    InterviewQuestionOut,
    InterviewQuestionUpdate,
    InterviewUpdate,
    ParticipantCreate,
    ParticipantUpdate,
    UpcomingInterviewOut,
)
from app.services.interview_extractor import extract_interview
from app.services.interview_prep import (
    generate_interview_prep,
    resolve_interview_prep_suggestion,
)
from app.services.interview_outcome import (
    generate_interview_outcome,
    resolve_interview_outcome_suggestion,
)

router = APIRouter(tags=["interviews"])


def _get_owned_application(
    application_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> Application:
    application = db.scalar(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _get_owned_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> Interview:
    _get_owned_application(application_id, current_user, db)
    interview = db.scalar(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.application_id == application_id,
        )
    )
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


def _get_owned_question(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> InterviewQuestion:
    _get_owned_interview(application_id, interview_id, current_user, db)
    question = db.scalar(
        select(InterviewQuestion).where(
            InterviewQuestion.id == question_id,
            InterviewQuestion.interview_id == interview_id,
        )
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def _get_owned_suggestion(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> tuple[Interview, AISuggestion]:
    interview = _get_owned_interview(application_id, interview_id, current_user, db)
    suggestion = db.scalar(
        select(AISuggestion).where(
            AISuggestion.id == suggestion_id,
            AISuggestion.interview_id == interview_id,
            AISuggestion.user_id == current_user.id,
        )
    )
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return interview, suggestion


def _validate_prep_suggestion(suggestion: AISuggestion) -> AISuggestion:
    """Reject malformed JSONB before it reaches the prep response contract."""
    InterviewPrepOutput.model_validate(suggestion.proposed_value)
    if suggestion.resolved_value is not None:
        InterviewPrepOutput.model_validate(suggestion.resolved_value)
    return suggestion


def _validate_outcome_suggestion(suggestion: AISuggestion) -> AISuggestion:
    """Reject malformed JSONB before it reaches the outcome response contract."""
    InterviewOutcomeAnalysisOutput.model_validate(suggestion.proposed_value)
    if suggestion.resolved_value is not None:
        InterviewOutcomeAnalysisOutput.model_validate(suggestion.resolved_value)
    return suggestion


@router.get(
    "/applications/{application_id}/interviews",
    response_model=list[InterviewOut],
)
def list_application_interviews(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Interview]:
    _get_owned_application(application_id, current_user, db)

    return list(
        db.scalars(
            select(Interview)
            .where(Interview.application_id == application_id)
            .order_by(Interview.round.asc(), Interview.scheduled_at.asc().nullslast())
        )
    )


@router.post(
    "/applications/{application_id}/interviews",
    response_model=InterviewOut,
    status_code=201,
)
def create_application_interview(
    application_id: uuid.UUID,
    payload: InterviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Interview:
    _get_owned_application(application_id, current_user, db)

    create_data = payload.model_dump()
    # If round is default 1 and other interviews exist, calculate round if user didn't explicitly override
    existing_count = db.scalar(
        select(func.count(Interview.id)).where(
            Interview.application_id == application_id
        )
    ) or 0

    if "round" not in payload.model_fields_set:
        create_data["round"] = existing_count + 1

    interview = Interview(
        application_id=application_id,
        **create_data,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.get(
    "/applications/{application_id}/interviews/{interview_id}/participants",
    response_model=list[InterviewParticipantOut],
)
def list_interview_participants(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InterviewParticipant]:
    _get_owned_interview(application_id, interview_id, current_user, db)
    return list(
        db.scalars(
            select(InterviewParticipant)
            .where(InterviewParticipant.interview_id == interview_id)
            .order_by(
                InterviewParticipant.created_at.asc(),
                InterviewParticipant.id.asc(),
            )
        )
    )


@router.post(
    "/applications/{application_id}/interviews/{interview_id}/participants",
    response_model=InterviewParticipantOut,
    status_code=201,
)
def add_interview_participant(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: ParticipantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterviewParticipant:
    _get_owned_interview(application_id, interview_id, current_user, db)
    contact = db.scalar(
        select(Contact).where(
            Contact.id == payload.contact_id,
            Contact.user_id == current_user.id,
        )
    )
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    existing = db.scalar(
        select(InterviewParticipant).where(
            InterviewParticipant.interview_id == interview_id,
            InterviewParticipant.contact_id == payload.contact_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Contact is already a participant")

    application_contact = db.scalar(
        select(ApplicationContact).where(
            ApplicationContact.application_id == application_id,
            ApplicationContact.contact_id == payload.contact_id,
        )
    )
    if application_contact is None:
        db.add(
            ApplicationContact(
                application_id=application_id,
                contact_id=contact.id,
                name=contact.name,
                contact_type="interviewer" if payload.role == "interviewer" else "other",
                email=contact.email,
                linkedin_url=contact.linkedin_url,
                notes=None,
            )
        )

    participant = InterviewParticipant(
        interview_id=interview_id,
        contact_id=payload.contact_id,
        role=payload.role,
        contact=contact,
    )
    db.add(participant)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Contact is already a participant",
        ) from error
    db.refresh(participant)
    return participant


@router.patch(
    "/applications/{application_id}/interviews/{interview_id}/participants/{participant_id}",
    response_model=InterviewParticipantOut,
)
def update_interview_participant(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: ParticipantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterviewParticipant:
    _get_owned_interview(application_id, interview_id, current_user, db)
    participant = db.scalar(
        select(InterviewParticipant).where(
            InterviewParticipant.id == participant_id,
            InterviewParticipant.interview_id == interview_id,
        )
    )
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant.role = payload.role
    db.commit()
    db.refresh(participant)
    return participant


@router.delete(
    "/applications/{application_id}/interviews/{interview_id}/participants/{participant_id}",
    status_code=204,
)
def remove_interview_participant(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    participant_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _get_owned_interview(application_id, interview_id, current_user, db)
    participant = db.scalar(
        select(InterviewParticipant).where(
            InterviewParticipant.id == participant_id,
            InterviewParticipant.interview_id == interview_id,
        )
    )
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    db.delete(participant)
    db.commit()
    return Response(status_code=204)


@router.get(
    "/applications/{application_id}/interviews/{interview_id}",
    response_model=InterviewOut,
)
def get_application_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Interview:
    return _get_owned_interview(application_id, interview_id, current_user, db)


@router.patch(
    "/applications/{application_id}/interviews/{interview_id}",
    response_model=InterviewOut,
)
def update_application_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Interview:
    interview = _get_owned_interview(application_id, interview_id, current_user, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(interview, field, value)

    interview.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(interview)
    return interview


@router.delete(
    "/applications/{application_id}/interviews/{interview_id}",
    status_code=204,
)
def delete_application_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    interview = _get_owned_interview(application_id, interview_id, current_user, db)
    db.delete(interview)
    db.commit()
    return Response(status_code=204)


@router.get(
    "/applications/{application_id}/interviews/{interview_id}/questions",
    response_model=list[InterviewQuestionOut],
)
def list_interview_questions(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InterviewQuestion]:
    _get_owned_interview(application_id, interview_id, current_user, db)

    return list(
        db.scalars(
            select(InterviewQuestion)
            .where(InterviewQuestion.interview_id == interview_id)
            .order_by(
                InterviewQuestion.asked_at.asc().nullslast(),
                InterviewQuestion.created_at.asc(),
            )
        )
    )


@router.post(
    "/applications/{application_id}/interviews/{interview_id}/questions",
    response_model=InterviewQuestionOut,
    status_code=201,
)
def create_interview_question(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterviewQuestion:
    _get_owned_interview(application_id, interview_id, current_user, db)

    question = InterviewQuestion(
        interview_id=interview_id,
        **payload.model_dump(),
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.patch(
    "/applications/{application_id}/interviews/{interview_id}/questions/{question_id}",
    response_model=InterviewQuestionOut,
)
def update_interview_question(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    question_id: uuid.UUID,
    payload: InterviewQuestionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterviewQuestion:
    question = _get_owned_question(
        application_id, interview_id, question_id, current_user, db
    )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    question.updated_at = utcnow()
    db.commit()
    db.refresh(question)
    return question


@router.delete(
    "/applications/{application_id}/interviews/{interview_id}/questions/{question_id}",
    status_code=204,
)
def delete_interview_question(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    question = _get_owned_question(
        application_id, interview_id, question_id, current_user, db
    )
    db.delete(question)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/applications/{application_id}/interviews/{interview_id}/prep/generate",
    response_model=AISuggestionOut,
)
def generate_interview_prep_plan(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISuggestion:
    application = _get_owned_application(application_id, current_user, db)
    interview = _get_owned_interview(application_id, interview_id, current_user, db)

    suggestion, is_new = generate_interview_prep(db, current_user, interview, application)
    if is_new:
        response.status_code = 201
    else:
        response.status_code = 200
    return _validate_prep_suggestion(suggestion)


@router.get(
    "/applications/{application_id}/interviews/{interview_id}/prep",
    response_model=list[AISuggestionOut],
)
def list_interview_prep_suggestions(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    status_filter: AISuggestionStatus | None = Query(
        default=None,
        alias="status",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AISuggestion]:
    """Return all prep suggestions newest-first unless a status is supplied."""
    _get_owned_interview(application_id, interview_id, current_user, db)

    query = (
        select(AISuggestion)
        .where(
            AISuggestion.interview_id == interview_id,
            AISuggestion.user_id == current_user.id,
            AISuggestion.suggestion_type == "interview_prep",
        )
        .order_by(AISuggestion.created_at.desc(), AISuggestion.id.desc())
    )
    if status_filter:
        query = query.where(AISuggestion.status == status_filter)

    suggestions = list(db.scalars(query).all())
    return [_validate_prep_suggestion(item) for item in suggestions]


@router.post(
    "/applications/{application_id}/interviews/{interview_id}/prep/{suggestion_id}/resolve",
    response_model=AISuggestionOut,
)
def resolve_prep_suggestion(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    payload: InterviewPrepResolveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISuggestion:
    _interview, suggestion = _get_owned_suggestion(
        application_id, interview_id, suggestion_id, current_user, db
    )

    resolved = resolve_interview_prep_suggestion(
        db=db,
        suggestion=suggestion,
        payload=payload,
    )
    return _validate_prep_suggestion(resolved)


@router.delete(
    "/applications/{application_id}/interviews/{interview_id}/prep/{suggestion_id}",
    status_code=204,
)
def delete_prep_suggestion(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _interview, suggestion = _get_owned_suggestion(
        application_id, interview_id, suggestion_id, current_user, db
    )
    if suggestion.suggestion_type != "interview_prep":
        raise HTTPException(status_code=404, detail="Suggestion not found")
    db.delete(suggestion)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/applications/{application_id}/interviews/{interview_id}/outcome-analysis/generate",
    response_model=AISuggestionOut,
)
def generate_interview_outcome_analysis(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISuggestion:
    application = _get_owned_application(application_id, current_user, db)
    interview = _get_owned_interview(application_id, interview_id, current_user, db)
    suggestion, is_new = generate_interview_outcome(
        db, current_user, interview, application
    )
    response.status_code = 201 if is_new else 200
    return _validate_outcome_suggestion(suggestion)


@router.get(
    "/applications/{application_id}/interviews/{interview_id}/outcome-analysis",
    response_model=list[AISuggestionOut],
)
def list_interview_outcome_analyses(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    status_filter: AISuggestionStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AISuggestion]:
    _get_owned_interview(application_id, interview_id, current_user, db)
    query = (
        select(AISuggestion)
        .where(
            AISuggestion.interview_id == interview_id,
            AISuggestion.user_id == current_user.id,
            AISuggestion.suggestion_type == "interview_outcome_analysis",
        )
        .order_by(AISuggestion.created_at.desc(), AISuggestion.id.desc())
    )
    if status_filter:
        query = query.where(AISuggestion.status == status_filter)
    return [_validate_outcome_suggestion(item) for item in db.scalars(query).all()]


@router.post(
    "/applications/{application_id}/interviews/{interview_id}/outcome-analysis/{suggestion_id}/resolve",
    response_model=AISuggestionOut,
)
def resolve_interview_outcome_analysis(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    payload: InterviewOutcomeResolveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISuggestion:
    _interview, suggestion = _get_owned_suggestion(
        application_id, interview_id, suggestion_id, current_user, db
    )
    if suggestion.suggestion_type != "interview_outcome_analysis":
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return _validate_outcome_suggestion(
        resolve_interview_outcome_suggestion(db, suggestion, payload)
    )


@router.delete(
    "/applications/{application_id}/interviews/{interview_id}/outcome-analysis/{suggestion_id}",
    status_code=204,
)
def delete_interview_outcome_analysis(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _interview, suggestion = _get_owned_suggestion(
        application_id, interview_id, suggestion_id, current_user, db
    )
    if suggestion.suggestion_type != "interview_outcome_analysis":
        raise HTTPException(status_code=404, detail="Suggestion not found")
    db.delete(suggestion)
    db.commit()
    return Response(status_code=204)


@router.get(
    "/interviews/upcoming",
    response_model=list[UpcomingInterviewOut],
)
def list_upcoming_interviews(
    days: int = Query(default=30, ge=1, le=365),
    include_past: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return upcoming interviews for current user across all applications."""
    now = datetime.utcnow()
    max_date = now + timedelta(days=days)

    statement = (
        select(Interview, Job)
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(Application.user_id == current_user.id)
    )

    if not include_past:
        statement = statement.where(
            Interview.scheduled_at.is_not(None),
            Interview.scheduled_at >= now - timedelta(hours=12),
            Interview.scheduled_at <= max_date,
        )
    else:
        statement = statement.where(Interview.scheduled_at.is_not(None))

    rows = db.execute(
        statement.order_by(Interview.scheduled_at.asc())
    ).all()

    results = []
    for interview, job in rows:
        item = {
            "id": interview.id,
            "application_id": interview.application_id,
            "round": interview.round,
            "title": interview.title,
            "interview_type": interview.interview_type,
            "scheduled_at": interview.scheduled_at,
            "duration_minutes": interview.duration_minutes,
            "timezone": interview.timezone,
            "status": interview.status,
            "result": interview.result,
            "interviewer_name": interview.interviewer_name,
            "interviewer_title": interview.interviewer_title,
            "interviewer_email": interview.interviewer_email,
            "meeting_url": interview.meeting_url,
            "location": interview.location,
            "notes": interview.notes,
            "preparation_notes": interview.preparation_notes,
            "created_at": interview.created_at,
            "updated_at": interview.updated_at,
            "company_name": job.company_name,
            "job_title": job.title,
        }
        results.append(item)

    return results


@router.post(
    "/interviews/fast-capture",
    response_model=InterviewExtraction,
)
def fast_capture_interview(
    payload: FastCaptureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterviewExtraction:
    """Extract structured interview details from unstructured text for user confirmation."""
    if not payload.raw_text.strip():
        raise HTTPException(status_code=422, detail="Text cannot be empty")

    return extract_interview(
        db=db,
        user_id=current_user.id,
        raw_text=payload.raw_text,
        application_id=payload.application_id,
    )
