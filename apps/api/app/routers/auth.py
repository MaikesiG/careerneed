from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import logging

from app.auth import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    create_password_reset_token,
    create_session,
    get_user_for_session_token,
    hash_password,
    hash_password_reset_token,
    hash_session_token,
    set_session_cookie,
    utcnow,
    verify_password,
)

from app.database import get_db
from app.email import send_password_reset_email
from app.models import PasswordResetToken, User, UserSession
from app.schemas import (
    AuthCredentials,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

INVALID_CREDENTIALS_DETAIL = "Invalid email or password"
EMAIL_ALREADY_REGISTERED_DETAIL = "Email already registered"
PASSWORD_RESET_REQUEST_DETAIL = (
    "If an account exists for that email, password-reset instructions have been sent."
)
INVALID_RESET_TOKEN_DETAIL = "This password reset link is invalid or has expired."
PASSWORD_RESET_SUCCESS_DETAIL = "Password reset successfully. Please log in again."


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


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    email = normalized_email(payload.email)
    user = db.scalar(select(User).where(User.email == email))

    if user is not None:
        now = utcnow()

        db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=now)
        )

        _, raw_token = create_password_reset_token(db, user)
        db.commit()

        try:
            send_password_reset_email(
                recipient=user.email,
                raw_token=raw_token,
            )
        except Exception:
            logger.exception(
                "Failed to send password-reset email",
                extra={"recipient": user.email},
            )

    return {"detail": PASSWORD_RESET_REQUEST_DETAIL}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    raw_token = payload.token.strip()

    if (
        not raw_token
        or payload.new_password != payload.confirm_password
        or len(payload.new_password) < 12
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enter matching passwords of at least 12 characters",
        )

    reset_token = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_password_reset_token(raw_token),
            PasswordResetToken.used_at.is_(None),
        )
    )

    if reset_token is None or reset_token.expires_at <= utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_RESET_TOKEN_DETAIL,
        )

    now = utcnow()
    user = reset_token.user

    user.password_hash = hash_password(payload.new_password)
    user.password_set_at = now
    reset_token.used_at = now

    # Invalidate every other outstanding reset link for this user.
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    # Force every existing device/session to log in with the new password.
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))

    db.commit()

    return {"detail": PASSWORD_RESET_SUCCESS_DETAIL}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> None:
    if session_token:
        session = db.scalar(
            select(UserSession).where(UserSession.token_hash == hash_session_token(session_token))
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
