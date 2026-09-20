"""Manual, opt-in Gemini request isolation. No calls occur on import."""

import json
import logging
import os
from copy import deepcopy

from google import genai
from google.genai import types

from app.config import load_ai_model_registry, load_ai_provider_keys, load_ai_router_timeout
from app.services.ai.gemini_adapter import GeminiAdapter, _prepare_response_schema
from scripts import google_structured_smoke_test as smoke

OPT_IN = "CAREERNEED_RUN_GOOGLE_ISOLATION_TEST"
STAGE_ENV = "CAREERNEED_GOOGLE_ISOLATION_STAGE"
STAGES = "ABCDEFGHIJ"
DELTA_STAGES = ("F1", "F2", "F3", "F4", "F5")
STAGE_ORDER = (*"ABCDEF", *DELTA_STAGES, *"GHIJ")
MINIMAL_SCHEMA = {
    "type": "object",
    "properties": {"result": {"type": "string"}},
    "required": ["result"],
    "additionalProperties": False,
}
NESTED_SCHEMA = {
    "type": "object",
    "properties": {
        "observations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "source_refs": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["job_description"]},
                    },
                },
                "required": ["text", "source_refs"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["observations"],
    "additionalProperties": False,
}
SYNTHETIC_PAYLOAD = {"topic": "interview practice", "available_sources": []}


def selected_stages(value: str) -> tuple[str, ...]:
    if value in STAGES and len(value) == 1:
        return (value,)
    if value in DELTA_STAGES:
        return (value,)
    if value.count(":") == 1:
        start, end = value.split(":")
        # Preserve existing A-J ranges; delta ranges must explicitly name a delta.
        order = STAGE_ORDER if start in DELTA_STAGES or end in DELTA_STAGES else tuple(STAGES)
        if start in order and end in order and order.index(start) <= order.index(end):
            return order[order.index(start) : order.index(end) + 1]
    raise ValueError("Invalid isolation stage selection.")


def production_schema() -> dict:
    from app.schemas import _InterviewPreparationBriefGenerated

    return _prepare_response_schema(
        _InterviewPreparationBriefGenerated.model_json_schema(mode="validation")
    )


def schema_nodes(schema: dict, depth: int = 0):
    """Visit schema positions only, never property names or annotation values."""
    yield schema, depth
    for keyword in ("properties", "$defs"):
        for child in schema.get(keyword, {}).values():
            yield from schema_nodes(child, depth + 1)
    if isinstance(schema.get("items"), dict):
        yield from schema_nodes(schema["items"], depth + 1)


def structural_summary(schema: dict) -> dict:
    nodes = list(schema_nodes(schema))
    return {
        "total_nodes": len(nodes),
        "max_depth": max(depth for _, depth in nodes),
        "object_count": sum(node.get("type") == "object" for node, _ in nodes),
        "array_count": sum(node.get("type") == "array" for node, _ in nodes),
        "property_count": sum(len(node.get("properties", {})) for node, _ in nodes),
        "required_count": sum(len(node.get("required", [])) for node, _ in nodes),
        "enum_count": sum("enum" in node for node, _ in nodes),
        "additional_properties_false_count": sum(
            node.get("additionalProperties") is False for node, _ in nodes
        ),
        "keywords": sorted({key for node, _ in nodes for key in node}),
    }


def delta_schema(stage: str) -> dict:
    schema = production_schema()
    # F1 isolates the full production topology with references expanded.
    # F2 restores reference representation; F3/F4/F5 restore one keyword each.
    omitted = {
        "F1": {"title", "minItems", "maxItems"},
        "F2": {"title", "minItems", "maxItems"},
        "F3": {"title", "maxItems"},
        "F4": {"title"},
        "F5": set(),
    }[stage]
    for node, _ in schema_nodes(schema):
        for keyword in omitted:
            node.pop(keyword, None)
    if stage == "F1":
        definitions = schema.pop("$defs", {})

        def expand(node):
            if isinstance(node, list):
                return [expand(item) for item in node]
            if not isinstance(node, dict):
                return node
            if "$ref" in node:
                reference = node["$ref"]
                prefix = "#/$defs/"
                if not reference.startswith(prefix):
                    raise ValueError("Unsupported diagnostic reference.")
                return expand(deepcopy(definitions[reference[len(prefix) :]]))
            return {key: expand(value) for key, value in node.items()}

        schema = expand(schema)
    return schema


