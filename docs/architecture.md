# Careerneed Architecture — v0.1

```text
Next.js dashboard  ->  FastAPI API  ->  PostgreSQL
                          ^
                  Python ingestion worker
                          ^
           Public Greenhouse / Lever job sources
```

## Design decisions

- Use a modular connector interface for each job source.
- Normalize source payloads before persistence.
- Make ingestion idempotent using source and external job ID.
- Keep job collection deterministic; add AI only after verified source data and user evidence exist.
- Do not automate application submission.
