import json
import math
from dataclasses import dataclass, field
from datetime import datetime

import pytest

from app.config import (
    AIConfigurationError,
    AIModelConfig,
    AIModelRegistry,
    AIProviderId,
    load_ai_model_registry,
    load_ai_provider_keys,
    load_ai_router_timeout,
)
from app.services.ai import (
    AdapterGenerationResult,
    AIModelRoutingError,
    InvalidGenerationRequestError,
    ModelRouter,
    ProviderCapabilities,
    SafeUsageMetadata,
    UnsupportedCapabilityError,
)
from app.services.ai.routing import ProviderAuthenticationError, ProviderRequestError


def model_config(
    *,
    provider: AIProviderId = "openai",
    model_id: str = "test-model",
    enabled: bool = True,
    supports_structured_output: bool = True,
) -> AIModelConfig:
    return AIModelConfig(
        provider=provider,
        model_id=model_id,
        display_name=f"{provider} test model",
        enabled=enabled,
        supports_structured_output=supports_structured_output,
        default_max_output_tokens=2048,
    )


@dataclass
class FakeAdapter:
    provider: AIProviderId
    capabilities: ProviderCapabilities = field(
        default_factory=lambda: ProviderCapabilities(supports_structured_output=True)
    )
    result: AdapterGenerationResult = field(
        default_factory=lambda: AdapterGenerationResult(
            content={"answer": "structured"},
            usage=SafeUsageMetadata(input_tokens=4, output_tokens=2, total_tokens=6),
        )
    )
    failure: Exception | None = None
    received: dict[str, object] | None = None

    def generate_structured(self, **kwargs: object) -> AdapterGenerationResult:
        self.received = kwargs
        if self.failure is not None:
            raise self.failure
        return self.result


def make_router(
    models: list[AIModelConfig],
    adapters: dict[AIProviderId, FakeAdapter],
    keys: dict[AIProviderId, str | None],
) -> ModelRouter:
    return ModelRouter(
        registry=AIModelRegistry(models),
        adapters=adapters,
        provider_keys=keys,
        default_timeout_seconds=15,
    )


def generate(router: ModelRouter, provider: str = "openai", model: str = "test-model"):
    return router.generate_structured(
        provider=provider,
        model=model,
        system_instruction="Return the requested object.",
        user_payload={"context": "safe"},
        output_schema={"type": "object"},
    )


def test_registry_loads_supported_providers_and_rejects_invalid_entries() -> None:
    entries = [
        {
            "provider": provider,
            "model_id": f"{provider}-model",
            "display_name": f"{provider.title()} model",
            "enabled": True,
            "supports_structured_output": True,
            "default_max_output_tokens": 1024,
        }
        for provider in ("openai", "anthropic", "google", "deepseek", "xai", "moonshot")
    ]
    registry = load_ai_model_registry({"AI_MODEL_REGISTRY_JSON": json.dumps(entries)})
    assert [model.provider for model in registry.models()] == [
        "openai",
        "anthropic",
        "google",
        "deepseek",
        "xai",
        "moonshot",
    ]
    assert registry.get("openai", "openai-model") is not None
    assert registry.get("unknown", "openai-model") is None
    assert registry.get("openai", "missing-model") is None

    invalid = [{**entries[0], "provider": "unknown"}]
    with pytest.raises(AIConfigurationError, match="configuration is invalid"):
        load_ai_model_registry({"AI_MODEL_REGISTRY_JSON": json.dumps(invalid)})


def test_optional_environment_and_timeout_configuration_are_safe() -> None:
    assert load_ai_model_registry({}).models() == ()
    assert all(value is None for value in load_ai_provider_keys({}).values())
    assert load_ai_router_timeout({}) == 30
    assert load_ai_router_timeout({"AI_ROUTER_TIMEOUT_SECONDS": "12.5"}) == 12.5
    with pytest.raises(AIConfigurationError):
        load_ai_router_timeout({"AI_ROUTER_TIMEOUT_SECONDS": "infinite"})


