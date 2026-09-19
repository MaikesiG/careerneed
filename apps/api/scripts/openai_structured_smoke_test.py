"""Manual local smoke test only. Never invoke from CI."""

import os
from collections.abc import Callable
from time import monotonic

OPT_IN_ENV_VAR = "CAREERNEED_RUN_OPENAI_SMOKE_TEST"
OPT_IN_INSTRUCTION = "Set CAREERNEED_RUN_OPENAI_SMOKE_TEST=1 to run this manual local smoke test."
UNAVAILABLE_MESSAGE = "No configured OpenAI model is available for the smoke test."
UNEXPECTED_FAILURE_MESSAGE = "OpenAI structured-output smoke test failed unexpectedly."
SYSTEM_INSTRUCTION = "Return one concise structured object for this harmless practice topic."
USER_PAYLOAD = {"topic": "interview practice"}
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"answer": {"type": "string"}},
    "required": ["answer"],
    "additionalProperties": False,
}


def main(*, router_factory: Callable[[], object] | None = None) -> int:
    if os.environ.get(OPT_IN_ENV_VAR) != "1":
        print(OPT_IN_INSTRUCTION)
        return 2

    try:
        return _run_smoke_test(router_factory)
    except Exception:
        print(UNEXPECTED_FAILURE_MESSAGE)
        return 1


def _run_smoke_test(router_factory: Callable[[], object] | None) -> int:
    from app.services.ai.interview_preparation_brief import get_model_router
    from app.services.ai.routing import AIModelRoutingError

    factory = get_model_router if router_factory is None else router_factory
    try:
        router = factory()
        openai_models = tuple(
            model for model in router.available_models() if model.provider == "openai"
        )
        if not openai_models:
            print(UNAVAILABLE_MESSAGE)
            return 1

        selected_model = openai_models[0]
        started_at = monotonic()
        result = router.generate_structured(
            provider="openai",
            model=selected_model.model_id,
            system_instruction=SYSTEM_INSTRUCTION,
            user_payload=USER_PAYLOAD,
            output_schema=OUTPUT_SCHEMA,
            max_output_tokens=100,
        )
        duration_ms = max(0, round((monotonic() - started_at) * 1_000))
        selected_provider = selected_model.provider
        selected_model_id = selected_model.model_id
        answer_present = isinstance(result.content.get("answer"), str)
        usage = result.usage
    except AIModelRoutingError as error:
        print(f"{error.code}: {error.safe_message}")
        return 1

    print("OpenAI structured-output smoke test succeeded.")
    print(f"Provider: {selected_provider}")
    print(f"Model: {selected_model_id}")
    print(f"Required answer string present: {answer_present}")
    if usage is not None:
        if usage.input_tokens is not None:
            print(f"Input tokens: {usage.input_tokens}")
        if usage.output_tokens is not None:
            print(f"Output tokens: {usage.output_tokens}")
        if usage.total_tokens is not None:
            print(f"Total tokens: {usage.total_tokens}")
    print(f"Duration: {duration_ms} ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
