import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import AISuggestion, Application, Interview, InterviewQuestion, Job, User


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


