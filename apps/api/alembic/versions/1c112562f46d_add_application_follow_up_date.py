"""add application follow up date

Revision ID: 1c112562f46d
Revises: a1f41b7e0d8c
Create Date: 2026-09-13 14:48:04.163103
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "1c112562f46d"
down_revision: Union[str, None] = "a1f41b7e0d8c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "applications",
        sa.Column("follow_up_on", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("applications", "follow_up_on")
