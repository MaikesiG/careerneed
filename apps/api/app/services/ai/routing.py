import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

from app.config import (
    AI_PROVIDER_IDS,
    MAX_AI_ROUTER_TIMEOUT_SECONDS,
    AIModelConfig,
    AIModelRegistry,
    AIProviderId,
)


class AIModelRoutingError(RuntimeError):
    code = "ai_routing_error"
    safe_message = "Unable to complete the AI request."

    def __init__(self) -> None:
        super().__init__(self.safe_message)


class UnknownModelError(AIModelRoutingError):
    code = "unknown_model"
    safe_message = "Requested AI model is not configured."


class ModelUnavailableError(AIModelRoutingError):
    code = "model_unavailable"
    safe_message = "Requested AI model is unavailable."


class UnsupportedCapabilityError(AIModelRoutingError):
    code = "unsupported_capability"
    safe_message = "Requested AI model does not support structured output."


class ProviderTimeoutError(AIModelRoutingError):
    code = "provider_timeout"
    safe_message = "AI provider request timed out."


class ProviderRequestError(AIModelRoutingError):
    code = "provider_request_failed"
    safe_message = "AI provider request failed."


class ProviderAuthenticationError(AIModelRoutingError):
    code = "provider_authentication_failed"
    safe_message = "AI provider authentication failed."


class ProviderPermissionDeniedError(AIModelRoutingError):
    code = "provider_permission_denied"
    safe_message = "AI provider permission was denied."


class ProviderResourceNotFoundError(AIModelRoutingError):
    code = "provider_resource_not_found"
    safe_message = "Requested AI provider resource was not found."


class ProviderRateLimitError(AIModelRoutingError):
    code = "provider_rate_limited"
    safe_message = "AI provider rate limit was reached."


class ProviderInvalidRequestError(AIModelRoutingError):
    code = "provider_invalid_request"
    safe_message = "AI provider rejected the request."


class ProviderConnectionError(AIModelRoutingError):
    code = "provider_connection_failed"
    safe_message = "Unable to connect to the AI provider."


class InvalidGenerationRequestError(AIModelRoutingError):
    code = "invalid_generation_request"
    safe_message = "AI generation request is invalid."


@dataclass(frozen=True, slots=True)
class ProviderCapabilities:
    supports_structured_output: bool


@dataclass(frozen=True, slots=True)
class SafeUsageMetadata:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None

    def __post_init__(self) -> None:
        for value in (self.input_tokens, self.output_tokens, self.total_tokens):
            if value is not None and (
                isinstance(value, bool) or not isinstance(value, int) or value < 0
            ):
                raise ValueError("Token counts must be non-negative integers.")


@dataclass(frozen=True, slots=True)
class AdapterGenerationResult:
    content: Mapping[str, object]
    usage: SafeUsageMetadata | None = None


@dataclass(frozen=True, slots=True)
class StructuredGenerationResult:
    content: dict[str, object]
    provider: AIProviderId
    model: str
    usage: SafeUsageMetadata | None = None


class ProviderAdapter(Protocol):
    provider: AIProviderId
    capabilities: ProviderCapabilities

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
    ) -> AdapterGenerationResult: ...


def _is_json_compatible(value: object, active_containers: set[int] | None = None) -> bool:
    if value is None or isinstance(value, (str, bool, int)):
        return True
    if isinstance(value, float):
        return math.isfinite(value)
    if not isinstance(value, (list, dict)):
        return False

    active = set() if active_containers is None else active_containers
    container_id = id(value)
    if container_id in active:
        return False
    active.add(container_id)
    try:
        if isinstance(value, list):
            return all(_is_json_compatible(item, active) for item in value)
        return all(
            isinstance(key, str) and _is_json_compatible(item, active)
            for key, item in value.items()
        )
    except RecursionError:
        return False
    finally:
        active.remove(container_id)


