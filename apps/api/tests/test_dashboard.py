import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, FollowUp, Interview, Job


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
        json={"email": email, "password": "correct horse battery staple"},
    )
    assert response.status_code == 201
    return response.json()


def create_application(
    db: Session,
    *,
    user_id: str,
    title: str,
    follow_up_on: date | None = None,
) -> Application:
    job = Job(
        company_name="Example Corp",
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=title,
        application_url="https://example.test/apply",
    )
    db.add(job)
    db.flush()
    application = Application(
        user_id=user_id,
        job_id=job.id,
        status="interviewing",
        follow_up_on=follow_up_on,
    )
    db.add(application)
    db.flush()
    return application


def local_day_bounds(timezone_name: str) -> tuple[datetime, datetime]:
    requested_timezone = ZoneInfo(timezone_name)
    local_date = datetime.now(timezone.utc).astimezone(requested_timezone).date()
    start = datetime.combine(local_date, time.min, requested_timezone).astimezone(timezone.utc)
    next_start = datetime.combine(
        local_date + timedelta(days=1), time.min, requested_timezone
    ).astimezone(timezone.utc)
    return start, next_start


def create_follow_up(
    db: Session,
    *,
    application: Application,
    title: str,
    due_at: datetime,
    completed_at: datetime | None = None,
    interview_id: uuid.UUID | None = None,
) -> FollowUp:
    follow_up = FollowUp(
        user_id=application.user_id,
        application_id=application.id,
        interview_id=interview_id,
        type="custom",
        title=title,
        due_at_utc=due_at,
        timezone="Pacific/Kiritimati",
        completed_at=completed_at,
        notes="Sensitive follow-up notes",
    )
    db.add(follow_up)
    db.flush()
    return follow_up


def create_interview(
    db: Session,
    *,
    application: Application,
    title: str,
    scheduled_at: datetime,
    round: int = 1,
    status: str = "scheduled",
) -> Interview:
    interview = Interview(
        application_id=application.id,
        round=round,
        title=title,
        scheduled_at=scheduled_at.replace(tzinfo=None),
        timezone="Pacific/Kiritimati",
        status=status,
        notes="Sensitive interview notes",
        preparation_notes="Sensitive preparation notes",
    )
    db.add(interview)
    db.flush()
    return interview


def group_map(payload: dict[str, object]) -> dict[str, list[dict[str, object]]]:
    groups = payload["groups"]
    assert isinstance(groups, list)
    return {group["key"]: group["items"] for group in groups}


def test_today_requires_authentication_and_valid_timezone(client: TestClient) -> None:
    assert client.get("/dashboard/today", params={"timezone": "UTC"}).status_code == 401
    register(client, "today-validation@example.test")
    assert client.get(
        "/dashboard/today", params={"timezone": "Mars/Olympus_Mons"}
    ).status_code == 422


