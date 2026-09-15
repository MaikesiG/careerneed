import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, ApplicationContact, Job, User
from app.routers.applications import INITIAL_USER_ID


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


def ensure_initial_user(db_session: Session) -> None:
    if db_session.get(User, INITIAL_USER_ID) is None:
        db_session.add(User(id=INITIAL_USER_ID, email="initial-user@example.test"))
        db_session.flush()


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
    user_id: uuid.UUID = INITIAL_USER_ID,
    title: str = "Contacts test role",
) -> Application:
    if user_id == INITIAL_USER_ID:
        ensure_initial_user(db_session)

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


def test_list_application_contacts_returns_empty_list(
    client: TestClient,
    db_session: Session,
) -> None:
    application = create_application(db_session)

    response = client.get(f"/applications/{application.id}/contacts")

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_application_contact(
    client: TestClient,
    db_session: Session,
) -> None:
    application = create_application(db_session)

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
    application = create_application(db_session)
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
    first_application = create_application(db_session, title="First contacts role")
    second_application = create_application(db_session, title="Second contacts role")
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


def test_contacts_return_404_when_parent_application_is_not_owned(
    client: TestClient,
    db_session: Session,
) -> None:
    other_user = User(id=uuid.uuid4(), email="other-user@example.test")
    db_session.add(other_user)
    db_session.flush()

    application = create_application(
        db_session,
        user_id=other_user.id,
        title="Other user's contacts role",
    )

    response = client.get(f"/applications/{application.id}/contacts")

    assert response.status_code == 404
    assert response.json()["detail"] == "Application not found"


def test_delete_application_contact(
    client: TestClient,
    db_session: Session,
) -> None:
    application = create_application(db_session)
    contact = create_contact(db_session, application_id=application.id)

    delete_response = client.delete(
        f"/applications/{application.id}/contacts/{contact.id}"
    )

    assert delete_response.status_code == 204
    assert delete_response.content == b""

    list_response = client.get(f"/applications/{application.id}/contacts")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_deleting_application_cascades_to_contacts(
    db_session: Session,
) -> None:
    application = create_application(db_session)
    contact = create_contact(db_session, application_id=application.id)

    db_session.delete(application)
    db_session.flush()

    remaining_contact = db_session.scalar(
        select(ApplicationContact).where(ApplicationContact.id == contact.id)
    )

    assert remaining_contact is None
