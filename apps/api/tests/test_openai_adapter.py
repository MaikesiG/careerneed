import json
from types import SimpleNamespace

import httpx
import pytest
from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
)

from app.config import AIModelConfig, AIModelRegistry
from app.services.ai import OpenAIAdapter, SafeUsageMetadata
from app.services.ai import interview_preparation_brief as brief_service
from app.services.ai import openai_adapter as adapter_module
from app.services.ai.routing import AIModelRoutingError


class FakeResponses:
    def __init__(self, response: object) -> None:
        self.response = response
        self.received: dict[str, object] | None = None

    def create(self, **kwargs: object) -> object:
        self.received = kwargs
        return self.response


class FakeClient:
    def __init__(self, response: object) -> None:
        self.responses = FakeResponses(response)


def install_fake_client(
    monkeypatch: pytest.MonkeyPatch,
    response: object,
) -> tuple[FakeClient, dict[str, object]]:
    client = FakeClient(response)
    client_arguments: dict[str, object] = {}

    def create_client(**kwargs: object) -> FakeClient:
        client_arguments.update(kwargs)
        return client

    monkeypatch.setattr(adapter_module, "OpenAI", create_client)
    return client, client_arguments


def generate(adapter: OpenAIAdapter):
    return adapter.generate_structured(
        api_key="test-api-key",
        model="test-model",
        system_instruction="Return a structured object.",
        user_payload={"second": [2, 1], "first": "value"},
        output_schema={
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
            "additionalProperties": False,
        },
        timeout_seconds=12.5,
        max_output_tokens=512,
    )


def test_responses_api_request_and_valid_result_are_normalized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = SimpleNamespace(
        output_text=json.dumps({"answer": "ready"}),
        usage=SimpleNamespace(input_tokens=8, output_tokens=3, total_tokens=11),
    )
    client, client_arguments = install_fake_client(monkeypatch, response)

    result = generate(OpenAIAdapter())

    assert client_arguments == {"api_key": "test-api-key", "timeout": 12.5}
    assert client.responses.received == {
        "model": "test-model",
        "instructions": "Return a structured object.",
        "input": '{"first":"value","second":[2,1]}',
        "text": {
            "format": {
                "type": "json_schema",
                "name": "structured_response",
                "schema": {
                    "type": "object",
                    "properties": {"answer": {"type": "string"}},
                    "required": ["answer"],
                    "additionalProperties": False,
                },
                "strict": True,
            }
        },
        "max_output_tokens": 512,
        "stream": False,
        "timeout": 12.5,
    }
    assert result.content == {"answer": "ready"}
    assert result.usage == SafeUsageMetadata(
        input_tokens=8,
        output_tokens=3,
        total_tokens=11,
    )


@pytest.mark.parametrize(
    "response",
    [
        SimpleNamespace(output_text="provider-body: not-json", usage=None),
        SimpleNamespace(usage=None),
        SimpleNamespace(output_text="", usage=None),
        SimpleNamespace(output_text="[]", usage=None),
        SimpleNamespace(output_text='"text"', usage=None),
        SimpleNamespace(output_text="1", usage=None),
        SimpleNamespace(output_text="null", usage=None),
        SimpleNamespace(output_text='{"answer":NaN}', usage=None),
    ],
)
def test_invalid_structured_output_fails_without_leaking_content(
    monkeypatch: pytest.MonkeyPatch,
    response: object,
) -> None:
    install_fake_client(monkeypatch, response)

    with pytest.raises(RuntimeError) as error:
        generate(OpenAIAdapter())

    assert str(error.value) == "AI provider returned an invalid structured response."
    assert "test-api-key" not in repr(error.value)
    assert "provider-body" not in repr(error.value)


