import uuid
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, Interview, Job


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
    db_session: Session,
    *,
    user_id: uuid.UUID | str,
    title: str = "Software Engineer",
    follow_up_on: date | None = None,
) -> Application:
    job = Job(
        company_name="Example Corp",
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=title,
        application_url="https://example.test/apply",
        match_score=100,
    )
    db_session.add(job)
    db_session.flush()
    application = Application(
        user_id=user_id,
        job_id=job.id,
        status="interviewing",
        follow_up_on=follow_up_on,
    )
    db_session.add(application)
    db_session.flush()
    return application


def create_interview(
    db_session: Session,
    *,
    application: Application,
    title: str = "Technical interview",
) -> Interview:
    interview = Interview(
        application_id=application.id,
        title=title,
        round=1,
    )
    db_session.add(interview)
    db_session.flush()
    return interview


def follow_up_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "type": "thank_you",
        "title": "Send thank-you note",
        "due_at_utc": "2026-09-20T10:00:00-04:00",
        "timezone": "America/New_York",
        "notes": "Mention the platform discussion.",
    }
    payload.update(overrides)
    return payload


def test_follow_up_routes_require_authentication(client: TestClient) -> None:
    application_id = uuid.uuid4()
    follow_up_id = uuid.uuid4()

    assert (
        client.post(
            f"/applications/{application_id}/follow-ups",
            json=follow_up_payload(),
        ).status_code
        == 401
    )
    assert client.get(f"/applications/{application_id}/follow-ups").status_code == 401
    assert (
        client.get(f"/applications/{application_id}/follow-ups/{follow_up_id}").status_code == 401
    )
    assert (
        client.patch(
            f"/applications/{application_id}/follow-ups/{follow_up_id}",
            json={"title": "Updated"},
        ).status_code
        == 401
    )
    assert (
        client.delete(f"/applications/{application_id}/follow-ups/{follow_up_id}").status_code
        == 401
    )


