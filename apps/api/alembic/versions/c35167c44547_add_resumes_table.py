"""add resumes table

Revision ID: c35167c44547
Revises: 597479694a5c
Create Date: 2026-09-08 09:04:17.216068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c35167c44547'
down_revision: Union[str, None] = '597479694a5c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'resumes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('skills', sa.Text(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('resumes')
