from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_list_jobs_returns_200() -> None:
    response = client.get("/jobs")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_manual_job_and_fetch_it() -> None:
    payload = {
        "company_name": "Test Co",
        "title": "Platform Engineer",
        "location": "NYC",
        "workplace_type": "Hybrid",
        "application_url": "https://example.com/job/123",
    }
    create_response = client.post("/jobs/manual", json=payload)
    assert create_response.status_code == 201
    job_id = create_response.json()["id"]

    get_response = client.get(f"/jobs/{job_id}")
    assert get_response.status_code == 200
    assert get_response.json()["title"] == "Platform Engineer"


def test_update_job_status() -> None:
    payload = {
        "company_name": "Test Co 2",
        "title": "SRE",
        "application_url": "https://example.com/job/456",
    }
    create_response = client.post("/jobs/manual", json=payload)
    job_id = create_response.json()["id"]

    patch_response = client.patch(f"/jobs/{job_id}/status", json={"status": "applied"})
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "applied"
