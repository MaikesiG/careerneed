from datetime import date, datetime, timedelta, timezone
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, FollowUp, Job, Resume
from app.routers import applications as applications_router


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


def create_follow_up(
    db_session: Session,
    *,
    application: Application,
    due_at: datetime,
    completed_at: datetime | None = None,
) -> FollowUp:
    follow_up = FollowUp(
        user_id=application.user_id,
        application_id=application.id,
        type="status_check",
        title="Check application status",
        due_at_utc=due_at,
        timezone="UTC",
        completed_at=completed_at,
    )
    db_session.add(follow_up)
    db_session.flush()
    return follow_up


def freeze_application_list_now(
    monkeypatch: pytest.MonkeyPatch,
    frozen_utc: datetime,
) -> None:
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            if tz is None:
                return frozen_utc.replace(tzinfo=None)
            return frozen_utc.astimezone(tz)

    monkeypatch.setattr(
        "app.routers.applications.datetime",
        FrozenDateTime,
    )


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
        assert [item["id"] for item in other_list_response.json()] == [str(other_application.id)]
    finally:
        other_client.close()


def test_application_list_returns_owner_scoped_open_follow_up_summaries(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_id = register(client, "application-summary-owner@example.test")
    open_application = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Multiple open follow-ups"),
    )
    no_follow_up_application = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="No follow-ups"),
    )
    completed_only_application = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Completed follow-up only"),
    )

    earliest = datetime(2026, 10, 20, 9, tzinfo=timezone.utc)
    create_follow_up(
        db_session,
        application=open_application,
        due_at=datetime(2026, 10, 22, 9, tzinfo=timezone.utc),
    )
    create_follow_up(db_session, application=open_application, due_at=earliest)
    create_follow_up(
        db_session,
        application=open_application,
        due_at=datetime(2026, 10, 19, 9, tzinfo=timezone.utc),
        completed_at=datetime(2026, 10, 19, 12, tzinfo=timezone.utc),
    )
    create_follow_up(
        db_session,
        application=completed_only_application,
        due_at=datetime(2026, 10, 18, 9, tzinfo=timezone.utc),
        completed_at=datetime(2026, 10, 18, 12, tzinfo=timezone.utc),
    )

    other_client = TestClient(app)
    try:
        other_id = register(other_client, "application-summary-other@example.test")
        other_application = create_application(
            db_session,
            user_id=other_id,
            job=create_job(db_session, title="Other user's follow-up"),
        )
        create_follow_up(
            db_session,
            application=other_application,
            due_at=datetime(2026, 10, 17, 9, tzinfo=timezone.utc),
        )

        response = client.get("/applications", params={"limit": 100})
        assert response.status_code == 200
        items = {item["id"]: item for item in response.json()}

        assert set(items) == {
            str(open_application.id),
            str(no_follow_up_application.id),
            str(completed_only_application.id),
        }
        open_summary = items[str(open_application.id)]
        assert open_summary["open_follow_up_count"] == 2
        assert (
            datetime.fromisoformat(open_summary["next_open_follow_up_at"].replace("Z", "+00:00"))
            == earliest
        )

        for application in (no_follow_up_application, completed_only_application):
            summary = items[str(application.id)]
            assert summary["next_open_follow_up_at"] is None
            assert summary["open_follow_up_count"] == 0
    finally:
        other_client.close()


