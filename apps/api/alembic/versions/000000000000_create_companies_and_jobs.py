"""create companies and jobs tables

Revision ID: 000000000000
Revises:
Create Date: 2026-09-16

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "000000000000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("board_token", sa.String(length=255), nullable=True),
        sa.Column("careers_url", sa.String(length=500), nullable=True),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column(
            "source_type", sa.String(length=50), nullable=False, server_default="company_ats"
        ),
        sa.Column("external_job_id", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        # 597479... widens this from 255 to 500.
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("workplace_type", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("application_url", sa.String(length=1000), nullable=False),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("match_score", sa.Integer(), nullable=True),
        sa.Column("posted_at", sa.DateTime(), nullable=True),
        sa.Column(
            "first_seen_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "external_job_id", name="uq_source_external_job_id"),
    )


def downgrade() -> None:
    op.drop_table("jobs")
    op.drop_table("companies")
