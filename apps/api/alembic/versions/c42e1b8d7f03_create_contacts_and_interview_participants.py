"""create contacts and interview participants

Revision ID: c42e1b8d7f03
Revises: b31f0a7c2d9e
Create Date: 2026-09-18

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c42e1b8d7f03"
down_revision: Union[str, None] = "b31f0a7c2d9e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("linkedin_url", sa.String(length=1000), nullable=True),
        sa.Column("relationship_type", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "relationship_type IN ('recruiter', 'interviewer', 'hiring_manager', "
            "'referral', 'networking', 'other')",
            name="ck_contacts_relationship_type",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contacts_user_id"), "contacts", ["user_id"], unique=False)
    op.create_index(op.f("ix_contacts_company_id"), "contacts", ["company_id"], unique=False)

    op.create_table(
        "interview_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interview_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('interviewer', 'coordinator', 'observer')",
            name="ck_interview_participants_role",
        ),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "interview_id",
            "contact_id",
            name="uq_interview_participants_interview_contact",
        ),
    )
    op.create_index(
        op.f("ix_interview_participants_interview_id"),
        "interview_participants",
        ["interview_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_participants_contact_id"),
        "interview_participants",
        ["contact_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_interview_participants_contact_id"),
        table_name="interview_participants",
    )
    op.drop_index(
        op.f("ix_interview_participants_interview_id"),
        table_name="interview_participants",
    )
    op.drop_table("interview_participants")
    op.drop_index(op.f("ix_contacts_company_id"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_user_id"), table_name="contacts")
    op.drop_table("contacts")
