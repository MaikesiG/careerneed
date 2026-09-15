from datetime import datetime
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Resume, User


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


def create_resume(
    db_session: Session,
    user_id: uuid.UUID,
    *,
    filename: str = "resume.pdf",
    is_default: bool = False,
) -> Resume:
    resume = Resume(
        user_id=user_id,
        filename=filename,
        raw_text="Resume text",
        skills="Python",
        is_default=is_default,
        source="test",
        uploaded_at=datetime.utcnow(),
    )
    db_session.add(resume)
    db_session.flush()
    return resume


def test_resume_routes_require_authentication(client: TestClient) -> None:
    list_response = client.get("/resumes")
    detail_response = client.get("/resumes/00000000-0000-0000-0000-000000000000")
    patch_response = client.patch(
        "/resumes/00000000-0000-0000-0000-000000000000",
        json={"label": "Updated"},
    )
    delete_response = client.delete("/resumes/00000000-0000-0000-0000-000000000000")

    assert list_response.status_code == 401
    assert detail_response.status_code == 401
    assert patch_response.status_code == 401
    assert delete_response.status_code == 401


def test_list_resumes_returns_only_current_users_resumes(
    client: TestClient,
    db_session: Session,
) -> None:
    first_user = register(client, "resume-owner@example.test")
    first_user_id = first_user["id"]
    create_resume(db_session, first_user_id, filename="owner.pdf")

    other_client = TestClient(app)
    try:
        second_user = register(other_client, "resume-other@example.test")
        create_resume(db_session, second_user["id"], filename="other.pdf")

        own_response = client.get("/resumes")
        other_response = other_client.get("/resumes")

        assert own_response.status_code == 200
        assert [item["filename"] for item in own_response.json()] == ["owner.pdf"]

        assert other_response.status_code == 200
        assert [item["filename"] for item in other_response.json()] == ["other.pdf"]
    finally:
        other_client.close()


def test_other_user_cannot_read_update_or_delete_resume(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "resume-owner@example.test")
    owner_resume = create_resume(db_session, owner["id"], filename="owner.pdf")

    other_client = TestClient(app)
    try:
        register(other_client, "resume-other@example.test")

        detail_response = other_client.get(f"/resumes/{owner_resume.id}")
        update_response = other_client.patch(
            f"/resumes/{owner_resume.id}",
            json={"label": "Not allowed"},
        )
        delete_response = other_client.delete(f"/resumes/{owner_resume.id}")

        assert detail_response.status_code == 404
        assert detail_response.json()["detail"] == "Resume not found"
        assert update_response.status_code == 404
        assert update_response.json()["detail"] == "Resume not found"
        assert delete_response.status_code == 404
        assert delete_response.json()["detail"] == "Resume not found"

        db_session.refresh(owner_resume)
        assert owner_resume.label is None
    finally:
        other_client.close()


def test_setting_default_resume_only_changes_current_users_resumes(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "resume-owner@example.test")
    owner_old_default = create_resume(
        db_session,
        owner["id"],
        filename="owner-old.pdf",
        is_default=True,
    )
    owner_new_default = create_resume(
        db_session,
        owner["id"],
        filename="owner-new.pdf",
    )

    other_client = TestClient(app)
    try:
        other = register(other_client, "resume-other@example.test")
        other_default = create_resume(
            db_session,
            other["id"],
            filename="other-default.pdf",
            is_default=True,
        )

        response = client.patch(
            f"/resumes/{owner_new_default.id}",
            json={"is_default": True},
        )

        assert response.status_code == 200

        db_session.refresh(owner_old_default)
        db_session.refresh(owner_new_default)
        db_session.refresh(other_default)

        assert owner_old_default.is_default is False
        assert owner_new_default.is_default is True
        assert other_default.is_default is True
    finally:
        other_client.close()
