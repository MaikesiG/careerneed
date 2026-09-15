from datetime import date, timedelta
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, Job, Resume


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


def register(client: TestClient, email: str) -> uuid.UUID:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "correct horse battery staple",
        },
    )
    assert response.status_code == 201
    return uuid.UUID(response.json()["id"])


def create_job(db_session: Session, *, title: str) -> Job:
    job = Job(
        company_name="Application Auth Test Co.",
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
    job: Job,
    status: str = "saved",
    follow_up_on: date | None = None,
) -> Application:
    application = Application(
        user_id=user_id,
        job_id=job.id,
        status=status,
        follow_up_on=follow_up_on,
    )
    db_session.add(application)
    db_session.flush()
    return application


def create_resume(
    db_session: Session,
    *,
    user_id: uuid.UUID,
) -> Resume:
    resume = Resume(
        user_id=user_id,
        filename="resume.pdf",
        raw_text="Resume text",
        skills="Python",
        source="test",
    )
    db_session.add(resume)
    db_session.flush()
    return resume


def test_application_routes_require_authentication(client: TestClient) -> None:
    application_id = uuid.uuid4()
    job_id = uuid.uuid4()

    list_response = client.get("/applications")
    detail_response = client.get(f"/applications/{application_id}")
    create_response = client.post(
        "/applications",
        json={"job_id": str(job_id), "status": "saved"},
    )
    update_response = client.patch(
        f"/applications/{application_id}",
        json={"status": "applied"},
    )
    delete_response = client.delete(f"/applications/{application_id}")
    job_states_response = client.get(
        "/applications/me/job-states",
        params={"job_id": str(job_id)},
    )

    assert list_response.status_code == 401
    assert detail_response.status_code == 401
    assert create_response.status_code == 401
    assert update_response.status_code == 401
    assert delete_response.status_code == 401
    assert job_states_response.status_code == 401


def test_user_cannot_read_update_or_delete_another_users_application(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_id = register(client, "application-owner@example.test")
    job = create_job(db_session, title="Owner application role")
    application = create_application(db_session, user_id=owner_id, job=job)

    other_client = TestClient(app)
    try:
        register(other_client, "application-other@example.test")

        detail_response = other_client.get(f"/applications/{application.id}")
        update_response = other_client.patch(
            f"/applications/{application.id}",
            json={"status": "applied"},
        )
        delete_response = other_client.delete(f"/applications/{application.id}")

        assert detail_response.status_code == 404
        assert detail_response.json()["detail"] == "Application not found"
        assert update_response.status_code == 404
        assert update_response.json()["detail"] == "Application not found"
        assert delete_response.status_code == 404
        assert delete_response.json()["detail"] == "Application not found"

        db_session.refresh(application)
        assert application.status == "saved"
    finally:
        other_client.close()


def test_application_list_and_job_states_are_scoped_to_current_user(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_id = register(client, "application-owner@example.test")
    owner_job = create_job(db_session, title="Owner application role")
    owner_application = create_application(
        db_session,
        user_id=owner_id,
        job=owner_job,
        status="applied",
    )

    other_client = TestClient(app)
    try:
        other_id = register(other_client, "application-other@example.test")
        other_job = create_job(db_session, title="Other application role")
        other_application = create_application(
            db_session,
            user_id=other_id,
            job=other_job,
            status="saved",
        )

        list_response = client.get("/applications")
        states_response = client.get(
            "/applications/me/job-states",
            params=[
                ("job_id", str(owner_job.id)),
                ("job_id", str(other_job.id)),
            ],
        )

        assert list_response.status_code == 200
        assert [item["id"] for item in list_response.json()] == [str(owner_application.id)]

        assert states_response.status_code == 200
        states = states_response.json()["states"]
        assert str(owner_job.id) in states
        assert states[str(owner_job.id)]["id"] == str(owner_application.id)
        assert str(other_job.id) not in states

        other_list_response = other_client.get("/applications")
        assert other_list_response.status_code == 200
        assert [item["id"] for item in other_list_response.json()] == [
            str(other_application.id)
        ]
    finally:
        other_client.close()


def test_user_cannot_attach_another_users_resume_to_application(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_id = register(client, "application-owner@example.test")
    owner_resume = create_resume(db_session, user_id=owner_id)

    other_client = TestClient(app)
    try:
        register(other_client, "application-other@example.test")
        job = create_job(db_session, title="Resume ownership role")

        response = other_client.post(
            "/applications",
            json={
                "job_id": str(job.id),
                "resume_id": str(owner_resume.id),
                "status": "saved",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Resume not found"
    finally:
        other_client.close()


def test_dashboard_returns_only_current_users_counts_and_follow_ups(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_id = register(client, "dashboard-owner@example.test")
    today = date.today()

    owner_saved_job = create_job(db_session, title="Owner saved role")
    owner_due_job = create_job(db_session, title="Owner due role")
    create_application(db_session, user_id=owner_id, job=owner_saved_job, status="saved")
    owner_due_application = create_application(
        db_session,
        user_id=owner_id,
        job=owner_due_job,
        status="applied",
        follow_up_on=today,
    )

    other_client = TestClient(app)
    try:
        other_id = register(other_client, "dashboard-other@example.test")
        other_overdue_job = create_job(db_session, title="Other overdue role")
        create_application(
            db_session,
            user_id=other_id,
            job=other_overdue_job,
            status="interviewing",
            follow_up_on=today - timedelta(days=1),
        )

        summary_response = client.get("/dashboard/summary")
        follow_ups_response = client.get("/dashboard/follow-ups", params={"limit": 20})

        assert summary_response.status_code == 200
        summary = summary_response.json()
        assert summary["applications_saved"] == 1
        assert summary["applications_applied"] == 1
        assert summary["applications_interviewing"] == 0
        assert summary["follow_ups_due_today"] == 1
        assert summary["follow_ups_overdue"] == 0
        assert summary["active_applications"] == 1

        assert follow_ups_response.status_code == 200
        items = follow_ups_response.json()["items"]
        assert [item["id"] for item in items] == [str(owner_due_application.id)]

        other_summary_response = other_client.get("/dashboard/summary")
        other_summary = other_summary_response.json()
        assert other_summary["applications_saved"] == 0
        assert other_summary["applications_applied"] == 0
        assert other_summary["applications_interviewing"] == 1
        assert other_summary["follow_ups_due_today"] == 0
        assert other_summary["follow_ups_overdue"] == 1
    finally:
        other_client.close()
