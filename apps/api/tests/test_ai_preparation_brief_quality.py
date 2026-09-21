import json
import uuid
from dataclasses import dataclass, field, replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import AIModelConfig
from app.database import engine, get_db
from app.main import app
from app.models import Application, Contact, Interview, InterviewParticipant, Job
from app.routers import interviews as interviews_router
from app.services.ai.interview_preparation_brief import (
    INTERVIEW_PREPARATION_BRIEF_DISCLAIMER,
)
from app.services.ai.routing import StructuredGenerationResult
from scripts.interview_preparation_brief_quality import (
    INTERVIEW_PREPARATION_BRIEF_QUALITY_FIXTURES,
    PreparationBriefQualityFixture,
    evaluate_preparation_brief,
)


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


@dataclass
class FixtureRouter:
    content: dict[str, object]
    calls: list[dict[str, object]] = field(default_factory=list)
    models: tuple[AIModelConfig, ...] = (
        AIModelConfig(
            provider="openai",
            model_id="offline-quality-fixture",
            display_name="Offline quality fixture",
            enabled=True,
            supports_structured_output=True,
            default_max_output_tokens=2048,
        ),
    )

    def available_models(self) -> tuple[AIModelConfig, ...]:
        return self.models

    def generate_structured(self, **kwargs: object) -> StructuredGenerationResult:
        self.calls.append(kwargs)
        return StructuredGenerationResult(
            content=self.content,
            provider="openai",
            model="offline-quality-fixture",
        )


def register(client: TestClient, fixture: PreparationBriefQualityFixture) -> dict[str, object]:
    response = client.post(
        "/auth/register",
        json={"email": fixture.candidate_email, "password": "synthetic test password only"},
    )
    assert response.status_code == 201
    return response.json()


def create_interview_records(
    db: Session,
    fixture: PreparationBriefQualityFixture,
    user_id: str,
) -> tuple[Application, Interview]:
    job = Job(
        company_name=fixture.company_name,
        source="manual",
        source_type="manual_user_entry",
        external_job_id=str(uuid.uuid4()),
        title=fixture.role_title,
        description=fixture.job_description,
        application_url="https://jobs.example.test/synthetic-role",
    )
    db.add(job)
    db.flush()
    application = Application(user_id=user_id, job_id=job.id, status="interviewing")
    db.add(application)
    db.flush()
    interview = Interview(
        application_id=application.id,
        round=2,
        title=fixture.interview_title,
        interview_type=fixture.interview_type,
        duration_minutes=60,
        timezone="America/New_York",
        location=fixture.exact_location,
        notes=fixture.interview_notes,
    )
    db.add(interview)
    db.flush()
    for participant_fixture in fixture.participants:
        contact = Contact(
            user_id=user_id,
            name=participant_fixture.name,
            title=participant_fixture.title,
            email=participant_fixture.email,
            linkedin_url=participant_fixture.linkedin_url,
            relationship_type=participant_fixture.relationship_type,
            notes=participant_fixture.private_notes,
        )
        db.add(contact)
        db.flush()
        db.add(
            InterviewParticipant(
                interview_id=interview.id,
                contact_id=contact.id,
                role=participant_fixture.role,
            )
        )
    db.flush()
    return application, interview


def nested_keys(value: object) -> set[str]:
    if isinstance(value, dict):
        return set(value).union(*(nested_keys(item) for item in value.values()))
    if isinstance(value, list):
        return set().union(*(nested_keys(item) for item in value))
    return set()


