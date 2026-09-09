"""add unique application user job

Revision ID: d0065c2f9c04
Revises: d40f39961233
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op


revision: str = "d0065c2f9c04"
down_revision: str | Sequence[str] | None = "d40f39961233"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_applications_user_job",
        "applications",
        ["user_id", "job_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_applications_user_job",
        "applications",
        type_="unique",
    )
