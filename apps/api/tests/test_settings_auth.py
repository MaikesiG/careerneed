import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import LLMCredential


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


def test_settings_routes_require_authentication(client: TestClient) -> None:
    list_response = client.get("/settings/llm-credentials")
    save_response = client.post(
        "/settings/llm-credentials",
        json={
            "provider": "openai",
            "api_key": "test-unauthenticated-key-123456",
        },
    )
    delete_response = client.delete("/settings/llm-credentials/openai")
    mode_response = client.get("/settings/extraction-mode")

    assert list_response.status_code == 401
    assert save_response.status_code == 401
    assert delete_response.status_code == 401
    assert mode_response.status_code == 401


def test_user_sees_masked_own_credential_only(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "settings-owner@example.test")

    saved = client.post(
        "/settings/llm-credentials",
        json={
            "provider": "openai",
            "api_key": "owner-openai-key-1234567890",
        },
    )

    assert saved.status_code == 201
    body = saved.json()
    assert body["provider"] == "openai"
    assert body["masked_key"] != "owner-openai-key-1234567890"
    assert body["masked_key"] == "owne...7890"

    stored_owner_credential = db_session.scalar(
        select(LLMCredential).where(
            LLMCredential.user_id == owner["id"],
            LLMCredential.provider == "openai",
        )
    )
    assert stored_owner_credential is not None
    assert stored_owner_credential.encrypted_api_key != "owner-openai-key-1234567890"

    other_client = TestClient(app)
    try:
        register(other_client, "settings-other@example.test")

        owner_list = client.get("/settings/llm-credentials")
        other_list = other_client.get("/settings/llm-credentials")

        assert owner_list.status_code == 200
        assert [item["provider"] for item in owner_list.json()] == ["openai"]

        assert other_list.status_code == 200
        assert other_list.json() == []
    finally:
        other_client.close()


def test_same_provider_is_isolated_per_user(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "settings-owner@example.test")

    owner_save = client.post(
        "/settings/llm-credentials",
        json={
            "provider": "openai",
            "api_key": "owner-openai-key-1234567890",
        },
    )
    assert owner_save.status_code == 201

    other_client = TestClient(app)
    try:
        other = register(other_client, "settings-other@example.test")

        other_save = other_client.post(
            "/settings/llm-credentials",
            json={
                "provider": "openai",
                "api_key": "other-openai-key-1234567890",
            },
        )
        assert other_save.status_code == 201

        owner_credential = db_session.scalar(
            select(LLMCredential).where(
                LLMCredential.user_id == owner["id"],
                LLMCredential.provider == "openai",
            )
        )
        other_credential = db_session.scalar(
            select(LLMCredential).where(
                LLMCredential.user_id == other["id"],
                LLMCredential.provider == "openai",
            )
        )

        assert owner_credential is not None
        assert other_credential is not None
        assert owner_credential.id != other_credential.id
        assert owner_credential.encrypted_api_key != other_credential.encrypted_api_key
    finally:
        other_client.close()


def test_user_cannot_delete_another_users_same_provider_credential(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "settings-owner@example.test")
    owner_save = client.post(
        "/settings/llm-credentials",
        json={
            "provider": "openai",
            "api_key": "owner-openai-key-1234567890",
        },
    )
    assert owner_save.status_code == 201

    other_client = TestClient(app)
    try:
        register(other_client, "settings-other@example.test")

        forbidden_delete = other_client.delete("/settings/llm-credentials/openai")

        assert forbidden_delete.status_code == 404
        assert forbidden_delete.json()["detail"] == "Credential not found"

        owner_credential = db_session.scalar(
            select(LLMCredential).where(
                LLMCredential.user_id == owner["id"],
                LLMCredential.provider == "openai",
            )
        )
        assert owner_credential is not None
    finally:
        other_client.close()


def test_user_can_delete_own_credential(client: TestClient) -> None:
    register(client, "settings-owner@example.test")

    saved = client.post(
        "/settings/llm-credentials",
        json={
            "provider": "groq",
            "api_key": "owner-groq-key-1234567890",
        },
    )
    assert saved.status_code == 201

    deleted = client.delete("/settings/llm-credentials/groq")
    listed = client.get("/settings/llm-credentials")

    assert deleted.status_code == 204
    assert deleted.content == b""
    assert listed.status_code == 200
    assert listed.json() == []
