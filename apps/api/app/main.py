from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Careerneed API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "careerneed-api"}

@app.get("/jobs", tags=["jobs"])
def list_jobs() -> list[dict[str, str]]:
    return []
