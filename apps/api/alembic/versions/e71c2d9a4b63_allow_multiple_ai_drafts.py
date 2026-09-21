"""allow multiple interview ai drafts

Revision ID: e71c2d9a4b63
Revises: d53f2c9e8a14
Create Date: 2026-09-18 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e71c2d9a4b63"
down_revision: Union[str, None] = "d53f2c9e8a14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(
        "ix_ai_suggestions_pending_idempotency",
        table_name="ai_suggestions",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY interview_id, suggestion_type, input_snapshot_hash
                           ORDER BY created_at DESC, id DESC
                       ) AS row_number
                FROM ai_suggestions
                WHERE status = 'pending'
            )
            UPDATE ai_suggestions
            SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
            WHERE id IN (SELECT id FROM ranked WHERE row_number > 1)
            """
        )
    )
    op.create_index(
        "ix_ai_suggestions_pending_idempotency",
        "ai_suggestions",
        ["interview_id", "suggestion_type", "input_snapshot_hash"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
