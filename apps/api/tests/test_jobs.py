from datetime import date, timedelta
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, Job, User
from app.routers.jobs import INITIAL_USER_ID


@pytest.fixture
def db_session() -> Session:
    """Run every request in a transaction that is rolled back after the test."""
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


def create_job(db_session: Session, *, title: str, workplace_type: str = "unknown") -> Job:
    job = Job(
        company_name="Regression Test Co.",
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=title,
        workplace_type=workplace_type,
        application_url="https://example.com/apply",
        match_score=100,
    )
    db_session.add(job)
    db_session.flush()
    return job


def ensure_initial_user(db_session: Session) -> None:
    if db_session.get(User, INITIAL_USER_ID) is None:
        db_session.add(User(id=INITIAL_USER_ID, email="initial-user@example.test"))
        db_session.flush()


def test_list_jobs_returns_ok(client: TestClient) -> None:
    response = client.get(
        "/jobs",
        params={
            "limit": 5,
            "offset": 0,
        },
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) <= 5
    assert "x-total-count" in response.headers
    assert "x-total-pages" in response.headers


def test_list_jobs_supports_sorting(client: TestClient) -> None:
    for sort, sort_direction in [
        ("match_score", "desc"),
        ("match_score", "asc"),
        ("recent", "desc"),
        ("recent", "asc"),
    ]:
        response = client.get(
            "/jobs",
            params={
                "limit": 5,
                "offset": 0,
                "sort": sort,
                "sort_direction": sort_direction,
            },
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_list_jobs_supports_multi_value_filters(client: TestClient) -> None:
    response = client.get(
        "/jobs",
        params=[
            ("limit", "5"),
            ("offset", "0"),
            ("source", "greenhouse"),
            ("source", "lever"),
            ("workplace_type", "remote"),
            ("workplace_type", "hybrid"),
            ("min_match_score", "70"),
            ("date_range", "week"),
            ("sort", "match_score"),
            ("sort_direction", "desc"),
        ],
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) <= 5
    assert "x-total-count" in response.headers
    assert "x-total-pages" in response.headers


def test_list_jobs_rejects_invalid_sort(client: TestClient) -> None:
    response = client.get(
        "/jobs",
        params={
            "sort": "title",
            "sort_direction": "desc",
        },
    )

    assert response.status_code == 422


def test_list_jobs_rejects_invalid_date_range(client: TestClient) -> None:
    response = client.get(
        "/jobs",
        params={
            "date_range": "year",
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize("minimum_score", [50, 75, 90])
def test_list_jobs_supports_match_score_thresholds(client: TestClient, minimum_score: int) -> None:
    response = client.get("/jobs", params={"min_match_score": minimum_score})

    assert response.status_code == 200


@pytest.mark.parametrize("date_range", ["all", "yesterday", "week", "month"])
def test_list_jobs_supports_date_ranges(client: TestClient, date_range: str) -> None:
    response = client.get("/jobs", params={"date_range": date_range})

    assert response.status_code == 200


def test_list_jobs_rejects_invalid_application_status(client: TestClient) -> None:
    response = client.get("/jobs", params={"application_status": "not-a-real-status"})

    assert response.status_code == 422


def test_list_jobs_matches_historical_workplace_type_variants(
    client: TestClient, db_session: Session
) -> None:
    onsite_job = create_job(db_session, title="Historical onsite role", workplace_type="OnSite")
    distributed_job = create_job(
        db_session, title="Historical distributed role", workplace_type="Distributed"
    )

    onsite_response = client.get("/jobs", params={"workplace_type": "onsite"})
    remote_response = client.get("/jobs", params={"workplace_type": "remote"})

    onsite_job_ids = {job["id"] for job in onsite_response.json()}
    remote_job_ids = {job["id"] for job in remote_response.json()}

    assert onsite_response.status_code == 200
    assert remote_response.status_code == 200
    assert str(onsite_job.id) in onsite_job_ids
    assert str(distributed_job.id) in remote_job_ids


def test_application_by_job_update_preserves_notes_when_only_status_changes(
    client: TestClient, db_session: Session
) -> None:
    ensure_initial_user(db_session)
    job = create_job(db_session, title="Application details job")

    created_response = client.put(
        f"/applications/by-job/{job.id}",
        json={"status": "saved", "notes": "Ask Casey for a referral."},
    )
    updated_response = client.put(
        f"/applications/by-job/{job.id}",
        json={"status": "interviewing"},
    )
    state_response = client.get(
        "/applications/me/job-states",
        params={"job_id": str(job.id)},
    )

    assert created_response.status_code == 200
    assert updated_response.status_code == 200
    assert updated_response.json()["status"] == "interviewing"
    assert updated_response.json()["notes"] == "Ask Casey for a referral."
    assert state_response.status_code == 200
    assert state_response.json()["states"][str(job.id)]["notes"] == "Ask Casey for a referral."


def test_list_jobs_filters_tracking_status_for_initial_user_only(
    client: TestClient, db_session: Session
) -> None:
    ensure_initial_user(db_session)
    current_user_job = create_job(db_session, title="Current user's saved job")
    current_user_applied_job = create_job(db_session, title="Current user's applied job")
    other_user_job = create_job(db_session, title="Another user's saved job")
    other_user = User(id=uuid.uuid4(), email="other-user@example.test")
    db_session.add_all(
        [
            other_user,
            Application(user_id=INITIAL_USER_ID, job_id=current_user_job.id, status="saved"),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=current_user_applied_job.id,
                status="applied",
            ),
            Application(user_id=other_user.id, job_id=other_user_job.id, status="saved"),
        ]
    )
    db_session.flush()

    saved_response = client.get("/jobs", params={"application_status": "saved"})
    applied_response = client.get("/jobs", params={"application_status": "applied"})
    combined_response = client.get(
        "/jobs",
        params=[("application_status", "saved"), ("application_status", "applied")],
    )

    assert saved_response.status_code == 200
    assert applied_response.status_code == 200
    assert combined_response.status_code == 200

    saved_job_ids = {job["id"] for job in saved_response.json()}
    applied_job_ids = {job["id"] for job in applied_response.json()}
    combined_job_ids = {job["id"] for job in combined_response.json()}

    assert str(current_user_job.id) in saved_job_ids
    assert str(current_user_applied_job.id) not in saved_job_ids
    assert str(current_user_applied_job.id) in applied_job_ids
    assert str(current_user_job.id) not in applied_job_ids
    assert {str(current_user_job.id), str(current_user_applied_job.id)} <= combined_job_ids
    assert str(other_user_job.id) not in combined_job_ids


def test_get_application_detail_includes_job(
    client: TestClient,
    db_session: Session,
) -> None:
    job = create_job(
        db_session,
        title="Application detail test role",
    )
    application = Application(
        user_id=INITIAL_USER_ID,
        job_id=job.id,
        status="applied",
        notes="Initial application note",
    )
    db_session.add(application)
    db_session.commit()
    db_session.refresh(application)

    response = client.get(f"/applications/{application.id}")

    assert response.status_code == 200

    body = response.json()
    assert body["id"] == str(application.id)
    assert body["status"] == "applied"
    assert body["notes"] == "Initial application note"
    assert body["job"]["id"] == str(job.id)
    assert body["job"]["title"] == job.title
    assert body["job"]["company_name"] == job.company_name


def test_list_jobs_filters_by_location_query(
    client: TestClient,
    db_session: Session,
) -> None:
    canada_job = create_job(db_session, title="Canada role")
    canada_job.location = "Toronto, Ontario, Canada"

    ny_job = create_job(db_session, title="New York role")
    ny_job.location = "New York City, NY, United States"

    remote_job = create_job(db_session, title="Remote role")
    remote_job.location = "Remote, Global"
    remote_job.workplace_type = "remote"

    db_session.commit()

    canada_response = client.get(
        "/jobs",
        params={"location_query": "canada"},
    )

    assert canada_response.status_code == 200
    canada_titles = {job["title"] for job in canada_response.json()}
    assert "Canada role" in canada_titles
    assert "New York role" not in canada_titles
    assert "Remote role" not in canada_titles

    new_york_response = client.get(
        "/jobs",
        params={"location_query": "NEW YORK"},
    )

    assert new_york_response.status_code == 200
    new_york_titles = {job["title"] for job in new_york_response.json()}
    assert "New York role" in new_york_titles
    assert "Canada role" not in new_york_titles

    combined_response = client.get(
        "/jobs",
        params=[
            ("location_query", "remote"),
            ("workplace_type", "remote"),
        ],
    )

    assert combined_response.status_code == 200
    combined_titles = {job["title"] for job in combined_response.json()}
    assert "Remote role" in combined_titles

def test_dashboard_summary_returns_expected_shape(
    client: TestClient,
) -> None:
    response = client.get("/dashboard/summary")

    assert response.status_code == 200

    summary = response.json()
    expected_keys = {
        "follow_ups_due_today",
        "follow_ups_overdue",
        "applications_saved",
        "applications_applied",
        "applications_interviewing",
        "active_applications",
    }

    assert set(summary) == expected_keys
    assert all(isinstance(summary[key], int) and summary[key] >= 0 for key in expected_keys)
    assert summary["active_applications"] == (
        summary["applications_applied"] + summary["applications_interviewing"]
    )


def test_dashboard_summary_counts_added_records_and_excludes_other_users(
    client: TestClient,
    db_session: Session,
) -> None:
    before_response = client.get("/dashboard/summary")
    assert before_response.status_code == 200
    before = before_response.json()

    ensure_initial_user(db_session)

    other_user = User(id=uuid.uuid4(), email="other-dashboard-user@example.test")
    db_session.add(other_user)
    db_session.flush()

    today = date.today()

    saved_job = create_job(db_session, title="Dashboard saved role")
    applied_job = create_job(db_session, title="Dashboard applied role")
    interviewing_job = create_job(db_session, title="Dashboard interviewing role")
    offer_job = create_job(db_session, title="Dashboard offer role")
    rejected_job = create_job(db_session, title="Dashboard rejected role")
    withdrawn_job = create_job(db_session, title="Dashboard withdrawn role")
    future_follow_up_job = create_job(db_session, title="Dashboard future follow-up role")
    other_user_job = create_job(db_session, title="Other user dashboard role")

    db_session.add_all(
        [
            Application(
                user_id=INITIAL_USER_ID,
                job_id=saved_job.id,
                status="saved",
            ),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=applied_job.id,
                status="applied",
                follow_up_on=today,
            ),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=interviewing_job.id,
                status="interviewing",
                follow_up_on=today - timedelta(days=1),
            ),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=offer_job.id,
                status="offer",
                follow_up_on=today - timedelta(days=3),
            ),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=rejected_job.id,
                status="rejected",
            ),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=withdrawn_job.id,
                status="withdrawn",
            ),
            Application(
                user_id=INITIAL_USER_ID,
                job_id=future_follow_up_job.id,
                status="saved",
                follow_up_on=today + timedelta(days=1),
            ),
            Application(
                user_id=other_user.id,
                job_id=other_user_job.id,
                status="applied",
                follow_up_on=today,
            ),
        ]
    )
    db_session.commit()

    after_response = client.get("/dashboard/summary")
    assert after_response.status_code == 200
    after = after_response.json()

    assert after["follow_ups_due_today"] == before["follow_ups_due_today"] + 1
    assert after["follow_ups_overdue"] == before["follow_ups_overdue"] + 2
    assert after["applications_saved"] == before["applications_saved"] + 2
    assert after["applications_applied"] == before["applications_applied"] + 1
    assert after["applications_interviewing"] == before["applications_interviewing"] + 1
    assert after["active_applications"] == before["active_applications"] + 2
