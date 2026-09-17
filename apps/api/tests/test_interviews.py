import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, Interview, Job, User


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
