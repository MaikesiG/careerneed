"""create follow ups

Revision ID: b31f0a7c2d9e
Revises: 780a9baa76ae
Create Date: 2026-09-18

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b31f0a7c2d9e"
down_revision: Union[str, None] = "780a9baa76ae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "follow_ups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interview_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_at_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timezone", sa.String(length=100), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "type IN ('thank_you', 'status_check', 'recruiter_reply', 'preparation', 'custom')",
            name="ck_follow_ups_type",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_follow_ups_user_id"), "follow_ups", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_follow_ups_application_id"), "follow_ups", ["application_id"], unique=False
    )
    op.create_index(
        op.f("ix_follow_ups_interview_id"), "follow_ups", ["interview_id"], unique=False
    )
    op.create_index(op.f("ix_follow_ups_due_at_utc"), "follow_ups", ["due_at_utc"], unique=False)
    op.create_index(
        "ix_follow_ups_application_due",
        "follow_ups",
        ["application_id", "due_at_utc"],
        unique=False,
    )
    op.create_index(
        "ix_follow_ups_application_interview",
        "follow_ups",
        ["application_id", "interview_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_follow_ups_application_interview", table_name="follow_ups")
    op.drop_index("ix_follow_ups_application_due", table_name="follow_ups")
    op.drop_index(op.f("ix_follow_ups_due_at_utc"), table_name="follow_ups")
    op.drop_index(op.f("ix_follow_ups_interview_id"), table_name="follow_ups")
    op.drop_index(op.f("ix_follow_ups_application_id"), table_name="follow_ups")
    op.drop_index(op.f("ix_follow_ups_user_id"), table_name="follow_ups")
    op.drop_table("follow_ups")
