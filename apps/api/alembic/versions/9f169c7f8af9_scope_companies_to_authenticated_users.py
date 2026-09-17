"""scope companies to authenticated users

Revision ID: 9f169c7f8af9
Revises: 5a4c68abfd13
Create Date: 2026-09-16 23:28:45.093850

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "9f169c7f8af9"
down_revision: Union[str, None] = "5a4c68abfd13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
    )

    op.drop_constraint(
        "uq_companies_source_type_board_token",
        "companies",
        type_="unique",
    )

    op.create_index(
        "ix_companies_user_id",
        "companies",
        ["user_id"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_companies_user_source_type_board_token",
        "companies",
        ["user_id", "source_type", "board_token"],
    )

    op.create_foreign_key(
        "fk_companies_user_id_users",
        "companies",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_companies_user_id_users",
        "companies",
        type_="foreignkey",
    )

    op.drop_constraint(
        "uq_companies_user_source_type_board_token",
        "companies",
        type_="unique",
    )

    op.drop_index(
        "ix_companies_user_id",
        table_name="companies",
    )

    op.create_unique_constraint(
        "uq_companies_source_type_board_token",
        "companies",
        ["source_type", "board_token"],
    )

    op.drop_column("companies", "user_id")
