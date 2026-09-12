"""normalize workplace types

Revision ID: a1f41b7e0d8c
Revises: 8a1bb80dbe12
Create Date: 2026-09-11
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a1f41b7e0d8c"
down_revision: str | Sequence[str] | None = "8a1bb80dbe12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        UPDATE jobs
        SET workplace_type = CASE
            WHEN regexp_replace(lower(coalesce(workplace_type, '')), '[^a-z]', '', 'g')
                IN ('remote', 'fullyremote', 'distributed', 'remotefirst', 'workfromhome', 'wfh')
                THEN 'remote'
            WHEN regexp_replace(lower(coalesce(workplace_type, '')), '[^a-z]', '', 'g') = 'hybrid'
                THEN 'hybrid'
            WHEN regexp_replace(lower(coalesce(workplace_type, '')), '[^a-z]', '', 'g')
                IN ('onsite', 'inperson', 'inoffice', 'office')
                THEN 'onsite'
            ELSE 'unknown'
        END
        """)


def downgrade() -> None:
    # This data cleanup intentionally does not restore provider-specific labels.
    pass
