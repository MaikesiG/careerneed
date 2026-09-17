import logging
import os
from urllib.parse import quote

logger = logging.getLogger(__name__)

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "console").lower()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def build_password_reset_url(raw_token: str) -> str:
    return f"{FRONTEND_URL}/reset-password?token={quote(raw_token, safe='')}"


def send_password_reset_email(*, recipient: str, raw_token: str) -> None:
    reset_url = build_password_reset_url(raw_token)

    # if EMAIL_BACKEND == "console":
    #     logger.warning(
    #         "Password reset link for %s: %s",
    #         recipient,
    #         reset_url,
    #     )
    #     return

    if EMAIL_BACKEND == "console":
        print(
            f"\nPassword reset link for {recipient}:\n" f"{reset_url}\n",
            flush=True,
        )
        return

    raise RuntimeError("Unsupported EMAIL_BACKEND. Use 'console' for local development.")
