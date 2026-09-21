import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, FollowUp, Interview, Job
from app.routers import dashboard as dashboard_router


FIXED_NOW_UTC = datetime(2026, 3, 8, 12, tzinfo=timezone.utc)


class FrozenDashboardDateTime(datetime):
    @classmethod
    def now(cls, tz: timezone | ZoneInfo | None = None) -> datetime:
        if tz is None:
            return FIXED_NOW_UTC.replace(tzinfo=None)
        return FIXED_NOW_UTC.astimezone(tz)


@pytest.fixture(autouse=True)
def freeze_dashboard_time(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dashboard_router, "datetime", FrozenDashboardDateTime)


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
    status: str = "interviewing",
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
        status=status,
        follow_up_on=follow_up_on,
    )
    db.add(application)
    db.flush()
    return application


def local_day_bounds(timezone_name: str) -> tuple[datetime, datetime]:
    requested_timezone = ZoneInfo(timezone_name)
    local_date = FIXED_NOW_UTC.astimezone(requested_timezone).date()
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


def test_today_coexists_with_canonical_dashboard_follow_up_behavior(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "today-legacy@example.test")
    application = create_application(
        db_session,
        user_id=user["id"],
        title="Legacy role",
        follow_up_on=FIXED_NOW_UTC.date(),
    )
    start, _ = local_day_bounds("UTC")
    create_follow_up(db_session, application=application, title="Dedicated", due_at=start)

    summary = client.get("/dashboard/summary").json()
    dashboard_items = client.get("/dashboard/follow-ups").json()["items"]
    assert summary["follow_ups_due_today"] == 1
    assert [item["id"] for item in dashboard_items] == [str(application.id)]


def test_dashboard_follow_up_contract_defaults_to_utc_and_ignores_legacy_date(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "dashboard-canonical-default@example.test")
    start, _ = local_day_bounds("UTC")
    canonical_application = create_application(
        db_session,
        user_id=user["id"],
        title="Canonical role",
        status="saved",
    )
    create_follow_up(
        db_session,
        application=canonical_application,
        title="Canonical reminder",
        due_at=start,
    )
    create_application(
        db_session,
        user_id=user["id"],
        title="Legacy-only role",
        follow_up_on=FIXED_NOW_UTC.date(),
        status="applied",
    )

    summary_response = client.get("/dashboard/summary")
    assert summary_response.status_code == 200
    summary = summary_response.json()
    assert summary["follow_ups_due_today"] == 1
    assert summary["follow_ups_overdue"] == 0
    assert summary["applications_saved"] == 1
    assert summary["applications_applied"] == 1
    assert summary["applications_interviewing"] == 0
    assert summary["active_applications"] == 1

    follow_ups_response = client.get("/dashboard/follow-ups")
    assert follow_ups_response.status_code == 200
    items = follow_ups_response.json()["items"]
    assert [item["id"] for item in items] == [str(canonical_application.id)]
    assert items[0]["follow_up_on"] == FIXED_NOW_UTC.date().isoformat()


@pytest.mark.parametrize("path", ["/dashboard/summary", "/dashboard/follow-ups"])
def test_dashboard_follow_up_contract_validates_iana_timezone(
    client: TestClient,
    path: str,
) -> None:
    register(client, f"dashboard-timezone-{path.rsplit('/', 1)[-1]}@example.test")

    valid_response = client.get(path, params={"timezone": "America/New_York"})
    assert valid_response.status_code == 200

    invalid_response = client.get(path, params={"timezone": "Mars/Olympus_Mons"})
    assert invalid_response.status_code == 422
    assert invalid_response.json() == {"detail": "Invalid IANA timezone"}


def test_dashboard_summary_counts_applications_by_earliest_open_follow_up(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "dashboard-earliest@example.test")
    start, next_start = local_day_bounds("America/New_York")

    overdue_application = create_application(
        db_session, user_id=user["id"], title="Overdue role"
    )
    create_follow_up(
        db_session,
        application=overdue_application,
        title="Earliest overdue",
        due_at=start - timedelta(hours=2),
    )
    create_follow_up(
        db_session,
        application=overdue_application,
        title="Also due today",
        due_at=start + timedelta(hours=2),
    )

    due_application = create_application(
        db_session, user_id=user["id"], title="Due-today role"
    )
    create_follow_up(
        db_session,
        application=due_application,
        title="Start boundary",
        due_at=start,
    )
    create_follow_up(
        db_session,
        application=due_application,
        title="Second reminder",
        due_at=start + timedelta(hours=1),
    )

    final_instant_application = create_application(
        db_session, user_id=user["id"], title="Final-instant role"
    )
    create_follow_up(
        db_session,
        application=final_instant_application,
        title="Completed earlier reminder",
        due_at=start - timedelta(days=2),
        completed_at=start - timedelta(days=1),
    )
    create_follow_up(
        db_session,
        application=final_instant_application,
        title="Final instant",
        due_at=next_start - timedelta(microseconds=1),
    )

    future_application = create_application(
        db_session, user_id=user["id"], title="Future role"
    )
    create_follow_up(
        db_session,
        application=future_application,
        title="Next midnight",
        due_at=next_start,
    )

    completed_only_application = create_application(
        db_session, user_id=user["id"], title="Completed-only role"
    )
    create_follow_up(
        db_session,
        application=completed_only_application,
        title="Completed",
        due_at=start,
        completed_at=start,
    )

    response = client.get(
        "/dashboard/summary", params={"timezone": "America/New_York"}
    )
    assert response.status_code == 200
    summary = response.json()
    assert summary["follow_ups_overdue"] == 1
    assert summary["follow_ups_due_today"] == 2

    item_ids = {
        item["id"]
        for item in client.get(
            "/dashboard/follow-ups",
            params={"timezone": "America/New_York"},
        ).json()["items"]
    }
    assert str(completed_only_application.id) not in item_ids
    assert str(future_application.id) not in item_ids


