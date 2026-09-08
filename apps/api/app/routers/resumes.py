import uuid

import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Resume
from app.schemas import ResumeDetail, ResumeOut, ResumeUpdate
from app.services.skill_extractor import extract_skills

router = APIRouter(prefix="/resumes", tags=["resumes"])


# TODO: replace with real authenticated user once auth is implemented.
INITIAL_USER_ID = uuid.UUID("363a7386-c17c-43ab-ad6c-9a60ff52492a")


MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _extract_text(file_bytes: bytes) -> str:
    import io

    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts).strip()


@router.get("", response_model=list[ResumeOut])
def list_resumes(include_archived: bool = False, db: Session = Depends(get_db)) -> list[Resume]:
    stmt = (
        select(Resume).where(Resume.user_id == INITIAL_USER_ID).order_by(Resume.uploaded_at.desc())
    )
    if not include_archived:
        stmt = stmt.where(Resume.archived_at.is_(None))
    return list(db.scalars(stmt))


@router.get("/{resume_id}", response_model=ResumeDetail)
def get_resume(resume_id: uuid.UUID, db: Session = Depends(get_db)) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None or resume.user_id != INITIAL_USER_ID:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.post("/upload", response_model=ResumeOut, status_code=201)
async def upload_resume(
    file: UploadFile,
    label: str | None = None,
    is_default: bool = False,
    db: Session = Depends(get_db),
) -> Resume:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=422, detail="Only PDF files are supported")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="File exceeds 10MB limit")

    raw_text = _extract_text(file_bytes)
    if not raw_text:
        raise HTTPException(status_code=422, detail="Could not extract any text from this PDF")

    if is_default:
        db.query(Resume).filter(
            Resume.user_id == INITIAL_USER_ID, Resume.is_default.is_(True)
        ).update({"is_default": False})

    resume = Resume(
        user_id=INITIAL_USER_ID,
        filename=file.filename or "resume.pdf",
        raw_text=raw_text,
        skills=extract_skills(db, INITIAL_USER_ID, raw_text),
        label=label,
        is_default=is_default,
        source="upload",
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.patch("/{resume_id}", response_model=ResumeOut)
def update_resume(
    resume_id: uuid.UUID, payload: ResumeUpdate, db: Session = Depends(get_db)
) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None or resume.user_id != INITIAL_USER_ID:
        raise HTTPException(status_code=404, detail="Resume not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("is_default") is True:
        db.query(Resume).filter(
            Resume.user_id == INITIAL_USER_ID,
            Resume.is_default.is_(True),
            Resume.id != resume_id,
        ).update({"is_default": False})

    for field, value in update_data.items():
        setattr(resume, field, value)

    db.commit()
    db.refresh(resume)
    return resume
