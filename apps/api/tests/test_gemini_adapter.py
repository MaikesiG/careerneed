import json
from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors, types

from app.config import AIModelConfig, AIModelRegistry
from app.services.ai import GeminiAdapter, SafeUsageMetadata
from app.services.ai import gemini_adapter as adapter_module
from app.services.ai import interview_preparation_brief as brief_service
from app.services.ai.routing import AIModelRoutingError


class FakeModels:
    def __init__(self, response: object | None = None, failure: Exception | None = None) -> None:
        self.response = response
        self.failure = failure
        self.received: dict[str, object] | None = None

    def generate_content(self, **kwargs: object) -> object:
        self.received = kwargs
        if self.failure is not None:
            raise self.failure
        assert self.response is not None
        return self.response


class FakeClient:
    def __init__(self, response: object | None = None, failure: Exception | None = None) -> None:
        self.models = FakeModels(response, failure)
        self.closed = False

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *_args: object) -> None:
        self.closed = True


def install_fake_client(
    monkeypatch: pytest.MonkeyPatch,
    *,
    response: object | None = None,
    failure: Exception | None = None,
) -> tuple[FakeClient, dict[str, object]]:
    client = FakeClient(response, failure)
    client_arguments: dict[str, object] = {}

    def create_client(**kwargs: object) -> FakeClient:
        client_arguments.update(kwargs)
        return client

    monkeypatch.setattr(adapter_module.genai, "Client", create_client)
    return client, client_arguments


def generate(
    adapter: GeminiAdapter,
    *,
    api_key: str = "test-google-key",
    model: str = "gemini-test-model",
    system_instruction: str = "Return the requested structured object.",
    user_payload: dict[str, object] | None = None,
    output_schema: dict[str, object] | None = None,
):
    return adapter.generate_structured(
        api_key=api_key,
        model=model,
        system_instruction=system_instruction,
        user_payload=(
            {"second": [2, 1], "first": "untrusted value"} if user_payload is None else user_payload
        ),
        output_schema=(
            {
                "type": "object",
                "properties": {
                    "answer": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 100,
                    }
                },
                "required": ["answer"],
                "additionalProperties": False,
            }
            if output_schema is None
            else output_schema
        ),
        timeout_seconds=12.5,
        max_output_tokens=512,
    )


def test_generate_content_request_and_valid_result_are_normalized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = SimpleNamespace(
        text=json.dumps({"answer": "ready"}),
        usage_metadata=SimpleNamespace(
            prompt_token_count=8,
            candidates_token_count=3,
            total_token_count=11,
        ),
    )
    client, client_arguments = install_fake_client(monkeypatch, response=response)

    result = generate(GeminiAdapter())

    assert client.closed is True
    assert client_arguments["api_key"] == "test-google-key"
    http_options = client_arguments["http_options"]
    assert isinstance(http_options, types.HttpOptions)
    assert http_options.timeout == 12_500
    assert client.models.received is not None
    assert client.models.received["model"] == "gemini-test-model"
    assert client.models.received["contents"] == ('{"first":"untrusted value","second":[2,1]}')
    config = client.models.received["config"]
    assert isinstance(config, types.GenerateContentConfig)
    assert config.system_instruction == "Return the requested structured object."
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema == {
        "type": "object",
        "properties": {"answer": {"type": "string"}},
        "required": ["answer"],
        "additionalProperties": False,
    }
    assert config.max_output_tokens == 512
    assert config.tools is None
    assert config.tool_config is None
    assert config.automatic_function_calling is None
    assert "automatic_function_calling" not in config.model_fields_set
    assert result.content == {"answer": "ready"}
    assert result.usage == SafeUsageMetadata(
        input_tokens=8,
        output_tokens=3,
        total_tokens=11,
    )


def test_missing_usage_is_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    install_fake_client(
        monkeypatch,
        response=SimpleNamespace(text='{"answer":"ready"}', usage_metadata=None),
    )

    assert generate(GeminiAdapter()).usage is None


@pytest.mark.parametrize(
    ("field", "expected_error"),
    [
        ("model", adapter_module.GeminiInvalidModelIdentifierError),
        ("api_key", adapter_module.GeminiInvalidApiKeyError),
    ],
)
def test_ascii_constrained_fields_reject_unicode_before_client_construction(
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    expected_error: type[AIModelRoutingError],
) -> None:
    client, client_arguments = install_fake_client(
        monkeypatch,
        response=SimpleNamespace(text='{"answer":"ready"}', usage_metadata=None),
    )
    arguments = {field: "invalid-秘密"}

    with pytest.raises(expected_error) as captured:
        generate(GeminiAdapter(), **arguments)

    assert client_arguments == {}
    assert client.models.received is None
    assert "invalid" not in repr(captured.value)
    assert "秘密" not in repr(captured.value)


