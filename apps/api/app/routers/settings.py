import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crypto import decrypt_secret, encrypt_secret, mask_secret
from app.database import get_db
from app.models import LLMCredential
from app.schemas import ExtractionModeOut, LLMCredentialCreate, LLMCredentialOut
from app.services.skill_extractor import get_extraction_mode

router = APIRouter(prefix="/settings", tags=["settings"])


# TODO: replace with real authenticated user once auth is implemented.
INITIAL_USER_ID = uuid.UUID("363a7386-c17c-43ab-ad6c-9a60ff52492a")


@router.get("/llm-credentials", response_model=list[LLMCredentialOut])
def list_llm_credentials(db: Session = Depends(get_db)) -> list[LLMCredentialOut]:
    credentials = db.scalars(select(LLMCredential).where(LLMCredential.user_id == INITIAL_USER_ID))
    return [
        LLMCredentialOut(
            provider=c.provider,
            masked_key=mask_secret(decrypt_secret(c.encrypted_api_key)),
            updated_at=c.updated_at,
        )
        for c in credentials
    ]


@router.post("/llm-credentials", response_model=LLMCredentialOut, status_code=201)
def save_llm_credential(
    payload: LLMCredentialCreate, db: Session = Depends(get_db)
) -> LLMCredentialOut:
    existing = db.scalar(
        select(LLMCredential).where(
            LLMCredential.user_id == INITIAL_USER_ID, LLMCredential.provider == payload.provider
        )
    )
    encrypted = encrypt_secret(payload.api_key)

    if existing is not None:
        existing.encrypted_api_key = encrypted
        db.commit()
        db.refresh(existing)
        credential = existing
    else:
        credential = LLMCredential(
            user_id=INITIAL_USER_ID, provider=payload.provider, encrypted_api_key=encrypted
        )
        db.add(credential)
        db.commit()
        db.refresh(credential)

    return LLMCredentialOut(
        provider=credential.provider,
        masked_key=mask_secret(payload.api_key),
        updated_at=credential.updated_at,
    )


@router.delete("/llm-credentials/{provider}", status_code=204)
def delete_llm_credential(provider: str, db: Session = Depends(get_db)) -> None:
    credential = db.scalar(
        select(LLMCredential).where(
            LLMCredential.user_id == INITIAL_USER_ID, LLMCredential.provider == provider
        )
    )
    if credential is None:
        raise HTTPException(status_code=404, detail="Credential not found")
    db.delete(credential)
    db.commit()


@router.get("/extraction-mode", response_model=ExtractionModeOut)
def get_current_extraction_mode(db: Session = Depends(get_db)) -> ExtractionModeOut:
    mode, remaining = get_extraction_mode(db, INITIAL_USER_ID)
    return ExtractionModeOut(mode=mode, free_calls_remaining=remaining)
