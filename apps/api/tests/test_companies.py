import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.curated_targets import CURATED_TARGETS, normalize_curated_target_name
from app.database import engine, get_db
from app.main import app
from app.models import AIRun, Application, Company, Contact, FollowUp, Interview, Job, Resume, User
from app.services.source_sync import SAFE_SYNC_FAILURE_MESSAGE


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
        json={"email": email, "password": "correct horse battery staple"},
    )
    assert response.status_code == 201
    return uuid.UUID(response.json()["id"])


def test_curated_target_endpoints_require_authentication(client: TestClient) -> None:
    assert client.get("/companies/curated-targets/preview").status_code == 401
    assert client.post("/companies/curated-targets/add-all").status_code == 401


def test_source_sync_requires_authentication(client: TestClient) -> None:
    assert client.post(f"/companies/{uuid.uuid4()}/sync").status_code == 401


def test_curated_target_normalization_is_narrow_and_deterministic() -> None:
    assert normalize_curated_target_name("  Amazon   Web SERVICES ") == "amazon web services"
    assert normalize_curated_target_name("AWS") != normalize_curated_target_name(
        "Amazon Web Services"
    )


def test_preview_and_add_all_are_owner_scoped_idempotent_and_non_destructive(
    client: TestClient,
    db_session: Session,
) -> None:
    user_id = register(client, "curated-owner@example.test")
    existing = Company(
        user_id=user_id,
        name="  ANTHROPIC ",
        source_type="greenhouse",
        board_token="owner-token",
        careers_url="https://example.test/owner-careers",
        priority="high",
    )
    foreign_user = User(
        email="curated-foreign@example.test",
        password_hash=hash_password("correct horse battery staple"),
    )
    db_session.add_all([existing, foreign_user])
    db_session.flush()
    db_session.add(
        Company(
            user_id=foreign_user.id,
            name="OpenAI",
            source_type="custom",
            board_token="foreign-token",
            careers_url="https://example.test/foreign-careers",
            priority="low",
        )
    )
    db_session.commit()

    preview = client.get("/companies/curated-targets/preview")
    assert preview.status_code == 200
    assert preview.json() == {
        "total_curated": len(CURATED_TARGETS),
        "to_create": len(CURATED_TARGETS) - 1,
        "already_present": 1,
    }

    domain_counts_before = {
        model: db_session.query(model).count()
        for model in (Job, Application, FollowUp, Interview, Contact, AIRun)
    }
    response = client.post("/companies/curated-targets/add-all")
    assert response.status_code == 200
    assert response.json() == {
        "created": len(CURATED_TARGETS) - 1,
        "already_present": 1,
        "total_curated": len(CURATED_TARGETS),
    }

    db_session.refresh(existing)
    assert existing.name == "  ANTHROPIC "
    assert existing.source_type == "greenhouse"
    assert existing.board_token == "owner-token"
    assert existing.careers_url == "https://example.test/owner-careers"
    assert existing.priority == "high"

    created = (
        db_session.query(Company)
        .filter(Company.user_id == user_id, Company.id != existing.id)
        .all()
    )
    assert len(created) == len(CURATED_TARGETS) - 1
    assert all(company.source_type == "manual" for company in created)
    assert all(company.board_token is None for company in created)
    assert all(company.careers_url is None for company in created)

    second_response = client.post("/companies/curated-targets/add-all")
    assert second_response.status_code == 200
    assert second_response.json() == {
        "created": 0,
        "already_present": len(CURATED_TARGETS),
        "total_curated": len(CURATED_TARGETS),
    }
    assert db_session.query(Company).filter(Company.user_id == user_id).count() == len(
        CURATED_TARGETS
    )
    assert {
        model: db_session.query(model).count()
        for model in (Job, Application, FollowUp, Interview, Contact, AIRun)
    } == domain_counts_before


@pytest.mark.parametrize("source_type", ["manual", "custom"])
def test_source_sync_rejects_manual_and_unsupported_without_connector_call(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    source_type: str,
) -> None:
    user_id = register(client, f"sync-{source_type}@example.test")
    source = Company(
        user_id=user_id,
        name="Not synchronizable",
        source_type=source_type,
        board_token=None,
        priority="medium",
    )
    db_session.add(source)
    db_session.commit()
    connector_call = pytest.fail
    monkeypatch.setattr("app.services.source_sync.sync_ashby_jobs", connector_call)
    monkeypatch.setattr("app.services.source_sync.sync_greenhouse_jobs", connector_call)
    monkeypatch.setattr("app.services.source_sync.sync_lever_jobs", connector_call)

    response = client.post(f"/companies/{source.id}/sync")

    assert response.status_code == 422
    assert "board_token" not in response.text