def test_application_list_uses_canonical_local_day_boundaries_and_open_earliest(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now_utc = datetime(2026, 3, 8, 12, tzinfo=timezone.utc)
    freeze_application_list_now(monkeypatch, now_utc)
    owner_id = register(client, "application-canonical-boundary@example.test")

    before_midnight = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Before local midnight"),
    )
    exact_midnight = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Exact local midnight"),
    )
    final_today_instant = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Final instant today"),
    )
    exact_next_midnight = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Exact next local midnight"),
    )
    completed_only = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Completed only"),
    )

    # America/New_York enters DST on 2026-03-08. Consecutive local midnights
    # are 05:00Z and 04:00Z, producing a 23-hour local calendar day.
    local_start_utc = datetime(2026, 3, 8, 5, tzinfo=timezone.utc)
    local_next_start_utc = datetime(2026, 3, 9, 4, tzinfo=timezone.utc)
    assert local_next_start_utc - local_start_utc == timedelta(hours=23)

    create_follow_up(
        db_session,
        application=before_midnight,
        due_at=local_start_utc - timedelta(microseconds=1),
    )
    create_follow_up(
        db_session,
        application=before_midnight,
        due_at=local_start_utc + timedelta(hours=2),
    )
    create_follow_up(
        db_session,
        application=exact_midnight,
        due_at=local_start_utc,
    )
    create_follow_up(
        db_session,
        application=exact_midnight,
        due_at=local_start_utc - timedelta(days=1),
        completed_at=local_start_utc - timedelta(hours=12),
    )
    create_follow_up(
        db_session,
        application=final_today_instant,
        due_at=local_next_start_utc - timedelta(microseconds=1),
    )
    create_follow_up(
        db_session,
        application=exact_next_midnight,
        due_at=local_next_start_utc,
    )
    create_follow_up(
        db_session,
        application=completed_only,
        due_at=local_start_utc - timedelta(days=2),
        completed_at=local_start_utc - timedelta(days=1),
    )

    params = {"timezone": "America/New_York", "limit": 100}
    overdue_response = client.get(
        "/applications",
        params={**params, "follow_up": "overdue"},
    )
    today_response = client.get(
        "/applications",
        params={**params, "follow_up": "today"},
    )
    scheduled_response = client.get(
        "/applications",
        params={**params, "follow_up": "scheduled"},
    )

    assert overdue_response.status_code == 200
    assert {item["id"] for item in overdue_response.json()} == {str(before_midnight.id)}

    assert today_response.status_code == 200
    assert {item["id"] for item in today_response.json()} == {
        str(exact_midnight.id),
        str(final_today_instant.id),
    }

    assert scheduled_response.status_code == 200
    assert {item["id"] for item in scheduled_response.json()} == {
        str(before_midnight.id),
        str(exact_midnight.id),
        str(final_today_instant.id),
        str(exact_next_midnight.id),
    }
    assert all(item["id"] != str(completed_only.id) for item in scheduled_response.json())
    assert (
        len([item for item in scheduled_response.json() if item["id"] == str(before_midnight.id)])
        == 1
    )


def test_application_list_timezone_default_validation_and_status_composition(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 05:30 UTC is 00:30 EST. A FollowUp due at 01:00 UTC is therefore
    # in the UTC day but before New York's Jan 15 local-day start at 05:00 UTC.
    now_utc = datetime(2026, 1, 15, 5, 30, tzinfo=timezone.utc)
    freeze_application_list_now(monkeypatch, now_utc)
    owner_id = register(client, "application-canonical-timezone@example.test")

    utc_today_ny_overdue = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="UTC today and New York overdue"),
        status="interviewing",
        follow_up_on=date(2099, 1, 1),
    )
    saved_today = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Saved UTC today"),
        status="saved",
    )

    due_at = datetime(2026, 1, 15, 1, tzinfo=timezone.utc)
    create_follow_up(
        db_session,
        application=utc_today_ny_overdue,
        due_at=due_at,
    )
    create_follow_up(
        db_session,
        application=saved_today,
        due_at=due_at,
    )

    default_utc = client.get(
        "/applications",
        params={
            "follow_up": "today",
            "status": "interviewing",
            "limit": 1,
        },
    )
    assert default_utc.status_code == 200
    assert [item["id"] for item in default_utc.json()] == [str(utc_today_ny_overdue.id)]
    assert default_utc.headers["X-Total-Count"] == "1"
    assert default_utc.headers["X-Total-Pages"] == "1"

    new_york_today = client.get(
        "/applications",
        params={
            "follow_up": "today",
            "timezone": "America/New_York",
            "limit": 100,
        },
    )
    new_york_overdue = client.get(
        "/applications",
        params={
            "follow_up": "overdue",
            "timezone": "America/New_York",
            "limit": 100,
        },
    )

    assert new_york_today.status_code == 200
    assert new_york_today.json() == []

    assert new_york_overdue.status_code == 200
    assert {item["id"] for item in new_york_overdue.json()} == {
        str(utc_today_ny_overdue.id),
        str(saved_today.id),
    }

    invalid_timezone = client.get(
        "/applications",
        params={
            "follow_up": "today",
            "timezone": "Invalid/Timezone",
        },
    )
    invalid_filter = client.get(
        "/applications",
        params={
            "follow_up": "not-supported",
            "timezone": "UTC",
        },
    )

    assert invalid_timezone.status_code == 422
    assert invalid_timezone.json()["detail"] == "Invalid IANA timezone"
    assert invalid_filter.status_code == 422


