from app.database import SessionLocal
from app.models import Company

COMPANIES = [
    {
        "name": "Mux",
        "source_type": "ashby",
        "board_token": "mux",
        "careers_url": "https://jobs.ashbyhq.com/mux",
        "priority": "high",
    },
    {
        "name": "Supabase",
        "source_type": "ashby",
        "board_token": "supabase",
        "careers_url": "https://jobs.ashbyhq.com/supabase",
        "priority": "high",
    },
    {
        "name": "Coframe",
        "source_type": "ashby",
        "board_token": "Coframe",
        "careers_url": "https://jobs.ashbyhq.com/Coframe",
        "priority": "medium",
    },
    {
        "name": "Sunset",
        "source_type": "ashby",
        "board_token": "sunset",
        "careers_url": "https://jobs.ashbyhq.com/sunset",
        "priority": "high",
    },
    {
        "name": "Office Hours",
        "source_type": "ashby",
        "board_token": "office-hours",
        "careers_url": "https://jobs.ashbyhq.com/office-hours",
        "priority": "high",
    },
    {
        "name": "Arena Intelligence",
        "source_type": "ashby",
        "board_token": "arena",
        "careers_url": "https://jobs.ashbyhq.com/arena",
        "priority": "high",
    },
    {
        "name": "Rifa AI",
        "source_type": "ashby",
        "board_token": "rifa",
        "careers_url": "https://jobs.ashbyhq.com/rifa",
        "priority": "medium",
    },
    {
        "name": "BrainCo",
        "source_type": "ashby",
        "board_token": "brainco",
        "careers_url": "https://jobs.ashbyhq.com/brainco",
        "priority": "high",
    },
]

db = SessionLocal()

try:
    for data in COMPANIES:
        existing = (
            db.query(Company)
            .filter(
                Company.source_type == "ashby",
                Company.board_token == data["board_token"],
            )
            .first()
        )

        if existing is not None:
            print(f"Skipped existing: {data['name']} ({data['board_token']})")
            continue

        db.add(Company(**data))
        print(f"Added: {data['name']} ({data['board_token']})")

    db.commit()
finally:
    db.close()
