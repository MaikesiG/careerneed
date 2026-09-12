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