def test_dashboard_follow_ups_are_application_centric_ordered_and_limited(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "dashboard-list@example.test")
    start, _ = local_day_bounds("America/New_York")

    first = create_application(db_session, user_id=user["id"], title="First role")
    create_follow_up(
        db_session,
        application=first,
        title="First open",
        due_at=start - timedelta(hours=3),
    )
    create_follow_up(
        db_session,
        application=first,
        title="Duplicate application reminder",
        due_at=start + timedelta(hours=3),
    )

    second = create_application(db_session, user_id=user["id"], title="Second role")
    create_follow_up(
        db_session,
        application=second,
        title="Completed old reminder",
        due_at=start - timedelta(days=3),
        completed_at=start - timedelta(days=2),
    )
    create_follow_up(
        db_session,
        application=second,
        title="Second open",
        due_at=start,
    )

    third = create_application(db_session, user_id=user["id"], title="Third role")
    create_follow_up(
        db_session,
        application=third,
        title="Third open",
        due_at=start + timedelta(hours=1),
    )

    response = client.get(
        "/dashboard/follow-ups",
        params={"timezone": "America/New_York", "limit": 2},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["id"] for item in items] == [str(first.id), str(second.id)]
    assert len({item["id"] for item in items}) == 2
    assert items[0]["follow_up_on"] == (
        FIXED_NOW_UTC.astimezone(ZoneInfo("America/New_York")).date()
        - timedelta(days=1)
    ).isoformat()
    assert items[1]["follow_up_on"] == FIXED_NOW_UTC.astimezone(
        ZoneInfo("America/New_York")
    ).date().isoformat()


def test_dashboard_follow_up_boundaries_use_dst_local_midnights(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "dashboard-dst@example.test")
    start, next_start = local_day_bounds("America/New_York")
    assert next_start - start == timedelta(hours=23)

    overdue = create_application(db_session, user_id=user["id"], title="Before start")
    create_follow_up(
        db_session,
        application=overdue,
        title="Before start",
        due_at=start - timedelta(microseconds=1),
    )
    due_at_start = create_application(db_session, user_id=user["id"], title="At start")
    create_follow_up(
        db_session,
        application=due_at_start,
        title="At start",
        due_at=start,
    )
    due_at_end = create_application(db_session, user_id=user["id"], title="At end")
    create_follow_up(
        db_session,
        application=due_at_end,
        title="At end",
        due_at=next_start - timedelta(microseconds=1),
    )
    next_day = create_application(db_session, user_id=user["id"], title="Next day")
    create_follow_up(
        db_session,
        application=next_day,
        title="Next midnight",
        due_at=next_start,
    )

    summary = client.get(
        "/dashboard/summary", params={"timezone": "America/New_York"}
    ).json()
    assert summary["follow_ups_overdue"] == 1
    assert summary["follow_ups_due_today"] == 2

    items = client.get(
        "/dashboard/follow-ups", params={"timezone": "America/New_York"}
    ).json()["items"]
    assert [item["id"] for item in items] == [
        str(overdue.id),
        str(due_at_start.id),
        str(due_at_end.id),
    ]
    assert str(next_day.id) not in {item["id"] for item in items}


def test_dashboard_follow_up_contract_preserves_owner_isolation(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "dashboard-owner@example.test")
    start, _ = local_day_bounds("UTC")
    owner_application = create_application(
        db_session, user_id=owner["id"], title="Owner role"
    )
    create_follow_up(
        db_session,
        application=owner_application,
        title="Owner reminder",
        due_at=start,
    )

    other_client = TestClient(app)
    try:
        other = register(other_client, "dashboard-foreign@example.test")
        foreign_application = create_application(
            db_session, user_id=other["id"], title="Foreign role"
        )
        create_follow_up(
            db_session,
            application=foreign_application,
            title="Foreign reminder",
            due_at=start - timedelta(days=1),
        )

        summary = client.get("/dashboard/summary").json()
        assert summary["follow_ups_due_today"] == 1
        assert summary["follow_ups_overdue"] == 0
        items = client.get("/dashboard/follow-ups").json()["items"]
        assert [item["id"] for item in items] == [str(owner_application.id)]
    finally:
        other_client.close()


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
