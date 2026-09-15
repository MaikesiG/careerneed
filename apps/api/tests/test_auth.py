from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import SESSION_COOKIE_NAME, hash_session_token, utcnow
from app.database import engine, get_db
from app.main import app
from app.models import User, UserSession


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


def credentials(
    email: str = "person@example.test",
    password: str = "correct horse battery staple",
) -> dict[str, str]:
    return {"email": email, "password": password}


def test_register_creates_password_protected_user_and_session(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post("/auth/register", json=credentials())

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "person@example.test"
    assert "password" not in body
    assert "password_hash" not in body
    assert response.headers["cache-control"] == "no-store"
    assert SESSION_COOKIE_NAME in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]

    user = db_session.scalar(select(User).where(User.email == "person@example.test"))
    assert user is not None
    assert user.password_hash is not None
    assert user.password_hash != "correct horse battery staple"
    assert user.password_set_at is not None

    session = db_session.scalar(select(UserSession).where(UserSession.user_id == user.id))
    assert session is not None
    assert len(session.token_hash) == 64


def test_register_normalizes_email_and_rejects_duplicate(
    client: TestClient,
) -> None:
    first = client.post(
        "/auth/register",
        json=credentials(email="  Person@Example.Test  "),
    )
    duplicate = client.post("/auth/register", json=credentials())

    assert first.status_code == 201
    assert first.json()["email"] == "person@example.test"
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Email already registered"


def test_register_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json=credentials(password="too-short"),
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Password must be at least 12 characters long"


def test_login_sets_a_new_session_cookie(
    client: TestClient,
) -> None:
    registered = client.post("/auth/register", json=credentials())
    assert registered.status_code == 201

    client.cookies.clear()
    response = client.post("/auth/login", json=credentials())

    assert response.status_code == 200
    assert response.json()["email"] == "person@example.test"
    assert SESSION_COOKIE_NAME in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "attempt",
    [
        credentials(email="missing@example.test"),
        credentials(password="wrong password value"),
    ],
)
def test_login_rejects_unknown_email_and_bad_password_identically(
    client: TestClient,
    attempt: dict[str, str],
) -> None:
    client.post("/auth/register", json=credentials())

    response = client.post("/auth/login", json=attempt)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_rejects_legacy_user_without_password(
    client: TestClient,
    db_session: Session,
) -> None:
    db_session.add(User(email="legacy@example.test"))
    db_session.flush()

    response = client.post(
        "/auth/login",
        json=credentials(email="legacy@example.test"),
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_me_returns_the_authenticated_user(client: TestClient) -> None:
    registered = client.post("/auth/register", json=credentials())
    assert registered.status_code == 201

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["id"] == registered.json()["id"]
    assert response.json()["email"] == "person@example.test"


def test_me_rejects_missing_or_unknown_session(client: TestClient) -> None:
    missing = client.get("/auth/me")
    assert missing.status_code == 401
    assert missing.json()["detail"] == "Not authenticated"

    client.cookies.set(SESSION_COOKIE_NAME, "unknown-session-token")
    unknown = client.get("/auth/me")
    assert unknown.status_code == 401
    assert unknown.json()["detail"] == "Not authenticated"


def test_me_rejects_and_removes_expired_session(
    client: TestClient,
    db_session: Session,
) -> None:
    user = User(email="expired@example.test", password_hash="not-used")
    db_session.add(user)
    db_session.flush()

    token = "expired-session-token"
    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(token),
        expires_at=utcnow() - timedelta(seconds=1),
    )
    db_session.add(session)
    db_session.flush()

    client.cookies.set(SESSION_COOKIE_NAME, token)
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert db_session.get(UserSession, session.id) is None


def test_logout_revokes_session_and_clears_cookie(
    client: TestClient,
    db_session: Session,
) -> None:
    registered = client.post("/auth/register", json=credentials())
    assert registered.status_code == 201

    session = db_session.scalar(select(UserSession))
    assert session is not None

    response = client.post("/auth/logout")

    assert response.status_code == 204
    assert response.content == b""
    assert response.headers["cache-control"] == "no-store"
    assert SESSION_COOKIE_NAME in response.headers["set-cookie"]
    assert "Max-Age=0" in response.headers["set-cookie"]
    assert db_session.get(UserSession, session.id) is None

    after_logout = client.get("/auth/me")
    assert after_logout.status_code == 401


def test_logout_succeeds_without_a_session_cookie(client: TestClient) -> None:
    response = client.post("/auth/logout")

    assert response.status_code == 204
    assert response.content == b""