def test_today_empty_response_has_stable_priority_groups(client: TestClient) -> None:
    register(client, "today-empty@example.test")
    response = client.get("/dashboard/today", params={"timezone": "UTC"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["timezone"] == "UTC"
    assert [(group["key"], group["priority"]) for group in payload["groups"]] == [
        ("overdue_follow_ups", 1),
        ("interviews_today", 2),
        ("follow_ups_due_today", 3),
        ("upcoming_interviews", 4),
        ("applications_needing_update", 5),
    ]
    assert all(group["items"] == [] for group in payload["groups"])


def test_today_classifies_and_orders_items_at_local_utc_boundaries(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "today-boundaries@example.test")
    application = create_application(db_session, user_id=user["id"], title="Platform Engineer")
    start, next_start = local_day_bounds("Pacific/Kiritimati")

    overdue_early = create_follow_up(
        db_session, application=application, title="Oldest overdue", due_at=start - timedelta(days=2)
    )
    overdue_late = create_follow_up(
        db_session, application=application, title="Latest overdue", due_at=start - timedelta(seconds=1)
    )
    due_early = create_follow_up(
        db_session, application=application, title="Start boundary", due_at=start
    )
    due_late = create_follow_up(
        db_session,
        application=application,
        title="Final instant today",
        due_at=next_start - timedelta(microseconds=1),
    )
    due_next_day = create_follow_up(
        db_session,
        application=application,
        title="Next midnight",
        due_at=next_start,
    )
    today_early = create_interview(
        db_session, application=application, title="Today first", scheduled_at=start
    )
    today_late = create_interview(
        db_session,
        application=application,
        title="Today last",
        scheduled_at=next_start - timedelta(microseconds=1),
    )
    upcoming = create_interview(
        db_session,
        application=application,
        title="Upcoming",
        scheduled_at=next_start,
    )

    response = client.get(
        "/dashboard/today", params={"timezone": "Pacific/Kiritimati"}
    )
    assert response.status_code == 200
    groups = group_map(response.json())
    assert [item["id"] for item in groups["overdue_follow_ups"]] == [
        str(overdue_early.id),
        str(overdue_late.id),
    ]
    assert [item["id"] for item in groups["interviews_today"]] == [
        str(today_early.id),
        str(today_late.id),
    ]
    assert [item["id"] for item in groups["follow_ups_due_today"]] == [
        str(due_early.id),
        str(due_late.id),
    ]
    assert str(due_next_day.id) not in {
        item["id"] for group in groups.values() for item in group
    }
    assert [item["id"] for item in groups["upcoming_interviews"]] == [str(upcoming.id)]


def test_today_excludes_completed_deleted_cancelled_and_other_users(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "today-owner@example.test")
    owner_application = create_application(db_session, user_id=owner["id"], title="Owner role")
    start, _ = local_day_bounds("UTC")
    visible = create_follow_up(
        db_session, application=owner_application, title="Visible", due_at=start
    )
    create_follow_up(
        db_session,
        application=owner_application,
        title="Completed",
        due_at=start,
        completed_at=start,
    )
    deleted = create_follow_up(
        db_session, application=owner_application, title="Deleted", due_at=start
    )
    db_session.delete(deleted)
    create_interview(
        db_session,
        application=owner_application,
        title="Cancelled",
        scheduled_at=start,
        status="cancelled",
    )

    other_client = TestClient(app)
    try:
        other = register(other_client, "today-other@example.test")
        other_application = create_application(
            db_session, user_id=other["id"], title="Other role"
        )
        create_follow_up(
            db_session, application=other_application, title="Foreign", due_at=start
        )
        create_interview(
            db_session, application=other_application, title="Foreign", scheduled_at=start
        )

        response = client.get("/dashboard/today", params={"timezone": "UTC"})
        assert response.status_code == 200
        items = [item for group in response.json()["groups"] for item in group["items"]]
        assert [item["id"] for item in items] == [str(visible.id)]
    finally:
        other_client.close()


def test_today_response_excludes_sensitive_fields(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "today-safe@example.test")
    application = create_application(db_session, user_id=user["id"], title="Safe role")
    start, _ = local_day_bounds("UTC")
    create_follow_up(db_session, application=application, title="Follow up", due_at=start)
    create_interview(db_session, application=application, title="Interview", scheduled_at=start)

    payload = client.get("/dashboard/today", params={"timezone": "UTC"}).json()
    serialized = str(payload).lower()
    for forbidden in (
        "notes",
        "preparation_notes",
        "outcome",
        "suggestion",
        "provider",
        "contact",
        "resume",
        "sensitive",
    ):
        assert forbidden not in serialized


def test_today_preserves_legacy_dashboard_follow_up_behavior(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "today-legacy@example.test")
    application = create_application(
        db_session,
        user_id=user["id"],
        title="Legacy role",
        follow_up_on=date.today(),
    )
    start, _ = local_day_bounds("UTC")
    create_follow_up(db_session, application=application, title="Dedicated", due_at=start)

    summary = client.get("/dashboard/summary").json()
    legacy_items = client.get("/dashboard/follow-ups").json()["items"]
    assert summary["follow_ups_due_today"] == 1
    assert [item["id"] for item in legacy_items] == [str(application.id)]


def test_today_enriches_interview_linked_follow_up_with_context(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "today-interview-context@example.test")
    application = create_application(db_session, user_id=user["id"], title="Backend Lead")
    start, _ = local_day_bounds("Pacific/Kiritimati")

    interview = create_interview(
        db_session,
        application=application,
        title="Architecture Deep Dive",
        round=2,
        scheduled_at=start,
    )
    follow_up = create_follow_up(
        db_session,
        application=application,
        interview_id=interview.id,
        title="Send thank-you note",
        due_at=start,
    )

    response = client.get(
        "/dashboard/today", params={"timezone": "Pacific/Kiritimati"}
    )
    assert response.status_code == 200
    groups = group_map(response.json())
    due_items = groups["follow_ups_due_today"]
    assert len(due_items) == 1
    item = due_items[0]
    assert item["id"] == str(follow_up.id)
    assert item["interview_id"] == str(interview.id)
    assert item["interview_title"] == "Architecture Deep Dive"
    assert item["interview_round"] == 2


def test_today_application_level_follow_up_has_null_interview_context(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "today-app-level-context@example.test")
    application = create_application(db_session, user_id=user["id"], title="Frontend Lead")
    start, _ = local_day_bounds("Pacific/Kiritimati")

    follow_up = create_follow_up(
        db_session,
        application=application,
        interview_id=None,
        title="Check status on application",
        due_at=start,
    )

    response = client.get(
        "/dashboard/today", params={"timezone": "Pacific/Kiritimati"}
    )
    assert response.status_code == 200
    groups = group_map(response.json())
    due_items = groups["follow_ups_due_today"]
    assert len(due_items) == 1
    item = due_items[0]
    assert item["id"] == str(follow_up.id)
    assert item["interview_id"] is None
    assert item["interview_title"] is None
    assert item["interview_round"] is None


def test_today_interview_context_preserves_ownership_scoping(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "today-ctx-owner@example.test")
    owner_app = create_application(db_session, user_id=owner["id"], title="Staff SRE")
    start, _ = local_day_bounds("UTC")

    interview = create_interview(
        db_session,
        application=owner_app,
        title="Staff Panel",
        round=3,
        scheduled_at=start,
    )
    create_follow_up(
        db_session,
        application=owner_app,
        interview_id=interview.id,
        title="Owner follow-up",
        due_at=start,
    )

    other_client = TestClient(app)
    try:
        register(other_client, "today-ctx-other@example.test")
        response = other_client.get("/dashboard/today", params={"timezone": "UTC"})
        assert response.status_code == 200
        groups = group_map(response.json())
        all_items = [item for group in groups.values() for item in group]
        assert len(all_items) == 0
    finally:
        other_client.close()