@pytest.mark.parametrize(
    "usage",
    [
        SimpleNamespace(input_tokens=-1, output_tokens=1, total_tokens=0),
        SimpleNamespace(input_tokens=True, output_tokens=1, total_tokens=2),
        SimpleNamespace(input_tokens="8", output_tokens=1, total_tokens=9),
        SimpleNamespace(input_tokens=8, output_tokens=1),
    ],
)
def test_malformed_usage_fails_safely(
    monkeypatch: pytest.MonkeyPatch,
    usage: object,
) -> None:
    install_fake_client(
        monkeypatch,
        SimpleNamespace(output_text='{"answer":"ready"}', usage=usage),
    )

    with pytest.raises(RuntimeError) as error:
        generate(OpenAIAdapter())

    assert str(error.value) == "AI provider returned an invalid structured response."
    assert "test-api-key" not in repr(error.value)


def test_missing_usage_is_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    install_fake_client(
        monkeypatch,
        SimpleNamespace(output_text='{"answer":"ready"}', usage=None),
    )

    assert generate(OpenAIAdapter()).usage is None


def openai_status_error(error_type: type[APIError], status_code: int) -> APIError:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(status_code, request=request)
    return error_type(
        "raw provider detail with test-api-key and private prompt",
        response=response,
        body={"error": "raw provider body"},
    )


@pytest.mark.parametrize(
    ("sdk_error", "expected_code", "expected_message"),
    [
        (
            openai_status_error(AuthenticationError, 401),
            "provider_authentication_failed",
            "AI provider authentication failed.",
        ),
        (
            openai_status_error(PermissionDeniedError, 403),
            "provider_permission_denied",
            "AI provider permission was denied.",
        ),
        (
            openai_status_error(NotFoundError, 404),
            "provider_resource_not_found",
            "Requested AI provider resource was not found.",
        ),
        (
            openai_status_error(RateLimitError, 429),
            "provider_rate_limited",
            "AI provider rate limit was reached.",
        ),
        (
            openai_status_error(BadRequestError, 400),
            "provider_invalid_request",
            "AI provider rejected the request.",
        ),
        (
            APITimeoutError(httpx.Request("POST", "https://api.openai.com/v1/responses")),
            "provider_timeout",
            "AI provider request timed out.",
        ),
        (
            APIConnectionError(
                message="raw connection detail with test-api-key",
                request=httpx.Request("POST", "https://api.openai.com/v1/responses"),
            ),
            "provider_connection_failed",
            "Unable to connect to the AI provider.",
        ),
        (
            APIError(
                "unknown raw provider detail with test-api-key",
                httpx.Request("POST", "https://api.openai.com/v1/responses"),
                body={"error": "raw provider body"},
            ),
            "provider_request_failed",
            "AI provider request failed.",
        ),
    ],
)
def test_sdk_request_errors_are_safely_classified(
    monkeypatch: pytest.MonkeyPatch,
    sdk_error: APIError,
    expected_code: str,
    expected_message: str,
) -> None:
    class FailingResponses:
        def create(self, **kwargs: object) -> object:
            raise sdk_error

    client = SimpleNamespace(responses=FailingResponses())
    monkeypatch.setattr(adapter_module, "OpenAI", lambda **kwargs: client)

    with pytest.raises(AIModelRoutingError) as captured:
        generate(OpenAIAdapter())

    assert captured.value.code == expected_code
    assert str(captured.value) == expected_message
    serialized_error = repr(captured.value)
    for private_value in (
        "test-api-key",
        "raw provider detail",
        "raw provider body",
        "private prompt",
    ):
        assert private_value not in serialized_error
    assert captured.value.__context__ is None


def test_registered_openai_adapter_controls_model_availability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model = AIModelConfig(
        provider="openai",
        model_id="test-model",
        display_name="Test model",
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
            "openai": "configured-key",
            "anthropic": None,
            "google": None,
            "deepseek": None,
            "xai": None,
            "moonshot": None,
        },
    )
    monkeypatch.setattr(brief_service, "load_ai_router_timeout", lambda: 15.0)

    assert brief_service.get_model_router().available_models() == (model,)

    monkeypatch.setattr(
        brief_service,
        "load_ai_provider_keys",
        lambda: {
            "openai": None,
            "anthropic": None,
            "google": None,
            "deepseek": None,
            "xai": None,
            "moonshot": None,
        },
    )
    assert brief_service.get_model_router().available_models() == ()
    assert "configured-key" not in repr(OpenAIAdapter())
