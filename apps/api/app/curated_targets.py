import json
from pathlib import Path
from typing import Literal, TypedDict


class CuratedTarget(TypedDict):
    name: str
    category: Literal["AI", "Tech"]


_CURATED_TARGETS_PATH = (
    Path(__file__).resolve().parents[3] / "apps" / "web" / "src" / "data" / "curated-targets.json"
)


def _load_curated_targets() -> tuple[CuratedTarget, ...]:
    with _CURATED_TARGETS_PATH.open(encoding="utf-8") as source:
        values = json.load(source)
    return tuple(CuratedTarget(name=value["name"], category=value["category"]) for value in values)


CURATED_TARGETS = _load_curated_targets()


def normalize_curated_target_name(value: str) -> str:
    return " ".join(value.strip().casefold().split())