def test_disabled_missing_key_and_unknown_models_are_unavailable() -> None:
    enabled = model_config()
    disabled = model_config(model_id="disabled", enabled=False)
    adapter = FakeAdapter(provider="openai")
    router = make_router(
        [enabled, disabled],
        {"openai": adapter},
        {"openai": None},
    )
    assert router.available_models() == ()

    for provider, model in (
        ("openai", "test-model"),
        ("openai", "disabled"),
        ("unknown", "test-model"),
        ("openai", "missing"),
    ):
        with pytest.raises(AIModelRoutingError):
            generate(router, provider, model)


def test_router_dispatches_to_matching_adapter_with_bounded_inputs() -> None:
    adapter = FakeAdapter(provider="anthropic")
    configured = model_config(provider="anthropic", model_id="claude-test")
    router = make_router(
        [configured],
        {"anthropic": adapter},
        {"anthropic": "server-secret"},
    )

    result = generate(router, "anthropic", "claude-test")

    assert result.content == {"answer": "structured"}
    assert result.provider == "anthropic"
    assert result.model == "claude-test"
    assert result.usage == SafeUsageMetadata(input_tokens=4, output_tokens=2, total_tokens=6)
    assert adapter.received is not None
    assert adapter.received["api_key"] == "server-secret"
    assert adapter.received["timeout_seconds"] == 15
    assert adapter.received["max_output_tokens"] == 2048
    available = router.available_models()
    assert available == (configured,)
    assert "server-secret" not in repr(router)
    assert "server-secret" not in repr(available)


@pytest.mark.parametrize(
    "adapters",
    [
        {"unknown": FakeAdapter(provider="openai")},
        {"openai": FakeAdapter(provider="anthropic")},
        {"openai": object()},
        {
            "openai": type(
                "InvalidCapabilitiesAdapter",
                (),
                {
                    "provider": "openai",
                    "capabilities": {"supports_structured_output": True},
                    "generate_structured": lambda: None,
                },
            )()
        },
        {
            "openai": type(
                "NonCallableAdapter",
                (),
                {
                    "provider": "openai",
                    "capabilities": ProviderCapabilities(supports_structured_output=True),
                    "generate_structured": None,
                },
            )()
        },
    ],
)
def test_malformed_adapter_registration_is_rejected(
    adapters: dict[object, object],
) -> None:
    with pytest.raises(ValueError, match="AI adapter registration is invalid"):
        ModelRouter(
            registry=AIModelRegistry([model_config()]),
            adapters=adapters,
            provider_keys={"openai": "secret"},
            default_timeout_seconds=15,
        )


def test_structured_output_capability_is_enforced_for_model_and_adapter() -> None:
    unsupported_model = model_config(supports_structured_output=False)
    supported_adapter = FakeAdapter(provider="openai")
    model_router = make_router(
        [unsupported_model],
        {"openai": supported_adapter},
        {"openai": "secret"},
    )
    with pytest.raises(UnsupportedCapabilityError):
        generate(model_router)
    assert supported_adapter.received is None

    unsupported_adapter = FakeAdapter(
        provider="openai",
        capabilities=ProviderCapabilities(supports_structured_output=False),
    )
    adapter_router = make_router(
        [model_config()],
        {"openai": unsupported_adapter},
        {"openai": "secret"},
    )
    with pytest.raises(UnsupportedCapabilityError):
        generate(adapter_router)
    assert unsupported_adapter.received is None


@pytest.mark.parametrize(
    ("overrides"),
    [
        {"timeout_seconds": float("inf")},
        {"timeout_seconds": 0},
        {"max_output_tokens": 0},
        {"max_output_tokens": 1.5},
        {"max_output_tokens": 65_537},
    ],
)
def test_invalid_request_limits_are_rejected_before_dispatch(
    overrides: dict[str, float | int],
) -> None:
    adapter = FakeAdapter(provider="openai")
    router = make_router(
        [model_config()],
        {"openai": adapter},
        {"openai": "secret"},
    )

    with pytest.raises(InvalidGenerationRequestError):
        router.generate_structured(
            provider="openai",
            model="test-model",
            system_instruction="Return the requested object.",
            user_payload={"context": "safe"},
            output_schema={"type": "object"},
            **overrides,
        )

    assert adapter.received is None


