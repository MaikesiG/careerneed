"""Shared normalization for values received from job providers."""

import re

WORKPLACE_TYPE_VALUES = {"remote", "hybrid", "onsite", "unknown"}

_REMOTE_WORKPLACE_TYPES = {
    "remote",
    "fullyremote",
    "distributed",
    "remotefirst",
    "workfromhome",
    "wfh",
}
_HYBRID_WORKPLACE_TYPES = {"hybrid"}
_ONSITE_WORKPLACE_TYPES = {"onsite", "inperson", "inoffice", "office"}


def normalize_workplace_type(value: object, *, is_remote: bool = False) -> str:
    """Map provider-specific workplace labels to the stored vocabulary."""
    if is_remote:
        return "remote"

    if not isinstance(value, str):
        return "unknown"

    compact_value = re.sub(r"[^a-z]", "", value.strip().lower())

    if compact_value in _REMOTE_WORKPLACE_TYPES:
        return "remote"
    if compact_value in _HYBRID_WORKPLACE_TYPES:
        return "hybrid"
    if compact_value in _ONSITE_WORKPLACE_TYPES:
        return "onsite"

    return "unknown"


def workplace_type_filter_values(value: str) -> set[str]:
    """Return normalized historical values that match a selected workplace type."""
    normalized_value = normalize_workplace_type(value)

    if normalized_value == "remote":
        return _REMOTE_WORKPLACE_TYPES
    if normalized_value == "hybrid":
        return _HYBRID_WORKPLACE_TYPES
    if normalized_value == "onsite":
        return _ONSITE_WORKPLACE_TYPES

    return {"unknown", "", "notspecified"}
