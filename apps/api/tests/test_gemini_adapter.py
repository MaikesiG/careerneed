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


def generate(adapter: GeminiAdapter):
    return adapter.generate_structured(
        api_key="test-google-key",
        model="gemini-test-model",
        system_instruction="Return the requested structured object.",
        user_payload={"second": [2, 1], "first": "untrusted value"},
        output_schema={
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
        },
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
    assert isinstance(
        config.automatic_function_calling,
        types.AutomaticFunctionCallingConfig,
    )
    assert config.automatic_function_calling.disable is True
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
    assert "raw SDK validation failure" not in repr(captured.value)
    assert "raw unknown provider failure" not in repr(captured.value)
    assert "test-google-key" not in repr(captured.value)


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
