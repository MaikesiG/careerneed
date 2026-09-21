# Manual OpenAI smoke test

This command is for manual, local development only. Never invoke it from CI. It can make exactly
one paid OpenAI API request, so add a small credit and a spend alert before using it. Ensure that one
enabled OpenAI model is configured locally through the normal server configuration. When multiple
OpenAI models are available, this smoke test selects the first one in server configuration order.

Never paste or print an API key, and never commit `.env.local`. From `apps/api`, explicitly opt in:

```bash
CAREERNEED_RUN_OPENAI_SMOKE_TEST=1 python -m scripts.openai_structured_smoke_test
```

The command prints only a success line, provider and model IDs, whether the required answer string
was present, optional token counts, and duration. It does not print prompts, payloads, generated
content, credentials, headers, registry configuration, or raw errors. The process exits after its
single request; do not rerun it after a successful smoke test.