def test_unicode_content_remains_supported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = install_fake_client(
        monkeypatch,
        response=SimpleNamespace(text='{"answer":"ready"}', usage_metadata=None),
    )
    user_payload = {
        "resume_text": "后端工程师",
        "job_description": "设计可靠的数据平台",
        "interview_notes": "讨论了系统设计",
    }
    output_schema = {
        "type": "object",
        "description": "返回简洁的准备建议",
        "properties": {"answer": {"type": "string"}},
        "required": ["answer"],
        "additionalProperties": False,
    }

    result = generate(
        GeminiAdapter(),
        system_instruction="请返回结构化结果。",
        user_payload=user_payload,
        output_schema=output_schema,
    )

    assert result.content == {"answer": "ready"}
    assert client.models.received is not None
    serialized_payload = client.models.received["contents"]
    assert isinstance(serialized_payload, str)
    for expected_text in user_payload.values():
        assert expected_text in serialized_payload
    config = client.models.received["config"]
    assert isinstance(config, types.GenerateContentConfig)
    assert config.system_instruction == "请返回结构化结果。"
    assert config.response_json_schema == output_schema


@pytest.mark.parametrize(
    "response",
    [
        SimpleNamespace(text="provider-body: not-json", usage_metadata=None),
        SimpleNamespace(usage_metadata=None),
        SimpleNamespace(text="", usage_metadata=None),
        SimpleNamespace(text="[]", usage_metadata=None),
        SimpleNamespace(text='"text"', usage_metadata=None),
        SimpleNamespace(text="1", usage_metadata=None),
        SimpleNamespace(text="null", usage_metadata=None),
        SimpleNamespace(text='{"answer":NaN}', usage_metadata=None),
    ],
)
def test_invalid_structured_output_fails_without_leaking_content(
    monkeypatch: pytest.MonkeyPatch,
    response: object,
) -> None:
    install_fake_client(monkeypatch, response=response)

    with pytest.raises(RuntimeError) as captured:
        generate(GeminiAdapter())

    assert str(captured.value) == "AI provider returned an invalid structured response."
    assert "test-google-key" not in repr(captured.value)
    assert "provider-body" not in repr(captured.value)


def test_unicode_encode_error_retains_only_safe_structural_diagnostics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_source = "private prompt 秘密"
    install_fake_client(
        monkeypatch,
        failure=UnicodeEncodeError(
            "ascii",
            private_source,
            15,
            16,
            "raw reason containing fake-key",
        ),
    )

    with pytest.raises(adapter_module.GeminiUnhandledProviderError) as captured:
        generate(
            GeminiAdapter(),
            system_instruction="Unicode 指令",
            user_payload={"context": "Unicode 内容"},
            output_schema={
                "type": "object",
                "description": "Unicode 描述",
            },
        )

    error = captured.value
    assert error.exception_type == "builtins.UnicodeEncodeError"
    diagnostic = error.unicode_diagnostic
    assert diagnostic is not None
    assert diagnostic.stage == "generate_content"
    assert diagnostic.encoding == "ascii"
    assert diagnostic.start == 15
    assert diagnostic.end == 16
    assert diagnostic.reason == "character cannot be encoded"
    assert {field.name: field.ascii_compatible for field in diagnostic.fields} == {
        "model": True,
        "api_key": True,
        "system_instruction": False,
        "user_payload": False,
        "schema": False,
    }
    assert not hasattr(diagnostic, "object")
    for private_value in (private_source, "raw reason", "fake-key"):
        assert private_value not in repr(error)
        assert private_value not in repr(diagnostic)


def gemini_api_error(code: int, status: str, reason: str | None = None) -> errors.APIError:
    details = [] if reason is None else [{"reason": reason}]
    return errors.APIError(
        code,
        {
            "error": {
                "code": code,
                "status": status,
                "message": "raw provider detail with test-google-key and private prompt",
                "details": details,
            }
        },
    )