class ModelRouter:
    def __init__(
        self,
        *,
        registry: AIModelRegistry,
        adapters: Mapping[AIProviderId, ProviderAdapter],
        provider_keys: Mapping[AIProviderId, str | None],
        default_timeout_seconds: float,
    ) -> None:
        self._registry = registry
        self._adapters = dict(adapters)
        self._provider_keys = dict(provider_keys)
        self._default_timeout_seconds = self._validate_timeout(default_timeout_seconds)
        for provider, adapter in self._adapters.items():
            try:
                valid_adapter = (
                    provider in AI_PROVIDER_IDS
                    and getattr(adapter, "provider", None) == provider
                    and isinstance(getattr(adapter, "capabilities", None), ProviderCapabilities)
                    and callable(getattr(adapter, "generate_structured", None))
                )
            except Exception:
                valid_adapter = False
            if not valid_adapter:
                raise ValueError("AI adapter registration is invalid.")

    def __repr__(self) -> str:
        return (
            f"ModelRouter(models={len(self._registry.models())}, "
            f"adapters={len(self._adapters)})"
        )

    def available_models(self) -> tuple[AIModelConfig, ...]:
        return tuple(
            model
            for model in self._registry.models()
            if model.enabled
            and bool(self._provider_keys.get(model.provider))
            and model.provider in self._adapters
        )

    def generate_structured(
        self,
        *,
        provider: str,
        model: str,
        system_instruction: str,
        user_payload: Mapping[str, object],
        output_schema: Mapping[str, object],
        timeout_seconds: float | None = None,
        max_output_tokens: int | None = None,
    ) -> StructuredGenerationResult:
        model_config = self._registry.get(provider, model)
        if model_config is None:
            raise UnknownModelError()
        if not model_config.enabled:
            raise ModelUnavailableError()

        api_key = self._provider_keys.get(model_config.provider)
        adapter = self._adapters.get(model_config.provider)
        if not api_key or adapter is None:
            raise ModelUnavailableError()
        if (
            not model_config.supports_structured_output
            or not adapter.capabilities.supports_structured_output
        ):
            raise UnsupportedCapabilityError()

        timeout = self._validate_timeout(
            self._default_timeout_seconds if timeout_seconds is None else timeout_seconds
        )
        token_limit = (
            model_config.default_max_output_tokens
            if max_output_tokens is None
            else max_output_tokens
        )
        if (
            isinstance(token_limit, bool)
            or not isinstance(token_limit, int)
            or not 1 <= token_limit <= 65_536
        ):
            raise InvalidGenerationRequestError()
        if (
            not system_instruction.strip()
            or not isinstance(user_payload, dict)
            or not _is_json_compatible(user_payload)
            or not isinstance(output_schema, dict)
            or not output_schema
            or not _is_json_compatible(output_schema)
        ):
            raise InvalidGenerationRequestError()

        generated: AdapterGenerationResult | None = None
        normalized_error: AIModelRoutingError | None = None
        try:
            generated = adapter.generate_structured(
                api_key=api_key,
                model=model_config.model_id,
                system_instruction=system_instruction,
                user_payload=user_payload,
                output_schema=output_schema,
                timeout_seconds=timeout,
                max_output_tokens=token_limit,
            )
        except AIModelRoutingError as error:
            normalized_error = error
        except TimeoutError:
            normalized_error = ProviderTimeoutError()
        except Exception:
            normalized_error = ProviderRequestError()

        if normalized_error is not None:
            raise normalized_error

        if (
            not isinstance(generated, AdapterGenerationResult)
            or not isinstance(generated.content, dict)
            or not _is_json_compatible(generated.content)
        ):
            raise ProviderRequestError()
        return StructuredGenerationResult(
            content=dict(generated.content),
            provider=model_config.provider,
            model=model_config.model_id,
            usage=generated.usage,
        )

    @staticmethod
    def _validate_timeout(value: float) -> float:
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or not 0 < value <= MAX_AI_ROUTER_TIMEOUT_SECONDS
        ):
            raise InvalidGenerationRequestError()
        return float(value)
