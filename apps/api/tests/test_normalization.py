import pytest

from app.normalization import normalize_workplace_type, workplace_type_filter_values


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("Remote", "remote"),
        ("Distributed", "remote"),
        ("Hybrid", "hybrid"),
        ("OnSite", "onsite"),
        ("On-site", "onsite"),
        ("Unknown", "unknown"),
        (None, "unknown"),
    ],
)
def test_normalize_workplace_type(raw_value: object, expected: str) -> None:
    assert normalize_workplace_type(raw_value) == expected


def test_remote_signal_takes_priority_over_provider_label() -> None:
    assert normalize_workplace_type("OnSite", is_remote=True) == "remote"


def test_onsite_filter_includes_historical_variants() -> None:
    assert {"onsite", "inperson", "inoffice"} <= workplace_type_filter_values("onsite")
