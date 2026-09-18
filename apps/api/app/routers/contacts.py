import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Company, Contact, User
from app.schemas import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _get_owned_contact(contact_id: uuid.UUID, current_user: User, db: Session) -> Contact:
    contact = db.scalar(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.user_id == current_user.id,
        )
    )
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


def _validate_owned_company(
    company_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> None:
    company = db.scalar(
        select(Company).where(
            Company.id == company_id,
            Company.user_id == current_user.id,
        )
    )
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")


@router.get("", response_model=list[ContactOut])
def list_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Contact]:
    return list(
        db.scalars(
            select(Contact)
            .where(Contact.user_id == current_user.id)
            .order_by(Contact.name.asc(), Contact.created_at.asc(), Contact.id.asc())
        )
    )


@router.post("", response_model=ContactOut, status_code=201)
def create_contact(
    payload: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Contact:
    if payload.company_id is not None:
        _validate_owned_company(payload.company_id, current_user, db)
    contact = Contact(user_id=current_user.id, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Contact:
    return _get_owned_contact(contact_id, current_user, db)


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Contact:
    contact = _get_owned_contact(contact_id, current_user, db)
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("company_id") is not None:
        _validate_owned_company(update_data["company_id"], current_user, db)
    for field, value in update_data.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    contact = _get_owned_contact(contact_id, current_user, db)
    db.delete(contact)
    db.commit()
    return Response(status_code=204)
