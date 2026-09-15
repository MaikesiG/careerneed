import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, ApplicationContact, Job, User


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


def create_job(db_session: Session, *, title: str) -> Job:
    job = Job(
        company_name="Contacts Test Co.",
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=title,
        application_url="https://example.test/apply",
        match_score=100,
    )
    db_session.add(job)
    db_session.flush()
    return job


def create_application(
    db_session: Session,
    *,
    user_id: uuid.UUID,
    title: str = "Contacts test role",
) -> Application:
    job = create_job(db_session, title=title)
    application = Application(
        user_id=user_id,
        job_id=job.id,
        status="saved",
    )
    db_session.add(application)
    db_session.flush()
    return application


def create_contact(
    db_session: Session,
    *,
    application_id: uuid.UUID,
    name: str = "Taylor Morgan",
    contact_type: str = "recruiter",
    email: str | None = "taylor@example.test",
    linkedin_url: str | None = "https://www.linkedin.com/in/taylormorgan",
    notes: str | None = "Initial outreach.",
) -> ApplicationContact:
    contact = ApplicationContact(
        application_id=application_id,
        name=name,
        contact_type=contact_type,
        email=email,
        linkedin_url=linkedin_url,
        notes=notes,
    )
    db_session.add(contact)
    db_session.flush()
    return contact


def test_application_contact_routes_require_authentication(client: TestClient) -> None:
    application_id = uuid.uuid4()

    list_response = client.get(f"/applications/{application_id}/contacts")
    create_response = client.post(
        f"/applications/{application_id}/contacts",
        json={"name": "Jordan Lee"},
    )
    update_response = client.patch(
        f"/applications/{application_id}/contacts/{uuid.uuid4()}",
        json={"name": "Jordan Lee"},
    )
    delete_response = client.delete(
        f"/applications/{application_id}/contacts/{uuid.uuid4()}"
    )

    assert list_response.status_code == 401
    assert create_response.status_code == 401
    assert update_response.status_code == 401
    assert delete_response.status_code == 401


def test_list_application_contacts_returns_empty_list(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "contacts-owner@example.test")
    application = create_application(db_session, user_id=user["id"])

    response = client.get(f"/applications/{application.id}/contacts")

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_application_contact(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "contacts-owner@example.test")
    application = create_application(db_session, user_id=user["id"])

    create_response = client.post(
        f"/applications/{application.id}/contacts",
        json={
            "name": "Jordan Lee",
            "contact_type": "recruiter",
            "email": "jordan@example.test",
            "linkedin_url": "https://www.linkedin.com/in/jordanlee",
            "notes": "Connected after applying.",
        },
    )

    assert create_response.status_code == 201

    created = create_response.json()
    assert created["application_id"] == str(application.id)
    assert created["name"] == "Jordan Lee"
    assert created["contact_type"] == "recruiter"
    assert created["email"] == "jordan@example.test"
    assert created["linkedin_url"] == "https://www.linkedin.com/in/jordanlee"
    assert created["notes"] == "Connected after applying."

    list_response = client.get(f"/applications/{application.id}/contacts")

    assert list_response.status_code == 200
    assert [contact["id"] for contact in list_response.json()] == [created["id"]]


def test_update_application_contact_preserves_omitted_fields_and_clears_null(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "contacts-owner@example.test")
    application = create_application(db_session, user_id=user["id"])
    contact = create_contact(db_session, application_id=application.id)

    response = client.patch(
        f"/applications/{application.id}/contacts/{contact.id}",
        json={
            "contact_type": "hiring_manager",
            "email": None,
            "notes": "Introduced by the recruiter.",
        },
    )

    assert response.status_code == 200

    body = response.json()
    assert body["id"] == str(contact.id)
    assert body["name"] == "Taylor Morgan"
    assert body["contact_type"] == "hiring_manager"
    assert body["email"] is None
    assert body["linkedin_url"] == "https://www.linkedin.com/in/taylormorgan"
    assert body["notes"] == "Introduced by the recruiter."


def test_contact_cannot_be_accessed_through_another_application(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "contacts-owner@example.test")
    first_application = create_application(
        db_session,
        user_id=user["id"],
        title="First contacts role",
    )
    second_application = create_application(
        db_session,
        user_id=user["id"],
        title="Second contacts role",
    )
    contact = create_contact(db_session, application_id=first_application.id)

    update_response = client.patch(
        f"/applications/{second_application.id}/contacts/{contact.id}",
        json={"name": "Wrong application update"},
    )
    delete_response = client.delete(
        f"/applications/{second_application.id}/contacts/{contact.id}"
    )

    assert update_response.status_code == 404
    assert delete_response.status_code == 404

    db_session.refresh(contact)
    assert contact.name == "Taylor Morgan"


def test_other_user_cannot_access_contacts_for_owners_application(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "contacts-owner@example.test")
    application = create_application(db_session, user_id=owner["id"])
    contact = create_contact(db_session, application_id=application.id)

    other_client = TestClient(app)
    try:
        register(other_client, "contacts-other@example.test")

        list_response = other_client.get(f"/applications/{application.id}/contacts")
        create_response = other_client.post(
            f"/applications/{application.id}/contacts",
            json={"name": "Unauthorized contact"},
        )
        update_response = other_client.patch(
            f"/applications/{application.id}/contacts/{contact.id}",
            json={"name": "Unauthorized update"},
        )
        delete_response = other_client.delete(
            f"/applications/{application.id}/contacts/{contact.id}"
        )

        assert list_response.status_code == 404
        assert list_response.json()["detail"] == "Application not found"
        assert create_response.status_code == 404
        assert create_response.json()["detail"] == "Application not found"
        assert update_response.status_code == 404
        assert update_response.json()["detail"] == "Application not found"
        assert delete_response.status_code == 404
        assert delete_response.json()["detail"] == "Application not found"

        db_session.refresh(contact)
        assert contact.name == "Taylor Morgan"
    finally:
        other_client.close()


def test_delete_application_contact(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "contacts-owner@example.test")
    application = create_application(db_session, user_id=user["id"])
    contact = create_contact(db_session, application_id=application.id)

    delete_response = client.delete(f"/applications/{application.id}/contacts/{contact.id}")

    assert delete_response.status_code == 204
    assert delete_response.content == b""

    list_response = client.get(f"/applications/{application.id}/contacts")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_deleting_application_cascades_to_contacts(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "contacts-owner@example.test")
    application = create_application(db_session, user_id=user["id"])
    contact = create_contact(db_session, application_id=application.id)

    db_session.delete(application)
    db_session.flush()

    remaining_contact = db_session.scalar(
        select(ApplicationContact).where(ApplicationContact.id == contact.id)
    )

    assert remaining_contact is None
