"""create ai runs

Revision ID: f82a4c1d9e70
Revises: e71c2d9a4b63
Create Date: 2026-09-18 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f82a4c1d9e70"
down_revision: Union[str, None] = "e71c2d9a4b63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interview_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feature_name", sa.String(length=100), nullable=False),
        sa.Column("prompt_version", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("model", sa.String(length=150), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="started"),
        sa.Column("safe_error_code", sa.String(length=100), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
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
            "status IN ('started', 'succeeded', 'failed')",
            name="ck_ai_runs_status",
        ),
        sa.CheckConstraint(
            "duration_ms IS NULL OR duration_ms >= 0",
            name="ck_ai_runs_duration_ms_non_negative",
        ),
        sa.CheckConstraint(
            "input_tokens IS NULL OR input_tokens >= 0",
            name="ck_ai_runs_input_tokens_non_negative",
        ),
        sa.CheckConstraint(
            "output_tokens IS NULL OR output_tokens >= 0",
            name="ck_ai_runs_output_tokens_non_negative",
        ),
        sa.CheckConstraint(
            "total_tokens IS NULL OR total_tokens >= 0",
            name="ck_ai_runs_total_tokens_non_negative",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_runs_application_id", "ai_runs", ["application_id"])
    op.create_index("ix_ai_runs_interview_id", "ai_runs", ["interview_id"])
    op.create_index("ix_ai_runs_user_id", "ai_runs", ["user_id"])
    op.create_index(
        "ix_ai_runs_user_feature_created",
        "ai_runs",
        ["user_id", "feature_name", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_runs_user_feature_created", table_name="ai_runs")
    op.drop_index("ix_ai_runs_user_id", table_name="ai_runs")
    op.drop_index("ix_ai_runs_interview_id", table_name="ai_runs")
    op.drop_index("ix_ai_runs_application_id", table_name="ai_runs")
    op.drop_table("ai_runs")
