"""alter resumes: add label, is_default, archived_at, source; drop is_current

Revision ID: 83d5bc62741d
Revises: c35167c44547
Create Date: 2026-09-08 09:16:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '83d5bc62741d'
down_revision: Union[str, None] = 'c35167c44547'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('resumes', sa.Column('label', sa.String(length=100), nullable=True))
    op.add_column('resumes', sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('resumes', sa.Column('archived_at', sa.DateTime(), nullable=True))
    op.add_column('resumes', sa.Column('source', sa.String(length=50), nullable=True))

    op.execute("UPDATE resumes SET is_default = is_current")

    op.drop_column('resumes', 'is_current')

    op.create_index('ix_resumes_is_default', 'resumes', ['is_default'])


def downgrade() -> None:
    op.drop_index('ix_resumes_is_default', table_name='resumes')
    op.add_column('resumes', sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("UPDATE resumes SET is_current = is_default")
    op.drop_column('resumes', 'source')
    op.drop_column('resumes', 'archived_at')
    op.drop_column('resumes', 'is_default')
    op.drop_column('resumes', 'label')
