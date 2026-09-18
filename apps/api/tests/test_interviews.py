import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import (
    AISuggestion,
    Application,
    Interview,
    InterviewQuestion,
    Job,
    Resume,
    UsageLog,
    User,
)
from app.schemas import (
    AISuggestionOut,
    AnalysisScope,
    BehavioralStory,
    GapWarning,
    InterviewPrepOutput,
    InterviewOutcomeAnalysisOutput,
    LikelyQuestion,
    PrepPriority,
    ReadinessAssessment,
    ReadinessBreakdown,
    TechnicalTopic,
)
from app.services.interview_outcome import SAFE_LIMITATION
from app.services.interview_prep import (
    _generate_deterministic_fallback,
    build_minimized_context,
)


@pytest.fixture
def db_session() -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    app.dependency_overrides[get_db] = lambda: session

    try:
        yield session
    finally:
        app.dependency_overrides.pop(get_db, None)
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, email: str) -> dict[str, object]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct horse battery staple",
        },
    )
    assert response.status_code == 201
    return response.json()


def create_job(db_session: Session, *, title: str, company_name: str = "OpenAI") -> Job:
    job = Job(
        company_name=company_name,
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=title,
        application_url="https://example.test/apply",
        match_score=100,
    )
    db_session.add(job)
    db_session.flush()
    return job


def create_application(
    db_session: Session,
    *,
    user_id: uuid.UUID,
    title: str = "Software Engineer",
    company_name: str = "OpenAI",
) -> Application:
    job = create_job(db_session, title=title, company_name=company_name)
    application = Application(
        user_id=user_id,
        job_id=job.id,
        status="interviewing",
    )
    db_session.add(application)
    db_session.flush()
    return application


def outcome_output(*, questions_considered: int = 1) -> InterviewOutcomeAnalysisOutput:
    return InterviewOutcomeAnalysisOutput(
        grounded_observations=[
            {
                "observation": "The candidate recorded a specific debugging example.",
                "source_reference": "reflection",
                "evidence_summary": "The reflection describes isolating a database timeout.",
                "confidence": 0.9,
            }
        ],
        possible_strengths=[
            {
                "title": "Structured debugging",
                "explanation": "The recorded example may indicate a methodical approach.",
                "evidence_summary": "The reflection lists isolation and verification steps.",
                "confidence": 0.7,
            }
        ],
        possible_growth_areas=[],
        recurring_topics=[
            {
                "topic": "Debugging",
                "occurrence_context": "Observed within this interview only.",
                "confidence": 0.6,
            }
        ],
        recommended_actions=[
            {
                "action": "Rehearse the debugging example with a concise result.",
                "time_horizon": "before_next_interview",
                "rationale": "A concise result can make the recorded evidence clearer.",
                "related_topics": ["Debugging"],
            }
        ],
        suggested_follow_up_points=["Clarify the measured impact of the fix."],
        uncertainty_notes=["Employer feedback was not available."],
        limitations=[SAFE_LIMITATION, "Recurring-topic scope is this interview only."],
        analysis_scope=AnalysisScope(
            interviews_considered=1,
            questions_considered=questions_considered,
            notes_available=True,
            result_recorded=True,
            data_limitations=["Only the current interview was considered."],
        ),
    )


def test_interview_routes_require_authentication(client: TestClient) -> None:
    app_id = uuid.uuid4()
    int_id = uuid.uuid4()

    assert client.get(f"/applications/{app_id}/interviews").status_code == 401
    assert client.post(f"/applications/{app_id}/interviews", json={"title": "Test"}).status_code == 401
    assert client.get(f"/applications/{app_id}/interviews/{int_id}").status_code == 401
    assert client.patch(f"/applications/{app_id}/interviews/{int_id}", json={"title": "Updated"}).status_code == 401
    assert client.delete(f"/applications/{app_id}/interviews/{int_id}").status_code == 401
    assert client.get("/interviews/upcoming").status_code == 401
    assert client.post("/interviews/fast-capture", json={"raw_text": "hello"}).status_code == 401


def test_create_and_list_application_interviews(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "interview-user1@example.test")
    app = create_application(db_session, user_id=user["id"])

    # Round 1 create
    resp1 = client.post(
        f"/applications/{app.id}/interviews",
        json={
            "title": "Recruiter Screen",
            "interview_type": "recruiter",
            "scheduled_at": "2026-09-18T11:00:00",
            "duration_minutes": 30,
            "status": "scheduled",
            "result": "pending",
            "interviewer_name": "Alice Recruiter",
            "meeting_url": "https://zoom.us/j/123456",
        },
    )
    assert resp1.status_code == 201
    int1 = resp1.json()
    assert int1["round"] == 1
    assert int1["title"] == "Recruiter Screen"
    assert int1["interview_type"] == "recruiter"
    assert int1["interviewer_name"] == "Alice Recruiter"
    assert int1["meeting_url"] == "https://zoom.us/j/123456"

    # Round 2 create (round should default to 2)
    resp2 = client.post(
        f"/applications/{app.id}/interviews",
        json={
            "title": "Technical Interview",
            "interview_type": "technical",
            "scheduled_at": "2026-09-24T14:00:00",
            "duration_minutes": 60,
            "interviewer_name": "John Smith",
            "interviewer_title": "Senior Software Engineer",
        },
    )
    assert resp2.status_code == 201
    int2 = resp2.json()
    assert int2["round"] == 2

    # List interviews
    list_resp = client.get(f"/applications/{app.id}/interviews")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 2
    assert items[0]["id"] == int1["id"]
    assert items[1]["id"] == int2["id"]