@pytest.mark.parametrize(
    ("sdk_error", "expected_code", "expected_message"),
    [
        (
            gemini_api_error(401, "UNAUTHENTICATED"),
            "provider_authentication_failed",
            "AI provider authentication failed.",
        ),
        (
            gemini_api_error(400, "INVALID_ARGUMENT", "API_KEY_INVALID"),
            "provider_authentication_failed",
            "AI provider authentication failed.",
        ),
        (
            gemini_api_error(403, "PERMISSION_DENIED"),
            "provider_permission_denied",
            "AI provider permission was denied.",
        ),
        (
            gemini_api_error(404, "NOT_FOUND"),
            "provider_resource_not_found",
            "Requested AI provider resource was not found.",
        ),
        (
            gemini_api_error(429, "RESOURCE_EXHAUSTED"),
            "provider_rate_limited",
            "AI provider rate limit was reached.",
        ),
        (
            gemini_api_error(400, "INVALID_ARGUMENT"),
            "provider_invalid_request",
            "AI provider rejected the request.",
        ),
        (
            gemini_api_error(504, "DEADLINE_EXCEEDED"),
            "provider_timeout",
            "AI provider request timed out.",
        ),
        (
            gemini_api_error(500, "INTERNAL"),
            "provider_request_failed",
            "AI provider request failed.",
        ),
        (
            httpx.ReadTimeout(
                "raw timeout detail with test-google-key",
                request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
            ),
            "provider_timeout",
            "AI provider request timed out.",
        ),
        (
            httpx.ConnectError(
                "raw connection detail with test-google-key",
                request=httpx.Request("POST", "https://generativelanguage.googleapis.com"),
            ),
            "provider_connection_failed",
            "Unable to connect to the AI provider.",
        ),
    ],
)
def test_provider_errors_are_safely_classified(
    monkeypatch: pytest.MonkeyPatch,
    sdk_error: Exception,
    expected_code: str,
    expected_message: str,
) -> None:
    install_fake_client(monkeypatch, failure=sdk_error)

    with pytest.raises(AIModelRoutingError) as captured:
        generate(GeminiAdapter())

    assert captured.value.code == expected_code
    assert str(captured.value) == expected_message
    serialized_error = repr(captured.value)
    for private_value in (
        "test-google-key",
        "raw provider detail",
        "raw timeout detail",
        "raw connection detail",
        "private prompt",
    ):
        assert private_value not in serialized_error
    assert captured.value.__context__ is None


def test_unclassified_gemini_api_error_preserves_only_safe_provenance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sdk_error = gemini_api_error(500, "INTERNAL")
    install_fake_client(monkeypatch, failure=sdk_error)

    with pytest.raises(adapter_module.GeminiUnhandledProviderError) as captured:
        generate(GeminiAdapter())

    error = captured.value
    assert error.code == "provider_request_failed"
    assert str(error) == "AI provider request failed."
    assert error.failure_stage == "generate_content"
    assert error.exception_module == "google.genai.errors"
    assert error.exception_name == "APIError"
    assert error.http_status == 500
    assert "raw provider detail" not in repr(error)
    assert "test-google-key" not in repr(error)
    assert "private prompt" not in repr(error)
    assert error.__context__ is None


@pytest.mark.parametrize(
    "sdk_error",
    [
        ValueError("raw SDK validation failure with test-google-key"),
        RuntimeError("raw unknown provider failure with test-google-key"),
    ],
)
def test_unclassified_sdk_exception_is_generic_through_router(
    monkeypatch: pytest.MonkeyPatch,
    sdk_error: Exception,
) -> None:
    model = AIModelConfig(
        provider="google",
        model_id="gemini-test-model",
        display_name="Gemini test model",
        enabled=True,
        supports_structured_output=True,
        default_max_output_tokens=512,
    )
    install_fake_client(
        monkeypatch,
        failure=sdk_error,
    )
    monkeypatch.setattr(
        brief_service,
        "load_ai_model_registry",
        lambda: AIModelRegistry([model]),
    )
    monkeypatch.setattr(
        brief_service,
        "load_ai_provider_keys",
        lambda: {
            "openai": None,
            "anthropic": None,
            "google": "configured-google-key",
            "deepseek": None,
            "xai": None,
            "moonshot": None,
        },
    )
    monkeypatch.setattr(brief_service, "load_ai_router_timeout", lambda: 15.0)

    with pytest.raises(AIModelRoutingError) as captured:
        brief_service.get_model_router().generate_structured(
            provider="google",
            model="gemini-test-model",
            system_instruction="Return the requested object.",
            user_payload={"context": "safe"},
            output_schema={"type": "object"},
        )

    assert captured.value.code == "provider_request_failed"
    assert str(captured.value) == "AI provider request failed."
    assert isinstance(captured.value, adapter_module.GeminiUnhandledProviderError)
    expected_exception_type = f"{type(sdk_error).__module__}.{type(sdk_error).__name__}"
    assert captured.value.exception_type == expected_exception_type
    assert "raw SDK validation failure" not in repr(captured.value)
    assert "raw unknown provider failure" not in repr(captured.value)
    assert "test-google-key" not in repr(captured.value)
    assert captured.value.__context__ is None


def test_registered_gemini_adapter_controls_model_availability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = AIModelConfig(
        provider="google",
        model_id="gemini-test-model",
        display_name="Gemini test model",
        enabled=True,
        supports_structured_output=True,
        default_max_output_tokens=512,
    )
    monkeypatch.setattr(
        brief_service,
        "load_ai_model_registry",
        lambda: AIModelRegistry([model]),
    )
    monkeypatch.setattr(
        brief_service,
        "load_ai_provider_keys",
        lambda: {
            "openai": None,
            "anthropic": None,
            "google": "configured-google-key",
            "deepseek": None,
            "xai": None,
            "moonshot": None,
        },
    )
    monkeypatch.setattr(brief_service, "load_ai_router_timeout", lambda: 15.0)

    assert brief_service.get_model_router().available_models() == (model,)
    assert "configured-google-key" not in repr(GeminiAdapter())
