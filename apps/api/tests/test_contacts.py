import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Application, ApplicationContact, Interview, InterviewParticipant, Job


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


def contact_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "  Avery Recruiter  ",
        "title": "  Senior Recruiter  ",
        "email": "avery@example.com",
        "linkedin_url": "https://www.linkedin.com/in/avery-recruiter",
        "relationship_type": "recruiter",
        "notes": "  Met during the screening call.  ",
    }
    payload.update(overrides)
    return payload


def create_application(db: Session, *, user_id: str, title: str) -> Application:
    job = Job(
        company_name="Example Corp",
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=title,
        application_url="https://example.test/apply",
    )
    db.add(job)
    db.flush()
    application = Application(user_id=user_id, job_id=job.id, status="interviewing")
    db.add(application)
    db.flush()
    return application


def create_interview(db: Session, *, application: Application, title: str) -> Interview:
    interview = Interview(application_id=application.id, title=title)
    db.add(interview)
    db.flush()
    return interview


def participant_path(application: Application, interview: Interview) -> str:
    return f"/applications/{application.id}/interviews/{interview.id}/participants"


def test_contact_routes_require_authentication(client: TestClient) -> None:
    contact_id = uuid.uuid4()
    assert client.get("/contacts").status_code == 401
    assert client.post("/contacts", json=contact_payload()).status_code == 401
    assert client.get(f"/contacts/{contact_id}").status_code == 401
    assert client.patch(f"/contacts/{contact_id}", json={"name": "Updated"}).status_code == 401
    assert client.delete(f"/contacts/{contact_id}").status_code == 401


def test_contact_crud_happy_path(client: TestClient) -> None:
    user = register(client, "contacts-crud@example.test")
    create_response = client.post("/contacts", json=contact_payload())
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["user_id"] == user["id"]
    assert created["name"] == "Avery Recruiter"
    assert created["title"] == "Senior Recruiter"
    assert created["notes"] == "Met during the screening call."

    contact_id = created["id"]
    assert client.get(f"/contacts/{contact_id}").json() == created
    assert [item["id"] for item in client.get("/contacts").json()] == [contact_id]

    update_response = client.patch(
        f"/contacts/{contact_id}",
        json={
            "name": "  Avery Chen  ",
            "title": None,
            "email": None,
            "linkedin_url": None,
            "relationship_type": "networking",
            "notes": None,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Avery Chen"
    assert updated["relationship_type"] == "networking"
    assert updated["title"] is None
    assert updated["email"] is None
    assert updated["linkedin_url"] is None
    assert updated["notes"] is None

    assert client.delete(f"/contacts/{contact_id}").status_code == 204
    assert client.get(f"/contacts/{contact_id}").status_code == 404
    assert client.get("/contacts").json() == []


def test_contacts_are_owner_scoped_for_all_operations(
    client: TestClient,
    db_session: Session,
) -> None:
    register(client, "contacts-owner@example.test")
    contact = client.post("/contacts", json=contact_payload()).json()

    other_client = TestClient(app)
    try:
        register(other_client, "contacts-other@example.test")
        assert other_client.get("/contacts").json() == []
        assert other_client.get(f"/contacts/{contact['id']}").status_code == 404
        assert other_client.patch(
            f"/contacts/{contact['id']}", json={"name": "Stolen"}
        ).status_code == 404
        assert other_client.delete(f"/contacts/{contact['id']}").status_code == 404
    finally:
        other_client.close()

    assert client.get(f"/contacts/{contact['id']}").status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        contact_payload(name="   "),
        contact_payload(email="not-an-email"),
        contact_payload(linkedin_url="http://www.linkedin.com/in/avery"),
        contact_payload(linkedin_url="https://example.com/in/avery"),
        contact_payload(relationship_type="coworker"),
    ],
)
def test_contact_validation_rejects_invalid_values(
    client: TestClient,
    payload: dict[str, object],
) -> None:
    register(client, f"contacts-validation-{uuid.uuid4()}@example.test")
    assert client.post("/contacts", json=payload).status_code == 422


def test_add_list_remove_and_reuse_participant(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "participants-owner@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    first_interview = create_interview(
        db_session, application=application, title="Technical round"
    )
    second_interview = create_interview(
        db_session, application=application, title="Final round"
    )
    contact = client.post("/contacts", json=contact_payload()).json()

    first_response = client.post(
        participant_path(application, first_interview),
        json={"contact_id": contact["id"], "role": "interviewer"},
    )
    assert first_response.status_code == 201
    first_participant = first_response.json()
    assert first_participant["contact"]["name"] == "Avery Recruiter"
    assert "notes" not in first_participant["contact"]

    duplicate_response = client.post(
        participant_path(application, first_interview),
        json={"contact_id": contact["id"], "role": "observer"},
    )
    assert duplicate_response.status_code == 409

    second_response = client.post(
        participant_path(application, second_interview),
        json={"contact_id": contact["id"], "role": "coordinator"},
    )
    assert second_response.status_code == 201
    assert second_response.json()["contact_id"] == contact["id"]

    listed = client.get(participant_path(application, first_interview)).json()
    assert [item["id"] for item in listed] == [first_participant["id"]]

    remove_path = f"{participant_path(application, first_interview)}/{first_participant['id']}"
    assert client.delete(remove_path).status_code == 204
    assert client.get(participant_path(application, first_interview)).json() == []
    assert len(client.get(participant_path(application, second_interview)).json()) == 1