@pytest.mark.parametrize(
    "quality_fixture",
    INTERVIEW_PREPARATION_BRIEF_QUALITY_FIXTURES,
    ids=lambda fixture: fixture.slug,
)
def test_quality_fixture_uses_minimized_payload_and_server_owned_disclaimer(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    quality_fixture: PreparationBriefQualityFixture,
) -> None:
    user = register(client, quality_fixture)
    application, interview = create_interview_records(
        db_session,
        quality_fixture,
        str(user["id"]),
    )
    router = FixtureRouter(content=quality_fixture.model_response)
    monkeypatch.setattr(interviews_router, "get_model_router", lambda: router)

    response = client.post(
        f"/applications/{application.id}/interviews/{interview.id}/preparation-brief"
    )

    assert response.status_code == 200
    assert response.json()["disclaimer"] == INTERVIEW_PREPARATION_BRIEF_DISCLAIMER
    assert "disclaimer" not in quality_fixture.model_response
    assert len(router.calls) == 1
    payload = router.calls[0]["user_payload"]
    assert isinstance(payload, dict)
    serialized_payload = json.dumps(payload)
    forbidden_values = [
        quality_fixture.candidate_email,
        quality_fixture.candidate_profile,
        quality_fixture.exact_location,
        str(application.id),
        str(interview.id),
    ]
    for participant in quality_fixture.participants:
        forbidden_values.extend(
            [participant.email, participant.linkedin_url, participant.private_notes]
        )
    for forbidden in forbidden_values:
        assert forbidden not in serialized_payload
    assert "credential-marker-" not in serialized_payload
    assert "linkedin.com" not in serialized_payload
    assert "@candidates.example.test" not in serialized_payload
    assert "@contacts.example.test" not in serialized_payload
    assert nested_keys(payload).isdisjoint(
        {
            "id",
            "user_id",
            "job_id",
            "application_id",
            "interview_id",
            "contact_id",
            "email",
            "linkedin_url",
            "location",
        }
    )
    assert "location" not in payload["interview"]
    assert all(
        set(participant) == {"name", "role", "title", "relationship_type"}
        for participant in payload["participants"]
    )
    assert quality_fixture.expected_evidence
    assert quality_fixture.allowed_inferences
    assert quality_fixture.prohibited_claims
    assert quality_fixture.expected_next_step_usefulness


@pytest.mark.parametrize(
    "quality_fixture",
    INTERVIEW_PREPARATION_BRIEF_QUALITY_FIXTURES,
    ids=lambda fixture: fixture.slug,
)
def test_quality_harness_matches_expected_fixture_outcome(
    quality_fixture: PreparationBriefQualityFixture,
) -> None:
    evaluation = evaluate_preparation_brief(quality_fixture)

    assert evaluation.passes is quality_fixture.expected_quality_pass
    assert evaluation.issue_codes == quality_fixture.expected_issue_codes


def test_quality_harness_rejects_structurally_invalid_content() -> None:
    fixture = INTERVIEW_PREPARATION_BRIEF_QUALITY_FIXTURES[0]
    invalid_fixture = replace(
        fixture,
        model_response={
            **fixture.model_response,
            "disclaimer": "Model-controlled disclaimer must not be accepted.",
        },
    )

    evaluation = evaluate_preparation_brief(invalid_fixture)

    assert evaluation.passes is False
    assert evaluation.issue_codes == ("invalid_structure",)


def test_structurally_invalid_model_output_remains_a_safe_endpoint_failure(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture = INTERVIEW_PREPARATION_BRIEF_QUALITY_FIXTURES[0]
    user = register(client, replace(fixture, candidate_email="invalid-output@example.test"))
    application, interview = create_interview_records(db_session, fixture, str(user["id"]))
    unsafe_text = "model-controlled disclaimer and raw provider detail"
    router = FixtureRouter(
        content={
            **fixture.model_response,
            "disclaimer": unsafe_text,
        }
    )
    monkeypatch.setattr(interviews_router, "get_model_router", lambda: router)

    response = client.post(
        f"/applications/{application.id}/interviews/{interview.id}/preparation-brief"
    )

    assert response.status_code == 502
    assert response.json() == {
        "detail": "Unable to generate the AI preparation brief. Please try again."
    }
    assert unsafe_text not in response.text
