"""link application contacts to contacts

Revision ID: d53f2c9e8a14
Revises: c42e1b8d7f03
Create Date: 2026-09-18

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d53f2c9e8a14"
down_revision: Union[str, None] = "c42e1b8d7f03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "application_contacts",
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_application_contacts_contact_id_contacts",
        "application_contacts",
        "contacts",
        ["contact_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_application_contacts_contact_id"),
        "application_contacts",
        ["contact_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_application_contacts_contact_id"),
        table_name="application_contacts",
    )
    op.drop_constraint(
        "fk_application_contacts_contact_id_contacts",
        "application_contacts",
        type_="foreignkey",
    )
    op.drop_column("application_contacts", "contact_id")
