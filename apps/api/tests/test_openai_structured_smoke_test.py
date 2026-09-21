from dataclasses import dataclass

import pytest

from app.config import AIModelConfig
from app.services.ai.routing import (
    ProviderRequestError,
    SafeUsageMetadata,
    StructuredGenerationResult,
)
from scripts import openai_structured_smoke_test as smoke_test


@dataclass
class FakeRouter:
    models: tuple[AIModelConfig, ...]
    result: StructuredGenerationResult | None = None
    failure: Exception | None = None
    available_calls: int = 0
    generation_calls: list[dict[str, object]] | None = None

    def available_models(self) -> tuple[AIModelConfig, ...]:
        self.available_calls += 1
        return self.models

    def generate_structured(self, **kwargs: object) -> StructuredGenerationResult:
        if self.generation_calls is None:
            self.generation_calls = []
        self.generation_calls.append(kwargs)
        if self.failure is not None:
            raise self.failure
        assert self.result is not None
        return self.result


def configured_model(provider: str = "openai", model_id: str = "smoke-model") -> AIModelConfig:
    return AIModelConfig(
        provider=provider,
        model_id=model_id,
        display_name="Smoke model",
        enabled=True,
        supports_structured_output=True,
        default_max_output_tokens=100,
    )


@pytest.mark.parametrize("flag_value", [None, "", "0", "true", " 1"])
def test_opt_in_gate_exits_before_router_creation(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    flag_value: str | None,
) -> None:
    if flag_value is None:
        monkeypatch.delenv(smoke_test.OPT_IN_ENV_VAR, raising=False)
    else:
        monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, flag_value)
    factory_called = False

    def forbidden_factory() -> object:
        nonlocal factory_called
        factory_called = True
        raise AssertionError("router must not be created")

    assert smoke_test.main(router_factory=forbidden_factory) == 2
    assert factory_called is False
    assert capsys.readouterr().out == f"{smoke_test.OPT_IN_INSTRUCTION}\n"


def test_no_available_openai_model_is_safe_and_does_not_generate(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    router = FakeRouter(models=(configured_model(provider="anthropic"),))

    assert smoke_test.main(router_factory=lambda: router) == 1
    assert router.available_calls == 1
    assert router.generation_calls is None
    assert capsys.readouterr().out == f"{smoke_test.UNAVAILABLE_MESSAGE}\n"


def test_success_uses_one_tiny_static_request_and_safe_output(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    first_openai_model = configured_model(model_id="first-model")
    router = FakeRouter(
        models=(
            configured_model(provider="anthropic", model_id="other-provider"),
            first_openai_model,
            configured_model(model_id="second-model"),
        ),
        result=StructuredGenerationResult(
            content={"answer": "concise result that must not be printed"},
            provider="openai",
            model="first-model",
            usage=SafeUsageMetadata(input_tokens=7, output_tokens=4, total_tokens=11),
        ),
    )

    assert smoke_test.main(router_factory=lambda: router) == 0

    assert router.available_calls == 1
    assert router.generation_calls == [
        {
            "provider": "openai",
            "model": "first-model",
            "system_instruction": smoke_test.SYSTEM_INSTRUCTION,
            "user_payload": {"topic": "interview practice"},
            "output_schema": {
                "type": "object",
                "properties": {"answer": {"type": "string"}},
                "required": ["answer"],
                "additionalProperties": False,
            },
            "max_output_tokens": 100,
        }
    ]
    output = capsys.readouterr().out
    assert "OpenAI structured-output smoke test succeeded." in output
    assert "Provider: openai" in output
    assert "Model: first-model" in output
    assert "Required answer string present: True" in output
    assert "Input tokens: 7" in output
    assert "Output tokens: 4" in output
    assert "Total tokens: 11" in output
    assert "Duration:" in output
    assert "concise result" not in output
    assert "interview practice" not in output
    assert smoke_test.SYSTEM_INSTRUCTION not in output


def test_safe_routing_error_does_not_print_internal_content(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    error = ProviderRequestError()
    error.__context__ = RuntimeError("provider body and fake secret")
    router = FakeRouter(models=(configured_model(),), failure=error)

    assert smoke_test.main(router_factory=lambda: router) == 1
    output = capsys.readouterr().out
    assert output == f"{error.code}: {error.safe_message}\n"
    assert "provider body" not in output
    assert "fake secret" not in output


def test_unexpected_error_prints_only_generic_failure(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    router = FakeRouter(
        models=(configured_model(),),
        failure=RuntimeError("provider body and fake secret"),
    )

    assert smoke_test.main(router_factory=lambda: router) == 1
    output = capsys.readouterr()
    assert output.out == f"{smoke_test.UNEXPECTED_FAILURE_MESSAGE}\n"
    assert output.err == ""
    assert "provider body" not in output.out
    assert "fake secret" not in output.out
