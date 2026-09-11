from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_jobs_returns_ok() -> None:
    response = client.get(
        "/jobs",
        params={
            "limit": 5,
            "offset": 0,
        },
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) <= 5
    assert "x-total-count" in response.headers
    assert "x-total-pages" in response.headers


def test_list_jobs_supports_sorting() -> None:
    for sort, sort_direction in [
        ("match_score", "desc"),
        ("match_score", "asc"),
        ("recent", "desc"),
        ("recent", "asc"),
    ]:
        response = client.get(
            "/jobs",
            params={
                "limit": 5,
                "offset": 0,
                "sort": sort,
                "sort_direction": sort_direction,
            },
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_list_jobs_supports_multi_value_filters() -> None:
    response = client.get(
        "/jobs",
        params=[
            ("limit", "5"),
            ("offset", "0"),
            ("source", "greenhouse"),
            ("source", "lever"),
            ("workplace_type", "remote"),
            ("workplace_type", "hybrid"),
            ("min_match_score", "70"),
            ("date_range", "week"),
            ("sort", "match_score"),
            ("sort_direction", "desc"),
        ],
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) <= 5
    assert "x-total-count" in response.headers
    assert "x-total-pages" in response.headers


def test_list_jobs_rejects_invalid_sort() -> None:
    response = client.get(
        "/jobs",
        params={
            "sort": "title",
            "sort_direction": "desc",
        },
    )

    assert response.status_code == 422


def test_list_jobs_rejects_invalid_date_range() -> None:
    response = client.get(
        "/jobs",
        params={
            "date_range": "year",
        },
    )

    assert response.status_code == 422
