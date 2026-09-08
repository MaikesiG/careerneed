"""add user_id to resumes and applications, backfill with initial user

Revision ID: 85aa66758bfe
Revises: 216c5798b4dc
Create Date: 2026-09-08 09:57:05.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '85aa66758bfe'
down_revision: Union[str, None] = '216c5798b4dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INITIAL_USER_ID = uuid.uuid4()
INITIAL_USER_EMAIL = 'maikesig@outlook.com'


def upgrade() -> None:
    users_table = sa.table(
        'users',
        sa.column('id', postgresql.UUID(as_uuid=True)),
        sa.column('email', sa.String),
        sa.column('created_at', sa.DateTime),
    )
    op.execute(
        users_table.insert().values(
            id=INITIAL_USER_ID,
            email=INITIAL_USER_EMAIL,
            created_at=sa.func.now(),
        )
    )

    op.add_column('resumes', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('applications', sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True))

    op.execute(f"UPDATE resumes SET user_id = '{INITIAL_USER_ID}'")
    op.execute(f"UPDATE applications SET user_id = '{INITIAL_USER_ID}'")

    op.alter_column('resumes', 'user_id', nullable=False)
    op.alter_column('applications', 'user_id', nullable=False)

    op.create_foreign_key(
        'fk_resumes_user_id', 'resumes', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_applications_user_id', 'applications', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )

    op.create_index('ix_resumes_user_id', 'resumes', ['user_id'])
    op.create_index('ix_applications_user_id', 'applications', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_applications_user_id', table_name='applications')
    op.drop_index('ix_resumes_user_id', table_name='resumes')
    op.drop_constraint('fk_applications_user_id', 'applications', type_='foreignkey')
    op.drop_constraint('fk_resumes_user_id', 'resumes', type_='foreignkey')
    op.drop_column('applications', 'user_id')
    op.drop_column('resumes', 'user_id')
    op.execute(f"DELETE FROM users WHERE id = '{INITIAL_USER_ID}'")