def test_source_sync_is_owner_scoped_and_uses_only_stored_configuration(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = register(client, "sync-owner@example.test")
    foreign_user = User(
        email="sync-foreign@example.test",
        password_hash=hash_password("correct horse battery staple"),
    )
    db_session.add(foreign_user)
    db_session.flush()
    owned_source = Company(
        user_id=user_id,
        name="Owned source",
        source_type="ashby",
        board_token="same-token",
        careers_url="https://example.test/owned",
        priority="high",
    )
    foreign_source = Company(
        user_id=foreign_user.id,
        name="Foreign source",
        source_type="ashby",
        board_token="same-token",
        careers_url="https://example.test/foreign",
        priority="low",
    )
    db_session.add_all([owned_source, foreign_source])
    db_session.commit()

    calls: list[tuple[str, str, uuid.UUID]] = []

    def fake_sync(db: Session, token: str, name: str, *, company: Company) -> dict:
        calls.append((token, name, company.id))
        return {"created": 2, "skipped": 3}

    monkeypatch.setattr("app.services.source_sync.sync_ashby_jobs", fake_sync)
    response = client.post(
        f"/companies/{owned_source.id}/sync",
        params={
            "board_token": "attacker-token",
            "company_name": "Attacker name",
            "source_type": "lever",
            "user_id": str(foreign_user.id),
            "careers_url": "https://attacker.test",
        },
        json={"board_token": "body-token", "source_id": str(foreign_source.id)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "synced",
        "jobs_created": 2,
        "jobs_updated": 3,
        "message": None,
    }
    assert calls == [("same-token", "Owned source", owned_source.id)]

    not_owned = client.post(f"/companies/{foreign_source.id}/sync")
    assert not_owned.status_code == 404
    assert not_owned.json() == {"detail": "Company source not found"}
    assert len(calls) == 1

    db_session.refresh(owned_source)
    assert owned_source.board_token == "same-token"
    assert owned_source.careers_url == "https://example.test/owned"
    assert owned_source.source_type == "ashby"
    assert owned_source.priority == "high"


def test_source_sync_uses_owned_company_for_job_association(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = register(client, "sync-job-owner@example.test")
    foreign_user = User(
        email="sync-job-foreign@example.test",
        password_hash=hash_password("correct horse battery staple"),
    )
    db_session.add(foreign_user)
    db_session.flush()
    foreign_source = Company(
        user_id=foreign_user.id,
        name="Foreign duplicate token",
        source_type="ashby",
        board_token="shared-board",
        priority="medium",
    )
    owned_source = Company(
        user_id=user_id,
        name="Owned duplicate token",
        source_type="ashby",
        board_token="shared-board",
        priority="medium",
    )
    db_session.add_all([foreign_source, owned_source])
    db_session.commit()
    monkeypatch.setattr(
        "app.connectors.ashby.fetch_ashby_jobs",
        lambda _token: [
            {
                "jobUrl": "https://example.test/job/owner-scoped",
                "applyUrl": "https://example.test/job/owner-scoped/apply",
                "title": "Platform Engineer",
                "descriptionPlain": "Synthetic role",
                "location": "Remote",
            }
        ],
    )
    unrelated_counts = {
        model: db_session.query(model).count()
        for model in (Application, FollowUp, Interview, Contact, Resume, AIRun)
    }

    response = client.post(f"/companies/{owned_source.id}/sync")

    assert response.status_code == 200
    assert response.json()["status"] == "synced"
    job = db_session.query(Job).filter(Job.external_job_id.contains("owner-scoped")).one()
    assert job.company_id == owned_source.id
    assert {
        model: db_session.query(model).count()
        for model in (Application, FollowUp, Interview, Contact, Resume, AIRun)
    } == unrelated_counts


def test_source_sync_sanitizes_connector_failure(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = register(client, "sync-failure@example.test")
    source = Company(
        user_id=user_id,
        name="Failure source",
        source_type="lever",
        board_token="secret-board-token",
        careers_url="https://external.example.test/private",
        priority="medium",
    )
    db_session.add(source)
    db_session.commit()

    def fail_sync(*_args: object, **_kwargs: object) -> dict:
        raise RuntimeError(
            "raw provider body; secret-board-token; Authorization: Bearer credential"
        )

    monkeypatch.setattr("app.services.source_sync.sync_lever_jobs", fail_sync)
    response = client.post(f"/companies/{source.id}/sync")

    assert response.status_code == 200
    assert response.json() == {
        "status": "failed",
        "jobs_created": None,
        "jobs_updated": None,
        "message": SAFE_SYNC_FAILURE_MESSAGE,
    }
    response_text = response.text
    assert "secret-board-token" not in response_text
    assert "external.example.test" not in response_text
    assert "raw provider body" not in response_text
    assert "Authorization" not in response_text
