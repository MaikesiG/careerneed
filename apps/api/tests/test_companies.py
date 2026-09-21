import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.curated_targets import CURATED_TARGETS, normalize_curated_target_name
from app.database import engine, get_db
from app.main import app
from app.models import AIRun, Application, Company, Contact, FollowUp, Interview, Job, User


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