def test_update_participant_role_changes_only_assignment(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "participant-update@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    interview = create_interview(db_session, application=application, title="Panel")
    contact = client.post("/contacts", json=contact_payload()).json()
    created = client.post(
        participant_path(application, interview),
        json={"contact_id": contact["id"], "role": "interviewer"},
    ).json()
    application_contact = db_session.scalar(
        select(ApplicationContact).where(
            ApplicationContact.application_id == application.id,
            ApplicationContact.contact_id == uuid.UUID(contact["id"]),
        )
    )
    assert application_contact is not None
    original_application_contact = (
        application_contact.id,
        application_contact.contact_type,
        application_contact.name,
        application_contact.email,
        application_contact.notes,
    )

    response = client.patch(
        f"{participant_path(application, interview)}/{created['id']}",
        json={"role": "coordinator"},
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == created["id"]
    assert updated["role"] == "coordinator"
    assert updated["contact"] == created["contact"]
    assert updated["contact_id"] == contact["id"]
    db_session.refresh(application_contact)
    assert (
        application_contact.id,
        application_contact.contact_type,
        application_contact.name,
        application_contact.email,
        application_contact.notes,
    ) == original_application_contact


def test_update_participant_rejects_wrong_interview_foreign_user_and_invalid_role(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "participant-update-owner@example.test")
    application = create_application(db_session, user_id=owner["id"], title="Owner role")
    interview = create_interview(db_session, application=application, title="Owner interview")
    other_interview = create_interview(
        db_session, application=application, title="Other interview"
    )
    contact = client.post("/contacts", json=contact_payload()).json()
    created = client.post(
        participant_path(application, interview),
        json={"contact_id": contact["id"], "role": "observer"},
    ).json()

    wrong_interview_response = client.patch(
        f"{participant_path(application, other_interview)}/{created['id']}",
        json={"role": "coordinator"},
    )
    assert wrong_interview_response.status_code == 404

    invalid_role_response = client.patch(
        f"{participant_path(application, interview)}/{created['id']}",
        json={"role": "manager"},
    )
    assert invalid_role_response.status_code == 422

    other_client = TestClient(app)
    try:
        register(other_client, "participant-update-other@example.test")
        foreign_response = other_client.patch(
            f"{participant_path(application, interview)}/{created['id']}",
            json={"role": "interviewer"},
        )
        assert foreign_response.status_code == 404
    finally:
        other_client.close()

    unchanged = client.get(participant_path(application, interview)).json()
    assert len(unchanged) == 1
    assert unchanged[0]["role"] == "observer"
    assert unchanged[0]["contact_id"] == contact["id"]


def test_participant_links_reject_foreign_missing_and_deleted_resources(
    client: TestClient,
    db_session: Session,
) -> None:
    owner = register(client, "participant-link-owner@example.test")
    owner_application = create_application(db_session, user_id=owner["id"], title="Owner role")
    owner_interview = create_interview(
        db_session, application=owner_application, title="Owner interview"
    )
    owner_contact = client.post("/contacts", json=contact_payload()).json()

    missing_contact_response = client.post(
        participant_path(owner_application, owner_interview),
        json={"contact_id": str(uuid.uuid4()), "role": "interviewer"},
    )
    assert missing_contact_response.status_code == 404

    deleted_contact = client.post(
        "/contacts", json=contact_payload(email="deleted@example.com")
    ).json()
    assert client.delete(f"/contacts/{deleted_contact['id']}").status_code == 204
    assert client.post(
        participant_path(owner_application, owner_interview),
        json={"contact_id": deleted_contact["id"], "role": "interviewer"},
    ).status_code == 404

    other_client = TestClient(app)
    try:
        other = register(other_client, "participant-link-other@example.test")
        other_application = create_application(
            db_session, user_id=other["id"], title="Other role"
        )
        other_interview = create_interview(
            db_session, application=other_application, title="Other interview"
        )
        foreign_contact = other_client.post(
            "/contacts", json=contact_payload(email="foreign@example.com")
        ).json()

        assert client.post(
            participant_path(owner_application, owner_interview),
            json={"contact_id": foreign_contact["id"], "role": "observer"},
        ).status_code == 404
        assert client.post(
            participant_path(other_application, other_interview),
            json={"contact_id": owner_contact["id"], "role": "observer"},
        ).status_code == 404
    finally:
        other_client.close()

    deleted_interview = create_interview(
        db_session, application=owner_application, title="Deleted interview"
    )
    assert client.delete(
        f"/applications/{owner_application.id}/interviews/{deleted_interview.id}"
    ).status_code == 204
    assert client.post(
        participant_path(owner_application, deleted_interview),
        json={"contact_id": owner_contact["id"], "role": "interviewer"},
    ).status_code == 404


def test_deleting_contact_removes_participant_link_not_interview(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "participant-delete-contact@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    interview = create_interview(db_session, application=application, title="Panel")
    contact = client.post("/contacts", json=contact_payload()).json()
    assert client.post(
        participant_path(application, interview),
        json={"contact_id": contact["id"], "role": "observer"},
    ).status_code == 201

    assert client.delete(f"/contacts/{contact['id']}").status_code == 204
    assert client.get(participant_path(application, interview)).json() == []
    assert client.get(
        f"/applications/{application.id}/interviews/{interview.id}"
    ).status_code == 200


@pytest.mark.parametrize(
    ("role", "expected_contact_type"),
    [
        ("interviewer", "interviewer"),
        ("coordinator", "other"),
        ("observer", "other"),
    ],
)
def test_adding_participant_creates_linked_application_contact_snapshot(
    client: TestClient,
    db_session: Session,
    role: str,
    expected_contact_type: str,
) -> None:
    user = register(client, f"participant-snapshot-{role}@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    interview = create_interview(db_session, application=application, title="Interview")
    contact = client.post("/contacts", json=contact_payload()).json()

    response = client.post(
        participant_path(application, interview),
        json={"contact_id": contact["id"], "role": role},
    )
    assert response.status_code == 201

    link = db_session.scalar(
        select(ApplicationContact).where(
            ApplicationContact.application_id == application.id,
            ApplicationContact.contact_id == uuid.UUID(contact["id"]),
        )
    )
    assert link is not None
    assert link.name == "Avery Recruiter"
    assert link.email == "avery@example.com"
    assert link.linkedin_url == "https://www.linkedin.com/in/avery-recruiter"
    assert link.notes is None
    assert link.contact_type == expected_contact_type


def test_reusing_contact_in_application_does_not_duplicate_or_overwrite_link(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "participant-existing-link@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    first_interview = create_interview(db_session, application=application, title="First")
    second_interview = create_interview(db_session, application=application, title="Second")
    contact = client.post("/contacts", json=contact_payload()).json()
    existing_link = ApplicationContact(
        application_id=application.id,
        contact_id=uuid.UUID(contact["id"]),
        name="Preserved snapshot",
        contact_type="recruiter",
        email="preserved@example.test",
        linkedin_url=None,
        notes="Preserved notes",
    )
    db_session.add(existing_link)
    db_session.flush()

    for interview, role in ((first_interview, "interviewer"), (second_interview, "observer")):
        response = client.post(
            participant_path(application, interview),
            json={"contact_id": contact["id"], "role": role},
        )
        assert response.status_code == 201

    links = list(
        db_session.scalars(
            select(ApplicationContact).where(
                ApplicationContact.application_id == application.id,
                ApplicationContact.contact_id == uuid.UUID(contact["id"]),
            )
        )
    )
    assert len(links) == 1
    assert links[0].id == existing_link.id
    assert links[0].name == "Preserved snapshot"
    assert links[0].contact_type == "recruiter"
    assert links[0].email == "preserved@example.test"
    assert links[0].notes == "Preserved notes"


def test_duplicate_participant_conflict_does_not_create_application_contact(
    client: TestClient,
    db_session: Session,
) -> None:
    user = register(client, "participant-duplicate-link@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    interview = create_interview(db_session, application=application, title="Interview")
    contact = client.post("/contacts", json=contact_payload()).json()
    existing_participant = InterviewParticipant(
        interview_id=interview.id,
        contact_id=uuid.UUID(contact["id"]),
        role="observer",
    )
    db_session.add(existing_participant)
    db_session.flush()

    response = client.post(
        participant_path(application, interview),
        json={"contact_id": contact["id"], "role": "interviewer"},
    )
    assert response.status_code == 409
    assert db_session.scalar(
        select(ApplicationContact).where(
            ApplicationContact.application_id == application.id,
            ApplicationContact.contact_id == uuid.UUID(contact["id"]),
        )
    ) is None


def test_participant_and_application_contact_creation_are_atomic_on_commit_failure(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = register(client, "participant-atomic@example.test")
    application = create_application(db_session, user_id=user["id"], title="Engineer")
    interview = create_interview(db_session, application=application, title="Interview")
    contact = client.post("/contacts", json=contact_payload()).json()

    def fail_commit() -> None:
        db_session.flush()
        raise IntegrityError("forced failure", params=None, orig=RuntimeError("forced"))

    monkeypatch.setattr(db_session, "commit", fail_commit)
    response = client.post(
        participant_path(application, interview),
        json={"contact_id": contact["id"], "role": "interviewer"},
    )
    assert response.status_code == 409
    assert db_session.scalar(
        select(InterviewParticipant).where(
            InterviewParticipant.interview_id == interview.id,
            InterviewParticipant.contact_id == uuid.UUID(contact["id"]),
        )
    ) is None
    assert db_session.scalar(
        select(ApplicationContact).where(
            ApplicationContact.application_id == application.id,
            ApplicationContact.contact_id == uuid.UUID(contact["id"]),
        )
    ) is None
