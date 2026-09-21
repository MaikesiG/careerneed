from types import SimpleNamespace

import pytest
from google.genai import errors

from scripts import google_structured_isolation_test as isolation


@pytest.fixture
def offline(monkeypatch):
    calls = []

    class Client:
        def __init__(self, **kwargs):
            self.models = self

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text="PRIVATE RESPONSE BODY")

    monkeypatch.setattr(isolation.genai, "Client", Client)
    monkeypatch.setattr(isolation, "load_ai_provider_keys", lambda: {"google": "SECRET-KEY"})
    monkeypatch.setattr(
        isolation, "load_ai_model_registry", lambda: SimpleNamespace(models=lambda: [])
    )
    monkeypatch.setattr(isolation, "load_ai_router_timeout", lambda: 10)
    monkeypatch.setenv(isolation.OPT_IN, "1")
    monkeypatch.setenv(isolation.STAGE_ENV, "A")
    return calls, Client


def test_requires_opt_in_before_configuration(offline, monkeypatch, capsys):
    monkeypatch.delenv(isolation.OPT_IN)
    monkeypatch.setattr(
        isolation, "load_ai_provider_keys", lambda: pytest.fail("configuration read")
    )
    assert isolation.main() == 2
    assert offline[0] == []
    assert "SECRET-KEY" not in capsys.readouterr().out


@pytest.mark.parametrize("selection,expected", [("A", "A"), ("E", "E"), ("C:F", "CDEF")])
def test_stage_selection(selection, expected):
    assert isolation.selected_stages(selection) == tuple(expected)


def test_delta_selection_and_exact_schema():
    assert isolation.selected_stages("F1:G") == (*isolation.DELTA_STAGES, "G")
    assert isolation.selected_stages("F3") == ("F3",)
    assert isolation.delta_schema("F5") == isolation.production_schema()
    assert (
        isolation.request_for("G", 100)["config"].response_json_schema
        == isolation.production_schema()
    )
    assert "$ref" not in isolation.structural_summary(isolation.delta_schema("F1"))["keywords"]
    for before, after, restored in (
        ("F2", "F3", "minItems"),
        ("F3", "F4", "maxItems"),
        ("F4", "F5", "title"),
    ):
        earlier = isolation.delta_schema(before)
        later = isolation.delta_schema(after)
        for node, _ in isolation.schema_nodes(later):
            node.pop(restored, None)
        assert earlier == later


def test_structural_metadata_never_contains_annotation_or_property_values():
    summary = isolation.structural_summary(
        {
            "type": "object",
            "title": "PRIVATE TITLE",
            "description": "PRIVATE DESCRIPTION",
            "properties": {"PRIVATE PROPERTY": {"type": "string", "enum": ["PRIVATE VALUE"]}},
        }
    )
    assert summary["property_count"] == 1
    assert summary["enum_count"] == 1
    assert all(isinstance(value, int) for key, value in summary.items() if key != "keywords")
    assert "PRIVATE" not in str(summary)


def test_delta_stage_output_is_safe(offline, monkeypatch, capsys):
    monkeypatch.setenv(isolation.STAGE_ENV, "F1:F5")
    assert isolation.main() == 0
    assert len(offline[0]) == 5
    assert capsys.readouterr().out == "".join(
        f"stage={stage} result=success has_text=true\n" for stage in isolation.DELTA_STAGES
    )


def test_b_preserves_explicit_afc_reproduction():
    baseline = isolation.request_for("A", 1024)
    reproduction = isolation.request_for("B", 1024)
    assert baseline["contents"] == reproduction["contents"]
    assert "config" not in baseline
    config = reproduction["config"]
    assert config.automatic_function_calling.disable is True
    assert config.tools is None
    assert config.tool_config is None


def test_installed_sdk_no_tools_request_construction():
    from google.genai import models, types

    calls = []

    def request(*args):
        calls.append(args)
        return SimpleNamespace(body='{"candidates": []}', headers={})

    client = SimpleNamespace(vertexai=False, request=request, _verify_response=lambda value: None)
    sdk = models.Models(client)
    for config in (
        None,
        types.GenerateContentConfig(),
        types.GenerateContentConfig(
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
        ),
    ):
        sdk.generate_content(model="gemini-test", contents="Reply exactly with OK", config=config)
    assert len(calls) == 3
    assert "generationConfig" not in calls[0][2]
    assert calls[2][2]["generationConfig"] == {}
    # Explicit AFC and an empty config produce identical provider request arguments.
    assert calls[1] == calls[2]
    assert "automaticFunctionCalling" not in calls[2][2].get("generationConfig", {})
    assert "tools" not in calls[2][2]


