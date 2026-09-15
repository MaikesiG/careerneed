import hashlib
import os
import secrets
from datetime import datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserSession

PASSWORD_HASHER = PasswordHasher()

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "careerneed_session")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").lower()
SESSION_DURATION_DAYS = int(os.getenv("SESSION_DURATION_DAYS", "30"))

if SESSION_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("SESSION_COOKIE_SAMESITE must be lax, strict, or none")

if SESSION_DURATION_DAYS <= 0:
    raise RuntimeError("SESSION_DURATION_DAYS must be greater than zero")

UNAUTHENTICATED_DETAIL = "Not authenticated"


def utcnow() -> datetime:
    return datetime.utcnow()


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        return PASSWORD_HASHER.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: User) -> tuple[UserSession, str]:
    token = generate_session_token()
    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(token),
        expires_at=utcnow() + timedelta(days=SESSION_DURATION_DAYS),
    )
    db.add(session)
    return session, token


def get_user_for_session_token(db: Session, token: str | None) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHENTICATED_DETAIL,
        )

    token_hash = hash_session_token(token)
    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == token_hash)
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHENTICATED_DETAIL,
        )

    if session.expires_at <= utcnow():
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=UNAUTHENTICATED_DETAIL,
        )

    return session.user


def get_optional_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User | None:
    if not session_token:
        return None

    try:
        return get_user_for_session_token(db, session_token)
    except HTTPException:
        return None


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> User:
    return get_user_for_session_token(db, session_token)


def set_session_cookie(response: Response, token: str) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite=SESSION_COOKIE_SAMESITE,
        path="/",
    )