@pytest.mark.parametrize(
    "invalid_payload",
    [
        {"value": b"not-json"},
        {"value": datetime(2026, 1, 1)},
        {"value": object()},
        {1: "non-string key"},
        {"value": math.nan},
        {"value": math.inf},
        {"nested": ["valid", {"invalid": b"bytes"}]},
    ],
)
def test_invalid_user_payload_is_rejected_without_dispatch(
    invalid_payload: dict[object, object],
) -> None:
    secret = "secret-payload-content"
    adapter = FakeAdapter(provider="openai")
    router = make_router(
        [model_config()],
        {"openai": adapter},
        {"openai": secret},
    )

    with pytest.raises(InvalidGenerationRequestError) as captured:
        router.generate_structured(
            provider="openai",
            model="test-model",
            system_instruction="Return the requested object.",
            user_payload=invalid_payload,
            output_schema={"type": "object"},
        )

    assert adapter.received is None
    assert secret not in str(captured.value)
    assert "not-json" not in str(captured.value)


@pytest.mark.parametrize(
    "invalid_schema",
    [
        {},
        {"type": "object", "invalid": b"internal-schema-content"},
        {"type": "object", "maximum": math.inf},
        {1: "non-string key"},
    ],
)
def test_invalid_output_schema_is_rejected_without_dispatch(
    invalid_schema: dict[object, object],
) -> None:
    adapter = FakeAdapter(provider="openai")
    router = make_router(
        [model_config()],
        {"openai": adapter},
        {"openai": "secret"},
    )

    with pytest.raises(InvalidGenerationRequestError) as captured:
        router.generate_structured(
            provider="openai",
            model="test-model",
            system_instruction="Return the requested object.",
            user_payload={"context": "safe"},
            output_schema=invalid_schema,
        )

    assert adapter.received is None
    assert "internal-schema-content" not in str(captured.value)


@pytest.mark.parametrize(
    "invalid_content",
    [
        {"value": b"raw-provider-secret"},
        {"value": math.nan},
        {1: "non-string key"},
    ],
)
def test_invalid_adapter_result_content_is_safely_normalized(
    invalid_content: dict[object, object],
) -> None:
    adapter = FakeAdapter(
        provider="openai",
        result=AdapterGenerationResult(content=invalid_content),
    )
    router = make_router(
        [model_config()],
        {"openai": adapter},
        {"openai": "server-secret"},
    )

    with pytest.raises(ProviderRequestError) as captured:
        generate(router)

    assert captured.value.code == "provider_request_failed"
    assert "raw-provider-secret" not in str(captured.value)
    assert "server-secret" not in str(captured.value)


@pytest.mark.parametrize(
    ("failure", "expected_code"),
    [
        (TimeoutError("provider timeout with sk-secret"), "provider_timeout"),
        (ProviderAuthenticationError(), "provider_authentication_failed"),
        (RuntimeError("raw provider body with sk-secret"), "provider_request_failed"),
    ],
)
def test_provider_failures_are_normalized_without_secret_text(
    failure: Exception,
    expected_code: str,
) -> None:
    secret = "sk-server-secret-value"
    adapter = FakeAdapter(provider="openai", failure=failure)
    router = make_router(
        [model_config()],
        {"openai": adapter},
        {"openai": secret},
    )

    with pytest.raises(AIModelRoutingError) as captured:
        generate(router)

    assert captured.value.code == expected_code
    assert secret not in str(captured.value)
    assert "raw provider body" not in str(captured.value)
    assert captured.value.__context__ is None
    assert secret not in repr(router)
