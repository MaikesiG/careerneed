import json
from collections.abc import Mapping

import httpx
from google import genai
from google.genai import errors, types

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
# Gemini's JSON Schema subset omits these keywords; downstream Pydantic validation
# remains authoritative for the full CareerNeed output contract.
_UNSUPPORTED_SCHEMA_KEYS = frozenset({"default", "minLength", "maxLength"})


class GeminiAdapter:
    provider: AIProviderId = "google"
    capabilities = ProviderCapabilities(supports_structured_output=True)

    def __repr__(self) -> str:
        return "GeminiAdapter()"

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
            with genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=round(timeout_seconds * 1_000)),
            ) as client:
                response = client.models.generate_content(
                    model=model,
                    contents=json.dumps(
                        user_payload,
                        ensure_ascii=False,
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_json_schema=_prepare_response_schema(output_schema),
                        max_output_tokens=max_output_tokens,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )
        except errors.APIError as error:
            normalized_error = _normalize_gemini_api_error(error)
        except httpx.TimeoutException:
            normalized_error = ProviderTimeoutError()
        except httpx.NetworkError:
            normalized_error = ProviderConnectionError()
        if normalized_error is not None:
            raise normalized_error

        try:
            output_text = response.text
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

        return AdapterGenerationResult(content=content, usage=_parse_usage(response))


def _normalize_gemini_api_error(error: errors.APIError) -> AIModelRoutingError:
    code = getattr(error, "code", None)
    status = getattr(error, "status", None)
    reason = _gemini_error_reason(error)
    if (
        code == 401
        or status == "UNAUTHENTICATED"
        or reason
        in {
            "API_KEY_INVALID",
            "API_KEY_MISSING",
        }
    ):
        return ProviderAuthenticationError()
    if code == 403 or status == "PERMISSION_DENIED":
        return ProviderPermissionDeniedError()
    if code == 404 or status == "NOT_FOUND":
        return ProviderResourceNotFoundError()
    if code == 429 or status == "RESOURCE_EXHAUSTED":
        return ProviderRateLimitError()
    if code in (400, 422) or status == "INVALID_ARGUMENT":
        return ProviderInvalidRequestError()
    if code in (408, 504) or status == "DEADLINE_EXCEEDED":
        return ProviderTimeoutError()
    return ProviderRequestError()


def _gemini_error_reason(error: errors.APIError) -> str | None:
    details = getattr(error, "details", None)
    if not isinstance(details, dict):
        return None
    error_details = details.get("error", details)
    if not isinstance(error_details, dict):
        return None
    entries = error_details.get("details")
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if isinstance(entry, dict) and isinstance(entry.get("reason"), str):
            return entry["reason"]
    return None


def _prepare_response_schema(schema: Mapping[str, object]) -> dict[str, object]:
    prepared: dict[str, object] = {}
    for key, value in schema.items():
        if key in _UNSUPPORTED_SCHEMA_KEYS:
            continue
        if key in {"properties", "$defs"} and isinstance(value, dict):
            prepared[key] = {
                name: _prepare_schema_value(property_schema)
                for name, property_schema in value.items()
            }
        else:
            prepared[key] = _prepare_schema_value(value)
    return prepared


def _prepare_schema_value(value: object) -> object:
    if isinstance(value, dict):
        return _prepare_response_schema(value)
    if isinstance(value, list):
        return [_prepare_schema_value(item) for item in value]
    return value


def _parse_usage(response: object) -> SafeUsageMetadata | None:
    try:
        usage = getattr(response, "usage_metadata", None)
        if usage is None:
            return None
        values = (
            getattr(usage, "prompt_token_count", None),
            getattr(usage, "candidates_token_count", None),
            getattr(usage, "total_token_count", None),
        )
    except Exception:
        raise RuntimeError(_INVALID_RESPONSE_MESSAGE) from None

    if any(
        value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0)
        for value in values
    ):
        raise RuntimeError(_INVALID_RESPONSE_MESSAGE)
    return SafeUsageMetadata(
        input_tokens=values[0],
        output_tokens=values[1],
        total_tokens=values[2],
    )


def _reject_non_json_number(_value: str) -> None:
    raise ValueError(_INVALID_RESPONSE_MESSAGE)