def test_follow_up_crud_filters_and_deletion(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "follow-up-crud@example.test")
    application = create_application(db_session, user_id=user["id"])
    interview = create_interview(db_session, application=application)

    create_response = client.post(
        f"/applications/{application.id}/follow-ups",
        json=follow_up_payload(interview_id=str(interview.id)),
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["user_id"] == user["id"]
    assert created["application_id"] == str(application.id)
    assert created["interview_id"] == str(interview.id)
    assert created["title"] == "Send thank-you note"
    assert datetime.fromisoformat(created["due_at_utc"].replace("Z", "+00:00")) == datetime(
        2026, 9, 20, 14, tzinfo=timezone.utc
    )

    follow_up_id = created["id"]
    get_response = client.get(f"/applications/{application.id}/follow-ups/{follow_up_id}")
    assert get_response.status_code == 200

    list_response = client.get(
        f"/applications/{application.id}/follow-ups",
        params={"interview_id": str(interview.id), "completed": False},
    )
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [follow_up_id]

    update_response = client.patch(
        f"/applications/{application.id}/follow-ups/{follow_up_id}",
        json={
            "type": "status_check",
            "title": "  Check status  ",
            "completed_at": "2026-09-21T15:30:00+01:00",
            "notes": None,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["type"] == "status_check"
    assert updated["title"] == "Check status"
    assert updated["notes"] is None
    assert datetime.fromisoformat(updated["completed_at"].replace("Z", "+00:00")) == datetime(
        2026, 9, 21, 14, 30, tzinfo=timezone.utc
    )

    completed_response = client.get(
        f"/applications/{application.id}/follow-ups",
        params={"completed": True},
    )
    assert [item["id"] for item in completed_response.json()] == [follow_up_id]

    reopen_response = client.patch(
        f"/applications/{application.id}/follow-ups/{follow_up_id}",
        json={"completed_at": None, "interview_id": None},
    )
    assert reopen_response.status_code == 200
    assert reopen_response.json()["completed_at"] is None
    assert reopen_response.json()["interview_id"] is None

    delete_response = client.delete(f"/applications/{application.id}/follow-ups/{follow_up_id}")
    assert delete_response.status_code == 204
    assert (
        client.get(f"/applications/{application.id}/follow-ups/{follow_up_id}").status_code == 404
    )
    assert client.get(f"/applications/{application.id}/follow-ups").json() == []


def test_follow_up_owner_isolation_for_all_operations(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "follow-up-owner@example.test")
    owner_application = create_application(db_session, user_id=owner["id"])
    created = client.post(
        f"/applications/{owner_application.id}/follow-ups",
        json=follow_up_payload(),
    ).json()

    other_client = TestClient(app)
    try:
        register(other_client, "follow-up-other@example.test")
        item_path = f"/applications/{owner_application.id}/follow-ups/{created['id']}"
        assert (
            other_client.get(f"/applications/{owner_application.id}/follow-ups").status_code == 404
        )
        assert (
            other_client.post(
                f"/applications/{owner_application.id}/follow-ups",
                json=follow_up_payload(),
            ).status_code
            == 404
        )
        assert other_client.get(item_path).status_code == 404
        assert other_client.patch(item_path, json={"title": "Stolen"}).status_code == 404
        assert other_client.delete(item_path).status_code == 404
    finally:
        other_client.close()

    assert (
        client.get(f"/applications/{owner_application.id}/follow-ups/{created['id']}").status_code
        == 200
    )


def test_interview_relationship_validation_on_create_update_and_filter(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "follow-up-links@example.test")
    application = create_application(db_session, user_id=user["id"], title="Target")
    other_application = create_application(db_session, user_id=user["id"], title="Other")
    mismatched_interview = create_interview(
        db_session,
        application=other_application,
        title="Other interview",
    )

    for method in ("post",):
        response = getattr(client, method)(
            f"/applications/{application.id}/follow-ups",
            json=follow_up_payload(interview_id=str(mismatched_interview.id)),
        )
        assert response.status_code == 404

    created = client.post(
        f"/applications/{application.id}/follow-ups",
        json=follow_up_payload(),
    ).json()
    item_path = f"/applications/{application.id}/follow-ups/{created['id']}"
    assert (
        client.patch(
            item_path,
            json={"interview_id": str(mismatched_interview.id)},
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/applications/{application.id}/follow-ups",
            params={"interview_id": str(mismatched_interview.id)},
        ).status_code
        == 404
    )

    other_client = TestClient(app)
    try:
        other_user = register(other_client, "follow-up-link-owner@example.test")
        foreign_application = create_application(db_session, user_id=other_user["id"])
        foreign_interview = create_interview(
            db_session,
            application=foreign_application,
            title="Foreign interview",
        )
        assert (
            client.post(
                f"/applications/{application.id}/follow-ups",
                json=follow_up_payload(interview_id=str(foreign_interview.id)),
            ).status_code
            == 404
        )
        assert (
            client.patch(
                item_path,
                json={"interview_id": str(foreign_interview.id)},
            ).status_code
            == 404
        )
    finally:
        other_client.close()


@pytest.mark.parametrize("field", ["due_at_utc", "completed_at"])
def test_follow_up_rejects_naive_datetimes(
    client: TestClient,
    db_session: Session,
    field: str,
) -> None:
    user = register(client, f"follow-up-naive-{field}@example.test")
    application = create_application(db_session, user_id=user["id"])
    payload = follow_up_payload(**{field: "2026-09-20T10:00:00"})

    response = client.post(
        f"/applications/{application.id}/follow-ups",
        json=payload,
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("payload_update", "expected_status"),
    [
        ({"type": "reminder"}, 422),
        ({"title": "   "}, 422),
        ({"title": "x" * 256}, 422),
        ({"notes": "x" * 10_001}, 422),
        ({"timezone": "Mars/Olympus_Mons"}, 422),
    ],
)
def test_follow_up_rejects_invalid_values(
    client: TestClient,
    db_session: Session,
    payload_update: dict[str, object],
    expected_status: int,
) -> None:
    user = register(client, f"follow-up-invalid-{uuid.uuid4()}@example.test")
    application = create_application(db_session, user_id=user["id"])

    response = client.post(
        f"/applications/{application.id}/follow-ups",
        json=follow_up_payload(**payload_update),
    )
    assert response.status_code == expected_status


def test_dedicated_follow_up_drives_dashboard_without_changing_legacy_date(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "follow-up-dashboard@example.test")
    today = date.today()
    application = create_application(
        db_session,
        user_id=user["id"],
        follow_up_on=today,
    )

    before_summary = client.get("/dashboard/summary").json()
    before_items = client.get("/dashboard/follow-ups").json()["items"]
    due_today = datetime.now(timezone.utc).replace(
        hour=12,
        minute=0,
        second=0,
        microsecond=0,
    )
    create_response = client.post(
        f"/applications/{application.id}/follow-ups",
        json=follow_up_payload(
            due_at_utc=due_today.isoformat(),
            timezone="UTC",
        ),
    )
    assert create_response.status_code == 201
    db_session.refresh(application)

    assert application.follow_up_on == today
    after_summary = client.get("/dashboard/summary").json()
    after_items = client.get("/dashboard/follow-ups").json()["items"]
    assert after_summary["follow_ups_due_today"] == (before_summary["follow_ups_due_today"] + 1)
    assert after_summary["follow_ups_overdue"] == before_summary["follow_ups_overdue"]
    before_item_ids = {item["id"] for item in before_items}
    after_item_ids = {item["id"] for item in after_items}
    assert str(application.id) not in before_item_ids
    assert str(application.id) in after_item_ids

    follow_up_id = create_response.json()["id"]
    item_path = f"/applications/{application.id}/follow-ups/{follow_up_id}"
    complete_response = client.patch(
        item_path,
        json={"completed_at": due_today.isoformat()},
    )
    assert complete_response.status_code == 200
    db_session.refresh(application)
    assert application.follow_up_on == today

    reopen_response = client.patch(item_path, json={"completed_at": None})
    assert reopen_response.status_code == 200
    db_session.refresh(application)
    assert application.follow_up_on == today

    delete_response = client.delete(item_path)
    assert delete_response.status_code == 204
    db_session.refresh(application)
    assert application.follow_up_on == today


@pytest.mark.parametrize(
    "deprecated_value",
    [
        "2026-09-20",
        None,
    ],
)
def test_update_application_rejects_deprecated_follow_up_on(
    client: TestClient,
    db_session: Session,
    deprecated_value: str | None,
) -> None:
    user = register(
        client,
        f"application-deprecated-follow-up-{uuid.uuid4()}@example.test",
    )
    application = create_application(
        db_session,
        user_id=user["id"],
        follow_up_on=date(2026, 9, 19),
    )

    response = client.patch(
        f"/applications/{application.id}",
        json={"follow_up_on": deprecated_value},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "follow_up_on is deprecated; use the FollowUp endpoints instead"
    }

    db_session.refresh(application)
    assert application.follow_up_on == date(2026, 9, 19)


def test_update_application_without_follow_up_on_still_succeeds(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(
        client,
        f"application-update-without-follow-up-{uuid.uuid4()}@example.test",
    )
    application = create_application(db_session, user_id=user["id"])

    response = client.patch(
        f"/applications/{application.id}",
        json={"status": "applied"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "applied"
