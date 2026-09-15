"""create llm_credentials and usage_logs tables

Revision ID: d40f39961233
Revises: 85aa66758bfe
Create Date: 2026-09-08 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd40f39961233'
down_revision: Union[str, None] = '85aa66758bfe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'llm_credentials',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('encrypted_api_key', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'provider', name='uq_llm_credentials_user_provider'),
    )
    op.create_index('ix_llm_credentials_user_id', 'llm_credentials', ['user_id'])

    op.create_table(
        'usage_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_usage_logs_user_id', 'usage_logs', ['user_id'])
    op.create_index('ix_usage_logs_created_at', 'usage_logs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_usage_logs_created_at', table_name='usage_logs')
    op.drop_index('ix_usage_logs_user_id', table_name='usage_logs')
    op.drop_table('usage_logs')
    op.drop_index('ix_llm_credentials_user_id', table_name='llm_credentials')
    op.drop_table('llm_credentials')
