"""add unique company source token

Revision ID: 8a1bb80dbe12
Revises: d0065c2f9c04
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op


revision: str = "8a1bb80dbe12"
down_revision: str | Sequence[str] | None = "d0065c2f9c04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_companies_source_type_board_token",
        "companies",
        ["source_type", "board_token"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_companies_source_type_board_token",
        "companies",
        type_="unique",
    )