def test_update_interview_status_and_result(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "interview-user2@example.test")
    app = create_application(db_session, user_id=user["id"])

    created = client.post(
        f"/applications/{app.id}/interviews",
        json={
            "title": "Technical Interview",
            "interview_type": "coding",
            "scheduled_at": "2026-09-24T14:00:00",
        },
    ).json()

    # Update status to completed, result to passed, and add notes
    update_resp = client.patch(
        f"/applications/{app.id}/interviews/{created['id']}",
        json={
            "status": "completed",
            "result": "passed",
            "notes": "Solved 2 graph problems, good communication feedback.",
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["status"] == "completed"
    assert updated["result"] == "passed"
    assert updated["notes"] == "Solved 2 graph problems, good communication feedback."


def test_other_user_cannot_access_interviews(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "owner-interviews@example.test")
    application = create_application(db_session, user_id=owner["id"])
    interview = client.post(
        f"/applications/{application.id}/interviews",
        json={"title": "Private Round"},
    ).json()

    other_client = TestClient(app)
    try:
        register(other_client, "intruder-interviews@example.test")
        assert other_client.get(f"/applications/{application.id}/interviews").status_code == 404
        assert other_client.get(f"/applications/{application.id}/interviews/{interview['id']}").status_code == 404
        assert other_client.patch(
            f"/applications/{application.id}/interviews/{interview['id']}", json={"title": "Hacked"}
        ).status_code == 404
        assert other_client.delete(f"/applications/{application.id}/interviews/{interview['id']}").status_code == 404
    finally:
        other_client.close()


def test_delete_interview_and_cascade(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "delete-interviews@example.test")
    app = create_application(db_session, user_id=user["id"])
    interview = client.post(
        f"/applications/{app.id}/interviews",
        json={"title": "Round to delete"},
    ).json()

    del_resp = client.delete(f"/applications/{app.id}/interviews/{interview['id']}")
    assert del_resp.status_code == 204

    # Verify deleted
    assert client.get(f"/applications/{app.id}/interviews/{interview['id']}").status_code == 404


def test_list_upcoming_interviews(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "upcoming-user@example.test")
    app1 = create_application(db_session, user_id=user["id"], title="Backend Engineer", company_name="Stripe")
    app2 = create_application(db_session, user_id=user["id"], title="Fullstack Engineer", company_name="Airbnb")

    now = datetime.utcnow()
    tomorrow = (now + timedelta(days=1)).replace(microsecond=0)
    next_week = (now + timedelta(days=7)).replace(microsecond=0)

    client.post(
        f"/applications/{app1.id}/interviews",
        json={
            "title": "Stripe Recruiter Call",
            "interview_type": "recruiter",
            "scheduled_at": tomorrow.isoformat(),
            "duration_minutes": 30,
        },
    )

    client.post(
        f"/applications/{app2.id}/interviews",
        json={
            "title": "Airbnb Technical Round",
            "interview_type": "technical",
            "scheduled_at": next_week.isoformat(),
            "duration_minutes": 60,
        },
    )

    resp = client.get("/interviews/upcoming?days=30")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2
    assert items[0]["company_name"] == "Stripe"
    assert items[0]["job_title"] == "Backend Engineer"
    assert items[1]["company_name"] == "Airbnb"
    assert items[1]["job_title"] == "Fullstack Engineer"


def test_fast_capture_interview_deterministic_extraction(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "fastcapture-user@example.test")
    app = create_application(db_session, user_id=user["id"], title="Software Engineer", company_name="OpenAI")

    email_text = """
    Hi Max,

    We'd like to invite you to the next round.

    Technical Interview
    Thursday, September 24
    2:00 PM EST
    60 minutes

    You'll meet with John Smith,
    Senior Software Engineer.

    Zoom:
    https://zoom.us/j/9876543210

    Preparation notes: Review distributed systems and concurrency.
    """

    resp = client.post(
        "/interviews/fast-capture",
        json={
            "raw_text": email_text,
            "application_id": str(app.id),
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Technical Interview"
    assert data["interview_type"] == "technical"
    assert data["duration_minutes"] == 60
    assert data["interviewer_name"] == "John Smith"
    assert data["interviewer_title"] == "Senior Software Engineer"
    assert "zoom.us/j/9876543210" in data["meeting_url"]
    assert data["company"] == "OpenAI"
    assert data["role"] == "Software Engineer"
    assert data["timezone"] == "EST"
    assert data["scheduled_at"] is not None


def test_interview_question_model_creation_and_defaults(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "question-user@example.test")
    app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(
        application_id=app.id,
        title="Coding Round",
        interview_type="coding",
    )
    db_session.add(interview)
    db_session.flush()

    question = InterviewQuestion(
        interview_id=interview.id,
        question="Implement an LRU cache in O(1) time.",
        leetcode_url="https://leetcode.com/problems/lru-cache/",
    )
    db_session.add(question)
    db_session.flush()

    assert question.id is not None
    assert question.category == "technical"
    assert question.difficulty == "unknown"
    assert question.answer_notes is None
    assert question.reflection is None
    assert question.leetcode_url == "https://leetcode.com/problems/lru-cache/"
    assert question.asked_at is None
    assert question.created_at is not None
    assert question.created_at.tzinfo is not None
    assert question.updated_at is not None
    assert question.updated_at.tzinfo is not None
    assert question.interview_id == interview.id
    assert question in interview.questions


def test_ai_suggestion_model_creation_and_defaults(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "suggestion-user@example.test")
    user_id = uuid.UUID(user["id"])
    app = create_application(db_session, user_id=user_id)
    interview = Interview(
        application_id=app.id,
        title="System Design",
        interview_type="system_design",
    )
    db_session.add(interview)
    db_session.flush()

    suggestion = AISuggestion(
        user_id=user_id,
        interview_id=interview.id,
        suggestion_type="interview_prep",
        proposed_value={"readiness_score": 85, "topics": ["Rate Limiting", "Consistent Hashing"]},
        model_provider="openai",
        model_version="gpt-4o-mini",
        prompt_version="interview-prep-v1",
        output_schema_version="1.0",
        input_snapshot_hash="abc123hash456",
    )
    db_session.add(suggestion)
    db_session.flush()

    assert suggestion.id is not None
    assert suggestion.entity_type == "interview"
    assert suggestion.status == "pending"
    assert suggestion.confidence is None
    assert suggestion.rationale is None
    assert suggestion.resolved_value is None
    assert suggestion.resolved_at is None
    assert suggestion.created_at is not None
    assert suggestion.created_at.tzinfo is not None
    assert suggestion.updated_at is not None
    assert suggestion.updated_at.tzinfo is not None
    assert suggestion in interview.ai_suggestions
    owner = db_session.get(User, user_id)
    assert owner is not None
    assert suggestion in owner.ai_suggestions


def test_existing_interview_and_application_remain_readable(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "readable-user@example.test")
    app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(
        application_id=app.id,
        title="Screening Call",
        interview_type="recruiter",
    )
    db_session.add(interview)
    db_session.flush()

    db_session.expire_all()
    loaded_interview = db_session.get(Interview, interview.id)
    assert loaded_interview is not None
    assert loaded_interview.title == "Screening Call"
    assert loaded_interview.questions == []
    assert loaded_interview.ai_suggestions == []


def test_cascade_delete_interview_removes_questions_and_suggestions(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "cascade-user@example.test")
    user_id = uuid.UUID(user["id"])
    app = create_application(db_session, user_id=user_id)
    interview = Interview(
        application_id=app.id,
        title="Behavioral Round",
        interview_type="behavioral",
    )
    db_session.add(interview)
    db_session.flush()

    question = InterviewQuestion(
        interview_id=interview.id,
        question="Tell me about a time you handled a difficult conflict.",
        category="behavioral",
    )
    suggestion = AISuggestion(
        user_id=user_id,
        interview_id=interview.id,
        suggestion_type="interview_prep",
        proposed_value={"key": "val"},
        model_provider="openai",
        model_version="gpt-4o-mini",
        prompt_version="v1",
        output_schema_version="1.0",
        input_snapshot_hash="hash-cascade-123",
    )
    db_session.add_all([question, suggestion])
    db_session.flush()

    q_id = question.id
    s_id = suggestion.id

    db_session.delete(interview)
    db_session.flush()

    assert db_session.get(InterviewQuestion, q_id) is None
    assert db_session.get(AISuggestion, s_id) is None


def test_ai_suggestion_pending_idempotency_constraint(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "idempotency-user@example.test")
    user_id = uuid.UUID(user["id"])
    app = create_application(db_session, user_id=user_id)
    interview = Interview(
        application_id=app.id,
        title="Architecture Round",
        interview_type="system_design",
    )
    db_session.add(interview)
    db_session.flush()

    sugg1 = AISuggestion(
        user_id=user_id,
        interview_id=interview.id,
        suggestion_type="interview_prep",
        proposed_value={"version": 1},
        model_provider="openai",
        model_version="gpt-4o-mini",
        prompt_version="v1",
        output_schema_version="1.0",
        input_snapshot_hash="same-hash-12345",
        status="pending",
    )
    db_session.add(sugg1)
    db_session.flush()

    savepoint = db_session.begin_nested()
    sugg2 = AISuggestion(
        user_id=user_id,
        interview_id=interview.id,
        suggestion_type="interview_prep",
        proposed_value={"version": 2},
        model_provider="openai",
        model_version="gpt-4o-mini",
        prompt_version="v1",
        output_schema_version="1.0",
        input_snapshot_hash="same-hash-12345",
        status="pending",
    )
    db_session.add(sugg2)
    with pytest.raises(IntegrityError):
        db_session.flush()
    savepoint.rollback()

    # After first suggestion is accepted (or rejected/superseded), creating a new suggestion with same hash succeeds
    sugg1.status = "accepted"
    db_session.flush()

    sugg3 = AISuggestion(
        user_id=user_id,
        interview_id=interview.id,
        suggestion_type="interview_prep",
        proposed_value={"version": 3},
        model_provider="openai",
        model_version="gpt-4o-mini",
        prompt_version="v1",
        output_schema_version="1.0",
        input_snapshot_hash="same-hash-12345",
        status="pending",
    )
    db_session.add(sugg3)
    db_session.flush()
    assert sugg3.id is not None


def test_interview_question_routes_require_authentication(client: TestClient) -> None:
    app_id = uuid.uuid4()
    int_id = uuid.uuid4()
    q_id = uuid.uuid4()

    assert client.get(f"/applications/{app_id}/interviews/{int_id}/questions").status_code == 401
    assert client.post(f"/applications/{app_id}/interviews/{int_id}/questions", json={"question": "Q"}).status_code == 401
    assert client.patch(f"/applications/{app_id}/interviews/{int_id}/questions/{q_id}", json={"question": "Updated"}).status_code == 401
    assert client.delete(f"/applications/{app_id}/interviews/{int_id}/questions/{q_id}").status_code == 401


def test_interview_question_crud_lifecycle(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "q-crud-user@example.test")
    app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(
        application_id=app.id,
        title="Architecture Round",
        interview_type="system_design",
    )
    db_session.add(interview)
    db_session.flush()

    # Create Question
    create_resp = client.post(
        f"/applications/{app.id}/interviews/{interview.id}/questions",
        json={
            "question": "How do you scale WebSocket connections across multiple nodes?",
            "category": "system_design",
            "difficulty": "hard",
            "answer_notes": "Discussed Redis pub/sub and sticky load balancing.",
            "reflection": "Covered architecture well, could elaborate on heartbeat timeouts.",
            "leetcode_url": "https://leetcode.com/problems/lru-cache/",
            "asked_at": "2026-09-18T14:30:00Z",
        },
    )
    assert create_resp.status_code == 201
    q_data = create_resp.json()
    assert q_data["id"] is not None
    assert q_data["interview_id"] == str(interview.id)
    assert q_data["question"] == "How do you scale WebSocket connections across multiple nodes?"
    assert q_data["category"] == "system_design"
    assert q_data["difficulty"] == "hard"
    assert q_data["answer_notes"] == "Discussed Redis pub/sub and sticky load balancing."
    assert q_data["reflection"] == "Covered architecture well, could elaborate on heartbeat timeouts."
    assert q_data["leetcode_url"] == "https://leetcode.com/problems/lru-cache/"
    assert q_data["asked_at"] is not None
    assert q_data["created_at"] is not None

    q_id = q_data["id"]

    # List Questions
    list_resp = client.get(f"/applications/{app.id}/interviews/{interview.id}/questions")
    assert list_resp.status_code == 200
    questions = list_resp.json()
    assert len(questions) == 1
    assert questions[0]["id"] == q_id

    # Patch Question
    patch_resp = client.patch(
        f"/applications/{app.id}/interviews/{interview.id}/questions/{q_id}",
        json={
            "difficulty": "medium",
            "reflection": "Updated reflection notes with more metrics.",
        },
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["difficulty"] == "medium"
    assert updated["reflection"] == "Updated reflection notes with more metrics."
    assert updated["question"] == "How do you scale WebSocket connections across multiple nodes?"

    # Delete Question
    del_resp = client.delete(f"/applications/{app.id}/interviews/{interview.id}/questions/{q_id}")
    assert del_resp.status_code == 204

    # Verify deleted from list
    list_after = client.get(f"/applications/{app.id}/interviews/{interview.id}/questions")
    assert list_after.status_code == 200
    assert list_after.json() == []

    # Patch deleted question returns 404
    patch_after = client.patch(
        f"/applications/{app.id}/interviews/{interview.id}/questions/{q_id}",
        json={"question": "New"},
    )
    assert patch_after.status_code == 404

    # Delete deleted question returns 404
    del_after = client.delete(f"/applications/{app.id}/interviews/{interview.id}/questions/{q_id}")
    assert del_after.status_code == 404


def test_interview_question_cross_user_isolation(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "owner-q@example.test")
    owner_app = create_application(db_session, user_id=uuid.UUID(owner["id"]))
    interview = Interview(
        application_id=owner_app.id,
        title="Owner Interview",
        interview_type="technical",
    )
    db_session.add(interview)
    db_session.flush()

    created_q = client.post(
        f"/applications/{owner_app.id}/interviews/{interview.id}/questions",
        json={"question": "Explain consistency models in distributed databases."},
    ).json()
    q_id = created_q["id"]

    other_client = TestClient(app)
    try:
        register(other_client, "intruder-q@example.test")

        # User B cannot list User A's questions
        assert other_client.get(
            f"/applications/{owner_app.id}/interviews/{interview.id}/questions"
        ).status_code == 404

        # User B cannot add question to User A's interview
        assert other_client.post(
            f"/applications/{owner_app.id}/interviews/{interview.id}/questions",
            json={"question": "Malicious question"},
        ).status_code == 404

        # User B cannot patch User A's question
        assert other_client.patch(
            f"/applications/{owner_app.id}/interviews/{interview.id}/questions/{q_id}",
            json={"question": "Tampered"},
        ).status_code == 404

        # User B cannot delete User A's question
        assert other_client.delete(
            f"/applications/{owner_app.id}/interviews/{interview.id}/questions/{q_id}"
        ).status_code == 404
    finally:
        other_client.close()


def test_interview_question_hierarchy_mismatch_returns_404(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "mismatch-user@example.test")
    user_id = uuid.UUID(user["id"])
    app1 = create_application(db_session, user_id=user_id, company_name="Company 1")
    app2 = create_application(db_session, user_id=user_id, company_name="Company 2")

    int1 = Interview(application_id=app1.id, title="Int 1")
    int2 = Interview(application_id=app2.id, title="Int 2")
    db_session.add_all([int1, int2])
    db_session.flush()

    q1 = client.post(
        f"/applications/{app1.id}/interviews/{int1.id}/questions",
        json={"question": "Valid Question in Int 1"},
    ).json()

    # Wrong application_id for int1
    assert client.get(
        f"/applications/{app2.id}/interviews/{int1.id}/questions"
    ).status_code == 404
    assert client.patch(
        f"/applications/{app2.id}/interviews/{int1.id}/questions/{q1['id']}",
        json={"difficulty": "hard"},
    ).status_code == 404
    assert client.delete(
        f"/applications/{app2.id}/interviews/{int1.id}/questions/{q1['id']}"
    ).status_code == 404

    # Wrong interview_id for q1
    assert client.patch(
        f"/applications/{app1.id}/interviews/{int2.id}/questions/{q1['id']}",
        json={"difficulty": "hard"},
    ).status_code == 404
    assert client.delete(
        f"/applications/{app1.id}/interviews/{int2.id}/questions/{q1['id']}"
    ).status_code == 404

    # Non-existent question_id
    assert client.patch(
        f"/applications/{app1.id}/interviews/{int1.id}/questions/{uuid.uuid4()}",
        json={"difficulty": "hard"},
    ).status_code == 404


def test_interview_question_validation_rules(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "validation-q-user@example.test")
    app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(application_id=app.id, title="Coding Round")
    db_session.add(interview)
    db_session.flush()

    endpoint = f"/applications/{app.id}/interviews/{interview.id}/questions"

    # Blank / whitespace question rejected
    assert client.post(endpoint, json={"question": ""}).status_code == 422
    assert client.post(endpoint, json={"question": "   "}).status_code == 422

    # Invalid category rejected
    assert client.post(endpoint, json={"question": "Valid", "category": "super_technical"}).status_code == 422

    # Invalid difficulty rejected
    assert client.post(endpoint, json={"question": "Valid", "difficulty": "impossible"}).status_code == 422

    # LeetCode URL validations
    # Reject HTTP
    assert client.post(
        endpoint,
        json={"question": "Valid", "leetcode_url": "http://leetcode.com/problems/two-sum/"},
    ).status_code == 422

    # Reject non-LeetCode host
    assert client.post(
        endpoint,
        json={"question": "Valid", "leetcode_url": "https://hackerrank.com/problems/two-sum/"},
    ).status_code == 422

    # Reject no problem path
    assert client.post(
        endpoint,
        json={"question": "Valid", "leetcode_url": "https://leetcode.com/"},
    ).status_code == 422

    # Reject user credentials in URL
    assert client.post(
        endpoint,
        json={"question": "Valid", "leetcode_url": "https://admin:pass@leetcode.com/problems/two-sum/"},
    ).status_code == 422

    # Reject javascript scheme
    assert client.post(
        endpoint,
        json={"question": "Valid", "leetcode_url": "javascript:alert(1)"},
    ).status_code == 422

    # Accept valid HTTPS LeetCode URLs
    resp1 = client.post(
        endpoint,
        json={"question": "Two Sum", "leetcode_url": "https://leetcode.com/problems/two-sum/"},
    )
    assert resp1.status_code == 201
    assert resp1.json()["leetcode_url"] == "https://leetcode.com/problems/two-sum/"

    resp2 = client.post(
        endpoint,
        json={"question": "3Sum", "leetcode_url": "https://www.leetcode.com/problems/3sum/"},
    )
    assert resp2.status_code == 201
    assert resp2.json()["leetcode_url"] == "https://www.leetcode.com/problems/3sum/"

    # asked_at timezone awareness
    # Reject naive datetime
    assert client.post(
        endpoint,
        json={"question": "Valid", "asked_at": "2026-09-18T14:00:00"},
    ).status_code == 422

    # Accept timezone-aware datetime (UTC with Z)
    resp_tz_z = client.post(
        endpoint,
        json={"question": "Valid", "asked_at": "2026-09-18T14:00:00Z"},
    )
    assert resp_tz_z.status_code == 201
    assert resp_tz_z.json()["asked_at"] is not None

    # Accept timezone-aware datetime (with numeric offset)
    resp_tz_offset = client.post(
        endpoint,
        json={"question": "Valid", "asked_at": "2026-09-18T10:00:00-04:00"},
    )
    assert resp_tz_offset.status_code == 201
    assert resp_tz_offset.json()["asked_at"] is not None


def test_interview_question_list_ordering(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "order-q-user@example.test")
    app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(application_id=app.id, title="Round 1")
    db_session.add(interview)
    db_session.flush()

    endpoint = f"/applications/{app.id}/interviews/{interview.id}/questions"

    # Q1: asked_at 15:00
    q1 = client.post(
        endpoint,
        json={"question": "Question asked at 15:00", "asked_at": "2026-09-18T15:00:00Z"},
    ).json()

    # Q2: asked_at None (created earlier among nulls)
    q2 = client.post(
        endpoint,
        json={"question": "Question without asked_at (1st)"},
    ).json()

    # Q3: asked_at 11:00 (earliest asked_at)
    q3 = client.post(
        endpoint,
        json={"question": "Question asked at 11:00", "asked_at": "2026-09-18T11:00:00Z"},
    ).json()

    # Q4: asked_at None (created later among nulls)
    q4 = client.post(
        endpoint,
        json={"question": "Question without asked_at (2nd)"},
    ).json()

    list_resp = client.get(endpoint)
    assert list_resp.status_code == 200
    ordered_ids = [q["id"] for q in list_resp.json()]

    # Expected order:
    # 1. Q3 (11:00)
    # 2. Q1 (15:00)
    # 3. Q2 (None, created 1st)
    # 4. Q4 (None, created 2nd)
    assert ordered_ids == [q3["id"], q1["id"], q2["id"], q4["id"]]


def test_parent_interview_delete_cascades_to_questions(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "cascade-endpoint-user@example.test")
    app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(application_id=app.id, title="To Delete")
    db_session.add(interview)
    db_session.flush()

    q = client.post(
        f"/applications/{app.id}/interviews/{interview.id}/questions",
        json={"question": "Cascade target question"},
    ).json()

    # Delete parent interview
    del_resp = client.delete(f"/applications/{app.id}/interviews/{interview.id}")
    assert del_resp.status_code == 204

    # Verify interview is 404
    assert client.get(f"/applications/{app.id}/interviews/{interview.id}").status_code == 404

    # Verify question is 404
    assert client.get(
        f"/applications/{app.id}/interviews/{interview.id}/questions"
    ).status_code == 404


def test_interview_prep_routes_require_authentication(client: TestClient) -> None:
    app_id = uuid.uuid4()
    int_id = uuid.uuid4()
    sugg_id = uuid.uuid4()

    assert client.post(f"/applications/{app_id}/interviews/{int_id}/prep/generate").status_code == 401
    assert client.get(f"/applications/{app_id}/interviews/{int_id}/prep").status_code == 401
    assert client.post(f"/applications/{app_id}/interviews/{int_id}/prep/{sugg_id}/resolve", json={"status": "accepted"}).status_code == 401


def test_interview_prep_cross_user_isolation(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "prep-owner@example.test")
    owner_app = create_application(db_session, user_id=uuid.UUID(owner["id"]))
    interview = Interview(
        application_id=owner_app.id,
        title="Owner Technical Interview",
        interview_type="technical",
    )
    db_session.add(interview)
    db_session.flush()

    gen_resp = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate")
    assert gen_resp.status_code == 201
    sugg_id = gen_resp.json()["id"]

    other_client = TestClient(app)
    try:
        register(other_client, "prep-intruder@example.test")

        # User B cannot generate prep for User A's interview
        assert other_client.post(
            f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate"
        ).status_code == 404

        # User B cannot list User A's prep suggestions
        assert other_client.get(
            f"/applications/{owner_app.id}/interviews/{interview.id}/prep"
        ).status_code == 404

        # User B cannot resolve User A's suggestion
        assert other_client.post(
            f"/applications/{owner_app.id}/interviews/{interview.id}/prep/{sugg_id}/resolve",
            json={"status": "accepted"},
        ).status_code == 404
    finally:
        other_client.close()


def test_interview_prep_hierarchy_mismatch_returns_404(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "prep-hierarchy-user@example.test")
    user_id = uuid.UUID(user["id"])
    app1 = create_application(db_session, user_id=user_id, company_name="Company 1")
    app2 = create_application(db_session, user_id=user_id, company_name="Company 2")

    int1 = Interview(application_id=app1.id, title="Int 1")
    int2 = Interview(application_id=app2.id, title="Int 2")
    db_session.add_all([int1, int2])
    db_session.flush()

    gen_resp = client.post(f"/applications/{app1.id}/interviews/{int1.id}/prep/generate")
    assert gen_resp.status_code == 201
    sugg_id = gen_resp.json()["id"]

    # Wrong application_id for int1 generate
    assert client.post(
        f"/applications/{app2.id}/interviews/{int1.id}/prep/generate"
    ).status_code == 404

    # Wrong application_id for int1 list
    assert client.get(
        f"/applications/{app2.id}/interviews/{int1.id}/prep"
    ).status_code == 404

    # Wrong application_id for int1 resolve
    assert client.post(
        f"/applications/{app2.id}/interviews/{int1.id}/prep/{sugg_id}/resolve",
        json={"status": "accepted"},
    ).status_code == 404

    # Wrong interview_id for sugg_id resolve
    assert client.post(
        f"/applications/{app1.id}/interviews/{int2.id}/prep/{sugg_id}/resolve",
        json={"status": "accepted"},
    ).status_code == 404

    # Non-existent suggestion_id resolve
    assert client.post(
        f"/applications/{app1.id}/interviews/{int1.id}/prep/{uuid.uuid4()}/resolve",
        json={"status": "accepted"},
    ).status_code == 404


def test_interview_prep_structured_llm_generation_and_usage_logging(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = register(client, "prep-llm-user@example.test")
    user_id = uuid.UUID(user["id"])
    owner_app = create_application(
        db_session,
        user_id=user_id,
        title="Staff Software Engineer",
        company_name="OpenAI",
    )
    owner_app.job.description = "Design and maintain high-throughput distributed message brokers."
    db_session.flush()

    interview = Interview(
        application_id=owner_app.id,
        title="System Architecture Round",
        interview_type="system_design",
        duration_minutes=60,
    )
    db_session.add(interview)
    db_session.flush()

    mock_output = InterviewPrepOutput(
        summary="Targeted preparation plan for Staff Software Engineer at OpenAI.",
        preparation_priorities=[
            PrepPriority(
                title="Distributed Message Brokers",
                reason="Directly aligned with core role requirements",
                recommended_action="Review Kafka partition rebalance internals and zero-copy transfer",
                priority="high",
            )
        ],
        technical_topics=[
            TechnicalTopic(
                topic="Consensus Algorithms",
                reason="Crucial for distributed coordinator state",
                recommended_actions=["Review Raft log replication and election safety"],
            )
        ],
        behavioral_stories=[
            BehavioralStory(
                story_or_evidence="Architected multi-region failover cluster",
                relevance="Demonstrates system resilience and leadership",
                suggested_angle="Focus on SLO preservation and automated recovery validation",
            )
        ],
        likely_questions=[
            LikelyQuestion(
                question="How would you ensure strict ordering in a multi-partition topic during broker failover?",
                category="system_design",
                reason="Evaluates edge-case understanding in event streaming",
                recommended_angle="Discuss partition leader epochs, idempotent producers, and consumer offsets",
            )
        ],
        questions_to_ask=[
            "What is the current p99 replication latency across availability zones?"
        ],
        gap_warnings=[
            GapWarning(
                area="Network Topologies",
                reason="Limited context on cross-region link guarantees",
                suggested_action="Inquire about multi-region networking constraints during the interview",
                confidence=0.82,
            )
        ],
        limitations_or_uncertainties=[
            "Based on available job description excerpt and candidate profile"
        ],
        readiness=ReadinessAssessment(
            score=88,
            summary="Based on the available preparation context, candidate shows strong architectural alignment.",
            breakdown=ReadinessBreakdown(
                technical_depth=90,
                role_context=85,
                behavioral_examples=85,
                logistics_and_preparation=92,
            ),
            limitations=["Evaluation is limited to candidate-provided context"],
        ),
    )

    def mock_call_llm(api_key: str, base_url: str | None, model: str, context: dict) -> tuple[InterviewPrepOutput, int]:
        return mock_output, 240

    monkeypatch.setattr("app.services.interview_prep._call_llm_for_prep", mock_call_llm)

    # Save BYOK credential for user
    save_cred = client.post(
        "/settings/llm-credentials",
        json={
            "provider": "openai",
            "api_key": "sk-mock-openai-secret-key-12345",
        },
    )
    assert save_cred.status_code == 201

    # Generate preparation plan
    resp = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate")
    assert resp.status_code == 201
    body = resp.json()

    assert body["status"] == "pending"
    assert body["suggestion_type"] == "interview_prep"
    assert body["model_provider"] == "byok_openai"
    assert body["model_version"] == "gpt-4o-mini"
    assert body["prompt_version"] == "interview-prep-v1"
    assert body["output_schema_version"] == "1.0"
    assert body["confidence"] == 0.88
    assert body["proposed_value"]["summary"] == "Targeted preparation plan for Staff Software Engineer at OpenAI."
    assert body["proposed_value"]["readiness"]["score"] == 88

    # Verify UsageLog recorded
    db_session.expire_all()
    usage = db_session.scalar(
        select(UsageLog).where(
            UsageLog.user_id == user_id,
            UsageLog.action == "interview_prep_generate",
        )
    )
    assert usage is not None
    assert usage.tokens_used == 240
    assert usage.provider == "byok_openai"

    # Verify no raw secrets in response
    assert "sk-mock-openai" not in resp.text


def test_interview_prep_idempotency_and_quota_preservation(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = register(client, "prep-idempotency-user@example.test")
    user_id = uuid.UUID(user["id"])
    owner_app = create_application(db_session, user_id=user_id)
    interview = Interview(application_id=owner_app.id, title="Round 1")
    db_session.add(interview)
    db_session.flush()

    call_count = 0

    def mock_call_llm(api_key: str, base_url: str | None, model: str, context: dict) -> tuple[InterviewPrepOutput, int]:
        nonlocal call_count
        call_count += 1
        return InterviewPrepOutput(
            summary="Mock summary",
            readiness=ReadinessAssessment(
                score=75,
                summary="Ready",
                breakdown=ReadinessBreakdown(),
            ),
        ), 100

    monkeypatch.setattr("app.services.interview_prep._call_llm_for_prep", mock_call_llm)

    client.post(
        "/settings/llm-credentials",
        json={"provider": "openai", "api_key": "sk-byok-test-key-12345"},
    )

    # First request creates new suggestion (201 Created)
    resp1 = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate")
    assert resp1.status_code == 201
    sugg1_id = resp1.json()["id"]
    assert call_count == 1

    # Second request with identical context returns existing pending suggestion (200 OK)
    resp2 = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate")
    assert resp2.status_code == 200
    assert resp2.json()["id"] == sugg1_id
    # Provider was not called a second time
    assert call_count == 1

    # UsageLog count for this action remains 1
    db_session.expire_all()
    usage_count = db_session.scalar(
        select(func.count()).where(
            UsageLog.user_id == user_id,
            UsageLog.action == "interview_prep_generate",
        )
    )
    assert usage_count == 1


def test_interview_prep_deterministic_fallback_and_readiness_rules(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "prep-fallback-user@example.test")
    user_id = uuid.UUID(user["id"])
    owner_app = create_application(db_session, user_id=user_id, title="Backend Engineer", company_name="Stripe")
    interview = Interview(
        application_id=owner_app.id,
        title="Coding Assessment",
        interview_type="coding",
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=3),
    )
    db_session.add(interview)
    db_session.flush()

    # Exhaust free-tier platform calls so user is in basic mode
    for _ in range(5):
        db_session.add(
            UsageLog(
                user_id=user_id,
                provider="platform_openai",
                action="dummy_action",
                tokens_used=10,
            )
        )
    db_session.commit()

    resp = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate")
    assert resp.status_code == 201
    data = resp.json()

    assert data["model_provider"] == "fallback"
    assert data["model_version"] == "deterministic-v1"
    assert data["confidence"] is None

    prep = data["proposed_value"]
    assert "Backend Engineer" in prep["summary"]
    assert "Stripe" in prep["summary"]
    assert len(prep["preparation_priorities"]) >= 1
    assert len(prep["likely_questions"]) >= 1
    assert len(prep["questions_to_ask"]) >= 1

    # Readiness rules adherence: score is null, breakdown has limitations
    readiness = prep["readiness"]
    assert readiness["score"] is None
    assert readiness["breakdown"]["technical_depth"] is None
    assert readiness["breakdown"]["logistics_and_preparation"] == 70
    assert any("fallback mode" in lim for lim in readiness["limitations"])

    # Fallback consumes no quota
    fallback_usage = db_session.scalar(
        select(UsageLog).where(
            UsageLog.user_id == user_id,
            UsageLog.action == "interview_prep_generate",
        )
    )
    assert fallback_usage is None


def test_interview_prep_provider_failure_falls_back_without_output_or_quota_debit(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    user = register(client, "prep-provider-failure@example.test")
    user_id = uuid.UUID(user["id"])
    application = create_application(db_session, user_id=user_id)
    interview = Interview(
        application_id=application.id,
        title="Provider Failure Round",
        preparation_notes="private preparation context marker",
    )
    db_session.add(interview)
    db_session.flush()

    monkeypatch.setattr(
        "app.services.interview_prep._get_active_provider",
        lambda: {
            "api_key": "test-provider-key",
            "base_url": None,
            "model": "test-model",
            "name": "openai",
        },
    )

    def fail_provider(*args: object, **kwargs: object) -> tuple[InterviewPrepOutput, int]:
        raise RuntimeError("sensitive provider body marker")

    monkeypatch.setattr(
        "app.services.interview_prep._call_llm_for_prep",
        fail_provider,
    )

    response = client.post(
        f"/applications/{application.id}/interviews/{interview.id}/prep/generate"
    )

    assert response.status_code == 201
    body = response.json()
    assert body["model_provider"] == "fallback"
    assert body["model_version"] == "deterministic-v1"
    InterviewPrepOutput.model_validate(body["proposed_value"])

    captured = capsys.readouterr()
    combined_output = captured.out + captured.err
    assert "sensitive provider body marker" not in combined_output
    assert "private preparation context marker" not in combined_output
    assert "test-provider-key" not in combined_output

    usage_count = db_session.scalar(
        select(func.count()).where(
            UsageLog.user_id == user_id,
            UsageLog.action == "interview_prep_generate",
        )
    )
    assert usage_count == 0


def test_interview_prep_resolve_accepted_with_notes_application(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "prep-resolve-user@example.test")
    owner_app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(
        application_id=owner_app.id,
        title="Technical Screen",
        preparation_notes="Candidate notes: Review past Kafka projects.",
    )
    db_session.add(interview)
    db_session.flush()

    gen_resp = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate")
    assert gen_resp.status_code == 201
    sugg_id = gen_resp.json()["id"]

    # Resolve with accepted and apply_to_preparation_notes = True
    resolve_resp = client.post(
        f"/applications/{owner_app.id}/interviews/{interview.id}/prep/{sugg_id}/resolve",
        json={
            "status": "accepted",
            "apply_to_preparation_notes": True,
        },
    )
    assert resolve_resp.status_code == 200
    res_data = resolve_resp.json()
    assert res_data["status"] == "accepted"
    assert res_data["resolved_at"] is not None
    assert res_data["resolved_value"] is not None

    # Check that interview.preparation_notes preserved user notes and appended delimited block
    db_session.expire_all()
    updated_interview = db_session.get(Interview, interview.id)
    assert updated_interview is not None
    assert "Candidate notes: Review past Kafka projects." in updated_interview.preparation_notes
    assert f"--- [AI Preparation Plan (Suggestion: {sugg_id})] ---" in updated_interview.preparation_notes
    assert f"--- [End AI Preparation Plan (Suggestion: {sugg_id})] ---" in updated_interview.preparation_notes

    # Resolving an already-resolved suggestion returns 400
    retry_resolve = client.post(
        f"/applications/{owner_app.id}/interviews/{interview.id}/prep/{sugg_id}/resolve",
        json={"status": "accepted", "apply_to_preparation_notes": True},
    )
    assert retry_resolve.status_code == 400
    assert "Only pending suggestions can be resolved" in retry_resolve.json()["detail"]
    db_session.expire_all()
    notes_after_retry = db_session.get(Interview, interview.id).preparation_notes
    assert notes_after_retry.count(
        f"--- [AI Preparation Plan (Suggestion: {sugg_id})] ---"
    ) == 1
    assert notes_after_retry.count(
        f"--- [End AI Preparation Plan (Suggestion: {sugg_id})] ---"
    ) == 1


def test_interview_prep_resolve_rejected_and_edited_validation(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "prep-resolve-types@example.test")
    user_id = uuid.UUID(user["id"])
    owner_app = create_application(db_session, user_id=user_id)
    int1 = Interview(application_id=owner_app.id, title="Round 1", preparation_notes="Pre-existing notes")
    db_session.add(int1)
    db_session.flush()

    # Generate suggestion
    sugg1 = client.post(f"/applications/{owner_app.id}/interviews/{int1.id}/prep/generate").json()

    # Reject with apply_to_notes=True is rejected with 422
    rej_invalid = client.post(
        f"/applications/{owner_app.id}/interviews/{int1.id}/prep/{sugg1['id']}/resolve",
        json={"status": "rejected", "apply_to_preparation_notes": True},
    )
    assert rej_invalid.status_code == 422

    # Reject cleanly with 200
    rej_valid = client.post(
        f"/applications/{owner_app.id}/interviews/{int1.id}/prep/{sugg1['id']}/resolve",
        json={"status": "rejected", "apply_to_preparation_notes": False},
    )
    assert rej_valid.status_code == 200
    assert rej_valid.json()["status"] == "rejected"

    # Notes were not touched
    db_session.expire_all()
    assert db_session.get(Interview, int1.id).preparation_notes == "Pre-existing notes"

    # After rejection, a new generation is permitted (not blocked by rejected suggestion)
    sugg2 = client.post(f"/applications/{owner_app.id}/interviews/{int1.id}/prep/generate").json()
    assert sugg2["id"] != sugg1["id"]
    assert sugg2["status"] == "pending"

    # Edited status without resolved_value is rejected with 422
    edit_invalid = client.post(
        f"/applications/{owner_app.id}/interviews/{int1.id}/prep/{sugg2['id']}/resolve",
        json={"status": "edited"},
    )
    assert edit_invalid.status_code == 422

    # Edited with valid InterviewPrepOutput payload
    custom_prep = sugg2["proposed_value"]
    custom_prep["summary"] = "Human-tailored preparation focus on live database migrations."

    edit_valid = client.post(
        f"/applications/{owner_app.id}/interviews/{int1.id}/prep/{sugg2['id']}/resolve",
        json={
            "status": "edited",
            "resolved_value": custom_prep,
            "apply_to_preparation_notes": True,
        },
    )
    assert edit_valid.status_code == 200
    assert edit_valid.json()["status"] == "edited"
    assert edit_valid.json()["resolved_value"]["summary"] == "Human-tailored preparation focus on live database migrations."

    # Delimited block appended with custom summary
    db_session.expire_all()
    assert "Human-tailored preparation focus on live database migrations." in db_session.get(Interview, int1.id).preparation_notes


def test_interview_prep_list_and_filtering(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "prep-list-user@example.test")
    owner_app = create_application(db_session, user_id=uuid.UUID(user["id"]))
    interview = Interview(application_id=owner_app.id, title="List Round")
    db_session.add(interview)
    db_session.flush()

    # Generate first suggestion and accept it
    s1 = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate").json()
    client.post(
        f"/applications/{owner_app.id}/interviews/{interview.id}/prep/{s1['id']}/resolve",
        json={"status": "accepted"},
    )

    # Change context (e.g. interviewer_title) and generate second suggestion (pending)
    interview.interviewer_title = "VP of Engineering"
    db_session.commit()

    s2 = client.post(f"/applications/{owner_app.id}/interviews/{interview.id}/prep/generate").json()
    assert s2["id"] != s1["id"]

    # List all suggestions
    all_list = client.get(f"/applications/{owner_app.id}/interviews/{interview.id}/prep").json()
    assert len(all_list) == 2
    assert all_list[0]["id"] == s2["id"]  # newest first
    assert all_list[1]["id"] == s1["id"]

    # Filter by pending
    pending_list = client.get(
        f"/applications/{owner_app.id}/interviews/{interview.id}/prep?status=pending"
    ).json()
    assert len(pending_list) == 1
    assert pending_list[0]["id"] == s2["id"]

    # Filter by accepted
    accepted_list = client.get(
        f"/applications/{owner_app.id}/interviews/{interview.id}/prep?status=accepted"
    ).json()
    assert len(accepted_list) == 1
    assert accepted_list[0]["id"] == s1["id"]


def test_interview_prep_response_schema_rejects_unstructured_json() -> None:
    valid_prep = InterviewPrepOutput(
        summary="Structured plan",
        readiness=ReadinessAssessment(
            summary="Based on the available preparation context, review the plan.",
        ),
    )
    suggestion_data = {
        "id": uuid.uuid4(),
        "interview_id": uuid.uuid4(),
        "entity_type": "interview",
        "entity_id": uuid.uuid4(),
        "suggestion_type": "interview_prep",
        "proposed_value": valid_prep.model_dump(mode="json"),
        "confidence": None,
        "rationale": None,
        "model_provider": "fallback",
        "model_version": "deterministic-v1",
        "prompt_version": "interview-prep-v1",
        "output_schema_version": "1.0",
        "input_snapshot_hash": "a" * 64,
        "status": "pending",
        "resolved_value": None,
        "resolved_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    assert AISuggestionOut.model_validate(suggestion_data).proposed_value == valid_prep

    invalid_proposed = {**suggestion_data, "proposed_value": {"arbitrary": "json"}}
    with pytest.raises(ValidationError):
        AISuggestionOut.model_validate(invalid_proposed)

    invalid_resolved = {**suggestion_data, "resolved_value": {"arbitrary": "json"}}
    with pytest.raises(ValidationError):
        AISuggestionOut.model_validate(invalid_resolved)


def test_interview_prep_context_minimizes_interviewer_identity_and_bounds_title(
    db_session: Session,
) -> None:
    user = User(email="prep-context@example.test")
    db_session.add(user)
    db_session.flush()
    application = create_application(db_session, user_id=user.id)
    application.notes = "n" * 1_500
    application.job.description = "d" * 4_000
    resume = Resume(
        user_id=user.id,
        filename="bounded-resume.txt",
        raw_text="not sent to provider",
        label="l" * 100,
        skills=", ".join(f"skill-{index}-" + ("s" * 120) for index in range(60)),
    )
    db_session.add(resume)
    db_session.flush()
    application.resume_id = resume.id
    application.resume = resume
    prior_interview = Interview(
        application_id=application.id,
        title="Completed Round",
        status="completed",
    )
    db_session.add(prior_interview)
    db_session.flush()
    for index in range(25):
        db_session.add(
            InterviewQuestion(
                interview_id=prior_interview.id,
                question=f"Question {index} " + ("q" * 600),
                answer_notes="a" * 600,
                reflection="r" * 600,
            )
        )
    db_session.flush()
    interview = Interview(
        id=uuid.uuid4(),
        application_id=application.id,
        title="Technical Round",
        interviewer_name="Private Person",
        interviewer_email="private.person@example.test",
        interviewer_title="Principal Engineer " + ("x" * 300),
        preparation_notes="p" * 2_500,
    )

    context = build_minimized_context(db_session, application, interview)
    interview_context = context["interview"]

    assert "interviewer_name" not in interview_context
    assert "interviewer_email" not in interview_context
    assert "Private Person" not in str(context)
    assert "private.person@example.test" not in str(context)
    assert interview_context["interviewer_title"].startswith("Principal Engineer")
    assert len(interview_context["interviewer_title"]) == 200
    assert len(interview_context["preparation_notes"]) == 2_000
    assert len(context["application"]["notes"]) == 1_000
    assert len(context["application"]["job_description"]) == 3_000
    assert len(context["application"]["resume_label"]) == 100
    assert len(context["application"]["resume_skills"]) == 50
    assert all(
        len(skill) <= 100 for skill in context["application"]["resume_skills"]
    )
    assert len(context["prior_questions"]) == 20
    assert all(len(item["question"]) <= 500 for item in context["prior_questions"])
    assert all(len(item["answer_notes"]) <= 500 for item in context["prior_questions"])
    assert all(len(item["reflection"]) <= 500 for item in context["prior_questions"])
    assert "not sent to provider" not in str(context)


def test_interview_prep_serializes_naive_and_aware_scheduled_times_safely(
    db_session: Session,
) -> None:
    user = User(email="prep-time-context@example.test")
    db_session.add(user)
    db_session.flush()
    application = create_application(db_session, user_id=user.id)

    naive_interview = Interview(
        id=uuid.uuid4(),
        application_id=application.id,
        title="Naive Time Round",
        scheduled_at=datetime(2026, 9, 20, 14, 30),
        timezone="America/New_York",
    )
    naive_context = build_minimized_context(db_session, application, naive_interview)
    naive_time = naive_context["interview"]["scheduled_at"]

    assert naive_time["value"] == "2026-09-20T14:30:00"
    assert naive_time["timezone_awareness"] == "naive"
    assert naive_time["timezone_context"] == "America/New_York"
    assert "without a UTC offset" in naive_time["limitation"]
    fallback = _generate_deterministic_fallback(naive_context)
    assert naive_time["limitation"] in fallback.limitations_or_uncertainties
    assert naive_time["limitation"] in fallback.readiness.limitations

    aware_interview = Interview(
        id=uuid.uuid4(),
        application_id=application.id,
        title="Aware Time Round",
        scheduled_at=datetime(2026, 9, 20, 18, 30, tzinfo=timezone.utc),
        timezone="UTC",
    )
    aware_context = build_minimized_context(db_session, application, aware_interview)
    aware_time = aware_context["interview"]["scheduled_at"]

    assert aware_time["value"] == "2026-09-20T18:30:00+00:00"
    assert aware_time["timezone_awareness"] == "aware"
    assert aware_time["timezone_context"] == "UTC"
    assert aware_time["limitation"] is None


def test_interview_prep_filter_supports_all_persisted_statuses(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "prep-statuses@example.test")
    user_id = uuid.UUID(user["id"])
    application = create_application(db_session, user_id=user_id)
    interview = Interview(application_id=application.id, title="Status Filter Round")
    db_session.add(interview)
    db_session.flush()
    prep = InterviewPrepOutput(
        summary="Status filter plan",
        readiness=ReadinessAssessment(
            summary="Based on the available preparation context, review the plan.",
        ),
    ).model_dump(mode="json")
    statuses = [
        "pending",
        "accepted",
        "rejected",
        "edited",
        "expired",
        "failed",
        "superseded",
    ]
    for index, status in enumerate(statuses):
        db_session.add(
            AISuggestion(
                user_id=user_id,
                interview_id=interview.id,
                entity_id=interview.id,
                suggestion_type="interview_prep",
                proposed_value=prep,
                model_provider="fallback",
                model_version="deterministic-v1",
                prompt_version="interview-prep-v1",
                output_schema_version="1.0",
                input_snapshot_hash=f"{index:064x}",
                status=status,
            )
        )
    db_session.commit()

    endpoint = f"/applications/{application.id}/interviews/{interview.id}/prep"
    all_response = client.get(endpoint)
    assert all_response.status_code == 200
    assert {item["status"] for item in all_response.json()} == set(statuses)

    for status in statuses:
        response = client.get(f"{endpoint}?status={status}")
        assert response.status_code == 200
        assert [item["status"] for item in response.json()] == [status]

    assert client.get(f"{endpoint}?status=unknown").status_code == 422


def test_interview_outcome_routes_require_authentication(client: TestClient) -> None:
    app_id, interview_id, suggestion_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    base = f"/applications/{app_id}/interviews/{interview_id}/outcome-analysis"
    assert client.post(f"{base}/generate").status_code == 401
    assert client.get(base).status_code == 401
    assert client.post(f"{base}/{suggestion_id}/resolve", json={"status": "accepted"}).status_code == 401


def test_interview_outcome_ownership_and_hierarchy_are_enforced(
    client: TestClient, db_session: Session
) -> None:
    owner = register(client, "outcome-owner@example.test")
    owner_app = create_application(db_session, user_id=owner["id"])
    other_app = create_application(db_session, user_id=owner["id"])
    interview = Interview(application_id=owner_app.id, title="Outcome interview")
    db_session.add(interview)
    db_session.commit()
    assert client.post(
        f"/applications/{other_app.id}/interviews/{interview.id}/outcome-analysis/generate"
    ).status_code == 404
    generated = client.post(
        f"/applications/{owner_app.id}/interviews/{interview.id}/outcome-analysis/generate"
    )
    assert generated.status_code == 201
    client.post("/auth/logout")
    register(client, "outcome-other@example.test")
    base = f"/applications/{owner_app.id}/interviews/{interview.id}/outcome-analysis"
    assert client.post(f"{base}/generate").status_code == 404
    assert client.get(base).status_code == 404
    assert client.post(
        f"{base}/{generated.json()['id']}/resolve", json={"status": "accepted"}
    ).status_code == 404


def test_interview_outcome_provider_generation_is_bounded_idempotent_and_logged_once(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = register(client, "outcome-provider@example.test")
    application = create_application(db_session, user_id=user["id"])
    interview = Interview(
        application_id=application.id,
        title="Do not send this interview title",
        status="completed",
        result="advanced",
        notes="N" * 3000,
        preparation_notes="P" * 3000,
        interviewer_name="Private Person",
        interviewer_email="private@example.test",
    )
    db_session.add(interview)
    db_session.flush()
    for index in range(35):
        db_session.add(InterviewQuestion(
            interview_id=interview.id,
            question=f"Question {index} " + "Q" * 1500,
            answer_notes="A" * 3000,
            reflection="R" * 3000,
        ))
    unrelated_application = create_application(db_session, user_id=user["id"])
    unrelated_interview = Interview(
        application_id=unrelated_application.id,
        title="Different application interview",
        status="completed",
    )
    db_session.add(unrelated_interview)
    db_session.flush()
    db_session.add(InterviewQuestion(
        interview_id=unrelated_interview.id,
        question="CROSS_APPLICATION_SECRET_MUST_NOT_BE_INCLUDED",
    ))
    db_session.commit()
    captured: dict[str, object] = {}

    def mock_call_llm(api_key: str, base_url: str | None, model: str, context: dict[str, object]) -> tuple[InterviewOutcomeAnalysisOutput, int]:
        captured["context"] = context
        return outcome_output(questions_considered=30), 42

    monkeypatch.setattr("app.services.interview_outcome.get_extraction_mode", lambda *_: ("platform", 5))
    monkeypatch.setattr("app.services.interview_outcome._get_active_provider", lambda: {
        "api_key": "test-key", "base_url": None, "model": "test-model", "name": "openai"
    })
    monkeypatch.setattr("app.services.interview_outcome._call_llm_for_outcome", mock_call_llm)
    url = f"/applications/{application.id}/interviews/{interview.id}/outcome-analysis/generate"
    first, second = client.post(url), client.post(url)
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["prompt_version"] == "interview-outcome-v1"
    assert first.json()["output_schema_version"] == "1.0"
    assert first.json()["model_provider"] == "platform_openai"
    context = captured["context"]
    assert isinstance(context, dict)
    assert context["scope"] == "current_interview_only"
    assert "title" not in context["interview"]
    assert "interviewer_name" not in context["interview"]
    assert len(context["interview"]["notes"]) == 2000
    assert len(context["questions"]) == 30
    assert len(context["questions"][0]["question"]) == 1000
    assert len(context["questions"][0]["reflection"]) == 2000
    assert "CROSS_APPLICATION_SECRET_MUST_NOT_BE_INCLUDED" not in str(context)
    assert db_session.scalar(select(func.count()).where(
        UsageLog.user_id == uuid.UUID(str(user["id"])),
        UsageLog.action == "interview_outcome_analysis_generate",
    )) == 1


def test_interview_outcome_provider_failure_uses_safe_sparse_fallback_without_usage(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = register(client, "outcome-fallback@example.test")
    application = create_application(db_session, user_id=user["id"])
    interview = Interview(application_id=application.id, title="Sparse")
    db_session.add(interview)
    db_session.commit()
    monkeypatch.setattr("app.services.interview_outcome.get_extraction_mode", lambda *_: ("platform", 5))
    monkeypatch.setattr("app.services.interview_outcome._get_active_provider", lambda: {
        "api_key": "test-key", "base_url": None, "model": "test-model", "name": "openai"
    })

    def fail_provider(*args: object, **kwargs: object) -> tuple[InterviewOutcomeAnalysisOutput, int]:
        raise RuntimeError("secret provider failure")

    monkeypatch.setattr("app.services.interview_outcome._call_llm_for_outcome", fail_provider)
    response = client.post(
        f"/applications/{application.id}/interviews/{interview.id}/outcome-analysis/generate"
    )
    assert response.status_code == 201
    body = response.json()
    assert body["model_provider"] == "fallback"
    assert body["proposed_value"]["possible_strengths"] == []
    assert "insufficient recorded evidence" in body["proposed_value"]["uncertainty_notes"][0]
    assert "secret provider failure" not in response.text
    assert db_session.scalar(select(func.count()).where(
        UsageLog.user_id == uuid.UUID(str(user["id"])),
        UsageLog.action == "interview_outcome_analysis_generate",
    )) == 0


def test_interview_outcome_resolution_never_modifies_interview_notes(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = register(client, "outcome-resolve@example.test")
    application = create_application(db_session, user_id=user["id"])
    interview = Interview(
        application_id=application.id,
        title="Resolve",
        notes="Keep manual notes",
        preparation_notes="Keep preparation notes",
    )
    db_session.add(interview)
    db_session.commit()
    monkeypatch.setattr("app.services.interview_outcome.get_extraction_mode", lambda *_: ("basic", 0))
    base = f"/applications/{application.id}/interviews/{interview.id}/outcome-analysis"
    generated = client.post(f"{base}/generate").json()
    accepted = client.post(f"{base}/{generated['id']}/resolve", json={"status": "accepted"})
    assert accepted.status_code == 200
    assert accepted.json()["resolved_value"] == generated["proposed_value"]
    assert client.post(f"{base}/{generated['id']}/resolve", json={"status": "rejected"}).status_code == 400
    interview.notes = "Changed context"
    db_session.commit()
    second = client.post(f"{base}/generate").json()
    assert client.post(f"{base}/{second['id']}/resolve", json={"status": "edited"}).status_code == 422
    edited_value = outcome_output(questions_considered=0).model_dump(mode="json")
    edited = client.post(
        f"{base}/{second['id']}/resolve",
        json={"status": "edited", "resolved_value": edited_value},
    )
    assert edited.status_code == 200
    assert edited.json()["resolved_value"] == edited_value
    interview.notes = "Third context"
    db_session.commit()
    third = client.post(f"{base}/generate").json()
    rejected = client.post(
        f"{base}/{third['id']}/resolve", json={"status": "rejected"}
    )
    assert rejected.status_code == 200
    assert rejected.json()["resolved_value"] is None
    db_session.refresh(interview)
    assert interview.notes == "Third context"
    assert interview.preparation_notes == "Keep preparation notes"
    listed = client.get(f"{base}?status=edited")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [second["id"]]
