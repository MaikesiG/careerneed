import json
import math
import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal, TypeAlias, cast

AIProviderId: TypeAlias = Literal[
    "openai",
    "anthropic",
    "google",
    "deepseek",
    "xai",
    "moonshot",
]

AI_PROVIDER_IDS: tuple[AIProviderId, ...] = (
    "openai",
    "anthropic",
    "google",
    "deepseek",
    "xai",
    "moonshot",
)

AI_PROVIDER_KEY_ENV_VARS: Mapping[AIProviderId, str] = {
    "openai": "PLATFORM_OPENAI_API_KEY",
    "anthropic": "PLATFORM_ANTHROPIC_API_KEY",
    "google": "PLATFORM_GOOGLE_API_KEY",
    "deepseek": "PLATFORM_DEEPSEEK_API_KEY",
    "xai": "PLATFORM_XAI_API_KEY",
    "moonshot": "PLATFORM_MOONSHOT_API_KEY",
}

AI_MODEL_REGISTRY_ENV_VAR = "AI_MODEL_REGISTRY_JSON"
AI_ROUTER_TIMEOUT_ENV_VAR = "AI_ROUTER_TIMEOUT_SECONDS"
DEFAULT_AI_ROUTER_TIMEOUT_SECONDS = 30.0
MAX_AI_ROUTER_TIMEOUT_SECONDS = 120.0


class AIConfigurationError(ValueError):
    """Safe configuration failure without echoing environment contents."""

    def __init__(self) -> None:
        super().__init__("AI model routing configuration is invalid.")


@dataclass(frozen=True, slots=True)
class AIModelConfig:
    provider: AIProviderId
    model_id: str
    display_name: str
    enabled: bool
    supports_structured_output: bool
    default_max_output_tokens: int

    def __post_init__(self) -> None:
        if not isinstance(self.provider, str) or self.provider not in AI_PROVIDER_IDS:
            raise AIConfigurationError()
        if not isinstance(self.model_id, str) or not isinstance(self.display_name, str):
            raise AIConfigurationError()
        if not isinstance(self.enabled, bool) or not isinstance(
            self.supports_structured_output, bool
        ):
            raise AIConfigurationError()
        if not self.model_id.strip() or not self.display_name.strip():
            raise AIConfigurationError()
        if self.model_id != self.model_id.strip() or self.display_name != self.display_name.strip():
            raise AIConfigurationError()
        if isinstance(self.default_max_output_tokens, bool) or not isinstance(
            self.default_max_output_tokens, int
        ):
            raise AIConfigurationError()
        if not 1 <= self.default_max_output_tokens <= 65_536:
            raise AIConfigurationError()


class AIModelRegistry:
    def __init__(self, models: Sequence[AIModelConfig]) -> None:
        entries: dict[tuple[AIProviderId, str], AIModelConfig] = {}
        for model in models:
            key = (model.provider, model.model_id)
            if key in entries:
                raise AIConfigurationError()
            entries[key] = model
        self._entries = entries

    def get(self, provider: str, model_id: str) -> AIModelConfig | None:
        if provider not in AI_PROVIDER_IDS:
            return None
        return self._entries.get((cast(AIProviderId, provider), model_id))

    def models(self) -> tuple[AIModelConfig, ...]:
        return tuple(self._entries.values())


def _parse_model_config(value: object) -> AIModelConfig:
    if not isinstance(value, dict):
        raise AIConfigurationError()
    expected_fields = {
        "provider",
        "model_id",
        "display_name",
        "enabled",
        "supports_structured_output",
        "default_max_output_tokens",
    }
    if set(value) != expected_fields:
        raise AIConfigurationError()

    provider = value["provider"]
    model_id = value["model_id"]
    display_name = value["display_name"]
    enabled = value["enabled"]
    supports_structured_output = value["supports_structured_output"]
    default_max_output_tokens = value["default_max_output_tokens"]
    if (
        not isinstance(provider, str)
        or provider not in AI_PROVIDER_IDS
        or not isinstance(model_id, str)
        or not isinstance(display_name, str)
        or not isinstance(enabled, bool)
        or not isinstance(supports_structured_output, bool)
        or not isinstance(default_max_output_tokens, int)
        or isinstance(default_max_output_tokens, bool)
    ):
        raise AIConfigurationError()

    return AIModelConfig(
        provider=cast(AIProviderId, provider),
        model_id=model_id,
        display_name=display_name,
        enabled=enabled,
        supports_structured_output=supports_structured_output,
        default_max_output_tokens=default_max_output_tokens,
    )


def load_ai_model_registry(
    environ: Mapping[str, str] | None = None,
) -> AIModelRegistry:
    source = os.environ if environ is None else environ
    raw_registry = source.get(AI_MODEL_REGISTRY_ENV_VAR, "").strip()
    if not raw_registry:
        return AIModelRegistry(())
    try:
        parsed = json.loads(raw_registry)
    except (TypeError, json.JSONDecodeError) as error:
        raise AIConfigurationError() from error
    if not isinstance(parsed, list):
        raise AIConfigurationError()
    return AIModelRegistry([_parse_model_config(item) for item in parsed])


def load_ai_provider_keys(
    environ: Mapping[str, str] | None = None,
) -> dict[AIProviderId, str | None]:
    source = os.environ if environ is None else environ
    return {
        provider: (source.get(environment_name) or "").strip() or None
        for provider, environment_name in AI_PROVIDER_KEY_ENV_VARS.items()
    }


def load_ai_router_timeout(environ: Mapping[str, str] | None = None) -> float:
    source = os.environ if environ is None else environ
    raw_timeout = source.get(AI_ROUTER_TIMEOUT_ENV_VAR, "").strip()
    if not raw_timeout:
        return DEFAULT_AI_ROUTER_TIMEOUT_SECONDS
    try:
        timeout = float(raw_timeout)
    except ValueError as error:
        raise AIConfigurationError() from error
    if not math.isfinite(timeout) or not 0 < timeout <= MAX_AI_ROUTER_TIMEOUT_SECONDS:
        raise AIConfigurationError()
    return timeout
