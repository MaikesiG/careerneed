from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    create_session,
    get_user_for_session_token,
    hash_password,
    hash_session_token,
    set_session_cookie,
    utcnow,
    verify_password,
)
from app.database import get_db
from app.models import User, UserSession
from app.schemas import AuthCredentials, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS_DETAIL = "Invalid email or password"
EMAIL_ALREADY_REGISTERED_DETAIL = "Email already registered"


def normalized_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter a valid email address",
        )
    return normalized


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    credentials: AuthCredentials,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    email = normalized_email(credentials.email)

    if len(credentials.password) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 12 characters long",
        )

    user = User(
        email=email,
        password_hash=hash_password(credentials.password),
        password_set_at=utcnow(),
    )
    db.add(user)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=EMAIL_ALREADY_REGISTERED_DETAIL,
        ) from None

    _, token = create_session(db, user)
    db.commit()
    db.refresh(user)
    set_session_cookie(response, token)
    return user


@router.post("/login", response_model=UserOut)
def login(
    credentials: AuthCredentials,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    email = normalized_email(credentials.email)
    user = db.scalar(select(User).where(User.email == email))

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_DETAIL,
        )

    _, token = create_session(db, user)
    db.commit()
    db.refresh(user)
    set_session_cookie(response, token)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> None:
    if session_token:
        session = db.scalar(
            select(UserSession).where(
                UserSession.token_hash == hash_session_token(session_token)
            )
        )
        if session is not None:
            db.delete(session)
            db.commit()

    clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
def me(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    return get_user_for_session_token(db, session_token)
