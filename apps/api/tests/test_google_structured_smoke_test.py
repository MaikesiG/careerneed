from dataclasses import dataclass

import pytest
from google.genai import errors

from app.config import AIModelConfig
from app.services.ai.gemini_adapter import (
    GeminiFieldDiagnostic,
    GeminiUnhandledProviderError,
)
from app.services.ai.routing import (
    ProviderRequestError,
    SafeUsageMetadata,
    StructuredGenerationResult,
)
from scripts import google_structured_smoke_test as smoke_test


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


def configured_model(provider: str = "google", model_id: str = "gemini-smoke") -> AIModelConfig:
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


def test_no_available_google_model_is_safe_and_does_not_generate(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    router = FakeRouter(models=(configured_model(provider="openai"),))

    assert smoke_test.main(router_factory=lambda: router) == 1
    assert router.available_calls == 1
    assert router.generation_calls is None
    assert capsys.readouterr().out == f"{smoke_test.UNAVAILABLE_MESSAGE}\n"


def test_success_uses_one_tiny_static_request_and_safe_output(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    first_google_model = configured_model(model_id="first-gemini")
    router = FakeRouter(
        models=(
            configured_model(provider="openai", model_id="other-provider"),
            first_google_model,
            configured_model(model_id="second-gemini"),
        ),
        result=StructuredGenerationResult(
            content={"answer": "concise result that must not be printed"},
            provider="google",
            model="first-gemini",
            usage=SafeUsageMetadata(input_tokens=7, output_tokens=4, total_tokens=11),
        ),
    )

    assert smoke_test.main(router_factory=lambda: router) == 0
    assert router.generation_calls == [
        {
            "provider": "google",
            "model": "first-gemini",
            "system_instruction": smoke_test.SYSTEM_INSTRUCTION,
            "user_payload": smoke_test.USER_PAYLOAD,
            "output_schema": smoke_test.OUTPUT_SCHEMA,
            "max_output_tokens": 100,
        }
    ]
    output = capsys.readouterr().out
    assert "Google structured-output smoke test succeeded." in output
    assert "Provider: google" in output
    assert "Model: first-gemini" in output
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


def test_unhandled_gemini_error_prints_only_safe_exception_type(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    error = GeminiUnhandledProviderError(
        ValueError("provider body with fake-key, private prompt, and request payload")
    )
    router = FakeRouter(models=(configured_model(),), failure=error)

    assert smoke_test.main(router_factory=lambda: router) == 1
    output = capsys.readouterr()
    assert output.out == (
        "provider_request_failed: AI provider request failed.\n"
        "failure_stage=unknown\n"
        "exception_module=builtins\n"
        "exception_type=ValueError\n"
    )
    assert output.err == ""
    for private_value in (
        "provider body",
        "fake-key",
        "private prompt",
        "request payload",
    ):
        assert private_value not in output.out


def test_unicode_error_prints_only_safe_structural_metadata(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    private_source = "private prompt and fake-key 秘密"
    error = GeminiUnhandledProviderError(
        UnicodeEncodeError(
            "ascii",
            private_source,
            28,
            29,
            "raw provider reason containing private content",
        ),
        stage="generate_content",
        fields=(
            GeminiFieldDiagnostic("model", True, 18, True, False, False),
            GeminiFieldDiagnostic("api_key", True, 39, True, False, False),
            GeminiFieldDiagnostic("system_instruction", True, 24, False, False, False),
            GeminiFieldDiagnostic("user_payload", True, 41, False, False, False),
            GeminiFieldDiagnostic("schema", True, 120, False, False, False),
        ),
    )
    router = FakeRouter(models=(configured_model(),), failure=error)

    assert smoke_test.main(router_factory=lambda: router) == 1
    output = capsys.readouterr()
    assert output.out == (
        "provider_request_failed: AI provider request failed.\n"
        "failure_stage=generate_content\n"
        "exception_module=builtins\n"
        "exception_type=UnicodeEncodeError\n"
        "Unicode encoding diagnostic:\n"
        "stage=generate_content\n"
        "encoding=ascii\n"
        "start=28\n"
        "end=29\n"
        "reason=character cannot be encoded\n"
        "Gemini field diagnostic:\n"
        "model: present=true ascii=true length=18 leading_whitespace=false "
        "trailing_whitespace=false\n"
        "api_key: present=true ascii=true length=39 leading_whitespace=false "
        "trailing_whitespace=false\n"
        "system_instruction: present=true ascii=false length=24 "
        "leading_whitespace=false trailing_whitespace=false\n"
        "user_payload: present=true ascii=false length=41 leading_whitespace=false "
        "trailing_whitespace=false\n"
        "schema: present=true ascii=false length=120 leading_whitespace=false "
        "trailing_whitespace=false\n"
    )
    assert output.err == ""
    for private_value in (
        private_source,
        "private prompt",
        "fake-key",
        "raw provider reason",
        "秘密",
    ):
        assert private_value not in output.out


def test_generic_gemini_api_error_prints_safe_status_and_provenance(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv(smoke_test.OPT_IN_ENV_VAR, "1")
    sdk_error = errors.APIError(
        503,
        {
            "error": {
                "code": 503,
                "status": "UNAVAILABLE",
                "message": "provider body with fake-key and private prompt",
            }
        },
    )
    error = GeminiUnhandledProviderError(sdk_error, stage="generate_content")
    router = FakeRouter(models=(configured_model(),), failure=error)

    assert smoke_test.main(router_factory=lambda: router) == 1
    output = capsys.readouterr()
    assert output.out == (
        "provider_request_failed: AI provider request failed.\n"
        "failure_stage=generate_content\n"
        "exception_module=google.genai.errors\n"
        "exception_type=APIError\n"
        "http_status=503\n"
    )
    assert output.err == ""
    for private_value in ("provider body", "fake-key", "private prompt"):
        assert private_value not in output.out


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
