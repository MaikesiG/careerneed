import json
from collections.abc import Mapping
from dataclasses import dataclass

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


@dataclass(frozen=True, slots=True)
class GeminiFieldDiagnostic:
    name: str
    present: bool
    length: int
    ascii_compatible: bool
    leading_whitespace: bool
    trailing_whitespace: bool


@dataclass(frozen=True, slots=True)
class GeminiUnicodeDiagnostic:
    stage: str
    encoding: str
    start: int
    end: int
    reason: str
    fields: tuple[GeminiFieldDiagnostic, ...]


class GeminiInvalidModelIdentifierError(ProviderInvalidRequestError):
    """Safe failure for a non-ASCII provider model identifier."""


class GeminiInvalidApiKeyError(ProviderAuthenticationError):
    """Safe failure for a non-ASCII provider credential."""


class GeminiUnhandledProviderError(ProviderRequestError):
    """Safe type-only diagnostic for the opt-in Gemini smoke harness."""

    def __init__(
        self,
        error: Exception,
        *,
        stage: str = "unknown",
        fields: tuple[GeminiFieldDiagnostic, ...] = (),
    ) -> None:
        super().__init__()
        error_type = type(error)
        self.exception_module = error_type.__module__
        self.exception_name = error_type.__name__
        self.failure_stage = stage
        self.http_status = _safe_http_status(error)
        self.unicode_diagnostic = (
            _unicode_diagnostic(error, stage=stage, fields=fields)
            if isinstance(error, UnicodeEncodeError)
            else None
        )

    @property
    def exception_type(self) -> str:
        return f"{self.exception_module}.{self.exception_name}"


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
        serialized_user_payload = json.dumps(
            user_payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        prepared_response_schema = _prepare_response_schema(output_schema)
        serialized_response_schema = json.dumps(
            prepared_response_schema,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        field_diagnostics = _field_diagnostics(
            model=model,
            api_key=api_key,
            system_instruction=system_instruction,
            serialized_user_payload=serialized_user_payload,
            serialized_response_schema=serialized_response_schema,
        )
        if not model.isascii():
            raise GeminiInvalidModelIdentifierError()
        if not api_key.isascii():
            raise GeminiInvalidApiKeyError()

        normalized_error: AIModelRoutingError | None = None
        response: object | None = None
        stage = "config construction"
        try:
            generation_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_json_schema=prepared_response_schema,
                max_output_tokens=max_output_tokens,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            )
            stage = "client construction"
            with genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=round(timeout_seconds * 1_000)),
            ) as client:
                stage = "generate_content"
                response = client.models.generate_content(
                    model=model,
                    contents=serialized_user_payload,
                    config=generation_config,
                )
        except errors.APIError as error:
            normalized_error = _normalize_gemini_api_error(error)
            if type(normalized_error) is ProviderRequestError:
                normalized_error = GeminiUnhandledProviderError(
                    error,
                    stage=stage,
                    fields=field_diagnostics,
                )
        except httpx.TimeoutException:
            normalized_error = ProviderTimeoutError()
        except httpx.NetworkError:
            normalized_error = ProviderConnectionError()
        except Exception as error:
            normalized_error = GeminiUnhandledProviderError(
                error,
                stage=stage,
                fields=field_diagnostics,
            )
        if normalized_error is not None:
            raise normalized_error

        try:
            output_text = response.text
        except UnicodeEncodeError as error:
            raise GeminiUnhandledProviderError(
                error,
                stage="response processing",
                fields=field_diagnostics,
            ) from None
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


def _field_diagnostics(
    *,
    model: str,
    api_key: str,
    system_instruction: str,
    serialized_user_payload: str,
    serialized_response_schema: str,
) -> tuple[GeminiFieldDiagnostic, ...]:
    return tuple(
        _field_diagnostic(name, value)
        for name, value in (
            ("model", model),
            ("api_key", api_key),
            ("system_instruction", system_instruction),
            ("user_payload", serialized_user_payload),
            ("schema", serialized_response_schema),
        )
    )


def _field_diagnostic(name: str, value: str) -> GeminiFieldDiagnostic:
    return GeminiFieldDiagnostic(
        name=name,
        present=bool(value),
        length=len(value),
        ascii_compatible=value.isascii(),
        leading_whitespace=bool(value[:1].isspace()),
        trailing_whitespace=bool(value[-1:].isspace()),
    )


def _unicode_diagnostic(
    error: UnicodeEncodeError,
    *,
    stage: str,
    fields: tuple[GeminiFieldDiagnostic, ...],
) -> GeminiUnicodeDiagnostic:
    encoding = error.encoding if error.encoding.isascii() else "unknown"
    return GeminiUnicodeDiagnostic(
        stage=stage,
        encoding=encoding,
        start=error.start,
        end=error.end,
        reason="character cannot be encoded",
        fields=fields,
    )


def _safe_http_status(error: Exception) -> int | None:
    for attribute in ("code", "status_code"):
        try:
            value = getattr(error, attribute, None)
        except Exception:
            continue
        if not isinstance(value, bool) and isinstance(value, int) and 100 <= value <= 599:
            return value
    return None


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
