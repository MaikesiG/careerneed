from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    applications,
    auth,
    companies,
    contacts,
    connectors,
    dashboard,
    follow_ups,
    interviews,
    jobs,
    resumes,
    settings,
    system,
)

load_dotenv()
app = FastAPI(title="Careerneed API", version="0.2.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(dashboard.router)
app.include_router(follow_ups.router)
app.include_router(companies.router)
app.include_router(contacts.router)
app.include_router(connectors.router)
app.include_router(interviews.router)
app.include_router(jobs.router)
app.include_router(resumes.router)
app.include_router(settings.router)
app.include_router(system.router)