@pytest.mark.parametrize("selection", ["", "Z", "F:A", "A:J:K", "AB"])
def test_invalid_selection(selection):
    with pytest.raises(ValueError):
        isolation.selected_stages(selection)


def test_selected_stage_only_and_safe_success(offline, monkeypatch, capsys):
    monkeypatch.setenv(isolation.STAGE_ENV, "E")
    assert isolation.main() == 0
    assert len(offline[0]) == 1
    config = offline[0][0]["config"]
    assert config.response_json_schema == isolation.MINIMAL_SCHEMA
    assert config.response_mime_type == "application/json"
    assert config.automatic_function_calling.disable is True
    assert capsys.readouterr().out == "stage=E result=success has_text=true\n"


def test_sequence_stops_at_first_failure_and_only_reports_provenance(offline, monkeypatch, capsys):
    calls, client = offline
    monkeypatch.setenv(isolation.STAGE_ENV, "A:I")

    def generate(self, **kwargs):
        calls.append(kwargs)
        if len(calls) == 2:
            raise errors.ServerError(
                503, {"error": {"message": "SECRET-KEY PRIVATE BODY PROMPT SCHEMA"}}
            )
        return SimpleNamespace(text="PRIVATE RESPONSE BODY")

    monkeypatch.setattr(client, "generate_content", generate)
    assert isolation.main() == 1
    assert len(calls) == 2
    assert capsys.readouterr().out == (
        "stage=A result=success has_text=true\n"
        "stage=B result=failure exception_module=google.genai.errors "
        "exception_type=ServerError http_status=503\n"
    )


def test_unknown_failure_does_not_print_message_or_args(offline, monkeypatch, capsys):
    def fail(self, **kwargs):
        raise ValueError("SECRET-KEY", kwargs, "PRIVATE RESPONSE BODY")

    monkeypatch.setattr(offline[1], "generate_content", fail)
    assert isolation.main() == 1
    captured = capsys.readouterr()
    assert (
        captured.out
        == "stage=A result=failure exception_module=builtins exception_type=ValueError\n"
    )
    assert captured.err == ""


def test_exact_schema_and_production_instruction_are_reused():
    from app.schemas import _InterviewPreparationBriefGenerated
    from app.services.ai.gemini_adapter import _prepare_response_schema
    from app.services.ai.interview_preparation_brief import INTERVIEW_PREPARATION_BRIEF_PROMPT

    request = isolation.request_for("I", 2048)
    config = request["config"]
    assert config.response_json_schema == _prepare_response_schema(
        _InterviewPreparationBriefGenerated.model_json_schema(mode="validation")
    )
    assert config.system_instruction == INTERVIEW_PREPARATION_BRIEF_PROMPT
    assert config.max_output_tokens == 2048
    assert config.tools is None
    assert config.thinking_config is None
    assert isolation.request_for("A", 2048) == {"contents": "Reply exactly with OK"}


def test_j_uses_smoke_adapter_arguments(offline, monkeypatch, capsys):
    captured = {}

    def generate(self, **kwargs):
        captured.update(kwargs)
        return SimpleNamespace(content={"answer": "PRIVATE"})

    monkeypatch.setattr(isolation.GeminiAdapter, "generate_structured", generate)
    monkeypatch.setenv(isolation.STAGE_ENV, "J")
    assert isolation.main() == 0
    assert captured["output_schema"] == isolation.smoke.OUTPUT_SCHEMA
    assert captured["system_instruction"] == isolation.smoke.SYSTEM_INSTRUCTION
    assert captured["user_payload"] == isolation.smoke.USER_PAYLOAD
    assert captured["max_output_tokens"] == 100
    assert offline[0] == []
    assert capsys.readouterr().out == "stage=J result=success has_text=true\n"