def request_for(stage: str, token_limit: int) -> dict[str, object]:
    contents = "Reply exactly with OK"
    config: dict[str, object] = {}
    if stage >= "B":
        config["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(disable=True)
    if stage >= "C":
        config["system_instruction"] = "You are a JSON generation test."
    if stage >= "D":
        contents = "Return a JSON object with a result string containing OK."
        config["response_mime_type"] = "application/json"
    if stage >= "E":
        config["response_json_schema"] = MINIMAL_SCHEMA
    if stage >= "F":
        config["response_json_schema"] = NESTED_SCHEMA
        contents = json.dumps(
            SYNTHETIC_PAYLOAD, ensure_ascii=False, separators=(",", ":"), sort_keys=True
        )
    if stage >= "G":
        from app.schemas import _InterviewPreparationBriefGenerated

        config["response_json_schema"] = _prepare_response_schema(
            _InterviewPreparationBriefGenerated.model_json_schema(mode="validation")
        )
    if stage in DELTA_STAGES:
        config["response_json_schema"] = delta_schema(stage)
    if stage >= "H":
        from app.services.ai.interview_preparation_brief import INTERVIEW_PREPARATION_BRIEF_PROMPT

        config["system_instruction"] = INTERVIEW_PREPARATION_BRIEF_PROMPT
    if stage >= "I":
        config["max_output_tokens"] = token_limit
    request: dict[str, object] = {"contents": contents}
    if config:
        request["config"] = types.GenerateContentConfig(**config)
    return request


def _failure(stage: str, error: Exception) -> None:
    # Never stringify the exception or traverse response/body/header attributes.
    module = type(error).__module__
    name = type(error).__name__
    from app.services.ai.gemini_adapter import GeminiUnhandledProviderError

    if isinstance(error, GeminiUnhandledProviderError):
        module, name = error.exception_module, error.exception_name
    parts = [
        f"stage={stage}",
        "result=failure",
        f"exception_module={module}",
        f"exception_type={name}",
    ]
    for attribute in ("http_status", "code", "status_code"):
        value = getattr(error, attribute, None)
        if type(value) is int and 100 <= value <= 599:
            parts.append(f"http_status={value}")
            break
    print(" ".join(parts))


def main() -> int:
    if os.environ.get(OPT_IN) != "1":
        print("Set CAREERNEED_RUN_GOOGLE_ISOLATION_TEST=1 to run isolation.")
        return 2
    stage = "setup"
    previous_logging = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        stages = selected_stages(os.environ.get(STAGE_ENV, "A"))
        key = load_ai_provider_keys()["google"]
        models = [
            m for m in load_ai_model_registry().models() if m.provider == "google" and m.enabled
        ]
        model = models[0].model_id if models else "gemini-3.8-flash"
        tokens = models[0].default_max_output_tokens if models else 1024
        timeout = load_ai_router_timeout()
        if not key or not key.isascii() or not model.isascii():
            raise ValueError("Invalid isolation configuration.")
        for stage in stages:
            if stage == "J":
                # Exact smoke adapter construction, including its 100-token override.
                result = GeminiAdapter().generate_structured(
                    api_key=key,
                    model=model,
                    system_instruction=smoke.SYSTEM_INSTRUCTION,
                    user_payload=smoke.USER_PAYLOAD,
                    output_schema=smoke.OUTPUT_SCHEMA,
                    timeout_seconds=timeout,
                    max_output_tokens=100,
                )
                has_text = bool(result.content)
            else:
                with genai.Client(
                    api_key=key,
                    http_options=types.HttpOptions(
                        timeout=round(timeout * 1000),
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                ) as client:
                    response = client.models.generate_content(
                        model=model, **request_for(stage, tokens)
                    )
                    has_text = isinstance(response.text, str) and bool(response.text)
            print(f"stage={stage} result=success has_text={str(has_text).lower()}")
        return 0
    except Exception as error:
        _failure(stage, error)
        return 1
    finally:
        logging.disable(previous_logging)


if __name__ == "__main__":
    raise SystemExit(main())
