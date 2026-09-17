"""create application contacts

Revision ID: 410b2482f2b7
Revises: 1c112562f46d
Create Date: 2026-09-15 10:33:15.036901

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "410b2482f2b7"
down_revision: Union[str, None] = "1c112562f46d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "application_contacts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("application_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_type", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("linkedin_url", sa.String(length=1000), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_application_contacts_application_id",
        "application_contacts",
        ["application_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_application_contacts_application_id",
        table_name="application_contacts",
    )
    op.drop_table("application_contacts")
