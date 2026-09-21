import json
from collections.abc import Mapping

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    OpenAI,
    PermissionDeniedError,
    RateLimitError,
)

from app.config import AIProviderId
from app.services.ai.routing import (
    AdapterGenerationResult,
    AIModelRoutingError,
    ProviderAuthenticationError,
    ProviderCapabilities,
    ProviderConnectionError,
    ProviderInvalidRequestError,
    ProviderPermissionDeniedError,
    ProviderRateLimitError,
    ProviderRequestError,
    ProviderResourceNotFoundError,
    ProviderTimeoutError,
    SafeUsageMetadata,
)

_INVALID_RESPONSE_MESSAGE = "AI provider returned an invalid structured response."
_STRUCTURED_OUTPUT_NAME = "structured_response"


class OpenAIAdapter:
    provider: AIProviderId = "openai"
    capabilities = ProviderCapabilities(supports_structured_output=True)

    def __repr__(self) -> str:
        return "OpenAIAdapter()"

    def generate_structured(
        self,
        *,
        api_key: str,
        model: str,
        system_instruction: str,
        user_payload: Mapping[str, object],
        output_schema: Mapping[str, object],
        timeout_seconds: float,
        max_output_tokens: int,
    ) -> AdapterGenerationResult:
        normalized_error: AIModelRoutingError | None = None
        response: object | None = None
        try:
            client = OpenAI(api_key=api_key, timeout=timeout_seconds)
            response = client.responses.create(
                model=model,
                instructions=system_instruction,
                input=json.dumps(
                    user_payload,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                ),
                text={
                    "format": {
                        "type": "json_schema",
                        "name": _STRUCTURED_OUTPUT_NAME,
                        "schema": dict(output_schema),
                        "strict": True,
                    }
                },
                max_output_tokens=max_output_tokens,
                stream=False,
                timeout=timeout_seconds,
            )
        except APIError as error:
            normalized_error = _normalize_openai_error(error)
        if normalized_error is not None:
            raise normalized_error

        try:
            output_text = response.output_text
        except Exception:
            raise RuntimeError(_INVALID_RESPONSE_MESSAGE) from None
        if not isinstance(output_text, str) or not output_text.strip():
            raise RuntimeError(_INVALID_RESPONSE_MESSAGE)

        try:
            content = json.loads(output_text, parse_constant=_reject_non_json_number)
        except (TypeError, ValueError):
            raise RuntimeError(_INVALID_RESPONSE_MESSAGE) from None
        if not isinstance(content, dict):
            raise RuntimeError(_INVALID_RESPONSE_MESSAGE)

        return AdapterGenerationResult(
            content=content,
            usage=_parse_usage(response),
        )


def _normalize_openai_error(error: APIError) -> AIModelRoutingError:
    if isinstance(error, AuthenticationError):
        return ProviderAuthenticationError()
    if isinstance(error, PermissionDeniedError):
        return ProviderPermissionDeniedError()
    if isinstance(error, NotFoundError):
        return ProviderResourceNotFoundError()
    if isinstance(error, RateLimitError):
        return ProviderRateLimitError()
    if isinstance(error, BadRequestError):
        return ProviderInvalidRequestError()
    if isinstance(error, APITimeoutError):
        return ProviderTimeoutError()
    if isinstance(error, APIConnectionError):
        return ProviderConnectionError()
    return ProviderRequestError()


def _parse_usage(response: object) -> SafeUsageMetadata | None:
    try:
        usage = getattr(response, "usage", None)
        if usage is None:
            return None
        values = (
            usage.input_tokens,
            usage.output_tokens,
            usage.total_tokens,
        )
    except Exception:
        raise RuntimeError(_INVALID_RESPONSE_MESSAGE) from None

    if any(isinstance(value, bool) or not isinstance(value, int) or value < 0 for value in values):
        raise RuntimeError(_INVALID_RESPONSE_MESSAGE)
    return SafeUsageMetadata(
        input_tokens=values[0],
        output_tokens=values[1],
        total_tokens=values[2],
    )


def _reject_non_json_number(_value: str) -> None:
    raise ValueError(_INVALID_RESPONSE_MESSAGE)
