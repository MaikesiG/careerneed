from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.crypto import decrypt_secret, encrypt_secret, mask_secret
from app.database import get_db
from app.models import LLMCredential, User
from app.schemas import ExtractionModeOut, LLMCredentialCreate, LLMCredentialOut
from app.services.skill_extractor import get_extraction_mode

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/llm-credentials", response_model=list[LLMCredentialOut])
def list_llm_credentials(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LLMCredentialOut]:
    credentials = db.scalars(
        select(LLMCredential).where(LLMCredential.user_id == current_user.id)
    )
    return [
        LLMCredentialOut(
            provider=credential.provider,
            masked_key=mask_secret(decrypt_secret(credential.encrypted_api_key)),
            updated_at=credential.updated_at,
        )
        for credential in credentials
    ]


@router.post("/llm-credentials", response_model=LLMCredentialOut, status_code=201)
def save_llm_credential(
    payload: LLMCredentialCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LLMCredentialOut:
    existing = db.scalar(
        select(LLMCredential).where(
            LLMCredential.user_id == current_user.id,
            LLMCredential.provider == payload.provider,
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
            user_id=current_user.id,
            provider=payload.provider,
            encrypted_api_key=encrypted,
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
def delete_llm_credential(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    credential = db.scalar(
        select(LLMCredential).where(
            LLMCredential.user_id == current_user.id,
            LLMCredential.provider == provider,
        )
    )
    if credential is None:
        raise HTTPException(status_code=404, detail="Credential not found")

    db.delete(credential)
    db.commit()


@router.get("/extraction-mode", response_model=ExtractionModeOut)
def get_current_extraction_mode(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExtractionModeOut:
    mode, remaining = get_extraction_mode(db, current_user.id)
    return ExtractionModeOut(mode=mode, free_calls_remaining=remaining)
