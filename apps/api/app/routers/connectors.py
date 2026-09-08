from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.greenhouse import sync_all_greenhouse_companies, sync_greenhouse_jobs
from app.connectors.lever import sync_all_lever_companies, sync_lever_jobs
from app.database import get_db

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.post("/greenhouse/sync")
def sync_greenhouse(board_token: str, company_name: str, db: Session = Depends(get_db)):
    try:
        return sync_greenhouse_jobs(db, board_token, company_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/greenhouse/sync-all")
def sync_all_greenhouse(db: Session = Depends(get_db)):
    results = sync_all_greenhouse_companies(db)
    return {"companies_synced": len(results), "results": results}


@router.post("/lever/sync")
def sync_lever(company_slug: str, company_name: str, db: Session = Depends(get_db)):
    try:
        return sync_lever_jobs(db, company_slug, company_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/lever/sync-all")
def sync_all_lever(db: Session = Depends(get_db)):
    results = sync_all_lever_companies(db)
    return {"companies_synced": len(results), "results": results}