def test_application_list_canonical_filter_preserves_owner_scope_and_pagination(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now_utc = datetime(2026, 5, 10, 12, tzinfo=timezone.utc)
    freeze_application_list_now(monkeypatch, now_utc)
    owner_id = register(client, "application-canonical-pagination@example.test")

    first_application = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="First scheduled application"),
    )
    second_application = create_application(
        db_session,
        user_id=owner_id,
        job=create_job(db_session, title="Second scheduled application"),
    )

    create_follow_up(
        db_session,
        application=first_application,
        due_at=now_utc + timedelta(days=1),
    )
    create_follow_up(
        db_session,
        application=first_application,
        due_at=now_utc + timedelta(days=2),
    )
    create_follow_up(
        db_session,
        application=second_application,
        due_at=now_utc + timedelta(days=3),
    )

    other_client = TestClient(app)
    try:
        other_id = register(
            other_client,
            "application-canonical-pagination-other@example.test",
        )
        other_application = create_application(
            db_session,
            user_id=other_id,
            job=create_job(db_session, title="Other owner scheduled application"),
        )
        create_follow_up(
            db_session,
            application=other_application,
            due_at=now_utc + timedelta(days=1),
        )

        first_page = client.get(
            "/applications",
            params={
                "follow_up": "scheduled",
                "limit": 1,
                "offset": 0,
            },
        )
        second_page = client.get(
            "/applications",
            params={
                "follow_up": "scheduled",
                "limit": 1,
                "offset": 1,
            },
        )

        assert first_page.status_code == 200
        assert second_page.status_code == 200
        assert first_page.headers["X-Total-Count"] == "2"
        assert first_page.headers["X-Total-Pages"] == "2"

        returned_ids = {
            first_page.json()[0]["id"],
            second_page.json()[0]["id"],
        }
        assert returned_ids == {
            str(first_application.id),
            str(second_application.id),
        }
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
    create_application(
        db_session,
        user_id=owner_id,
        job=owner_saved_job,
        status="saved",
    )
    owner_due_application = create_application(
        db_session,
        user_id=owner_id,
        job=owner_due_job,
        status="applied",
        follow_up_on=today,
    )
    due_today = datetime.now(timezone.utc).replace(
        hour=12,
        minute=0,
        second=0,
        microsecond=0,
    )
    create_follow_up(
        db_session,
        application=owner_due_application,
        due_at=due_today,
    )

    other_client = TestClient(app)
    try:
        other_id = register(other_client, "dashboard-other@example.test")
        other_overdue_job = create_job(db_session, title="Other overdue role")
        other_overdue_application = create_application(
            db_session,
            user_id=other_id,
            job=other_overdue_job,
            status="interviewing",
            follow_up_on=today - timedelta(days=1),
        )
        create_follow_up(
            db_session,
            application=other_overdue_application,
            due_at=due_today - timedelta(days=1),
        )

        summary_response = client.get("/dashboard/summary")
        follow_ups_response = client.get(
            "/dashboard/follow-ups",
            params={"limit": 20},
        )

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
