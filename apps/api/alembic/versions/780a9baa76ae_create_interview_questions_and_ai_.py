"""create interview questions and ai suggestions tables

Revision ID: 780a9baa76ae
Revises: adfa97fa8b79
Create Date: 2026-09-17 23:47:03.142756

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '780a9baa76ae'
down_revision: Union[str, None] = 'adfa97fa8b79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'interview_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='technical'),
        sa.Column('difficulty', sa.String(length=20), nullable=False, server_default='unknown'),
        sa.Column('answer_notes', sa.Text(), nullable=True),
        sa.Column('reflection', sa.Text(), nullable=True),
        sa.Column('leetcode_url', sa.String(length=500), nullable=True),
        sa.Column('asked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_interview_questions_interview_id'), 'interview_questions', ['interview_id'], unique=False)
    op.create_index('ix_interview_questions_interview_id_created_at', 'interview_questions', ['interview_id', 'created_at'], unique=False)

    op.create_table(
        'ai_suggestions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False, server_default='interview'),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('suggestion_type', sa.String(length=100), nullable=False),
        sa.Column('proposed_value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('rationale', sa.Text(), nullable=True),
        sa.Column('model_provider', sa.String(length=50), nullable=False),
        sa.Column('model_version', sa.String(length=150), nullable=False),
        sa.Column('prompt_version', sa.String(length=100), nullable=False),
        sa.Column('output_schema_version', sa.String(length=50), nullable=False),
        sa.Column('input_snapshot_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('resolved_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ai_suggestions_user_id'), 'ai_suggestions', ['user_id'], unique=False)
    op.create_index(op.f('ix_ai_suggestions_interview_id'), 'ai_suggestions', ['interview_id'], unique=False)
    op.create_index(op.f('ix_ai_suggestions_suggestion_type'), 'ai_suggestions', ['suggestion_type'], unique=False)
    op.create_index(op.f('ix_ai_suggestions_input_snapshot_hash'), 'ai_suggestions', ['input_snapshot_hash'], unique=False)
    op.create_index(op.f('ix_ai_suggestions_status'), 'ai_suggestions', ['status'], unique=False)
    op.create_index(
        'ix_ai_suggestions_user_interview_type_status_created',
        'ai_suggestions',
        ['user_id', 'interview_id', 'suggestion_type', 'status', 'created_at'],
        unique=False,
    )
    op.create_index(
        'ix_ai_suggestions_pending_idempotency',
        'ai_suggestions',
        ['interview_id', 'suggestion_type', 'input_snapshot_hash'],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index('ix_ai_suggestions_pending_idempotency', table_name='ai_suggestions')
    op.drop_index('ix_ai_suggestions_user_interview_type_status_created', table_name='ai_suggestions')
    op.drop_index(op.f('ix_ai_suggestions_status'), table_name='ai_suggestions')
    op.drop_index(op.f('ix_ai_suggestions_input_snapshot_hash'), table_name='ai_suggestions')
    op.drop_index(op.f('ix_ai_suggestions_suggestion_type'), table_name='ai_suggestions')
    op.drop_index(op.f('ix_ai_suggestions_interview_id'), table_name='ai_suggestions')
    op.drop_index(op.f('ix_ai_suggestions_user_id'), table_name='ai_suggestions')
    op.drop_table('ai_suggestions')

    op.drop_index('ix_interview_questions_interview_id_created_at', table_name='interview_questions')
    op.drop_index(op.f('ix_interview_questions_interview_id'), table_name='interview_questions')
    op.drop_table('interview_questions')
