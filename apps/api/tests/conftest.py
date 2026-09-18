from alembic import command
from alembic.config import Config

from app.database import API_ROOT


def pytest_sessionstart() -> None:
    alembic_config = Config(API_ROOT / "alembic.ini")
    command.upgrade(alembic_config, "head")
